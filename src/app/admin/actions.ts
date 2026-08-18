"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionToken, verifyAdminPassword, SESSION_COOKIE, SESSION_TTL_MS } from "../../lib/auth";

const loginSchema = z.object({
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    redirect(`/admin/login?error=1`);
  }

  const ok = await verifyAdminPassword(parsed.data.password);
  if (!ok) {
    const next = parsed.data.next ? `&next=${encodeURIComponent(parsed.data.next)}` : "";
    redirect(`/admin/login?error=1${next}`);
  }

  const token = await createSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  redirect(parsed.data.next && parsed.data.next.startsWith("/admin") ? parsed.data.next : "/admin");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
