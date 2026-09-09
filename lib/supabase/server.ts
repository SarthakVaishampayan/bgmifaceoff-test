import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getValidUrl(url?: string): string {
  if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('your_supabase')) {
    return url
  }
  return 'https://placeholder.supabase.co'
}

export async function createClient() {
  const cookieStore = await cookies()
  const url = getValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}

export async function createAdminClient() {
  const url = getValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-service-key'

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
