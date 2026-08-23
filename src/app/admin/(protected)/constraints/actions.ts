"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { fieldOptions, constraintPairs } from "../../../../db/schema";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const PATH = "/admin/constraints";

const createSchema = z.object({
  optionAId: z.coerce.number().int(),
  optionBId: z.coerce.number().int(),
});

export async function createConstraint(formData: FormData) {
  try {
    const parsed = createSchema.parse(Object.fromEntries(formData));

    if (parsed.optionAId === parsed.optionBId) {
      throw new Error("Choose two different options.");
    }

    const [optionA, optionB] = await Promise.all([
      db.select().from(fieldOptions).where(eq(fieldOptions.id, parsed.optionAId)).get(),
      db.select().from(fieldOptions).where(eq(fieldOptions.id, parsed.optionBId)).get(),
    ]);
    if (!optionA || !optionB) throw new Error("Option not found.");
    if (optionA.fieldId === optionB.fieldId) {
      throw new Error("Constraints must be between two different fields.");
    }

    // canonicalize so (A,B) and (B,A) are never stored as separate rows
    const [first, second] = optionA.id < optionB.id ? [optionA, optionB] : [optionB, optionA];

    db.insert(constraintPairs)
      .values({ optionAId: first.id, optionBId: second.id })
      .onConflictDoNothing()
      .run();

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't add this constraint."));
  }

  toastRedirect(PATH, "success", "Constraint added successfully!");
}

const deleteSchema = z.object({ id: z.coerce.number().int() });

export async function deleteConstraint(formData: FormData) {
  const parsed = deleteSchema.parse(Object.fromEntries(formData));
  db.delete(constraintPairs).where(eq(constraintPairs.id, parsed.id)).run();
  revalidatePath("/admin/constraints");
}
