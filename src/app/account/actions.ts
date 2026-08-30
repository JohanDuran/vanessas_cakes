"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { profiles } from "../../db/schema";
import { getCurrentUser } from "../../db/queries";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getSiteUrl } from "../../lib/stripe";
import { toastRedirect } from "../../lib/toast";

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

// Only allows same-site relative paths — "//evil.com" or "/\evil.com" are
// browser-interpreted as protocol-relative URLs and would otherwise let
// `next` redirect off-site.
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/account";
}

export async function signup(formData: FormData) {
  const rawNext = formData.get("next");
  const nextExtra = typeof rawNext === "string" && rawNext ? { next: rawNext } : undefined;

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
    const message = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword")
      ? "Passwords do not match."
      : "Please check the form — all fields are required, including a valid email, a valid phone number, and an 8+ character password.";
    toastRedirect("/account/signup", "error", message, nextExtra);
  }

  const { name, email, phone, password, marketingOptIn, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    toastRedirect(
      "/account/signup",
      "error",
      "Please check the form — all fields are required, including a valid email, a valid phone number, and an 8+ character password.",
      nextExtra
    );
  }
  if (!data.user) {
    toastRedirect(
      "/account/signup",
      "error",
      "Please check the form — all fields are required, including a valid email, a valid phone number, and an 8+ character password.",
      nextExtra
    );
  }

  await db
    .insert(profiles)
    .values({ id: data.user.id, email, name, phone, marketingOptIn })
    .onConflictDoUpdate({ target: profiles.id, set: { email, name, phone, marketingOptIn } });

  // No session yet means Supabase Auth is waiting on email confirmation —
  // there's nothing more to do here until the customer clicks that link.
  if (!data.session) {
    toastRedirect(
      "/account/login",
      "success",
      "Almost there — check your email for a confirmation link before logging in.",
      nextExtra
    );
  }

  redirect(safeNext(next));
}

export async function login(formData: FormData) {
  const rawNext = formData.get("next");
  const nextExtra = typeof rawNext === "string" && rawNext ? { next: rawNext } : undefined;

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    toastRedirect("/account/login", "error", "Incorrect email or password. Try again.", nextExtra);
  }

  const { email, password, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    toastRedirect("/account/login", "error", "Incorrect email or password. Try again.", nextExtra);
  }

  redirect(safeNext(next));
}

export async function loginWithGoogle(formData: FormData) {
  const next = (formData.get("next") as string | null) ?? undefined;
  const nextExtra = next ? { next } : undefined;
  const nextParam = next ? `?next=${encodeURIComponent(next)}` : "";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${getSiteUrl()}/auth/callback${nextParam}` },
  });

  if (error || !data.url) {
    toastRedirect("/account/login", "error", "Couldn't start Google sign-in. Please try again.", nextExtra);
  }

  redirect(data.url);
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

  toastRedirect("/account", "success", "Preference saved!");
}
