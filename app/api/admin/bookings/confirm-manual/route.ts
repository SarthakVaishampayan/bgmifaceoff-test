import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import { getNextAvailableRoomSlot } from '@/lib/utils/roomSlot'

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

    // 1. Fetch booking with slot details
    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select('*, slots(*), teams(team_name)')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (bErr || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }

    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'This booking is already marked as paid.' }, { status: 400 })
    }

    const slot = booking.slots
    if (!slot) {
      return NextResponse.json({ error: 'Associated match slot not found.' }, { status: 404 })
    }

    // 2. Allocate collision-free room slot
    const roomSlot = await getNextAvailableRoomSlot(admin, booking.slot_id, booking.team_id)

    // 3. Mark booking as paid
    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        room_slot_number: roomSlot,
        amount_paid: slot.entry_fee || 40,
        payment_id: 'MANUAL_ADMIN_VERIFIED',
      })
      .eq('booking_id', booking_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // 4. Increment slot teams_booked_count
    await admin
      .from('slots')
      .update({ teams_booked_count: (slot.teams_booked_count || 0) + 1 })
      .eq('slot_id', booking.slot_id)

    return NextResponse.json({
      success: true,
      message: `Booking manually confirmed for ${(booking.teams as any)?.team_name || 'Team'}! Assigned Room Slot #${roomSlot}.`,
      room_slot_number: roomSlot,
    })
  } catch (err: any) {
    console.error('Manual confirmation error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
