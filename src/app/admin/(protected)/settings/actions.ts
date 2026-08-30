"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "../../../../db";
import { siteSettings } from "../../../../db/schema";
import { requireAdmin } from "../../../../db/queries";
import { toastMessage, toastRedirect } from "../../../../lib/toast";

const PATH = "/admin/settings";

export async function setMaintenanceMode(formData: FormData) {
  const maintenanceMode = formData.get("maintenanceMode") === "on";

  try {
    await requireAdmin();
    const existing = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1).then((r) => r[0]);

    if (existing) {
      await db.update(siteSettings)
        .set({ maintenanceMode, updatedAt: Date.now() })
        .where(eq(siteSettings.id, existing.id))
        ;
    } else {
      await db.insert(siteSettings).values({ maintenanceMode, updatedAt: Date.now() });
    }

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't update maintenance mode."));
  }

  toastRedirect(
    PATH,
    "success",
    maintenanceMode ? "Maintenance mode turned on — only admins can see the site." : "Maintenance mode turned off — the site is live again."
  );
}
