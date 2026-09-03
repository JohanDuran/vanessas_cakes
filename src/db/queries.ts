import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, ne } from "drizzle-orm";
import { db } from "./index";
import { withDbRetry } from "./retry";
import {
  fields,
  fieldOptions,
  fieldOptionDimensions,
  designExcludedOptions,
  designFieldOrder,
  designHiddenFields,
  designLockedFields,
  designOptionPrices,
  designOptionSizePrices,
  designFieldPrices,
  designFieldSizePrices,
  designRequiredFields,
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
  orderItems,
  orderSelections,
  orderReferenceImages,
  profiles,
  cartItems,
  cartItemSelections,
  cartItemReferenceImages,
  siteSettings,
} from "./schema";
import { baseFieldRank, isCakeStyleKind, isDesignKind, isFieldType, isTierLevelCount, SIZE_FIELD_SLUG, type DesignKind, type FieldType } from "../lib/fields";
import { createSupabaseServerClient } from "../lib/supabase/server";
import { computeTotalCents, resolvePriceableFields, resolvePriceableOptions, type Answers } from "../lib/pricing";
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

/** Archives every order whose pickup date has already passed and isn't
 *  already archived, so a fulfilled/missed pickup stops showing as a "new"
 *  order needing attention — same auto-transition pattern as the order
 *  detail page's new->viewed flip on view. Orders with no pickup date (e.g.
 *  custom-cake quote requests) are left alone since there's no date to judge
 *  "past" by. Call this before reading orders in any admin orders view. */
export async function closePastPickupOrders(): Promise<void> {
  const todayKey = toDateKey(new Date());
  await withDbRetry(() =>
    db
      .update(orders)
      .set({ status: "archived" })
      .where(and(ne(orders.status, "archived"), isNotNull(orders.pickupDate), lt(orders.pickupDate, todayKey))),
  );
}

/** Everything the cart's pickup calendar needs to compute available
 *  dates/slots client-side, and everything submitCart needs to re-validate
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

  const [settingsRow, weeklyRows, overrideRows, orderCountRows] = await withDbRetry(() =>
    Promise.all([
      db.select().from(pickupSettings).limit(1).then((r) => r[0]),
      db.select().from(pickupWeeklyHours).then((r) => r),
      db.select().from(pickupDateOverrides).where(gte(pickupDateOverrides.endDate, todayKey)).then((r) => r),
      db
        .select({ pickupDate: orders.pickupDate, count: count() })
        .from(orders)
        // an order whose Stripe Checkout was never completed never actually
        // happened — don't let it hold a pickup slot hostage against the cap
        .where(and(gte(orders.pickupDate, todayKey), ne(orders.paymentStatus, "failed"), ne(orders.paymentStatus, "expired")))
        .groupBy(orders.pickupDate)
        .then((r) => r),
    ]),
  );

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

export type FeaturedDesignDTO = {
  id: number;
  name: string;
  description: string | null;
  /** the design's own default configuration, fully priced (see computeTotalCents) */
  priceCents: number;
  photo: string | null;
};

/** The admin's curated pick for the homepage hero carousel (designs.featured)
 *  — published only, since an unpublished design has no order page to link to.
 *  See setDesignFeatured in admin/(protected)/designs/actions.ts for the
 *  write side. */
export async function loadFeaturedDesigns(): Promise<FeaturedDesignDTO[]> {
  const featuredDesigns = await withDbRetry(() =>
    db
      .select()
      .from(designs)
      .where(and(eq(designs.featured, true), eq(designs.published, true)))
      .orderBy(asc(designs.featuredSortOrder), asc(designs.name))
      .then((r) => r),
  );

  if (featuredDesigns.length === 0) return [];

  const [photos, orderData] = await Promise.all([
    withDbRetry(() => db.select().from(designPhotos).orderBy(asc(designPhotos.sortOrder)).then((r) => r)),
    loadOrderData(),
  ]);
  const primaryPhotoByDesign = new Map<number, string>();
  for (const photo of photos) {
    if (photo.isPrimary || !primaryPhotoByDesign.has(photo.designId)) {
      primaryPhotoByDesign.set(photo.designId, photo.path);
    }
  }

  const summaryById = new Map(orderData.designSummaries.map((d) => [d.id, d]));
  const sizeField = orderData.fields.find((f) => f.slug === SIZE_FIELD_SLUG);

  return featuredDesigns.map((d) => {
    const summary = summaryById.get(d.id);
    let priceCents = 0;
    if (summary) {
      const sizeAnswer = sizeField ? summary.fieldValues[sizeField.id] : undefined;
      const currentSizeOptionId = sizeAnswer?.type === "options" ? sizeAnswer.optionIds[0] : undefined;
      priceCents = computeTotalCents(
        summary.fieldValues,
        resolvePriceableOptions(summary, orderData.options),
        resolvePriceableFields(
          summary,
          orderData.fields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents }))
        ),
        summary.perSizeFieldPrices,
        summary.optionSizePrices,
        currentSizeOptionId
      );
    }
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      priceCents,
      photo: primaryPhotoByDesign.get(d.id) ?? null,
    };
  });
}

export const DEFAULT_STORY_HEADING = "Baked from a tiny kitchen, made with a lot of heart";
export const DEFAULT_STORY_PARAGRAPH_1 =
  "Vanessa's cake started in 2013 in a cramped apartment kitchen with one oven and " +
  "a big dream: to make cakes that felt like a warm hug. What began with birthday " +
  "orders for neighbors has grown into a full pastel-colored studio — but every " +
  "cake is still mixed, layered, and frosted by hand.";
export const DEFAULT_STORY_PARAGRAPH_2 =
  "We believe dessert should be playful. That's why our cakes lean into soft " +
  "colors, whimsical toppings, and a signature pink donut on every box — a little " +
  "reminder to enjoy the sweeter side of life.";
export const DEFAULT_STORY_STATS: { label: string; value: string }[] = [
  { label: "Years Baking", value: "12+" },
  { label: "Cakes Delivered", value: "8,400+" },
];

export type StoryContentDTO = {
  heading: string;
  paragraph1: string;
  paragraph2: string;
  imagePath: string | null;
  stats: { label: string; value: string }[];
};

/** Homepage "Our Story" section content — editable from /admin/homepage
 *  (see updateStoryContent in that route's actions.ts for the write side).
 *  Null fields on the (at most one) site_settings row fall back to the
 *  copy that used to be hardcoded in StorySection.tsx. */
export async function loadStoryContent(): Promise<StoryContentDTO> {
  const row = await withDbRetry(() =>
    db
      .select({
        storyHeading: siteSettings.storyHeading,
        storyParagraph1: siteSettings.storyParagraph1,
        storyParagraph2: siteSettings.storyParagraph2,
        storyImagePath: siteSettings.storyImagePath,
        storyStat1Label: siteSettings.storyStat1Label,
        storyStat1Value: siteSettings.storyStat1Value,
        storyStat2Label: siteSettings.storyStat2Label,
        storyStat2Value: siteSettings.storyStat2Value,
      })
      .from(siteSettings)
      .limit(1)
      .then((r) => r[0]),
  );

  return {
    heading: row?.storyHeading || DEFAULT_STORY_HEADING,
    paragraph1: row?.storyParagraph1 || DEFAULT_STORY_PARAGRAPH_1,
    paragraph2: row?.storyParagraph2 || DEFAULT_STORY_PARAGRAPH_2,
    imagePath: row?.storyImagePath ?? null,
    stats: [
      { label: row?.storyStat1Label || DEFAULT_STORY_STATS[0].label, value: row?.storyStat1Value || DEFAULT_STORY_STATS[0].value },
      { label: row?.storyStat2Label || DEFAULT_STORY_STATS[1].label, value: row?.storyStat2Value || DEFAULT_STORY_STATS[1].value },
    ],
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
    allDesignOptionPriceRows,
    allDesignFieldPriceRows,
    allDesignFieldSizePriceRows,
    allDesignOptionSizePriceRows,
    allHiddenRows,
    allRequiredRows,
    allFieldOrderRows,
  ] = await withDbRetry(() =>
    Promise.all([
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
      db.select().from(designOptionPrices).then((r) => r),
      db.select().from(designFieldPrices).then((r) => r),
      db.select().from(designFieldSizePrices).then((r) => r),
      db.select().from(designOptionSizePrices).then((r) => r),
      db.select().from(designHiddenFields).then((r) => r),
      db.select().from(designRequiredFields).then((r) => r),
      db.select().from(designFieldOrder).then((r) => r),
    ]),
  );

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
        ? {
            diameterIn: d.diameterIn,
            widthIn: d.widthIn,
            lengthIn: d.lengthIn,
            shape: d.shape,
            tiers: d.tiers,
            servesMin: d.servesMin,
            servesMax: d.servesMax,
          }
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
        widthIn: mold?.dimensions?.widthIn ?? null,
        lengthIn: mold?.dimensions?.lengthIn ?? null,
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

  const optionPriceOverridesByDesign = new Map<number, Record<number, number>>();
  for (const row of allDesignOptionPriceRows) {
    const map = optionPriceOverridesByDesign.get(row.designId) ?? {};
    map[row.fieldOptionId] = row.priceCents;
    optionPriceOverridesByDesign.set(row.designId, map);
  }

  const fieldPriceOverridesByDesign = new Map<number, Record<number, number>>();
  for (const row of allDesignFieldPriceRows) {
    const map = fieldPriceOverridesByDesign.get(row.designId) ?? {};
    map[row.fieldId] = row.priceCents;
    fieldPriceOverridesByDesign.set(row.designId, map);
  }

  const perSizeFieldPricesByDesign = new Map<number, Record<number, Record<number, number>>>();
  for (const row of allDesignFieldSizePriceRows) {
    const byField = perSizeFieldPricesByDesign.get(row.designId) ?? {};
    const bySize = byField[row.fieldId] ?? {};
    bySize[row.sizeOptionId] = row.priceCents;
    byField[row.fieldId] = bySize;
    perSizeFieldPricesByDesign.set(row.designId, byField);
  }

  const optionSizePricesByDesign = new Map<number, Record<number, Record<number, number>>>();
  for (const row of allDesignOptionSizePriceRows) {
    const byOption = optionSizePricesByDesign.get(row.designId) ?? {};
    const bySize = byOption[row.fieldOptionId] ?? {};
    bySize[row.sizeOptionId] = row.priceCents;
    byOption[row.fieldOptionId] = bySize;
    optionSizePricesByDesign.set(row.designId, byOption);
  }

  const hiddenByDesign = new Map<number, number[]>();
  for (const row of allHiddenRows) {
    const list = hiddenByDesign.get(row.designId) ?? [];
    list.push(row.fieldId);
    hiddenByDesign.set(row.designId, list);
  }

  const requiredByDesign = new Map<number, number[]>();
  for (const row of allRequiredRows) {
    const list = requiredByDesign.get(row.designId) ?? [];
    list.push(row.fieldId);
    requiredByDesign.set(row.designId, list);
  }

  // this design's own field display order, if it's ever been saved through
  // the admin's field reorder — see design_field_order and DesignForm
  const fieldOrderByDesign = new Map<number, Map<number, number>>();
  for (const row of allFieldOrderRows) {
    const map = fieldOrderByDesign.get(row.designId) ?? new Map<number, number>();
    map.set(row.fieldId, row.sortOrder);
    fieldOrderByDesign.set(row.designId, map);
  }
  // fallback for a design with no rows in design_field_order at all (never
  // reordered) — same canonical order the customer would've seen before this
  // feature existed
  const canonicalFieldIndex = new Map(fieldSummaries.map((f, i) => [f.id, i]));

  const designSummaries: DesignSummaryDTO[] = publishedDesigns.map((d) => {
    const orderMap = fieldOrderByDesign.get(d.id);
    const includedFieldIds = Array.from(includedFieldIdsByDesign.get(d.id) ?? []);
    if (orderMap && orderMap.size > 0) {
      includedFieldIds.sort(
        (a, b) => (orderMap.get(a) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b) ?? Number.MAX_SAFE_INTEGER)
      );
    } else {
      includedFieldIds.sort((a, b) => (canonicalFieldIndex.get(a) ?? 0) - (canonicalFieldIndex.get(b) ?? 0));
    }
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      kind: isDesignKind(d.kind) ? d.kind : "catalog",
      photos: photosByDesign.get(d.id) ?? [],
      fieldValues: fieldValuesByDesign.get(d.id) ?? {},
      lockedFieldIds: lockedByDesign.get(d.id) ?? [],
      hiddenFieldIds: hiddenByDesign.get(d.id) ?? [],
      requiredFieldIds: requiredByDesign.get(d.id) ?? [],
      excludedOptionIds: excludedByDesign.get(d.id) ?? [],
      categoryIds: categoryIdsByDesign.get(d.id) ?? [],
      includedFieldIds,
      optionPriceOverrides: optionPriceOverridesByDesign.get(d.id) ?? {},
      fieldPriceOverrides: fieldPriceOverridesByDesign.get(d.id) ?? {},
      perSizeFieldPrices: perSizeFieldPricesByDesign.get(d.id) ?? {},
      optionSizePrices: optionSizePricesByDesign.get(d.id) ?? {},
    };
  });

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

export type OrderItemDetailDTO = {
  id: number;
  designId: number;
  designName: string;
  /** catalog | custom | custom_portfolio — see DesignKind. A quote item is
   *  designKind !== "catalog", not designId == null. */
  designKind: DesignKind;
  priceCents: number;
  selections: {
    fieldId: number;
    fieldSlug: string;
    fieldName: string;
    labelSnapshot: string;
    priceCentsSnapshot: number;
  }[];
  referenceImagePaths: string[];
};

/** One checkout with every cake in it, fully expanded for display — used by
 *  the admin order detail page (looked up by id, which is fine there since
 *  that page is admin-only) and the thank-you page (looked up by
 *  confirmationToken instead — see loadOrderWithItemsByToken — since the
 *  sequential id must never be exposed to an unauthenticated lookup).
 *  Returns null if no matching order exists. */
export async function loadOrderWithItems(orderId: number) {
  const order = await withDbRetry(() => db.select().from(orders).where(eq(orders.id, orderId)).then((r) => r[0]));
  return order ? loadOrderItemDetails(order) : null;
}

/** Same as loadOrderWithItems, but looked up by the order's unguessable
 *  confirmationToken instead of its sequential id — the only lookup safe to
 *  expose on the public, unauthenticated /order/thank-you page. */
export async function loadOrderWithItemsByToken(token: string) {
  const order = await withDbRetry(() =>
    db.select().from(orders).where(eq(orders.confirmationToken, token)).then((r) => r[0]),
  );
  return order ? loadOrderItemDetails(order) : null;
}

async function loadOrderItemDetails(order: typeof orders.$inferSelect) {
  const orderId = order.id;
  const items = await withDbRetry(() =>
    db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.sortOrder)),
  );
  const itemIds = items.map((i) => i.id);

  const [selections, referenceImages, allFieldRows, designRows] = await withDbRetry(() =>
    Promise.all([
      itemIds.length > 0
        ? db.select().from(orderSelections).where(inArray(orderSelections.orderItemId, itemIds)).then((r) => r)
        : Promise.resolve([]),
      itemIds.length > 0
        ? db
            .select()
            .from(orderReferenceImages)
            .where(inArray(orderReferenceImages.orderItemId, itemIds))
            .then((r) => r)
        : Promise.resolve([]),
      db.select().from(fields).then((r) => r),
      db.select().from(designs).then((r) => r),
    ]),
  );

  const fieldById = new Map(allFieldRows.map((f) => [f.id, f]));
  const designById = new Map(designRows.map((d) => [d.id, d]));

  const itemDetails: OrderItemDetailDTO[] = items.map((item) => {
    const itemDesign = designById.get(item.designId);
    return {
    id: item.id,
    designId: item.designId,
    designName: itemDesign?.name ?? "Unknown design",
    designKind: itemDesign && isDesignKind(itemDesign.kind) ? itemDesign.kind : "catalog",
    priceCents: item.priceCents,
    selections: selections
      .filter((s) => s.orderItemId === item.id)
      .map((s) => ({
        fieldId: s.fieldId,
        fieldSlug: fieldById.get(s.fieldId)?.slug ?? "",
        fieldName: fieldById.get(s.fieldId)?.name ?? "Unknown field",
        labelSnapshot: s.labelSnapshot,
        priceCentsSnapshot: s.priceCentsSnapshot,
      })),
    referenceImagePaths: referenceImages.filter((img) => img.orderItemId === item.id).map((img) => img.path),
    };
  });

  return { order, items: itemDetails };
}

export type CurrentUserDTO = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isAdmin: boolean;
  marketingOptIn: boolean;
};

/** The logged-in user for this request, or null if there's no valid
 *  Supabase Auth session — this is for using the identity within a
 *  page/action; proxy.ts does its own separate check for route protection.
 *  Covers both customers and admins — isAdmin is just a flag on the row. */
export async function getCurrentUser(): Promise<CurrentUserDTO | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const profile = await withDbRetry(() => db.select().from(profiles).where(eq(profiles.id, authUser.id)).then((r) => r[0]));
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    isAdmin: profile.isAdmin,
    marketingOptIn: profile.marketingOptIn,
  };
}

/** Guards an admin Server Action. proxy.ts already blocks page navigation to
 *  /admin for non-admins, but Server Actions are reachable directly by
 *  anyone who can send the matching POST regardless of the page they're
 *  "on" — so every admin action must independently re-check this itself
 *  rather than trusting proxy.ts alone. Throws (not redirects) since actions
 *  either propagate the error to their own try/catch + toastRedirect, or,
 *  for actions with no try/catch, are only ever reachable this way through a
 *  forged request. */
export async function requireAdmin(): Promise<CurrentUserDTO> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new Error("Not authorized.");
  return user;
}

export type CartItemDTO = {
  id: number;
  /** always points at a design — catalog or one of the two singleton
   *  quote-kind designs; callers cross-reference designSummaries/`designs`
   *  for `kind` to tell a quote item from a catalog one. */
  designId: number;
  answers: Answers;
  /** already-uploaded reference photos for a custom-cake item, primary
   *  first — carried through to order_reference_images at checkout instead
   *  of being re-uploaded (see submitCart). */
  referenceImagePaths: string[];
};

/** A logged-in customer's saved cart, in wizard-answer shape — the DB-backed
 *  counterpart to CartContext's in-memory guest cart. Empty for anyone who
 *  isn't signed in (guests never get rows here). */
export async function getCartItemsForUser(userId: string): Promise<CartItemDTO[]> {
  const items = await withDbRetry(() =>
    db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(asc(cartItems.sortOrder), asc(cartItems.id)),
  );
  if (items.length === 0) return [];

  const itemIds = items.map((i) => i.id);
  const selections = await withDbRetry(() =>
    db
      .select()
      .from(cartItemSelections)
      .where(inArray(cartItemSelections.cartItemId, itemIds)),
  );
  const images = await withDbRetry(() =>
    db
      .select()
      .from(cartItemReferenceImages)
      .where(inArray(cartItemReferenceImages.cartItemId, itemIds))
      .orderBy(asc(cartItemReferenceImages.sortOrder)),
  );

  return items.map((item) => {
    const answers: Answers = {};
    for (const sel of selections) {
      if (sel.cartItemId !== item.id) continue;
      if (sel.fieldOptionId != null) {
        const existing = answers[sel.fieldId];
        if (existing?.type === "options") existing.optionIds.push(sel.fieldOptionId);
        else answers[sel.fieldId] = { type: "options", optionIds: [sel.fieldOptionId] };
      } else if (sel.textValue != null) {
        answers[sel.fieldId] = { type: "text", value: sel.textValue };
      } else if (sel.numberValue != null) {
        answers[sel.fieldId] = { type: "number", value: sel.numberValue };
      } else if (sel.booleanValue != null) {
        answers[sel.fieldId] = { type: "toggle", value: sel.booleanValue };
      }
    }

    return {
      id: item.id,
      designId: item.designId,
      answers,
      referenceImagePaths: images.filter((im) => im.cartItemId === item.id).map((im) => im.path),
    };
  });
}

export type UserSummaryDTO = { id: string; name: string; email: string; isAdmin: boolean; createdAt: number };

/** Every registered account, for the admin section's Admins page — lets an
 *  admin grant or revoke admin access on any user. */
export async function loadAllUsers(): Promise<UserSummaryDTO[]> {
  return withDbRetry(() => db.select().from(profiles).orderBy(asc(profiles.name)));
}

export type OrderSummaryDTO = {
  id: number;
  createdAt: number;
  totalPriceCents: number;
  status: string;
  pickupDate: string | null;
  pickupTime: string | null;
  cakeNames: string[];
};

/** Order history for a logged-in customer's account page — newest first. */
export async function loadOrdersForUser(userId: string): Promise<OrderSummaryDTO[]> {
  const userOrders = await withDbRetry(() =>
    db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt)),
  );
  if (userOrders.length === 0) return [];

  const orderIds = userOrders.map((o) => o.id);
  const items = await withDbRetry(() => db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)));
  const designIds = items.map((i) => i.designId).filter((id): id is number => id != null);
  const designRows =
    designIds.length > 0 ? await withDbRetry(() => db.select().from(designs).where(inArray(designs.id, designIds))) : [];
  const designNameById = new Map(designRows.map((d) => [d.id, d.name]));

  return userOrders.map((order) => ({
    id: order.id,
    createdAt: order.createdAt,
    totalPriceCents: order.totalPriceCents,
    status: order.status,
    pickupDate: order.pickupDate,
    pickupTime: order.pickupTime,
    cakeNames: items
      .filter((i) => i.orderId === order.id)
      .map((i) => (i.designId ? (designNameById.get(i.designId) ?? "Unknown design") : "Custom Cake Quote")),
  }));
}
