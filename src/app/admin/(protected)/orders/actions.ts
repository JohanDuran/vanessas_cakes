"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { orders } from "../../../../db/schema";
import { requireAdmin } from "../../../../db/queries";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const setStatusSchema = z.object({
  id: z.coerce.number().int(),
  status: z.enum(["new", "viewed", "archived"]),
});

export async function setOrderStatus(formData: FormData) {
  const rawId = formData.get("id");
  const path = `/admin/orders/${rawId}`;

  try {
    await requireAdmin();
    const parsed = setStatusSchema.parse(Object.fromEntries(formData));
    await db.update(orders).set({ status: parsed.status }).where(eq(orders.id, parsed.id));
    revalidatePath("/admin/orders");
    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't update order status."));
  }

  toastRedirect(path, "success", "Order status updated successfully!");
}

const markBalanceCollectedSchema = z.object({ id: z.coerce.number().int() });

/** Manual record that a deposit order's remaining balance was collected in
 *  person (cash/card at pickup) — there's no automatic follow-up Stripe
 *  charge for it yet, so this is the only record that it was paid. */
export async function markBalanceCollected(formData: FormData) {
  const rawId = formData.get("id");
  const path = `/admin/orders/${rawId}`;

  try {
    await requireAdmin();
    const parsed = markBalanceCollectedSchema.parse(Object.fromEntries(formData));
    await db.update(orders).set({ balanceCollectedAt: Date.now() }).where(eq(orders.id, parsed.id));
    revalidatePath("/admin/orders");
    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't mark balance as collected."));
  }

  toastRedirect(path, "success", "Balance marked as collected!");
}

const dollarsToCents = (v: string) => Math.round(Number(v) * 100);

const saveQuotePriceSchema = z.object({
  id: z.coerce.number().int(),
  notes: z.string().optional(),
  priceDollars: z.string().refine((v) => !Number.isNaN(Number(v)), "Must be a number"),
});

/** Admin's manual quote pricing — notes + a single final price, logged onto
 *  the order and moving quoteStatus to "calculated". Can be resubmitted at
 *  any point before "accepted" (including to revive a "rejected" quote). */
export async function saveQuotePrice(formData: FormData) {
  const rawId = formData.get("id");
  const path = `/admin/orders/${rawId}`;

  try {
    await requireAdmin();
    const parsed = saveQuotePriceSchema.parse(Object.fromEntries(formData));
    const order = await db.select().from(orders).where(eq(orders.id, parsed.id)).then((r) => r[0]);
    if (!order) throw new Error("Order not found.");
    if (order.quoteStatus == null) throw new Error("This order isn't a quote.");
    if (order.quoteStatus === "accepted") {
      throw new Error("This quote has already been accepted and can't be repriced.");
    }

    await db
      .update(orders)
      .set({
        totalPriceCents: dollarsToCents(parsed.priceDollars),
        quoteNotes: parsed.notes || null,
        quoteStatus: "calculated",
      })
      .where(eq(orders.id, parsed.id));
    revalidatePath("/admin/orders");
    revalidatePath("/admin/quotes");
    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't save the quote price."));
  }

  toastRedirect(path, "success", "Quote price saved!");
}

const setQuoteStatusSchema = z.object({
  id: z.coerce.number().int(),
  status: z.enum(["awaiting_confirmation", "accepted", "rejected"]),
});

// which quoteStatus values a quote may move FROM to reach each target status
const ALLOWED_QUOTE_TRANSITIONS: Record<"awaiting_confirmation" | "accepted" | "rejected", string[]> = {
  awaiting_confirmation: ["calculated"],
  accepted: ["calculated", "awaiting_confirmation"],
  rejected: ["calculated", "awaiting_confirmation"],
};

/** Manual quote status transitions — see orders.quoteStatus in
 *  src/db/schema.ts for the full lifecycle. "accepted" is what makes a quote
 *  order show up under /admin/orders instead of /admin/quotes. */
export async function setQuoteStatus(formData: FormData) {
  const rawId = formData.get("id");
  const path = `/admin/orders/${rawId}`;

  try {
    await requireAdmin();
    const parsed = setQuoteStatusSchema.parse(Object.fromEntries(formData));
    const order = await db.select().from(orders).where(eq(orders.id, parsed.id)).then((r) => r[0]);
    if (!order) throw new Error("Order not found.");
    if (!ALLOWED_QUOTE_TRANSITIONS[parsed.status].includes(order.quoteStatus ?? "")) {
      throw new Error(`Can't move a "${order.quoteStatus ?? "non-quote"}" order to "${parsed.status}".`);
    }

    await db.update(orders).set({ quoteStatus: parsed.status }).where(eq(orders.id, parsed.id));
    revalidatePath("/admin/orders");
    revalidatePath("/admin/quotes");
    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't update the quote status."));
  }

  toastRedirect(path, "success", "Quote status updated!");
}
