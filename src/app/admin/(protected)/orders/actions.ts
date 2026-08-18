"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { orders } from "../../../../db/schema";

const setStatusSchema = z.object({
  id: z.coerce.number().int(),
  status: z.enum(["new", "viewed", "archived"]),
});

export async function setOrderStatus(formData: FormData) {
  const parsed = setStatusSchema.parse(Object.fromEntries(formData));
  db.update(orders).set({ status: parsed.status }).where(eq(orders.id, parsed.id)).run();
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.id}`);
}
