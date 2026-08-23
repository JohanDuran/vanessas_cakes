"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { orders } from "../../../../db/schema";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const setStatusSchema = z.object({
  id: z.coerce.number().int(),
  status: z.enum(["new", "viewed", "archived"]),
});

export async function setOrderStatus(formData: FormData) {
  const rawId = formData.get("id");
  const path = `/admin/orders/${rawId}`;

  try {
    const parsed = setStatusSchema.parse(Object.fromEntries(formData));
    db.update(orders).set({ status: parsed.status }).where(eq(orders.id, parsed.id)).run();
    revalidatePath("/admin/orders");
    revalidatePath(path);
  } catch (err) {
    toastRedirect(path, "error", toastMessage(err, "Couldn't update order status."));
  }

  toastRedirect(path, "success", "Order status updated successfully!");
}
