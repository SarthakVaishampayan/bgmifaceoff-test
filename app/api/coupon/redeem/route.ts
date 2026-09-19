import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSlotPastOrEnded } from '@/lib/utils/slotTime'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/coupon/redeem
export async function POST(request: Request) {
  try {
    const { coupon_id, slot_id, team_name, phone } = await request.json()

    if (!coupon_id || !slot_id) {
      return NextResponse.json({ error: 'coupon_id and slot_id are required' }, { status: 400 })
    }

    // Verify auth
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Get user's team
    const { data: userProfile } = await admin
      .from('users')
      .select('team_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    let team_id = userProfile?.team_id
    const assignedRole = isSuperAdminEmail(user.email)
      ? 'admin'
      : ((userProfile?.role === 'admin' || userProfile?.role === 'admin_scores') ? userProfile.role : 'captain')

    if (!team_id) {
      const finalTeamName = (team_name && team_name.trim()) || user.email?.split('@')[0] || 'Team User'
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      const { data: newTeam, error: teamErr } = await admin
        .from('teams')
        .insert({
          team_name: finalTeamName,
          captain_user_id: user.id,
          invite_code: inviteCode,
          phone: phone || null,
        })
        .select('team_id')
        .single()

      if (teamErr) {
        return NextResponse.json({ error: 'Failed to set up team: ' + teamErr.message }, { status: 500 })
      }

      team_id = newTeam.team_id

      await admin
        .from('users')
        .upsert({
          user_id: user.id,
          email: user.email,
          team_id: team_id,
          role: assignedRole,
        }, { onConflict: 'user_id' })
    }

    // Guard: Re-verify coupon is still valid
    const { data: coupon, error: couponErr } = await admin
      .from('coupons')
      .select('coupon_id, status, team_id')
      .eq('coupon_id', coupon_id)
      .single()

    if (couponErr || !coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }
    if (coupon.team_id !== team_id) {
      return NextResponse.json({ error: 'This coupon was not issued to your team' }, { status: 403 })
    }
    if (coupon.status === 'used') {
      return NextResponse.json({ error: 'This coupon has already been used' }, { status: 409 })
    }

    // Check slot capacity & date-time expiration
    const { data: slot, error: slotErr } = await admin
      .from('slots')
      .select('slot_id, capacity, teams_booked_count, status, whatsapp_link, date, time_label')
      .eq('slot_id', slot_id)
      .single()

    if (slotErr || !slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    if (isSlotPastOrEnded(slot.date, slot.time_label, slot.status)) {
      return NextResponse.json({
        error: 'Registration for this slot is closed. Slots automatically close 10 minutes before the match start time.'
      }, { status: 400 })
    }
    if (slot.status === 'full' || slot.teams_booked_count >= slot.capacity) {
      return NextResponse.json({ error: 'This slot is full. Please choose another slot.' }, { status: 409 })
    }

    // Check no duplicate booking
    const { data: existingBooking } = await admin
      .from('bookings')
      .select('booking_id, payment_status, room_slot_number')
      .eq('team_id', team_id)
      .eq('slot_id', slot_id)
      .maybeSingle()

    if (existingBooking?.payment_status === 'paid') {
      return NextResponse.json({ error: 'Your team has already booked this slot.' }, { status: 409 })
    }

    // Atomically mark coupon as used (guarantees strictly 1 single-use even under concurrent clicks)
    const { data: updatedCoupon, error: couponUpdateErr } = await admin
      .from('coupons')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('coupon_id', coupon_id)
      .eq('status', 'unused')
      .select('coupon_id')
      .maybeSingle()

    if (couponUpdateErr || !updatedCoupon) {
      return NextResponse.json({ error: 'This coupon has already been redeemed or is no longer valid.' }, { status: 409 })
    }

    // Compute room_slot_number
    const { count: otherPaidCount } = await admin
      .from('bookings')
      .select('booking_id', { count: 'exact', head: true })
      .eq('slot_id', slot_id)
      .eq('payment_status', 'paid')
      .neq('team_id', team_id)

    const room_slot_number = existingBooking?.room_slot_number || (5 + (otherPaidCount || 0))

    // Create or update booking as paid
    let bookingId: string

    if (existingBooking) {
      const { data: updatedBooking, error: bookUpdateErr } = await admin
        .from('bookings')
        .update({
          payment_status: 'paid',
          amount_paid: 0,
          coupon_used: true,
          coupon_id,
          room_slot_number,
        })
        .eq('booking_id', existingBooking.booking_id)
        .select('booking_id')
        .single()

      if (bookUpdateErr) {
        // Rollback coupon if booking fails
        await admin.from('coupons').update({ status: 'unused', used_at: null }).eq('coupon_id', coupon_id)
        return NextResponse.json({ error: bookUpdateErr.message }, { status: 500 })
      }
      bookingId = updatedBooking.booking_id
    } else {
      const { data: newBooking, error: bookErr } = await admin
        .from('bookings')
        .insert({
          team_id,
          slot_id,
          payment_status: 'paid',
          amount_paid: 0,
          coupon_used: true,
          coupon_id,
          room_slot_number,
        })
        .select('booking_id')
        .single()

      if (bookErr) {
        // Rollback coupon if booking fails
        await admin.from('coupons').update({ status: 'unused', used_at: null }).eq('coupon_id', coupon_id)
        return NextResponse.json({ error: bookErr.message }, { status: 500 })
      }
      bookingId = newBooking.booking_id
    }

    // Increment slot teams_booked_count
    const newCount = (slot.teams_booked_count || 0) + 1
    const isFull = newCount >= slot.capacity
    await admin
      .from('slots')
      .update({
        teams_booked_count: newCount,
        status: isFull ? 'full' : slot.status,
      })
      .eq('slot_id', slot_id)

    let whatsappLink = slot.whatsapp_link || null
    if (!whatsappLink) {
      const { data: config } = await admin
        .from('config')
        .select('value')
        .eq('key', 'whatsapp_invite_link')
        .single()
      whatsappLink = config?.value || null
    }

    return NextResponse.json({
      success: true,
      booking_id: bookingId,
      whatsapp_link: whatsappLink,
      slot_date: slot.date,
      slot_time: slot.time_label,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
