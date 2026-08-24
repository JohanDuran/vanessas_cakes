import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { users, authAccounts } from "./schema";
import { hashPassword } from "../lib/auth";

const [emailArg, password, name] = process.argv.slice(2);
if (!emailArg || !password) {
  console.error('Usage: npm run admin:create -- "email@example.com" "password" ["Display Name"]');
  process.exit(1);
}

async function main() {
  const email = emailArg.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const existingAccount = db
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "local"), eq(authAccounts.providerAccountId, email)))
    .get();

  if (existingAccount) {
    db.update(authAccounts)
      .set({ passwordHash, updatedAt: Date.now() })
      .where(eq(authAccounts.id, existingAccount.id))
      .run();
    db.update(users).set({ isAdmin: true, updatedAt: Date.now() }).where(eq(users.id, existingAccount.userId)).run();
    console.log(`Updated existing account for ${email} — password reset and granted admin access.`);
    return;
  }

  const user = db
    .insert(users)
    .values({ email, name: name?.trim() || email, isAdmin: true })
    .returning({ id: users.id })
    .get();
  db.insert(authAccounts).values({ userId: user.id, provider: "local", providerAccountId: email, passwordHash }).run();
  console.log(`Created admin account for ${email}.`);
}

main();
