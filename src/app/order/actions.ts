"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import {
  constraintPairs,
  designExcludedOptions,
  designFieldValues,
  designFieldPrices,
  designFieldSizePrices,
  designHiddenFields,
  designLockedFields,
  designOptionPrices,
  designOptionSizePrices,
  designRequiredFields,
  designs,
  fieldOptions,
  fields,
  orderReferenceImages,
  orderSelections,
  orders,
  orderItems,
  tierPresets as tierPresetsTable,
  tierPresetLevels,
  cartItems,
  cartItemReferenceImages,
} from "../../db/schema";
import { getCurrentUser, loadPickupAvailability } from "../../db/queries";
import { selectionsViolateConstraints } from "../../lib/constraints";
import { buildCakeStyleContext } from "../../lib/cakeStyle";
import {
  buildDesignPriceOverrides,
  computeTotalCents,
  resolvePriceableFields,
  resolvePriceableOptions,
  type Answers,
  type DesignPriceOverrides,
} from "../../lib/pricing";
import { isSlotAvailable } from "../../lib/availability";
import { isCakeStyleKind, isFieldType, isTierLevelCount, type FieldType } from "../../lib/fields";
import { saveUploadedPhoto } from "../../lib/uploads";
import { createCheckoutSessionForOrder } from "../../lib/payments";
import type { FieldDTO, FieldOptionDTO, TierPresetDTO } from "../../lib/order-types";

const answerSchema = z.union([
  z.object({ type: z.literal("options"), optionIds: z.array(z.number()) }),
  z.object({ type: z.literal("text"), value: z.string() }),
  z.object({ type: z.literal("number"), value: z.number() }),
  z.object({ type: z.literal("toggle"), value: z.boolean() }),
]);

const cartItemSchema = z.object({
  clientId: z.string().min(1),
  designId: z.number(),
  answers: z.record(z.string(), answerSchema),
  // set when this item was already persisted to the customer's DB cart
  // (see src/lib/cart/dbActions.ts) — its reference images, if any, already
  // live on disk and are copied over below instead of being re-uploaded.
  dbId: z.number().nullable().optional(),
  // an already-uploaded photo (Portfolio "Get a Quote") attached as-is — only
  // used for guest (no dbId) items; a dbId item's copy already covers it, see
  // below.
  lockedReferenceImagePath: z.string().nullable().optional(),
});

const submitCartSchema = z.object({
  cart: z.string().min(1, "Your cart is empty."),
  pickupDate: z.string().optional(),
  pickupTime: z.string().optional(),
  customerName: z.string().trim().min(1, "Name is required"),
  customerEmail: z.string().trim().email("Enter a valid email"),
  customerPhone: z.string().trim().optional(),
  comments: z.string().trim().optional(),
  paymentPlan: z.enum(["full", "deposit"]).optional(),
});

/** Result shape for useActionState in the cart page — a thrown error inside
 *  a form action has no friendly on-page presentation (Next.js falls back to
 *  its generic error page, dropping the customer's whole cart), so every
 *  validation failure here is returned instead, letting the cart page show it
 *  next to Submit and keep everything intact. */
export type SubmitCartState = { error: string } | undefined;

type ResolvedItem = {
  clientId: string;
  designId: number;
  designName: string;
  /** design.kind !== "catalog" — no fixed price, quoted by hand later. */
  isQuote: boolean;
  answers: Answers;
  priceCents: number;
  /** this design's own resolved (catalog price, or its override) prices —
   *  used again below to snapshot each selection's actual charged price. */
  overrides: DesignPriceOverrides;
  resolvedOptionPriceById: Map<number, number>;
  resolvedFieldPriceById: Map<number, number>;
  currentSizeOptionId?: number;
};

/** Validates and re-prices one cart item entirely from trusted server-side
 *  catalog data — never trusts the client-sent designId/answers/price shape.
 *  Mirrors what the old single-cake submitOrder did for its one design. */
async function resolveCartItem(
  item: z.infer<typeof cartItemSchema>,
  catalog: {
    allFields: (typeof fields.$inferSelect)[];
    allOptions: (typeof fieldOptions.$inferSelect)[];
    optionById: Map<number, typeof fieldOptions.$inferSelect>;
    fieldById: Map<number, typeof fields.$inferSelect>;
    cakeStyleCtx: ReturnType<typeof buildCakeStyleContext>;
    pairs: (typeof constraintPairs.$inferSelect)[];
    optionPriceRows: (typeof designOptionPrices.$inferSelect)[];
    fieldPriceRows: (typeof designFieldPrices.$inferSelect)[];
    sizePriceRows: (typeof designFieldSizePrices.$inferSelect)[];
    optionSizePriceRows: (typeof designOptionSizePrices.$inferSelect)[];
  }
): Promise<{ ok: true; item: ResolvedItem } | { ok: false; error: string }> {
  const { allFields, allOptions, optionById, cakeStyleCtx, pairs } = catalog;

  const design = await db.select().from(designs).where(eq(designs.id, item.designId)).then((r) => r[0]);
  if (!design || !design.published) {
    return { ok: false, error: "One of the designs in your cart is no longer available." };
  }
  const isQuote = design.kind !== "catalog";

  const designAnswers: Answers = {};
  const includedFieldIds = new Set<number>();
  const designFieldValueRows = await db
    .select()
    .from(designFieldValues)
    .where(eq(designFieldValues.designId, design.id))
    ;
  for (const row of designFieldValueRows) {
    includedFieldIds.add(row.fieldId);
    if (row.fieldOptionId != null) {
      const existing = designAnswers[row.fieldId];
      if (existing?.type === "options") existing.optionIds.push(row.fieldOptionId);
      else designAnswers[row.fieldId] = { type: "options", optionIds: [row.fieldOptionId] };
    } else if (row.textValue != null) {
      designAnswers[row.fieldId] = { type: "text", value: row.textValue };
    } else if (row.numberValue != null) {
      designAnswers[row.fieldId] = { type: "number", value: row.numberValue };
    }
  }

  const designFields = allFields.filter((f) => includedFieldIds.has(f.id));

  const lockedFieldIds = new Set(
    (await db.select().from(designLockedFields).where(eq(designLockedFields.designId, design.id))).map(
      (r) => r.fieldId
    )
  );

  // hidden fields have no customer-facing UI at all, so — like locked ones —
  // their value can only ever be the design's own default
  const hiddenFieldIds = new Set(
    (await db.select().from(designHiddenFields).where(eq(designHiddenFields.designId, design.id))).map(
      (r) => r.fieldId
    )
  );

  const requiredFieldIds = new Set(
    (await db.select().from(designRequiredFields).where(eq(designRequiredFields.designId, design.id))).map(
      (r) => r.fieldId
    )
  );

  const excludedOptionIds = new Set(
    (await db.select().from(designExcludedOptions).where(eq(designExcludedOptions.designId, design.id))).map(
      (r) => r.fieldOptionId
    )
  );

  // re-validate each field's answer against the trusted catalog — never trust
  // the client-sent shape; locked/hidden fields always fall back to the
  // design's own default
  const answers: Answers = {};
  for (const field of designFields) {
    if (lockedFieldIds.has(field.id) || hiddenFieldIds.has(field.id)) {
      const defaultAnswer = designAnswers[field.id];
      if (defaultAnswer) answers[field.id] = defaultAnswer;
      continue;
    }

    const raw = item.answers[String(field.id)];
    if (!raw) continue;

    if (field.type === "single_select" || field.type === "multi_select") {
      if (raw.type !== "options") continue;
      const ids = raw.optionIds.filter((n) => Number.isInteger(n));
      if (field.type === "single_select" && ids.length > 1) {
        return { ok: false, error: `Invalid selection for ${field.name}.` };
      }
      for (const id of ids) {
        const option = optionById.get(id);
        if (!option || option.fieldId !== field.id) return { ok: false, error: `Invalid selection for ${field.name}.` };
        if (excludedOptionIds.has(id)) {
          return { ok: false, error: "One of your selections isn't available for this design." };
        }
      }
      if (ids.length > 0) answers[field.id] = { type: "options", optionIds: ids };
    } else if (field.type === "text") {
      if (raw.type !== "text") continue;
      const value = raw.value.trim();
      if (value) answers[field.id] = { type: "text", value };
    } else if (field.type === "number") {
      if (raw.type !== "number") continue;
      answers[field.id] = { type: "number", value: raw.value };
    } else if (field.type === "per_size") {
      if (raw.type !== "toggle") continue;
      answers[field.id] = { type: "toggle", value: raw.value };
    }
  }

  if (!isQuote) {
    for (const field of designFields) {
      if (!requiredFieldIds.has(field.id)) continue;
      const answer = answers[field.id];
      const answered =
        answer != null &&
        (answer.type !== "options" || answer.optionIds.length > 0) &&
        (answer.type !== "text" || answer.value.trim() !== "");
      if (!answered) return { ok: false, error: `${field.name} is required.` };
    }

    // the submitted `size` option must belong to the submitted cake_style
    if (cakeStyleCtx) {
      const styleAnswer = answers[cakeStyleCtx.styleFieldId];
      const styleOptionId = styleAnswer?.type === "options" ? styleAnswer.optionIds[0] : undefined;
      const styleKind = styleOptionId != null ? cakeStyleCtx.styleKindByOptionId.get(styleOptionId) : undefined;

      const sizeAnswer = answers[cakeStyleCtx.sizeFieldId];
      const sizeOptionId = sizeAnswer?.type === "options" ? sizeAnswer.optionIds[0] : undefined;
      const sizeOptionStyle = sizeOptionId != null ? cakeStyleCtx.styleKindByOptionId.get(sizeOptionId) : undefined;
      if (sizeOptionId != null && sizeOptionStyle !== styleKind) {
        return { ok: false, error: "Size doesn't match the selected Cake Style for one of your cakes." };
      }
    }
  }

  if (selectionsViolateConstraints(answers, pairs)) {
    return { ok: false, error: "One of your cakes has a combination that isn't allowed." };
  }

  const overrides = buildDesignPriceOverrides(
    design.id,
    catalog.optionPriceRows,
    catalog.fieldPriceRows,
    catalog.sizePriceRows,
    catalog.optionSizePriceRows
  );
  const resolvedOptions = resolvePriceableOptions(
    overrides,
    allOptions.map((o) => ({ id: o.id, fieldId: o.fieldId, priceCents: o.priceCents }))
  );
  const resolvedFields = resolvePriceableFields(
    overrides,
    allFields.map((f) => ({ id: f.id, additionalPriceCents: f.additionalPriceCents }))
  );
  const currentSizeOptionId = cakeStyleCtx
    ? (() => {
        const a = answers[cakeStyleCtx.sizeFieldId];
        return a?.type === "options" ? a.optionIds[0] : undefined;
      })()
    : undefined;
  const priceCents = computeTotalCents(
    answers,
    resolvedOptions,
    resolvedFields,
    overrides.perSizeFieldPrices,
    overrides.optionSizePrices,
    currentSizeOptionId
  );

  return {
    ok: true,
    item: {
      clientId: item.clientId,
      designId: design.id,
      designName: design.name,
      isQuote,
      answers,
      priceCents,
      overrides,
      resolvedOptionPriceById: new Map(resolvedOptions.map((o) => [o.id, o.priceCents])),
      resolvedFieldPriceById: new Map(resolvedFields.map((f) => [f.id, f.additionalPriceCents])),
      currentSizeOptionId,
    },
  };
}

export async function submitCart(_prevState: SubmitCartState, formData: FormData): Promise<SubmitCartState> {
  const rawParsed = submitCartSchema.safeParse(Object.fromEntries(formData));
  if (!rawParsed.success) {
    return { error: rawParsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const parsed = rawParsed.data;

  let cartInput: z.infer<typeof cartItemSchema>[];
  try {
    cartInput = cartItemSchema.array().min(1, "Your cart is empty.").parse(JSON.parse(parsed.cart));
  } catch {
    return { error: "Your cart is empty." };
  }

  // lightweight pre-check for the pickup-date requirement below — final
  // per-item validation (including a stale/deleted designId) happens in
  // resolveCartItem once the full catalog is loaded.
  const designKindRows = await db.select({ id: designs.id, kind: designs.kind }).from(designs);
  const designKindById = new Map(designKindRows.map((d) => [d.id, d.kind]));
  const hasCatalogItem = cartInput.some((i) => designKindById.get(i.designId) === "catalog");

  // never trust a client-computed slot — re-validate against current admin
  // config in case availability changed since the cart loaded. Pickup is
  // required as soon as any cart item is a catalog order; a cart made up
  // entirely of custom-cake quotes can leave it as just a rough preference.
  const hasPickupDate = !!parsed.pickupDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.pickupDate);
  const hasPickupTime = !!parsed.pickupTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.pickupTime);
  if (hasCatalogItem && !hasPickupDate) return { error: "Choose a pickup date" };
  if (hasCatalogItem && !hasPickupTime) return { error: "Choose a pickup time" };

  let pickupDate: string | null = null;
  let pickupTime: string | null = null;
  if (hasPickupDate && hasPickupTime) {
    const { settings, weeklyHours, overrides, orderCountsByDate } = await loadPickupAvailability();
    if (
      !isSlotAvailable(
        parsed.pickupDate!,
        parsed.pickupTime!,
        weeklyHours,
        overrides,
        settings,
        new Date(),
        orderCountsByDate
      )
    ) {
      return { error: "That pickup time is no longer available — please go back and choose another." };
    }
    pickupDate = parsed.pickupDate!;
    pickupTime = parsed.pickupTime!;
  }

  const allFields = await db.select().from(fields).where(eq(fields.active, true));
  const allOptions = await db.select().from(fieldOptions).where(eq(fieldOptions.active, true));
  const optionById = new Map(allOptions.map((o) => [o.id, o]));
  const fieldById = new Map(allFields.map((f) => [f.id, f]));

  const allTierPresetRows = await db.select().from(tierPresetsTable);
  const allTierPresetLevelRows = await db.select().from(tierPresetLevels);
  const tierPresetDTOs: TierPresetDTO[] = allTierPresetRows.map((preset) => ({
    fieldOptionId: preset.fieldOptionId,
    levelCount: preset.levelCount,
    levels: allTierPresetLevelRows
      .filter((lvl) => lvl.tierPresetId === preset.id)
      .sort((a, b) => a.position - b.position)
      .map((lvl) => {
        const mold = optionById.get(lvl.moldOptionId);
        return {
          position: lvl.position,
          moldOptionId: lvl.moldOptionId,
          moldName: mold?.name ?? "Unknown",
          diameterIn: null,
          shape: null,
          servesMin: null,
          servesMax: null,
        };
      }),
  }));

  const fieldDTOs: FieldDTO[] = allFields
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
    }));
  const optionDTOs: FieldOptionDTO[] = allOptions.map((o) => ({
    id: o.id,
    fieldId: o.fieldId,
    name: o.name,
    priceCents: o.priceCents,
    dimensions: null,
    styleKind: o.styleKind != null && isCakeStyleKind(o.styleKind) ? o.styleKind : null,
    tierLevelCount: o.tierLevelCount != null && isTierLevelCount(o.tierLevelCount) ? o.tierLevelCount : null,
  }));
  const cakeStyleCtx = buildCakeStyleContext(fieldDTOs, optionDTOs, tierPresetDTOs);
  const pairs = await db.select().from(constraintPairs);
  const optionPriceRows = await db.select().from(designOptionPrices);
  const fieldPriceRows = await db.select().from(designFieldPrices);
  const sizePriceRows = await db.select().from(designFieldSizePrices);
  const optionSizePriceRows = await db.select().from(designOptionSizePrices);

  const resolvedItems: ResolvedItem[] = [];
  for (const item of cartInput) {
    const result = await resolveCartItem(item, {
      allFields,
      allOptions,
      optionById,
      fieldById,
      cakeStyleCtx,
      pairs,
      optionPriceRows,
      fieldPriceRows,
      sizePriceRows,
      optionSizePriceRows,
    });
    if (!result.ok) return { error: result.error };
    resolvedItems.push(result.item);
  }

  const totalPriceCents = resolvedItems.reduce((sum, i) => sum + i.priceCents, 0);
  const currentUser = await getCurrentUser();

  // custom-cake quotes have no fixed price yet (the baker prices them by
  // hand) — only a cart made up entirely of catalog cakes has a known total
  // to actually charge online. Anything else keeps the pre-Stripe "we'll
  // contact you to confirm pricing" flow, unchanged.
  const requiresPayment = totalPriceCents > 0 && resolvedItems.every((i) => !i.isQuote);

  // deposits only make sense when there's a real online charge to split —
  // otherwise (custom quotes / $0 carts) always treat as "full" with nothing
  // due today, ignoring whatever the client sent.
  const paymentPlan = requiresPayment && parsed.paymentPlan === "deposit" ? "deposit" : "full";
  const amountDueCents = requiresPayment
    ? paymentPlan === "deposit"
      ? Math.round(totalPriceCents / 2)
      : totalPriceCents
    : totalPriceCents;

  // Unguessable lookup key for the public /order/thank-you page — never the
  // sequential `id`, which anyone could enumerate to view other customers' orders.
  const confirmationToken = crypto.randomBytes(24).toString("hex");

  const { orderId, itemIdByClientId } = await db.transaction(async (tx) => {
    const insertedOrder = await tx
      .insert(orders)
      .values({
        userId: currentUser?.id ?? null,
        customerName: parsed.customerName,
        customerEmail: parsed.customerEmail,
        customerPhone: parsed.customerPhone || null,
        comments: parsed.comments || null,
        totalPriceCents,
        status: "new",
        quoteStatus: resolvedItems.some((i) => i.isQuote) ? "new" : null,
        pickupDate,
        pickupTime,
        paymentStatus: requiresPayment ? "pending" : "not_required",
        paymentPlan,
        amountDueCents,
        confirmationToken,
      })
      .returning({ id: orders.id })
      .then((r) => r[0]);

    const itemIdByClientId = new Map<string, number>();

    for (const [index, resolved] of resolvedItems.entries()) {
      const insertedItem = await tx
        .insert(orderItems)
        .values({
          orderId: insertedOrder.id,
          designId: resolved.designId,
          priceCents: resolved.priceCents,
          sortOrder: index,
        })
        .returning({ id: orderItems.id })
        .then((r) => r[0]);
      itemIdByClientId.set(resolved.clientId, insertedItem.id);

      for (const [fieldIdStr, answer] of Object.entries(resolved.answers)) {
        const fieldId = Number(fieldIdStr);
        if (answer.type === "options") {
          for (const optionId of answer.optionIds) {
            const option = optionById.get(optionId)!;
            // this design's own price for the option — size-resolved if this
            // design made the option's field size-varying, else flat
            const optionSizePrices = resolved.overrides.optionSizePrices[optionId];
            const priceCentsSnapshot = optionSizePrices
              ? (resolved.currentSizeOptionId != null ? (optionSizePrices[resolved.currentSizeOptionId] ?? 0) : 0)
              : (resolved.resolvedOptionPriceById.get(optionId) ?? option.priceCents);
            await tx.insert(orderSelections)
              .values({
                orderItemId: insertedItem.id,
                fieldId,
                fieldOptionId: optionId,
                labelSnapshot: option.name,
                priceCentsSnapshot,
              })
              ;
          }
        } else if (answer.type === "text") {
          await tx.insert(orderSelections)
            .values({
              orderItemId: insertedItem.id,
              fieldId,
              textValue: answer.value,
              labelSnapshot: answer.value,
              priceCentsSnapshot: resolved.resolvedFieldPriceById.get(fieldId) ?? 0,
            })
            ;
        } else if (answer.type === "number") {
          await tx.insert(orderSelections)
            .values({
              orderItemId: insertedItem.id,
              fieldId,
              numberValue: answer.value,
              labelSnapshot: String(answer.value),
              priceCentsSnapshot: resolved.resolvedFieldPriceById.get(fieldId) ?? 0,
            })
            ;
        } else {
          if (!answer.value) continue; // declined a per_size add-on — nothing to record
          const sizePrices = resolved.overrides.perSizeFieldPrices[fieldId];
          const priceCentsSnapshot = sizePrices
            ? (resolved.currentSizeOptionId != null ? (sizePrices[resolved.currentSizeOptionId] ?? 0) : 0)
            : (resolved.resolvedFieldPriceById.get(fieldId) ?? 0);
          await tx.insert(orderSelections)
            .values({
              orderItemId: insertedItem.id,
              fieldId,
              booleanValue: answer.value,
              labelSnapshot: "Yes",
              priceCentsSnapshot,
            })
            ;
        }
      }
    }

    return { orderId: insertedOrder.id, itemIdByClientId };
  });

  for (const item of cartInput) {
    if (designKindById.get(item.designId) === "catalog") continue;
    const orderItemId = itemIdByClientId.get(item.clientId);
    if (!orderItemId) continue;

    // an item already persisted to the customer's DB cart has its reference
    // images saved on disk already — copy the rows over instead of expecting
    // (client-impossible-to-resend) File objects in this submission. Only
    // trust dbId when it actually belongs to the submitting customer.
    if (item.dbId && currentUser) {
      const ownedCartItem = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, item.dbId))
        .then((r) => r[0]);
      if (ownedCartItem && ownedCartItem.userId === currentUser.id) {
        const savedImages = await db
          .select()
          .from(cartItemReferenceImages)
          .where(eq(cartItemReferenceImages.cartItemId, item.dbId))
          ;
        for (const image of savedImages) {
          await db.insert(orderReferenceImages).values({ orderItemId, path: image.path });
        }
        continue;
      }
    }

    const referenceImageFiles = formData
      .getAll(`referenceImages_${item.clientId}`)
      .filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of referenceImageFiles) {
      const relPath = await saveUploadedPhoto(file);
      await db.insert(orderReferenceImages).values({ orderItemId, path: relPath });
    }
    if (item.lockedReferenceImagePath) {
      await db.insert(orderReferenceImages).values({ orderItemId, path: item.lockedReferenceImagePath });
    }
  }

  if (requiresPayment) {
    // leave the customer's saved DB cart intact until payment is actually
    // confirmed (see src/lib/payments.ts) — if they abandon Stripe Checkout,
    // their configured cakes are still waiting for them in the cart
    let session;
    try {
      session = await createCheckoutSessionForOrder({
        orderId,
        confirmationToken,
        customerEmail: parsed.customerEmail,
        items: resolvedItems.map((item) => ({
          name: item.designName ?? "Cake",
          priceCents: item.priceCents,
        })),
        paymentPlan,
        amountDueCents,
        totalPriceCents,
      });
    } catch {
      await db.update(orders).set({ paymentStatus: "failed" }).where(eq(orders.id, orderId));
      return { error: "We couldn't start checkout. Please try again in a moment." };
    }
    redirect(session.url!);
  }

  // no payment to collect — the checkout above is the definitive record now,
  // drop whatever's left of the customer's saved cart so it doesn't linger
  // and get resubmitted
  if (currentUser) {
    await db.delete(cartItems).where(eq(cartItems.userId, currentUser.id));
  }

  redirect(`/order/thank-you?token=${confirmationToken}`);
}
