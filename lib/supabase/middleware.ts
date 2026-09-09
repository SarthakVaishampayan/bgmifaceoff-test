import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const isValidUrl = Boolean(
    supabaseUrl &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))
  )

  // Safety fallback if Supabase credentials are missing or placeholder
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

    // Maintenance Mode Check
    const isAllowedPath =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/maintenance') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next')

    if (!isAllowedPath) {
      const { data: configData } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle()

      if (configData?.value === 'true') {
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
    const adminPaths = ['/admin']

    if (pathname.startsWith('/onboard')) {
      const url = request.nextUrl.clone()
      url.pathname = user ? '/dashboard' : '/login'
      return NextResponse.redirect(url)
    }

    if (adminPaths.some(p => pathname.startsWith(p))) {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    }
  } catch (error) {
    console.error('Middleware Supabase error:', error)
  }

  return supabaseResponse
}
