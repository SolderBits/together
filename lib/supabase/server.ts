import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfiguredServer() {
  return Boolean(url && anonKey);
}

/** Server-side Supabase client bound to the request's cookie jar. */
export async function getServerSupabase() {
  if (!isSupabaseConfiguredServer()) return null;
  const cookieStore = await cookies();
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (all: Array<{ name: string; value: string; options?: CookieOptions }>) => {
        try {
          all.forEach((c) => cookieStore.set(c.name, c.value, c.options));
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      },
    },
  });
}
