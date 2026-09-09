import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/coupon/validate
// Validates a coupon code for the authenticated user's team.
// Does NOT reveal if the code exists but belongs to a different team
// (returns invalid in both cases — no oracle attack surface).
export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code?.trim()) {
      return NextResponse.json({ valid: false, error: 'No code provided' })
    }

    // Verify auth
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ valid: false, error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Get user's team
    const { data: userProfile } = await admin
      .from('users')
      .select('team_id')
      .eq('user_id', user.id)
      .single()

    if (!userProfile?.team_id) {
      return NextResponse.json({ valid: false, error: 'No team found' })
    }

    // Look up coupon — must belong to this team and be unused
    const { data: coupon } = await admin
      .from('coupons')
      .select('coupon_id, status, team_id, code')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle()

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'Invalid coupon code' })
    }

    if (coupon.team_id !== userProfile.team_id) {
      // Don't reveal it exists — treat same as invalid
      return NextResponse.json({ valid: false, error: 'Invalid coupon code' })
    }

    if (coupon.status === 'used') {
      return NextResponse.json({ valid: false, error: 'This coupon has already been used' })
    }

    return NextResponse.json({
      valid: true,
      coupon_id: coupon.coupon_id,
    })
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
