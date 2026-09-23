import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

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

    const { booking_id } = await request.json()
    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
    }

    // Safety: Only delete if pending or failed, NEVER paid!
    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select('booking_id, payment_status, teams(team_name)')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (bErr || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }

    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'Cannot cancel a paid booking.' }, { status: 400 })
    }

    const { error: delErr } = await admin
      .from('bookings')
      .delete()
      .eq('booking_id', booking_id)
      .neq('payment_status', 'paid')

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Pending booking for ${(booking.teams as any)?.team_name || 'team'} was discarded.`,
    })
  } catch (err: any) {
    console.error('Cancel booking error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
