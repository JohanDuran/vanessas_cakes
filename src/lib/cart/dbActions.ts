"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { cartItems, cartItemSelections, cartItemReferenceImages } from "../../db/schema";
import { getCurrentUser, getCartItemsForUser, type CartItemDTO } from "../../db/queries";
import { saveUploadedPhoto } from "../uploads";
import type { Answers } from "../pricing";

const answerSchema = z.union([
  z.object({ type: z.literal("options"), optionIds: z.array(z.number()) }),
  z.object({ type: z.literal("text"), value: z.string() }),
  z.object({ type: z.literal("number"), value: z.number() }),
]);
const answersSchema = z.record(z.string(), answerSchema);

function parseDesignId(formData: FormData): number {
  const raw = Number(formData.get("designId"));
  if (!Number.isInteger(raw)) throw new Error("Missing designId.");
  return raw;
}

function parseAnswers(formData: FormData): Answers {
  return answersSchema.parse(JSON.parse(String(formData.get("answers") ?? "{}")));
}

function filesFrom(formData: FormData, field: string): File[] {
  return formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
}

/** A reference image path that's already sitting in storage (e.g. a Portfolio
 *  photo picked via "Get a Quote") — attached to the cart item as-is, no
 *  saveUploadedPhoto re-upload needed. */
function lockedPathFrom(formData: FormData): string | null {
  const raw = formData.get("lockedReferenceImagePath");
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed || null;
}

/** Mirrors submitCart's order_selections insert, minus the price/label
 *  snapshot — nothing is final until checkout. */
async function insertSelections(cartItemId: number, answers: Answers) {
  for (const [fieldIdStr, answer] of Object.entries(answers)) {
    const fieldId = Number(fieldIdStr);
    if (answer.type === "options") {
      for (const optionId of answer.optionIds) {
        await db.insert(cartItemSelections).values({ cartItemId, fieldId, fieldOptionId: optionId });
      }
    } else if (answer.type === "text") {
      await db.insert(cartItemSelections).values({ cartItemId, fieldId, textValue: answer.value });
    } else {
      await db.insert(cartItemSelections).values({ cartItemId, fieldId, numberValue: answer.value });
    }
  }
}

/** Persists one cart item for the signed-in customer — called the moment
 *  they add a cake in the wizard. Guests never reach this (see CartContext,
 *  which keeps their cart in the browser instead). */
export async function addCartItemAction(formData: FormData): Promise<{ id: number; referenceImagePaths: string[] }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const designId = parseDesignId(formData);
  const answers = parseAnswers(formData);
  const files = filesFrom(formData, "referenceImages");
  const lockedPath = lockedPathFrom(formData);

  const inserted = await db
    .insert(cartItems)
    .values({ userId: user.id, designId })
    .returning({ id: cartItems.id })
    .then((r) => r[0]);
  await insertSelections(inserted.id, answers);

  const referenceImagePaths: string[] = [];
  for (const file of files) {
    const relPath = await saveUploadedPhoto(file);
    await db.insert(cartItemReferenceImages).values({ cartItemId: inserted.id, path: relPath });
    referenceImagePaths.push(relPath);
  }
  if (lockedPath) {
    await db.insert(cartItemReferenceImages).values({ cartItemId: inserted.id, path: lockedPath });
    referenceImagePaths.push(lockedPath);
  }

  return { id: inserted.id, referenceImagePaths };
}

/** Re-saves one cart item's answers after the customer edits it. Any newly
 *  attached reference images are appended — previously uploaded ones are
 *  left alone (the wizard's edit flow doesn't reload them as Files, so
 *  there's nothing to diff against). */
export async function updateCartItemAction(formData: FormData): Promise<{ referenceImagePaths: string[] }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const id = Number(formData.get("id"));
  const existing = await db.select().from(cartItems).where(eq(cartItems.id, id)).then((r) => r[0]);
  if (!existing || existing.userId !== user.id) throw new Error("Cart item not found.");

  const designId = parseDesignId(formData);
  const answers = parseAnswers(formData);
  const files = filesFrom(formData, "referenceImages");
  const lockedPath = lockedPathFrom(formData);

  await db.update(cartItems).set({ designId }).where(eq(cartItems.id, id));
  await db.delete(cartItemSelections).where(eq(cartItemSelections.cartItemId, id));
  await insertSelections(id, answers);

  for (const file of files) {
    const relPath = await saveUploadedPhoto(file);
    await db.insert(cartItemReferenceImages).values({ cartItemId: id, path: relPath });
  }

  const images = await db
    .select()
    .from(cartItemReferenceImages)
    .where(eq(cartItemReferenceImages.cartItemId, id))
    ;
  const referenceImagePaths = images.map((i) => i.path);

  // avoid re-inserting the same locked path on every save (e.g. the wizard's
  // review step re-submitting an unchanged edit)
  if (lockedPath && !referenceImagePaths.includes(lockedPath)) {
    await db.insert(cartItemReferenceImages).values({ cartItemId: id, path: lockedPath });
    referenceImagePaths.push(lockedPath);
  }

  return { referenceImagePaths };
}

/** Removes one cart item — ownership-checked so a customer can only ever
 *  delete their own rows, no matter what id the client sends. */
export async function removeCartItemAction(id: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const existing = await db.select().from(cartItems).where(eq(cartItems.id, id)).then((r) => r[0]);
  if (!existing || existing.userId !== user.id) return;
  await db.delete(cartItems).where(eq(cartItems.id, id));
}

const guestItemSchema = z.object({
  localId: z.string(),
  designId: z.number(),
  answers: answersSchema,
  lockedReferenceImagePath: z.string().nullable().optional(),
});

/** Folds a just-logged-in customer's browser-only cart into their DB cart —
 *  called once, right after CartContext observes the guest -> logged-in
 *  transition. Returns the merged cart so the browser copy can be dropped
 *  in favor of the DB as the new source of truth. */
export async function mergeGuestCartAction(formData: FormData): Promise<CartItemDTO[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const items = guestItemSchema.array().parse(JSON.parse(String(formData.get("items") ?? "[]")));

  for (const item of items) {
    const inserted = await db
      .insert(cartItems)
      .values({ userId: user.id, designId: item.designId })
      .returning({ id: cartItems.id })
      .then((r) => r[0]);
    await insertSelections(inserted.id, item.answers);

    // reference images are only ever attached to a quote item to begin
    // with (see CustomCakeQuoteStep) — a catalog item simply has none of
    // these to carry over
    for (const file of filesFrom(formData, `files_${item.localId}`)) {
      const relPath = await saveUploadedPhoto(file);
      await db.insert(cartItemReferenceImages).values({ cartItemId: inserted.id, path: relPath });
    }
    if (item.lockedReferenceImagePath) {
      await db.insert(cartItemReferenceImages).values({ cartItemId: inserted.id, path: item.lockedReferenceImagePath });
    }
  }

  return getCartItemsForUser(user.id);
}

/** Re-fetches the signed-in customer's DB cart — used when CartContext sees
 *  the logged-in user change (e.g. switching accounts) without a guest cart
 *  to merge. */
export async function loadCartItemsAction(): Promise<CartItemDTO[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getCartItemsForUser(user.id);
}
