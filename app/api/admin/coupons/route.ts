import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userProfile?.role !== 'admin' && userProfile?.role !== 'admin_scores') {
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
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userProfile?.role !== 'admin') {
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
