import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// In-memory cache for maintenance mode (persists across requests in same worker)
let maintenanceCache: { value: boolean; checkedAt: number } = { value: false, checkedAt: 0 }
const CACHE_TTL_MS = 30_000 // re-check every 30 seconds

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const isValidUrl = Boolean(
    supabaseUrl &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))
  )

  if (!isValidUrl || !supabaseAnonKey || supabaseUrl?.includes('your_supabase')) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      supabaseUrl as string,
      supabaseAnonKey as string,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const pathname = request.nextUrl.pathname

    // Skip maintenance check on allowed paths (no DB hit needed)
    const isAllowedPath =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/maintenance') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next')

    if (!isAllowedPath) {
      // Use cached value if fresh
      const now = Date.now()
      if (now - maintenanceCache.checkedAt > CACHE_TTL_MS) {
        const { data: configData } = await supabase
          .from('config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle()

        maintenanceCache = {
          value: configData?.value === 'true',
          checkedAt: now,
        }
      }

      if (maintenanceCache.value) {
        let isAdmin = false
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle()

          if (userData?.role === 'admin' || userData?.role === 'admin_scores') {
            isAdmin = true
          }
        }

        if (!isAdmin) {
          const url = request.nextUrl.clone()
          url.pathname = '/maintenance'
          return NextResponse.redirect(url)
        }
      }
    }

    // Protected routes
    if (pathname.startsWith('/onboard')) {
      const url = request.nextUrl.clone()
      url.pathname = user ? '/dashboard' : '/login'
      return NextResponse.redirect(url)
    }

    // Admin routes: redirect to dedicated admin login (skip /admin/login itself)
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin/login'
        return NextResponse.redirect(url)
      }
    }
  } catch (error) {
    console.error('Middleware Supabase error:', error)
  }

  return supabaseResponse
}
