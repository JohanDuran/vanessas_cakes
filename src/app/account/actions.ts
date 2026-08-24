"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { users, authAccounts } from "../../db/schema";
import {
  createUserSessionToken,
  hashPassword,
  verifyPassword,
  USER_SESSION_COOKIE,
  USER_SESSION_TTL_MS,
} from "../../lib/auth";

const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/account") ? next : "/account";
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
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    redirect(`/account/signup?error=invalid`);
  }

  const { name, email, password, next } = parsed.data;
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
    const user = tx.insert(users).values({ name, email }).returning({ id: users.id }).get();
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
