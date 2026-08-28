import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL env var is not set");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY env var is not set");

/** Service-role client — full access, bypasses RLS. Server-only: never import
 *  this from anything that could run in or ship to the browser. Used for
 *  Storage read/write (see src/lib/uploads.ts) and admin-bootstrap/migration
 *  scripts that need to create Supabase Auth users directly. */
export function createSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
