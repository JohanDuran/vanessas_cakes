"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { users, authAccounts } from "../../db/schema";
import { getCurrentUser } from "../../db/queries";
import {
  createUserSessionToken,
  hashPassword,
  verifyPassword,
  USER_SESSION_COOKIE,
  USER_SESSION_TTL_MS,
} from "../../lib/auth";

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

async function startSession(userId: number) {
  const token = await createUserSessionToken(userId);
  const store = await cookies();
  store.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_TTL_MS / 1000,
  });
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

  const existing = db
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "local"), eq(authAccounts.providerAccountId, email)))
    .get();
  if (existing) {
    redirect(`/account/signup?error=taken${nextParam}`);
  }

  const passwordHash = await hashPassword(password);
  const userId = db.transaction((tx) => {
    const user = tx
      .insert(users)
      .values({ name, email, phone, marketingOptIn })
      .returning({ id: users.id })
      .get();
    tx.insert(authAccounts)
      .values({ userId: user.id, provider: "local", providerAccountId: email, passwordHash })
      .run();
    return user.id;
  });

  await startSession(userId);
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

  const account = db
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "local"), eq(authAccounts.providerAccountId, email)))
    .get();

  const ok = account?.passwordHash ? await verifyPassword(password, account.passwordHash) : false;
  if (!ok || !account) {
    redirect(`/account/login?error=1${nextParam}`);
  }

  await startSession(account.userId);
  redirect(safeNext(next));
}

export async function logout() {
  const store = await cookies();
  store.delete(USER_SESSION_COOKIE);
  redirect("/");
}

export async function updateMarketingOptIn(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?next=/account");

  const marketingOptIn = formData.get("marketingOptIn") === "on";
  db.update(users).set({ marketingOptIn }).where(eq(users.id, user.id)).run();

  redirect("/account");
}
