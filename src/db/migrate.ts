import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { db } from "./index";

await migrate(db, { migrationsFolder: path.join(process.cwd(), "src/db/migrations") });
console.log("Migrations applied.");
process.exit(0);
