import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import { getNextAvailableRoomSlot } from '@/lib/utils/roomSlot'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

// POST /api/admin/slots/add-false-team
// Allows admin to add an on-spot / giveaway / false team directly to a slot during score entry
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
      return NextResponse.json({ error: 'Super Admin or Score Admin privileges required' }, { status: 403 })
    }

    const body = await request.json()
    const { slot_id, team_name, reuse_existing } = body || {}

    if (!slot_id) {
      return NextResponse.json({ error: 'slot_id is required' }, { status: 400 })
    }

    const trimmedName = (team_name || '').trim()
    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json({ error: 'Please provide a valid team name (at least 2 characters).' }, { status: 400 })
    }

    // 1. Verify slot exists
    const { data: slot, error: slotErr } = await admin
      .from('slots')
      .select('slot_id, teams_booked_count, capacity, date, time_label')
      .eq('slot_id', slot_id)
      .maybeSingle()

    if (slotErr || !slot) {
      return NextResponse.json({ error: 'Slot not found.' }, { status: 404 })
    }

    // 2. Check for name duplicacy across the database (case-insensitive)
    const { data: existingTeam } = await admin
      .from('teams')
      .select('team_id, team_name')
      .ilike('team_name', trimmedName)
      .maybeSingle()

    let targetTeamId: string
    let targetTeamName: string

    if (existingTeam) {
      // 2a. Check if already registered in THIS slot
      const { data: slotBooking } = await admin
        .from('bookings')
        .select('booking_id, room_slot_number')
        .eq('slot_id', slot_id)
        .eq('team_id', existingTeam.team_id)
        .maybeSingle()

      if (slotBooking) {
        return NextResponse.json(
          {
            error: `Team "${existingTeam.team_name}" is already registered in this slot (Assigned Room Slot #${slotBooking.room_slot_number || 5}).`,
            is_in_slot: true,
          },
          { status: 400 }
        )
      }

      // 2b. If team exists elsewhere and admin hasn't confirmed reusing it, prompt them
      if (!reuse_existing) {
        return NextResponse.json({
          team_exists: true,
          existing_team: {
            team_id: existingTeam.team_id,
            team_name: existingTeam.team_name,
          },
          message: `A team named "${existingTeam.team_name}" already exists in the system. Would you like to add this existing team to this slot?`,
        })
      }

      // 2c. Admin approved reusing existing team
      targetTeamId = existingTeam.team_id
      targetTeamName = existingTeam.team_name
    } else {
      // 2d. Completely new team — insert into teams
      const { data: newTeam, error: teamErr } = await admin
        .from('teams')
        .insert({
          team_name: trimmedName,
        })
        .select('team_id, team_name')
        .single()

      if (teamErr || !newTeam) {
        return NextResponse.json(
          { error: teamErr?.message || 'Failed to create team' },
          { status: 500 }
        )
      }

      targetTeamId = newTeam.team_id
      targetTeamName = newTeam.team_name
    }

    // 3. Compute collision-free room_slot_number (starting from 5)
    const room_slot_number = await getNextAvailableRoomSlot(admin, slot_id, targetTeamId)

    // 4. Create confirmed paid booking for the spot team
    const { data: newBooking, error: bookErr } = await admin
      .from('bookings')
      .insert({
        slot_id,
        team_id: targetTeamId,
        payment_status: 'paid',
        payment_id: 'FREE_SPOT_ENTRY',
        room_slot_number,
        coupon_used: false,
        is_test_booking: false,
      })
      .select('booking_id, slot_id, team_id, room_slot_number, payment_status, created_at, teams(team_id, team_name)')
      .single()

    if (bookErr || !newBooking) {
      return NextResponse.json(
        { error: bookErr?.message || 'Failed to create booking for team.' },
        { status: 500 }
      )
    }

    // 5. Increment slot teams_booked_count
    const updatedCount = (slot.teams_booked_count || 0) + 1
    await admin
      .from('slots')
      .update({ teams_booked_count: updatedCount })
      .eq('slot_id', slot_id)

    // 6. Revalidate cache
    try {
      revalidatePath('/leaderboard')
      revalidatePath('/admin')
    } catch {}

    return NextResponse.json({
      success: true,
      team: {
        team_id: targetTeamId,
        team_name: targetTeamName,
        room_slot_number,
      },
      booking: newBooking,
      message: `Team "${targetTeamName}" was successfully added to Slot ${slot.time_label || ''} as Room Slot #${room_slot_number}!`,
    })
  } catch (err: any) {
    console.error('Add false team error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/slots/add-false-team
// Safely removes a false/spot team from a slot and cleans up their slot booking and any entered scores for that slot
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

    if (!isPermAdmin && userProfile?.role !== 'admin' && userProfile?.role !== 'admin_scores') {
      return NextResponse.json({ error: 'Super Admin or Score Admin privileges required' }, { status: 403 })
    }

    const body = await request.json()
    const { slot_id, team_id } = body || {}

    if (!slot_id || !team_id) {
      return NextResponse.json({ error: 'slot_id and team_id are required' }, { status: 400 })
    }

    // 1. Fetch booking to verify it's a false/spot team (payment_id === 'FREE_SPOT_ENTRY')
    const { data: booking, error: findErr } = await admin
      .from('bookings')
      .select('booking_id, slot_id, team_id, payment_id, teams(team_name)')
      .eq('slot_id', slot_id)
      .eq('team_id', team_id)
      .maybeSingle()

    if (findErr || !booking) {
      return NextResponse.json({ error: 'No booking found for this team in this slot.' }, { status: 404 })
    }

    const teamName = (booking.teams as any)?.team_name || 'Team'

    // Strict Safety Guard: only allow removing false/spot giveaway teams
    if (booking.payment_id !== 'FREE_SPOT_ENTRY') {
      return NextResponse.json(
        { error: `Cannot remove: "${teamName}" is a regular paid booking, not a false/spot team.` },
        { status: 400 }
      )
    }

    // 2. Delete the booking
    const { error: delBookErr } = await admin
      .from('bookings')
      .delete()
      .eq('booking_id', booking.booking_id)

    if (delBookErr) {
      return NextResponse.json({ error: delBookErr.message }, { status: 500 })
    }

    // 3. Delete any matches entered for this team in this slot
    await admin
      .from('matches')
      .delete()
      .eq('slot_id', slot_id)
      .eq('team_id', team_id)

    // 4. Clean up Chicken Dinner winners if this team was selected
    const { data: winConfig } = await admin
      .from('config')
      .select('value')
      .eq('key', `slot_winners_${slot_id}`)
      .maybeSingle()

    if (winConfig?.value) {
      try {
        const parsed = JSON.parse(winConfig.value)
        let changed = false
        if (parsed.m1 === team_id) { parsed.m1 = ''; changed = true }
        if (parsed.m2 === team_id) { parsed.m2 = ''; changed = true }
        if (parsed.m3 === team_id) { parsed.m3 = ''; changed = true }
        if (changed) {
          await admin.from('config').upsert({
            key: `slot_winners_${slot_id}`,
            value: JSON.stringify(parsed),
          }, { onConflict: 'key' })
        }
      } catch {}
    }

    // 5. Decrement slot teams_booked_count
    const { data: slot } = await admin
      .from('slots')
      .select('teams_booked_count')
      .eq('slot_id', slot_id)
      .maybeSingle()

    if (slot && (slot.teams_booked_count || 0) > 0) {
      await admin
        .from('slots')
        .update({ teams_booked_count: Math.max(0, (slot.teams_booked_count || 1) - 1) })
        .eq('slot_id', slot_id)
    }

    // 6. Revalidate cache
    try {
      revalidatePath('/leaderboard')
      revalidatePath('/admin')
    } catch {}

    return NextResponse.json({
      success: true,
      message: `False team "${teamName}" was successfully removed from this slot.`,
    })
  } catch (err: any) {
    console.error('Remove false team error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
