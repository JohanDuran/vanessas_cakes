"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import { users } from "../../../../db/schema";
import { getCurrentUser } from "../../../../db/queries";
import { toastMessage, toastRedirect } from "../../../../lib/adminToast";

const PATH = "/admin/admins";

const userIdSchema = z.object({ userId: z.coerce.number().int() });

export async function promoteToAdmin(formData: FormData) {
  try {
    const caller = await getCurrentUser();
    if (!caller?.isAdmin) throw new Error("Not authorized.");

    const { userId } = userIdSchema.parse(Object.fromEntries(formData));
    db.update(users).set({ isAdmin: true, updatedAt: Date.now() }).where(eq(users.id, userId)).run();

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't make this user an admin."));
  }

  toastRedirect(PATH, "success", "User is now an admin.");
}

export async function demoteFromAdmin(formData: FormData) {
  try {
    const caller = await getCurrentUser();
    if (!caller?.isAdmin) throw new Error("Not authorized.");

    const { userId } = userIdSchema.parse(Object.fromEntries(formData));
    const target = db.select().from(users).where(eq(users.id, userId)).get();
    if (!target?.isAdmin) throw new Error("This user isn't an admin.");

    const adminCount = db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).all().length;
    if (adminCount <= 1) throw new Error("At least one admin must exist — make someone else an admin first.");

    db.update(users).set({ isAdmin: false, updatedAt: Date.now() }).where(eq(users.id, userId)).run();

    revalidatePath(PATH);
  } catch (err) {
    toastRedirect(PATH, "error", toastMessage(err, "Couldn't remove admin access."));
  }

  toastRedirect(PATH, "success", "Admin access removed.");
}
