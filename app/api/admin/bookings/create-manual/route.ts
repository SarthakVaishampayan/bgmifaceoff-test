import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import { getNextAvailableRoomSlot } from '@/lib/utils/roomSlot'

// POST /api/admin/bookings/create-manual
// Allows admin to manually create a confirmed booking for a registered or false/spot team in any slot.
// Works even after slot is closed or past, and assigns collision-free room_slot_number.
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
    const { slot_id, team_id, team_name, is_false_team, amount_paid } = body || {}

    if (!slot_id) {
      return NextResponse.json({ error: 'slot_id is required' }, { status: 400 })
    }

    // 1. Fetch slot info
    const { data: slot, error: slotErr } = await admin
      .from('slots')
      .select('*')
      .eq('slot_id', slot_id)
      .maybeSingle()

    if (slotErr || !slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    let targetTeamId = team_id
    let targetTeamName = team_name || ''

    // 2. Handle team resolution
    if (is_false_team) {
      const trimmedName = String(team_name || '').trim()
      if (!trimmedName || trimmedName.length < 2) {
        return NextResponse.json({ error: 'Please provide a valid team name (at least 2 characters).' }, { status: 400 })
      }

      // Check if team already exists by exact name (case-insensitive)
      const { data: existingTeam } = await admin
        .from('teams')
        .select('team_id, team_name')
        .ilike('team_name', trimmedName)
        .maybeSingle()

      if (existingTeam) {
        targetTeamId = existingTeam.team_id
        targetTeamName = existingTeam.team_name
      } else {
        // Create new team
        const { data: newTeam, error: newTeamErr } = await admin
          .from('teams')
          .insert({ team_name: trimmedName })
          .select('team_id, team_name')
          .single()

        if (newTeamErr || !newTeam) {
          return NextResponse.json({ error: newTeamErr?.message || 'Failed to create team record' }, { status: 500 })
        }
        targetTeamId = newTeam.team_id
        targetTeamName = newTeam.team_name
      }
    } else {
      if (!targetTeamId) {
        return NextResponse.json({ error: 'Please select a registered team.' }, { status: 400 })
      }

      const { data: teamObj, error: teamErr } = await admin
        .from('teams')
        .select('team_id, team_name')
        .eq('team_id', targetTeamId)
        .maybeSingle()

      if (teamErr || !teamObj) {
        return NextResponse.json({ error: 'Selected team not found.' }, { status: 404 })
      }
      targetTeamName = teamObj.team_name
    }

    // 3. Check if team is already booked in this slot
    const { data: existingBooking } = await admin
      .from('bookings')
      .select('booking_id, room_slot_number')
      .eq('slot_id', slot_id)
      .eq('team_id', targetTeamId)
      .eq('payment_status', 'paid')
      .maybeSingle()

    if (existingBooking) {
      return NextResponse.json({
        error: `Team "${targetTeamName}" is already booked in this slot (Room Slot #${existingBooking.room_slot_number || 5}).`
      }, { status: 400 })
    }

    // 4. Assign next available room slot number (gaps filled starting from 5)
    const room_slot_number = await getNextAvailableRoomSlot(admin, slot_id, targetTeamId)

    // 5. Insert confirmed paid booking
    const paymentId = is_false_team ? 'FREE_SPOT_ENTRY' : 'MANUAL_DIRECT_BOOKING'
    const finalAmount = typeof amount_paid === 'number' ? amount_paid : (slot.entry_fee || 50)

    const { data: newBooking, error: bookErr } = await admin
      .from('bookings')
      .insert({
        slot_id,
        team_id: targetTeamId,
        payment_status: 'paid',
        payment_id: paymentId,
        room_slot_number,
        coupon_used: false,
        is_test_booking: false,
        amount_paid: finalAmount,
      })
      .select(`
        booking_id,
        slot_id,
        team_id,
        room_slot_number,
        payment_status,
        payment_id,
        amount_paid,
        coupon_used,
        is_test_booking,
        created_at,
        teams(team_id, team_name),
        slots(slot_id, date, time_label, whatsapp_link, status, capacity, teams_booked_count)
      `)
      .single()

    if (bookErr || !newBooking) {
      return NextResponse.json({ error: bookErr?.message || 'Failed to create booking.' }, { status: 500 })
    }

    // 6. Recalibrate slot count & status
    const currentBookedCount = slot.teams_booked_count || 0
    const newBookedCount = currentBookedCount + 1
    const isNowFull = newBookedCount >= (slot.capacity || 20)

    await admin
      .from('slots')
      .update({
        teams_booked_count: newBookedCount,
        status: isNowFull ? 'full' : (slot.status === 'not_open' ? 'not_open' : slot.status),
      })
      .eq('slot_id', slot_id)

    return NextResponse.json({
      success: true,
      message: `Booking created for ${targetTeamName} (Assigned Room Slot #${room_slot_number})!`,
      booking: newBooking,
      room_slot_number,
      teams_booked_count: newBookedCount,
    })
  } catch (err: any) {
    console.error('Error creating manual booking:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
