import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/admin/bookings/cancel
// Allows admin to cancel / delete a booking, clearing all related slot data and vacating the room slot number.
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

    if (!isPermAdmin && userProfile?.role !== 'admin' && userProfile?.role !== 'admin_scores') {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 403 })
    }

    const body = await request.json()
    const { booking_id } = body || {}

    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
    }

    // 1. Fetch booking details
    const { data: booking, error: fetchErr } = await admin
      .from('bookings')
      .select(`
        booking_id,
        slot_id,
        team_id,
        room_slot_number,
        payment_status,
        teams(team_name),
        slots(slot_id, date, time_label, teams_booked_count, capacity, status)
      `)
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }

    const slotId = booking.slot_id
    const teamId = booking.team_id
    const roomSlotNum = booking.room_slot_number || 5
    const teamName = (booking.teams as any)?.team_name || 'Team'
    const slotObj = booking.slots as any

    // 2. Delete the booking record
    const { error: deleteErr } = await admin
      .from('bookings')
      .delete()
      .eq('booking_id', booking_id)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message || 'Failed to delete booking.' }, { status: 500 })
    }

    // 3. Clear any matches recorded for this team in this slot
    if (slotId && teamId) {
      await admin
        .from('matches')
        .delete()
        .eq('slot_id', slotId)
        .eq('team_id', teamId)
    }

    // 4. Clear any pending payouts for this team in this slot
    if (slotId && teamId) {
      await admin
        .from('payouts')
        .delete()
        .eq('slot_id', slotId)
        .eq('team_id', teamId)
        .eq('status', 'pending')
    }

    // 5. Recalibrate slot count & status
    let updatedCount = 0
    if (slotObj) {
      const currentCount = slotObj.teams_booked_count || 1
      updatedCount = Math.max(0, currentCount - 1)
      const newStatus = slotObj.status === 'full' ? 'open' : slotObj.status

      await admin
        .from('slots')
        .update({
          teams_booked_count: updatedCount,
          status: newStatus,
        })
        .eq('slot_id', slotId)
    }

    return NextResponse.json({
      success: true,
      message: `Booking for ${teamName} canceled successfully. Room Slot #${roomSlotNum} is now vacant.`,
      booking_id,
      slot_id: slotId,
      vacated_room_slot_number: roomSlotNum,
      new_teams_booked_count: updatedCount,
    })
  } catch (err: any) {
    console.error('Error canceling booking:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
