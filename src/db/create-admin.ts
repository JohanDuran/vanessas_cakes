import { eq } from "drizzle-orm";
import { db } from "./index";
import { profiles } from "./schema";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const [emailArg, password, name] = process.argv.slice(2);
if (!emailArg || !password) {
  console.error('Usage: npm run admin:create -- "email@example.com" "password" ["Display Name"]');
  process.exit(1);
}

async function main() {
  const email = emailArg.trim().toLowerCase();
  const supabase = createSupabaseAdminClient();

  const existingProfile = await db.select().from(profiles).where(eq(profiles.email, email)).then((r) => r[0]);

  if (existingProfile) {
    const { error } = await supabase.auth.admin.updateUserById(existingProfile.id, { password });
    if (error) throw new Error(`Couldn't reset password: ${error.message}`);

    await db.update(profiles).set({ isAdmin: true, updatedAt: Date.now() }).where(eq(profiles.id, existingProfile.id));

    console.log(`Updated existing account for ${email} — password reset and granted admin access.`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Couldn't create Supabase Auth user: ${error?.message}`);

  await db.insert(profiles).values({
    id: data.user.id,
    email,
    name: name?.trim() || email,
    isAdmin: true,
  });

  console.log(`Created admin account for ${email}.`);
}

await main();
process.exit(0);
