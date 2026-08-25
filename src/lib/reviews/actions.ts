"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../db";
import { designReviews, designs } from "../../db/schema";
import { getCurrentUser } from "../../db/queries";

export type ReviewFormState = { error: string } | { success: true } | undefined;

const reviewSchema = z.object({
  designId: z.coerce.number().int(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

/** Creates or updates the signed-in customer's review for a design — one
 *  review per (design, user), so re-submitting just edits the existing row
 *  (see the unique index on design_reviews). Guests never reach this; the
 *  review form itself is hidden from them on the design page. */
export async function submitReview(_prevState: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to leave a review." };

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your review and try again." };
  }
  const { designId, rating, comment } = parsed.data;

  const design = db.select({ id: designs.id }).from(designs).where(eq(designs.id, designId)).get();
  if (!design) return { error: "This cake is no longer available." };

  const existing = db
    .select({ id: designReviews.id })
    .from(designReviews)
    .where(and(eq(designReviews.designId, designId), eq(designReviews.userId, user.id)))
    .get();

  if (existing) {
    db.update(designReviews)
      .set({ rating, comment: comment || null, updatedAt: Date.now() })
      .where(eq(designReviews.id, existing.id))
      .run();
  } else {
    db.insert(designReviews)
      .values({ designId, userId: user.id, rating, comment: comment || null })
      .run();
  }

  revalidatePath(`/gallery/${designId}`);
  return { success: true };
}
