import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
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
  orderItems,
  orderSelections,
  orderReferenceImages,
  users,
  cartItems,
  cartItemSelections,
  cartItemReferenceImages,
  designReviews,
} from "./schema";
import { baseFieldRank, isCakeStyleKind, isFieldType, isTierLevelCount, type FieldType } from "../lib/fields";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "../lib/auth";
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

/** Archives every order whose pickup date has already passed and isn't
 *  already archived, so a fulfilled/missed pickup stops showing as a "new"
 *  order needing attention — same auto-transition pattern as the order
 *  detail page's new->viewed flip on view. Orders with no pickup date (e.g.
 *  custom-cake quote requests) are left alone since there's no date to judge
 *  "past" by. Call this before reading orders in any admin orders view. */
export function closePastPickupOrders(): void {
  const todayKey = toDateKey(new Date());
  db.update(orders)
    .set({ status: "archived" })
    .where(and(ne(orders.status, "archived"), isNotNull(orders.pickupDate), lt(orders.pickupDate, todayKey)))
    .run();
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

export type FeaturedDesignDTO = {
  id: number;
  name: string;
  description: string | null;
  chargedPriceCents: number;
  photo: string | null;
};

/** The admin's curated pick for the homepage hero carousel (designs.featured)
 *  — published only, since an unpublished design has no order page to link to.
 *  See setDesignFeatured in admin/(protected)/designs/actions.ts for the
 *  write side. */
export async function loadFeaturedDesigns(): Promise<FeaturedDesignDTO[]> {
  const featuredDesigns = await db
    .select()
    .from(designs)
    .where(and(eq(designs.featured, true), eq(designs.published, true)))
    .orderBy(asc(designs.featuredSortOrder), asc(designs.name))
    .then((r) => r);

  if (featuredDesigns.length === 0) return [];

  const photos = await db.select().from(designPhotos).orderBy(asc(designPhotos.sortOrder)).then((r) => r);
  const primaryPhotoByDesign = new Map<number, string>();
  for (const photo of photos) {
    if (photo.isPrimary || !primaryPhotoByDesign.has(photo.designId)) {
      primaryPhotoByDesign.set(photo.designId, photo.path);
    }
  }

  return featuredDesigns.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    chargedPriceCents: d.chargedPriceCents,
    photo: primaryPhotoByDesign.get(d.id) ?? null,
  }));
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

export type OrderItemDetailDTO = {
  id: number;
  designId: number | null;
  designName: string | null;
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
 *  the admin order detail page and the thank-you page. Returns null if no
 *  order with this id exists. */
export async function loadOrderWithItems(orderId: number) {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return null;

  const items = db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.sortOrder))
    .all();
  const itemIds = items.map((i) => i.id);

  const [selections, referenceImages, allFieldRows, designRows] = await Promise.all([
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
  ]);

  const fieldById = new Map(allFieldRows.map((f) => [f.id, f]));
  const designById = new Map(designRows.map((d) => [d.id, d]));

  const itemDetails: OrderItemDetailDTO[] = items.map((item) => ({
    id: item.id,
    designId: item.designId,
    designName: item.designId ? (designById.get(item.designId)?.name ?? "Unknown design") : null,
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
  }));

  return { order, items: itemDetails };
}

export type CurrentUserDTO = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  isAdmin: boolean;
  marketingOptIn: boolean;
};

/** The logged-in user for this request, or null if there's no valid
 *  session — reads the same signed cookie proxy.ts checks for route
 *  protection, but this is for using the identity within a page/action.
 *  Covers both customers and admins — isAdmin is just a flag on the row. */
export async function getCurrentUser(): Promise<CurrentUserDTO | null> {
  const store = await cookies();
  const userId = await verifyUserSessionToken(store.get(USER_SESSION_COOKIE)?.value);
  if (userId == null) return null;

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isAdmin: user.isAdmin,
    marketingOptIn: user.marketingOptIn,
  };
}

export type CartItemDTO = {
  id: number;
  designId: number | null;
  isCustom: boolean;
  answers: Answers;
  /** already-uploaded reference photos for a custom-cake item, primary
   *  first — carried through to order_reference_images at checkout instead
   *  of being re-uploaded (see submitCart). */
  referenceImagePaths: string[];
};

/** A logged-in customer's saved cart, in wizard-answer shape — the DB-backed
 *  counterpart to CartContext's in-memory guest cart. Empty for anyone who
 *  isn't signed in (guests never get rows here). */
export async function getCartItemsForUser(userId: number): Promise<CartItemDTO[]> {
  const items = db
    .select()
    .from(cartItems)
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(cartItems.sortOrder), asc(cartItems.id))
    .all();
  if (items.length === 0) return [];

  const itemIds = items.map((i) => i.id);
  const selections = db
    .select()
    .from(cartItemSelections)
    .where(inArray(cartItemSelections.cartItemId, itemIds))
    .all();
  const images = db
    .select()
    .from(cartItemReferenceImages)
    .where(inArray(cartItemReferenceImages.cartItemId, itemIds))
    .orderBy(asc(cartItemReferenceImages.sortOrder))
    .all();

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
      }
    }

    return {
      id: item.id,
      designId: item.designId,
      isCustom: item.isCustom,
      answers,
      referenceImagePaths: images.filter((im) => im.cartItemId === item.id).map((im) => im.path),
    };
  });
}

export type UserSummaryDTO = { id: number; name: string; email: string; isAdmin: boolean; createdAt: number };

/** Every registered account, for the admin section's Admins page — lets an
 *  admin grant or revoke admin access on any user. */
export async function loadAllUsers(): Promise<UserSummaryDTO[]> {
  return db.select().from(users).orderBy(asc(users.name)).all();
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
export async function loadOrdersForUser(userId: number): Promise<OrderSummaryDTO[]> {
  const userOrders = db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .all();
  if (userOrders.length === 0) return [];

  const orderIds = userOrders.map((o) => o.id);
  const items = db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).all();
  const designIds = items.map((i) => i.designId).filter((id): id is number => id != null);
  const designRows =
    designIds.length > 0 ? db.select().from(designs).where(inArray(designs.id, designIds)).all() : [];
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

export type ReviewDTO = {
  id: number;
  designId: number;
  userId: number;
  userName: string;
  rating: number;
  comment: string | null;
  adminReply: string | null;
  adminReplyAt: number | null;
  createdAt: number;
};

/** All reviews for one design's public page, newest first, with the
 *  reviewer's current display name joined in — the review row itself never
 *  stores a name snapshot, it's read live off users.name. */
export async function loadReviewsForDesign(designId: number): Promise<ReviewDTO[]> {
  const rows = await db
    .select({
      id: designReviews.id,
      designId: designReviews.designId,
      userId: designReviews.userId,
      userName: users.name,
      rating: designReviews.rating,
      comment: designReviews.comment,
      adminReply: designReviews.adminReply,
      adminReplyAt: designReviews.adminReplyAt,
      createdAt: designReviews.createdAt,
    })
    .from(designReviews)
    .innerJoin(users, eq(designReviews.userId, users.id))
    .where(eq(designReviews.designId, designId))
    .orderBy(desc(designReviews.createdAt))
    .then((r) => r);
  return rows;
}

export type AdminReviewDTO = ReviewDTO & { userEmail: string; designName: string };

/** Every review across every design, for the admin section's Reviews page —
 *  newest first so unanswered reviews naturally surface near the top. */
export async function loadAllReviewsForAdmin(): Promise<AdminReviewDTO[]> {
  const rows = await db
    .select({
      id: designReviews.id,
      designId: designReviews.designId,
      userId: designReviews.userId,
      userName: users.name,
      userEmail: users.email,
      designName: designs.name,
      rating: designReviews.rating,
      comment: designReviews.comment,
      adminReply: designReviews.adminReply,
      adminReplyAt: designReviews.adminReplyAt,
      createdAt: designReviews.createdAt,
    })
    .from(designReviews)
    .innerJoin(users, eq(designReviews.userId, users.id))
    .innerJoin(designs, eq(designReviews.designId, designs.id))
    .orderBy(desc(designReviews.createdAt))
    .then((r) => r);
  return rows;
}
