"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import { portfolioPhotos } from "../../../../db/schema";
import { requireAdmin } from "../../../../db/queries";
import { deleteUploadedPhoto, saveUploadedPhoto } from "../../../../lib/uploads";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

/** Bulk-adds every attached photo as its own Portfolio row — the admin's entry
 *  point for stocking the customer-facing /portfolio page. */
export async function uploadPortfolioPhotos(formData: FormData) {
  try {
    await requireAdmin();
    const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new Error("Choose at least one photo to upload.");

    for (const file of files) {
      const path = await saveUploadedPhoto(file);
      await db.insert(portfolioPhotos).values({ path });
    }
  } catch (err) {
    toastRedirect("/admin/portfolio", "error", toastMessage(err, "Couldn't upload those photos."));
  }

  revalidatePath("/admin/portfolio");
  toastRedirect("/admin/portfolio", "success", "Photos uploaded!");
}

const deleteSchema = z.object({ id: z.coerce.number().int() });

/** Removes a Portfolio photo outright (not the "Configure" path — this is for
 *  photos the admin never wants to turn into a design, e.g. a mistaken upload). */
export async function deletePortfolioPhoto(formData: FormData) {
  await requireAdmin();
  const parsed = deleteSchema.parse(Object.fromEntries(formData));
  const photo = await db.select().from(portfolioPhotos).where(eq(portfolioPhotos.id, parsed.id)).then((r) => r[0]);
  if (photo) {
    await deleteUploadedPhoto(photo.path);
    await db.delete(portfolioPhotos).where(eq(portfolioPhotos.id, parsed.id));
  }
  revalidatePath("/admin/portfolio");
}
