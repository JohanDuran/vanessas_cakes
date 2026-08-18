"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { catalogItems, constraintPairs, designs, orderSelections, orders } from "../../db/schema";
import { AXES, type Axis } from "../../lib/axes";
import { selectionsViolateConstraints } from "../../lib/constraints";
import { computeTotalCents } from "../../lib/pricing";

const selectionFields = Object.fromEntries(
  AXES.map((axis) => [`selection_${axis}`, z.coerce.number().int()])
) as Record<`selection_${Axis}`, z.ZodNumber>;

const submitSchema = z.object({
  designId: z.coerce.number().int(),
  customerName: z.string().trim().min(1, "Name is required"),
  customerEmail: z.string().trim().email("Enter a valid email"),
  customerPhone: z.string().trim().optional(),
  comments: z.string().trim().optional(),
  ...selectionFields,
});

export async function submitOrder(formData: FormData) {
  const parsed = submitSchema.parse(Object.fromEntries(formData));

  const design = db.select().from(designs).where(eq(designs.id, parsed.designId)).get();
  if (!design || !design.published) {
    throw new Error("This design is no longer available.");
  }

  const selections = Object.fromEntries(
    AXES.map((axis) => [axis, parsed[`selection_${axis}`]])
  ) as Record<Axis, number>;

  const allItems = db.select().from(catalogItems).all();
  const itemById = new Map(allItems.map((i) => [i.id, i]));

  // re-validate every selected item actually exists, is active, and matches its axis
  for (const axis of AXES) {
    const item = itemById.get(selections[axis]);
    if (!item || !item.active || item.axis !== axis) {
      throw new Error(`Invalid selection for ${axis}.`);
    }
  }

  const pairs = db.select().from(constraintPairs).all();
  if (selectionsViolateConstraints(selections, pairs)) {
    throw new Error("This combination is not allowed — please go back and adjust your selections.");
  }

  // total is recomputed here — never trust a client-sent price
  const totalPriceCents = computeTotalCents(selections, design.premiumCents, allItems);

  const orderId = db.transaction((tx) => {
    const inserted = tx
      .insert(orders)
      .values({
        designId: design.id,
        customerName: parsed.customerName,
        customerEmail: parsed.customerEmail,
        customerPhone: parsed.customerPhone || null,
        comments: parsed.comments || null,
        totalPriceCents,
        status: "new",
      })
      .returning({ id: orders.id })
      .get();

    for (const axis of AXES) {
      const item = itemById.get(selections[axis])!;
      tx.insert(orderSelections)
        .values({
          orderId: inserted.id,
          axis,
          catalogItemId: item.id,
          itemNameSnapshot: item.name,
          priceCentsSnapshot: item.priceCents,
        })
        .run();
    }

    return inserted.id;
  });

  redirect(`/order/thank-you?id=${orderId}`);
}
