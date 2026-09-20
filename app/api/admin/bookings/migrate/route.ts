import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import { getNextAvailableRoomSlot } from '@/lib/utils/roomSlot'

// POST /api/admin/bookings/migrate
// Safely transfers a team's booking from their current slot to a new target slot.
// Preserves payment details, recalibrates slot counts, and assigns an in-game room slot number.
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
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    const { booking_id, new_slot_id } = await request.json()
    if (!booking_id || !new_slot_id) {
      return NextResponse.json({ error: 'Missing required parameters: booking_id and new_slot_id' }, { status: 400 })
    }

    // 1. Fetch current booking and related data
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select('booking_id, team_id, slot_id, payment_status, room_slot_number, is_test_booking, amount_paid, teams(team_id, team_name), slots(*)')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.slot_id === new_slot_id) {
      return NextResponse.json({ error: 'Team is already registered for this slot' }, { status: 400 })
    }

    const teamName = (booking.teams as any)?.team_name || 'Team'

    // 2. Fetch target slot
    const { data: newSlot, error: newSlotErr } = await admin
      .from('slots')
      .select('*')
      .eq('slot_id', new_slot_id)
      .maybeSingle()

    if (newSlotErr || !newSlot) {
      return NextResponse.json({ error: 'Target slot not found' }, { status: 404 })
    }

    if (newSlot.status === 'completed') {
      return NextResponse.json({ error: 'Target slot has already been completed' }, { status: 400 })
    }

    const targetCapacity = newSlot.capacity || 20
    const targetCount = newSlot.teams_booked_count || 0

    if (targetCount >= targetCapacity || newSlot.status === 'full') {
      return NextResponse.json({ error: `Target slot is at full capacity (${targetCount}/${targetCapacity})` }, { status: 400 })
    }

    // 3. Ensure team is not already booked in target slot (prevent UNIQUE constraint error)
    const { data: existingInTarget } = await admin
      .from('bookings')
      .select('booking_id')
      .eq('slot_id', new_slot_id)
      .eq('team_id', booking.team_id)
      .maybeSingle()

    if (existingInTarget) {
      return NextResponse.json({
        error: `Team "${teamName}" already has a booking registered in the target slot.`
      }, { status: 400 })
    }

    // 4. Safety lock: Check if match scores were already entered for this slot
    const { data: recordedMatches } = await admin
      .from('matches')
      .select('match_id')
      .eq('slot_id', booking.slot_id)
      .eq('team_id', booking.team_id)
      .limit(1)

    if (recordedMatches && recordedMatches.length > 0) {
      return NextResponse.json({
        error: 'Cannot migrate: Match scores have already been recorded for this team in their current slot.'
      }, { status: 400 })
    }

    // 5. Determine collision-free room_slot_number in the target slot (starting from 5)
    const assignedRoomSlot = await getNextAvailableRoomSlot(admin, new_slot_id)

    // 6. Update Target Slot: increment booked count, set full if capacity reached
    const updatedTargetCount = targetCount + 1
    const updatedTargetStatus = updatedTargetCount >= targetCapacity ? 'full' : newSlot.status

    const { error: targetUpdateErr } = await admin
      .from('slots')
      .update({
        teams_booked_count: updatedTargetCount,
        status: updatedTargetStatus,
      })
      .eq('slot_id', new_slot_id)

    if (targetUpdateErr) {
      return NextResponse.json({ error: `Failed to update target slot: ${targetUpdateErr.message}` }, { status: 500 })
    }

    // 7. Update Source Slot: decrement booked count, reopen if was full
    const oldSlot = booking.slots as any
    if (oldSlot) {
      const updatedOldCount = Math.max(0, (oldSlot.teams_booked_count || 1) - 1)
      const updatedOldStatus = oldSlot.status === 'full' ? 'open' : oldSlot.status

      await admin
        .from('slots')
        .update({
          teams_booked_count: updatedOldCount,
          status: updatedOldStatus,
        })
        .eq('slot_id', booking.slot_id)
    }

    // 8. Update Booking: assign new slot_id and new room_slot_number
    const { error: bookingUpdateErr } = await admin
      .from('bookings')
      .update({
        slot_id: new_slot_id,
        room_slot_number: assignedRoomSlot,
      })
      .eq('booking_id', booking_id)

    if (bookingUpdateErr) {
      // Rollback target and source slot counts if booking update fails
      await admin
        .from('slots')
        .update({
          teams_booked_count: targetCount,
          status: newSlot.status,
        })
        .eq('slot_id', new_slot_id)

      if (oldSlot) {
        await admin
          .from('slots')
          .update({
            teams_booked_count: oldSlot.teams_booked_count,
            status: oldSlot.status,
          })
          .eq('slot_id', booking.slot_id)
      }

      return NextResponse.json({ error: `Failed to update booking: ${bookingUpdateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Team "${teamName}" successfully migrated to ${newSlot.date} (${newSlot.time_label}). Assigned Room Slot #${assignedRoomSlot}.`,
      booking_id,
      old_slot_id: booking.slot_id,
      new_slot_id,
      new_room_slot_number: assignedRoomSlot,
      new_slot: {
        slot_id: newSlot.slot_id,
        date: newSlot.date,
        time_label: newSlot.time_label,
        teams_booked_count: updatedTargetCount,
        status: updatedTargetStatus,
        capacity: targetCapacity,
        whatsapp_link: newSlot.whatsapp_link,
      }
    })
  } catch (err: any) {
    console.error('Migrate booking API error:', err)
    return NextResponse.json({ error: err?.message || 'Server error while migrating booking' }, { status: 500 })
  }
}
