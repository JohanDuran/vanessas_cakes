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
