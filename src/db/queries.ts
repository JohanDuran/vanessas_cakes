import { asc, count, eq, gte } from "drizzle-orm";
import { db } from "./index";
import {
  fields,
  fieldOptions,
  fieldOptionDimensions,
  designExcludedOptions,
  designLockedFields,
  designPhotos,
  designFieldValues,
  designCategories,
  cakeCategories,
  designs,
  constraintPairs,
  tierPresets,
  tierPresetLevels,
  pickupSettings,
  pickupWeeklyHours,
  pickupDateOverrides,
  orders,
} from "./schema";
import { baseFieldRank, isCakeStyleKind, isFieldType, isTierLevelCount, type FieldType } from "../lib/fields";
import type { Answers } from "../lib/pricing";
import type {
  CategoryDTO,
  DesignSummaryDTO,
  FieldDTO,
  FieldOptionDTO,
  TierPresetDTO,
  TierPresetLevelDTO,
} from "../lib/order-types";
import { toDateKey, type DateOverride, type PickupSettings, type WeeklyHour } from "../lib/availability";

export const DEFAULT_PICKUP_SETTINGS: PickupSettings = {
  leadTimeHours: 24,
  maxAdvanceDays: 60,
  slotIntervalMinutes: 30,
  maxOrdersPerDay: null,
};

/** Everything the order wizard's pickup calendar needs to compute available
 *  dates/slots client-side, and everything submitOrder needs to re-validate
 *  a submitted slot server-side. Weekly hours always has all 7 days (closed
 *  default for any day the admin hasn't configured yet); overrides are
 *  limited to today-or-later since past ones can no longer affect booking.
 *  orderCountsByDate only covers today-or-later dates too, since that's all
 *  the max-orders-per-day cap can affect. */
export async function loadPickupAvailability(): Promise<{
  settings: PickupSettings;
  weeklyHours: WeeklyHour[];
  overrides: DateOverride[];
  orderCountsByDate: Record<string, number>;
}> {
  const todayKey = toDateKey(new Date());

  const [settingsRow, weeklyRows, overrideRows, orderCountRows] = await Promise.all([
    db.select().from(pickupSettings).limit(1).then((r) => r[0]),
    db.select().from(pickupWeeklyHours).then((r) => r),
    db.select().from(pickupDateOverrides).where(gte(pickupDateOverrides.endDate, todayKey)).then((r) => r),
    db
      .select({ pickupDate: orders.pickupDate, count: count() })
      .from(orders)
      .where(gte(orders.pickupDate, todayKey))
      .groupBy(orders.pickupDate)
      .then((r) => r),
  ]);

  const orderCountsByDate: Record<string, number> = {};
  for (const row of orderCountRows) {
    if (row.pickupDate) orderCountsByDate[row.pickupDate] = row.count;
  }

  const weeklyByDay = new Map(weeklyRows.map((w) => [w.dayOfWeek, w]));
  const weeklyHours: WeeklyHour[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const row = weeklyByDay.get(dayOfWeek);
    return {
      dayOfWeek,
      isOpen: row?.isOpen ?? false,
      openTime: row?.openTime ?? null,
      closeTime: row?.closeTime ?? null,
    };
  });

  const overrides: DateOverride[] = overrideRows.map((o) => ({
    startDate: o.startDate,
    endDate: o.endDate,
    closed: o.closed,
    openTime: o.openTime,
    closeTime: o.closeTime,
    note: o.note,
  }));

  return {
    settings: settingsRow
      ? {
          leadTimeHours: settingsRow.leadTimeHours,
          maxAdvanceDays: settingsRow.maxAdvanceDays,
          slotIntervalMinutes: settingsRow.slotIntervalMinutes,
          maxOrdersPerDay: settingsRow.maxOrdersPerDay,
        }
      : DEFAULT_PICKUP_SETTINGS,
    weeklyHours,
    overrides,
    orderCountsByDate,
  };
}

/** Everything the customer-facing order flow (wizard + gallery) needs:
 *  active fields + options (base and custom, unified), published designs
 *  (with their default answers, locks, and exclusions), and constraint pairs. */
export async function loadOrderData() {
  const [
    allFields,
    allOptions,
    allDimensionRows,
    publishedDesigns,
    allPhotos,
    allFieldValueRows,
    pairs,
    allLockedRows,
    allExcludedRows,
    allTierPresetRows,
    allTierPresetLevelRows,
    activeCategories,
    allDesignCategoryRows,
  ] = await Promise.all([
    db.select().from(fields).where(eq(fields.active, true)).then((r) => r),
    db.select().from(fieldOptions).where(eq(fieldOptions.active, true)).then((r) => r),
    db.select().from(fieldOptionDimensions).then((r) => r),
    db.select().from(designs).where(eq(designs.published, true)).then((r) => r),
    db
      .select()
      .from(designPhotos)
      .orderBy(asc(designPhotos.sortOrder))
      .then((r) => r),
    db.select().from(designFieldValues).then((r) => r),
    db.select().from(constraintPairs).then((r) => r),
    db.select().from(designLockedFields).then((r) => r),
    db.select().from(designExcludedOptions).then((r) => r),
    db.select().from(tierPresets).then((r) => r),
    db.select().from(tierPresetLevels).orderBy(asc(tierPresetLevels.position)).then((r) => r),
    db
      .select()
      .from(cakeCategories)
      .where(eq(cakeCategories.active, true))
      .orderBy(asc(cakeCategories.sortOrder), asc(cakeCategories.name))
      .then((r) => r),
    db.select().from(designCategories).then((r) => r),
  ]);

  const fieldSummaries: FieldDTO[] = allFields
    .filter((f) => isFieldType(f.type))
    .map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      type: f.type as FieldType,
      isBase: f.isBase,
      sortOrder: f.sortOrder,
      hasShapeDiagram: f.hasShapeDiagram,
      required: f.required,
      additionalPriceCents: f.additionalPriceCents,
    }))
    .sort((a, b) => {
      const rankDiff = baseFieldRank(a.slug) - baseFieldRank(b.slug);
      if (rankDiff !== 0) return rankDiff;
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    });

  const dimsByOptionId = new Map(allDimensionRows.map((d) => [d.fieldOptionId, d]));

  const optionSummaries: FieldOptionDTO[] = allOptions.map((o) => {
    const d = dimsByOptionId.get(o.id);
    return {
      id: o.id,
      fieldId: o.fieldId,
      name: o.name,
      priceCents: o.priceCents,
      dimensions: d
        ? { diameterIn: d.diameterIn, shape: d.shape, tiers: d.tiers, servesMin: d.servesMin, servesMax: d.servesMax }
        : null,
      styleKind: o.styleKind != null && isCakeStyleKind(o.styleKind) ? o.styleKind : null,
      tierLevelCount: o.tierLevelCount != null && isTierLevelCount(o.tierLevelCount) ? o.tierLevelCount : null,
    };
  });

  const optionById = new Map(optionSummaries.map((o) => [o.id, o]));
  const levelsByPresetId = new Map<number, typeof allTierPresetLevelRows>();
  for (const row of allTierPresetLevelRows) {
    const list = levelsByPresetId.get(row.tierPresetId) ?? [];
    list.push(row);
    levelsByPresetId.set(row.tierPresetId, list);
  }

  const tierPresetDTOs: TierPresetDTO[] = allTierPresetRows.map((preset) => {
    const levels: TierPresetLevelDTO[] = (levelsByPresetId.get(preset.id) ?? []).map((lvl) => {
      const mold = optionById.get(lvl.moldOptionId);
      return {
        position: lvl.position,
        moldOptionId: lvl.moldOptionId,
        moldName: mold?.name ?? "Unknown",
        diameterIn: mold?.dimensions?.diameterIn ?? null,
        shape: mold?.dimensions?.shape ?? null,
        servesMin: mold?.dimensions?.servesMin ?? null,
        servesMax: mold?.dimensions?.servesMax ?? null,
      };
    });
    return { fieldOptionId: preset.fieldOptionId, levelCount: preset.levelCount, levels };
  });

  const photosByDesign = new Map<number, string[]>();
  for (const photo of allPhotos) {
    const list = photosByDesign.get(photo.designId) ?? [];
    if (photo.isPrimary) list.unshift(photo.path);
    else list.push(photo.path);
    photosByDesign.set(photo.designId, list);
  }

  const fieldValuesByDesign = new Map<number, Answers>();
  for (const row of allFieldValueRows) {
    const answers = fieldValuesByDesign.get(row.designId) ?? {};
    if (row.fieldOptionId != null) {
      const existing = answers[row.fieldId];
      if (existing?.type === "options") existing.optionIds.push(row.fieldOptionId);
      else answers[row.fieldId] = { type: "options", optionIds: [row.fieldOptionId] };
    } else if (row.textValue != null) {
      answers[row.fieldId] = { type: "text", value: row.textValue };
    } else if (row.numberValue != null) {
      answers[row.fieldId] = { type: "number", value: row.numberValue };
    }
    fieldValuesByDesign.set(row.designId, answers);
  }

  // inclusion is having ANY row here, value or not — distinct from
  // fieldValuesByDesign above, since a custom field can be included with no
  // default answer (admin may leave a required field's default empty)
  const includedFieldIdsByDesign = new Map<number, Set<number>>();
  for (const row of allFieldValueRows) {
    const set = includedFieldIdsByDesign.get(row.designId) ?? new Set<number>();
    set.add(row.fieldId);
    includedFieldIdsByDesign.set(row.designId, set);
  }

  const lockedByDesign = new Map<number, number[]>();
  for (const row of allLockedRows) {
    const list = lockedByDesign.get(row.designId) ?? [];
    list.push(row.fieldId);
    lockedByDesign.set(row.designId, list);
  }

  const excludedByDesign = new Map<number, number[]>();
  for (const row of allExcludedRows) {
    const list = excludedByDesign.get(row.designId) ?? [];
    list.push(row.fieldOptionId);
    excludedByDesign.set(row.designId, list);
  }

  const categoryIdsByDesign = new Map<number, number[]>();
  for (const row of allDesignCategoryRows) {
    const list = categoryIdsByDesign.get(row.designId) ?? [];
    list.push(row.categoryId);
    categoryIdsByDesign.set(row.designId, list);
  }

  const designSummaries: DesignSummaryDTO[] = publishedDesigns.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    chargedPriceCents: d.chargedPriceCents,
    premiumCents: d.premiumCents,
    photos: photosByDesign.get(d.id) ?? [],
    fieldValues: fieldValuesByDesign.get(d.id) ?? {},
    lockedFieldIds: lockedByDesign.get(d.id) ?? [],
    excludedOptionIds: excludedByDesign.get(d.id) ?? [],
    categoryIds: categoryIdsByDesign.get(d.id) ?? [],
    includedFieldIds: Array.from(includedFieldIdsByDesign.get(d.id) ?? []),
  }));

  const constraintPairsDTO = pairs.map((p) => ({ optionAId: p.optionAId, optionBId: p.optionBId }));

  const categories: CategoryDTO[] = activeCategories.map((c) => ({ id: c.id, name: c.name }));

  return {
    fields: fieldSummaries,
    options: optionSummaries,
    designSummaries,
    constraintPairsDTO,
    tierPresets: tierPresetDTOs,
    categories,
  };
}
