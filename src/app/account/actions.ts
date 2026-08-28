"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { profiles } from "../../db/schema";
import { getCurrentUser } from "../../db/queries";
import { createSupabaseServerClient } from "../../lib/supabase/server";

// Accepts digits with optional +, spaces, dashes, dots, and parentheses;
// the digit count (7-15) follows the E.164 range so both local and
// international numbers pass while junk input doesn't.
function isValidPhone(value: string): boolean {
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

const signupSchema = z
  .object({
    name: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().refine(isValidPhone),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
    marketingOptIn: z.boolean(),
    next: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string {
  return next && (next.startsWith("/account") || next.startsWith("/admin") || next.startsWith("/cart"))
    ? next
    : "/account";
}

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    marketingOptIn: formData.get("marketingOptIn") === "on",
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const error = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword")
      ? "mismatch"
      : "invalid";
    redirect(`/account/signup?error=${error}`);
  }

  const { name, email, phone, password, marketingOptIn, next } = parsed.data;
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/account/signup?error=invalid${nextParam}`);
  }
  if (!data.user) {
    redirect(`/account/signup?error=invalid${nextParam}`);
  }

  await db
    .insert(profiles)
    .values({ id: data.user.id, email, name, phone, marketingOptIn })
    .onConflictDoUpdate({ target: profiles.id, set: { email, name, phone, marketingOptIn } });

  // No session yet means Supabase Auth is waiting on email confirmation —
  // there's nothing more to do here until the customer clicks that link.
  if (!data.session) {
    redirect(`/account/login?notice=confirm-email${nextParam}`);
  }

  redirect(safeNext(next));
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    redirect(`/account/login?error=1`);
  }

  const { email, password, next } = parsed.data;
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/account/login?error=1${nextParam}`);
  }

  redirect(safeNext(next));
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateMarketingOptIn(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?next=/account");

  const marketingOptIn = formData.get("marketingOptIn") === "on";
  await db.update(profiles).set({ marketingOptIn }).where(eq(profiles.id, user.id));

  redirect("/account");
}
