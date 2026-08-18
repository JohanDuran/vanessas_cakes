import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run admin:hash-password -- "your-password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
// Next.js expands "$VAR" in .env files, which corrupts a raw bcrypt hash —
// print the escaped form that's safe to paste directly into ADMIN_PASSWORD_HASH.
console.log("Paste into .env.local as ADMIN_PASSWORD_HASH:");
console.log(hash.replace(/\$/g, "\\$"));
