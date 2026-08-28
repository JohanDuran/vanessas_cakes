import postgres from "postgres";
import fs from "node:fs";

const envText = fs.readFileSync("./.env.local", "utf8");
const url = envText.match(/^DATABASE_URL=(.+)$/m)[1].trim();

const sql = postgres(url, { max: 1 });
await sql`TRUNCATE TABLE field_options, fields RESTART IDENTITY CASCADE`;
console.log("Cleared fields + field_options (dev only).");
await sql.end({ timeout: 1 });
