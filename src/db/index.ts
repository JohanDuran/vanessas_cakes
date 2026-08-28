import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Next.js loads .env.local itself, but scripts run directly via `tsx`
// (db:migrate, db:seed, admin:create, ...) don't — load it here so both paths work.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // missing in environments (e.g. Docker) that supply env vars directly
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL env var is not set");

const sql = postgres(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
