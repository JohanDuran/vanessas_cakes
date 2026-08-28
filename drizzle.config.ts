import type { Config } from "drizzle-kit";

// drizzle-kit's CLI only auto-loads `.env`, not `.env.local` — load it
// ourselves so `npm run db:generate`/`db:migrate` pick up DATABASE_URL.
try {
  process.loadEnvFile(".env.local");
} catch {
  // missing in environments (e.g. Docker) that supply env vars directly
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL env var is not set");

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
