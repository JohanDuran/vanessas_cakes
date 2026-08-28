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

// proxy.ts (Next.js Proxy/middleware) is bundled and executed separately
// from the rest of the app — it gets its own module instance of this file,
// and therefore its own separate connection pool from the one shared by
// pages/route handlers. `max` bounds each pool so the two combined can't
// exceed Supabase's session-pooler limit (pool_size: 15 as of writing);
// idle_timeout releases unused connections back instead of holding them
// for the life of the process.
const sql = postgres(process.env.DATABASE_URL, { max: 5, idle_timeout: 20 });

export const db = drizzle(sql, { schema });
