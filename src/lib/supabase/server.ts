import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL env var is not set");
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY env var is not set");

/** A Supabase client bound to the current request's cookies — use in Server
 *  Components, Server Actions, and Route Handlers. Cookie writes are wrapped
 *  in try/catch since a plain Server Component can't set cookies; proxy.ts
 *  refreshes the session on every request instead, so a dropped write there
 *  is harmless (see Supabase's Next.js SSR guide). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // called from a Server Component — proxy.ts handles session refresh
        }
      },
    },
  });
}
