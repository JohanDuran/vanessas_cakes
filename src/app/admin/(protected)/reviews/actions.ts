"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../../../../db";
import { designReviews } from "../../../../db/schema";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const PATH = "/admin/reviews";

const replySchema = z.object({
  id: z.coerce.number().int(),
  designId: z.coerce.number().int(),
  reply: z.string().trim().max(2000),
});

export async function replyToReview(formData: FormData) {
  try {
    const parsed = replySchema.parse(Object.fromEntries(formData));
    db.update(designReviews)
      .set({ adminReply: parsed.reply || null, adminReplyAt: parsed.reply ? Date.now() : null })
      .where(eq(designReviews.id, parsed.id))
      .run();

    revalidatePath(PATH);
    revalidatePath(`/gallery/${parsed.designId}`);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't save this reply."));
  }

  toastRedirect(PATH, "success", "Reply saved successfully!");
}
