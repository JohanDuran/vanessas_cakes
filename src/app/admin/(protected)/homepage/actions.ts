"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../../../db";
import { siteSettings } from "../../../../db/schema";
import { requireAdmin } from "../../../../db/queries";
import { saveUploadedPhoto, deleteUploadedPhoto } from "../../../../lib/uploads";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const PATH = "/admin/homepage";

export async function updateStoryContent(formData: FormData) {
  const heading = String(formData.get("heading") ?? "").trim();
  const paragraph1 = String(formData.get("paragraph1") ?? "").trim();
  const paragraph2 = String(formData.get("paragraph2") ?? "").trim();
  const stat1Label = String(formData.get("stat1Label") ?? "").trim();
  const stat1Value = String(formData.get("stat1Value") ?? "").trim();
  const stat2Label = String(formData.get("stat2Label") ?? "").trim();
  const stat2Value = String(formData.get("stat2Value") ?? "").trim();
  const stat3Label = String(formData.get("stat3Label") ?? "").trim();
  const stat3Value = String(formData.get("stat3Value") ?? "").trim();
  const removePhoto = formData.get("removePhoto") === "on";
  const photo = formData.get("photo");
  const newPhotoFile = photo instanceof File && photo.size > 0 ? photo : null;

  try {
    await requireAdmin();
    const existing = await db
      .select({ id: siteSettings.id, storyImagePath: siteSettings.storyImagePath })
      .from(siteSettings)
      .limit(1)
      .then((r) => r[0]);

    let storyImagePath = existing?.storyImagePath ?? null;
    if (newPhotoFile) {
      const uploadedPath = await saveUploadedPhoto(newPhotoFile);
      if (storyImagePath) await deleteUploadedPhoto(storyImagePath);
      storyImagePath = uploadedPath;
    } else if (removePhoto && storyImagePath) {
      await deleteUploadedPhoto(storyImagePath);
      storyImagePath = null;
    }

    const values = {
      storyHeading: heading,
      storyParagraph1: paragraph1,
      storyParagraph2: paragraph2,
      storyImagePath,
      storyStat1Label: stat1Label,
      storyStat1Value: stat1Value,
      storyStat2Label: stat2Label,
      storyStat2Value: stat2Value,
      storyStat3Label: stat3Label,
      storyStat3Value: stat3Value,
      updatedAt: Date.now(),
    };

    if (existing) {
      await db.update(siteSettings).set(values).where(eq(siteSettings.id, existing.id));
    } else {
      await db.insert(siteSettings).values(values);
    }

    revalidatePath(PATH);
    revalidatePath("/");
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't update the homepage content."));
  }

  toastRedirect(PATH, "success", "Homepage updated!");
}
