import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL env var is not set");
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY env var is not set");

/** Builds a Supabase client for use in proxy.ts, plus the response object
 *  that must be returned so any refreshed session cookies actually reach the
 *  browser. Call `supabase.auth.getUser()` (never getSession() here — it
 *  doesn't revalidate the token) before returning `response`. */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  return { supabase, getResponse: () => response };
}
