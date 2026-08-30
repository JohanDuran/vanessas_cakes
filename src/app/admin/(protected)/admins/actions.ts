"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import { profiles } from "../../../../db/schema";
import { requireAdmin } from "../../../../db/queries";
import { toastMessage, toastRedirect } from "../../../../lib/toast";

const PATH = "/admin/admins";

const userIdSchema = z.object({ userId: z.string().min(1) });

export async function promoteToAdmin(formData: FormData) {
  try {
    await requireAdmin();

    const { userId } = userIdSchema.parse(Object.fromEntries(formData));
    await db.update(profiles).set({ isAdmin: true, updatedAt: Date.now() }).where(eq(profiles.id, userId));

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't make this user an admin."));
  }

  toastRedirect(PATH, "success", "User is now an admin.");
}

export async function demoteFromAdmin(formData: FormData) {
  try {
    await requireAdmin();

    const { userId } = userIdSchema.parse(Object.fromEntries(formData));
    const target = await db.select().from(profiles).where(eq(profiles.id, userId)).then((r) => r[0]);
    if (!target?.isAdmin) throw new Error("This user isn't an admin.");

    const admins = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.isAdmin, true));
    if (admins.length <= 1) throw new Error("At least one admin must exist — make someone else an admin first.");

    await db.update(profiles).set({ isAdmin: false, updatedAt: Date.now() }).where(eq(profiles.id, userId));

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't remove admin access."));
  }

  toastRedirect(PATH, "success", "Admin access removed.");
}
