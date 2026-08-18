export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    const path = await import("node:path");
    const { db } = await import("./db");
    migrate(db, { migrationsFolder: path.join(process.cwd(), "src/db/migrations") });
    console.log("[db] migrations applied");
  }
}
