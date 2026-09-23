import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// GET /api/admin/coupons
// Returns all coupons with team name, issued slot info, and redemption booking details
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()
    const isPermAdmin = isSuperAdminEmail(user.email)
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isPermAdmin && userProfile?.role !== 'admin' && userProfile?.role !== 'admin_scores') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: coupons, error: fetchErr } = await admin
      .from('coupons')
      .select('*, teams(team_name), slots!issued_from_slot(date, time_label), bookings(slot_id, created_at, slots(date, time_label))')
      .order('issued_at', { ascending: false })

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, coupons: coupons || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/coupons
// Manually issues a free slot coupon to a team
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()
    const isPermAdmin = isSuperAdminEmail(user.email)
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isPermAdmin && userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Super Admin privileges required' }, { status: 403 })
    }

    const { team_id, code: customCode } = await request.json()
    if (!team_id) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    const code = (customCode && customCode.trim()) ? customCode.trim().toUpperCase() : `FREE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const { data, error } = await admin
      .from('coupons')
      .insert({
        team_id,
        type: 'free_slot',
        status: 'unused',
        code,
      })
      .select('*, teams(team_name), slots!issued_from_slot(date, time_label), bookings(slot_id, created_at, slots(date, time_label))')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, coupon: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/coupons
// Safely cancels/deletes an unused coupon. Rejects if already used.
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()
    const isPermAdmin = isSuperAdminEmail(user.email)
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isPermAdmin && userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Super Admin privileges required' }, { status: 403 })
    }

    const { coupon_id } = await request.json()
    if (!coupon_id) {
      return NextResponse.json({ error: 'coupon_id is required' }, { status: 400 })
    }

    // 1. Fetch coupon to check its current status
    const { data: coupon, error: findErr } = await admin
      .from('coupons')
      .select('coupon_id, code, status, team_id, teams(team_name)')
      .eq('coupon_id', coupon_id)
      .maybeSingle()

    if (findErr || !coupon) {
      return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 })
    }

    // 2. Strict Safety Guard: If used, refuse to delete!
    if (coupon.status === 'used') {
      return NextResponse.json(
        { error: 'Cannot cancel: This coupon has already been redeemed and used by the team.' },
        { status: 400 }
      )
    }

    // 3. Delete unused coupon safely
    const { error: delErr } = await admin
      .from('coupons')
      .delete()
      .eq('coupon_id', coupon_id)
      .eq('status', 'unused')

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Coupon ${coupon.code} for ${(coupon.teams as any)?.team_name || 'team'} was successfully cancelled.`,
      cancelled_coupon_id: coupon_id,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

