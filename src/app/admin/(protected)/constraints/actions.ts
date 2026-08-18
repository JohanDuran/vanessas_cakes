"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { catalogItems, constraintPairs } from "../../../../db/schema";

const createSchema = z.object({
  itemAId: z.coerce.number().int(),
  itemBId: z.coerce.number().int(),
});

export async function createConstraint(formData: FormData) {
  const parsed = createSchema.parse(Object.fromEntries(formData));

  if (parsed.itemAId === parsed.itemBId) {
    throw new Error("Choose two different items.");
  }

  const [itemA, itemB] = await Promise.all([
    db.select().from(catalogItems).where(eq(catalogItems.id, parsed.itemAId)).get(),
    db.select().from(catalogItems).where(eq(catalogItems.id, parsed.itemBId)).get(),
  ]);
  if (!itemA || !itemB) throw new Error("Item not found.");
  if (itemA.axis === itemB.axis) {
    throw new Error("Constraints must be between two different axes.");
  }

  // canonicalize so (A,B) and (B,A) are never stored as separate rows
  const [first, second] = itemA.id < itemB.id ? [itemA, itemB] : [itemB, itemA];

  db.insert(constraintPairs)
    .values({
      axisA: first.axis,
      itemAId: first.id,
      axisB: second.axis,
      itemBId: second.id,
    })
    .onConflictDoNothing()
    .run();

  revalidatePath("/admin/constraints");
}

const deleteSchema = z.object({ id: z.coerce.number().int() });

export async function deleteConstraint(formData: FormData) {
  const parsed = deleteSchema.parse(Object.fromEntries(formData));
  db.delete(constraintPairs).where(eq(constraintPairs.id, parsed.id)).run();
  revalidatePath("/admin/constraints");
}
