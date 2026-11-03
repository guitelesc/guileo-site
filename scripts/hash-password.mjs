// scripts/hash-password.mjs — generates a PBKDF2 hash for seeding supabase/004_users.sql.
// Node 20+ exposes the Web Crypto API as a global, matching what
// functions/lib/naturaPassword.js uses on Cloudflare Workers, so the output format is identical.
// Usage: node scripts/hash-password.mjs "<new password>"
import { hashPassword } from "../functions/lib/naturaPassword.js";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs \"<password>\"");
  process.exit(1);
}

const hash = await hashPassword(password);
console.log(hash);
