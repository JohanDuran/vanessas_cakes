"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { fieldOptions, constraintPairs } from "../../../../db/schema";
import { requireAdmin } from "../../../../db/queries";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const PATH = "/admin/constraints";

const createSchema = z.object({
  optionAId: z.coerce.number().int(),
  optionBId: z.coerce.number().int(),
});

export async function createConstraint(formData: FormData) {
  try {
    await requireAdmin();
    const parsed = createSchema.parse(Object.fromEntries(formData));

    if (parsed.optionAId === parsed.optionBId) {
      throw new Error("Choose two different options.");
    }

    const [optionA, optionB] = await Promise.all([
      await db.select().from(fieldOptions).where(eq(fieldOptions.id, parsed.optionAId)).then((r) => r[0]),
      await db.select().from(fieldOptions).where(eq(fieldOptions.id, parsed.optionBId)).then((r) => r[0]),
    ]);
    if (!optionA || !optionB) throw new Error("Option not found.");
    if (optionA.fieldId === optionB.fieldId) {
      throw new Error("Constraints must be between two different fields.");
    }

    // canonicalize so (A,B) and (B,A) are never stored as separate rows
    const [first, second] = optionA.id < optionB.id ? [optionA, optionB] : [optionB, optionA];

    await db.insert(constraintPairs)
      .values({ optionAId: first.id, optionBId: second.id })
      .onConflictDoNothing()
      ;

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't add this constraint."));
  }

  toastRedirect(PATH, "success", "Constraint added successfully!");
}

const deleteSchema = z.object({ id: z.coerce.number().int() });

export async function deleteConstraint(formData: FormData) {
  await requireAdmin();
  const parsed = deleteSchema.parse(Object.fromEntries(formData));
  await db.delete(constraintPairs).where(eq(constraintPairs.id, parsed.id));
  revalidatePath("/admin/constraints");
}
