import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSlotPastOrEnded } from '@/lib/utils/slotTime'

// POST /api/booking/create
export async function POST(request: Request) {
  try {
    const { slot_id, team_name, phone } = await request.json()

    if (!slot_id) {
      return NextResponse.json({ error: 'slot_id is required' }, { status: 400 })
    }

    // Verify auth
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Please sign in to book a slot.' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Get user's team profile & check test account status
    const { data: userProfile } = await admin
      .from('users')
      .select('team_id, is_test_account')
      .eq('user_id', user.id)
      .maybeSingle()

    let team_id = userProfile?.team_id
    let isTestAccount = Boolean(userProfile?.is_test_account)

    // Fallback: Check if user is already captain of an existing team in teams table
    if (!team_id) {
      const { data: existingTeam } = await admin
        .from('teams')
        .select('team_id, is_test_account')
        .eq('captain_user_id', user.id)
        .maybeSingle()

      if (existingTeam) {
        team_id = existingTeam.team_id
        if (existingTeam.is_test_account) isTestAccount = true
        await admin
          .from('users')
          .upsert({ user_id: user.id, email: user.email, team_id, role: 'captain' }, { onConflict: 'user_id' })
      }
    } else {
      const { data: teamRec } = await admin
        .from('teams')
        .select('is_test_account')
        .eq('team_id', team_id)
        .maybeSingle()
      if (teamRec?.is_test_account) isTestAccount = true
    }

    // If user has no team yet, create one seamlessly on the spot!
    if (!team_id) {
      const finalTeamName = (team_name && team_name.trim()) || user.email?.split('@')[0] || 'Team User'
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      let teamToInsert = finalTeamName
      let { data: newTeam, error: teamErr } = await admin
        .from('teams')
        .insert({
          team_name: teamToInsert,
          captain_user_id: user.id,
          invite_code: inviteCode,
          is_test_account: isTestAccount,
        })
        .select('team_id')
        .single()

      if (teamErr && teamErr.code === '23505') {
        teamToInsert = `${finalTeamName} ${Math.floor(1000 + Math.random() * 9000)}`
        const retry = await admin
          .from('teams')
          .insert({
            team_name: teamToInsert,
            captain_user_id: user.id,
            invite_code: inviteCode,
            is_test_account: isTestAccount,
          })
          .select('team_id')
          .single()
        newTeam = retry.data
        teamErr = retry.error
      }

      if (teamErr || !newTeam) {
        return NextResponse.json({ error: 'Failed to set up team name: ' + (teamErr?.message || 'Error creating team') }, { status: 500 })
      }

      team_id = newTeam.team_id
    }

    // Always ensure user profile in public.users has team_id linked (eliminates RLS violation 100%)
    if (team_id) {
      await admin
        .from('users')
        .upsert({
          user_id: user.id,
          email: user.email,
          team_id: team_id,
          role: 'captain',
        }, { onConflict: 'user_id' })
    }

    // Check slot exists and has capacity
    const { data: slot, error: slotErr } = await admin
      .from('slots')
      .select('slot_id, capacity, teams_booked_count, status, entry_fee, whatsapp_link, date, time_label')
      .eq('slot_id', slot_id)
      .single()

    if (slotErr || !slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    // Guard: Prevent booking expired / past date-time slots
    if (isSlotPastOrEnded(slot.date, slot.time_label, slot.status)) {
      return NextResponse.json({ error: 'This match slot has already ended and is closed for registration.' }, { status: 400 })
    }

    if (slot.status === 'full' || slot.teams_booked_count >= slot.capacity) {
      return NextResponse.json({ error: 'This slot is full. Please choose another slot.' }, { status: 409 })
    }

    // Check for duplicate booking
    const { data: existingBooking } = await admin
      .from('bookings')
      .select('booking_id, payment_status, is_test_booking')
      .eq('team_id', team_id)
      .eq('slot_id', slot_id)
      .maybeSingle()

    if (existingBooking) {
      if (existingBooking.payment_status === 'paid') {
        return NextResponse.json({ error: 'Your team has already booked this slot.' }, { status: 409 })
      }
    }

    // DIRECT INSTANT BOOKING MODE (Testing Mode requested by user: bypasses Razorpay popup for testing leaderboards & post-booking flows)
    const isTestMode = true
    if (isTestMode) {
      // Calculate FCFS room slot number starting from Slot 5 for this specific slot
      const { count: otherPaidCount } = await admin
        .from('bookings')
        .select('booking_id', { count: 'exact', head: true })
        .eq('slot_id', slot_id)
        .eq('payment_status', 'paid')
        .neq('team_id', team_id)

      const room_slot_number = 5 + (otherPaidCount || 0)

      let { data: booking, error: bookErr } = await admin
        .from('bookings')
        .upsert({
          team_id,
          slot_id,
          payment_status: 'paid',
          amount_paid: 0,
          is_test_booking: true,
          room_slot_number,
        }, { onConflict: 'team_id,slot_id' })
        .select('booking_id')
        .single()

      if (bookErr) {
        // Fallback using elevated admin client (bypasses RLS completely)
        const fallback = await admin
          .from('bookings')
          .upsert({
            team_id,
            slot_id,
            payment_status: 'paid',
            amount_paid: 0,
          }, { onConflict: 'team_id,slot_id' })
          .select('booking_id')
          .single()
        booking = fallback.data
        bookErr = fallback.error
      }

      if (bookErr) {
        return NextResponse.json({ error: 'Booking failed: ' + bookErr.message }, { status: 500 })
      }

      // Increment slot capacity count if this was not already paid
      if (!existingBooking || existingBooking.payment_status !== 'paid') {
        const newCount = (slot.teams_booked_count || 0) + 1
        const isFull = newCount >= slot.capacity
        await admin
          .from('slots')
          .update({
            teams_booked_count: newCount,
            status: isFull ? 'full' : slot.status,
          })
          .eq('slot_id', slot_id)
      }

      return NextResponse.json({
        success: true,
        booking_id: booking?.booking_id,
        is_test_booking: true,
        auto_confirmed: true,
        amount: 0,
      })
    }

    // Create or reuse pending booking for standard accounts
    if (existingBooking && existingBooking.booking_id) {
      return NextResponse.json({
        success: true,
        booking_id: existingBooking.booking_id,
        amount: slot.entry_fee ?? 50,
      })
    }

    let { data: booking, error: bookErr } = await admin
      .from('bookings')
      .upsert({
        team_id,
        slot_id,
        payment_status: 'pending',
        amount_paid: 0,
        is_test_booking: false,
      }, { onConflict: 'team_id,slot_id' })
      .select('booking_id')
      .single()

    if (bookErr) {
      // Fallback using elevated admin client (bypasses RLS completely)
      const fallback = await admin
        .from('bookings')
        .upsert({
          team_id,
          slot_id,
          payment_status: 'pending',
          amount_paid: 0,
        }, { onConflict: 'team_id,slot_id' })
        .select('booking_id')
        .single()
      booking = fallback.data
      bookErr = fallback.error
    }

    if (bookErr || !booking) {
      return NextResponse.json({ error: bookErr?.message || 'Failed to create booking' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      booking_id: booking.booking_id,
      amount: slot.entry_fee ?? 50,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
