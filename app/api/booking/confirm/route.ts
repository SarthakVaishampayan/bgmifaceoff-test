import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getNextAvailableRoomSlot } from '@/lib/utils/roomSlot'

// POST /api/booking/confirm
// ─────────────────────────────────────────────────────────────
// THIS IS THE PAYMENT ABSTRACTION LAYER.
// Currently simulates payment success for testing.
// To integrate Razorpay: verify the payment signature here
// before calling the confirm logic below — the DB operations
// remain identical.
// ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { booking_id } = await request.json()

    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
    }

    // Verify auth
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Fetch the booking with slot info
    const { data: booking, error: bookErr } = await admin
      .from('bookings')
      .select('booking_id, team_id, slot_id, payment_status, is_test_booking, slots(slot_id, capacity, teams_booked_count, status, whatsapp_link, entry_fee, date, time_label)')
      .eq('booking_id', booking_id)
      .single()

    if (bookErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.payment_status === 'paid') {
      // Already confirmed — idempotent
      const slot = booking.slots as any
      return NextResponse.json({ success: true, already_paid: true, whatsapp_link: slot?.whatsapp_link || null })
    }

    // Security Guard: Check whether simulated confirmation is permitted
    const { data: userProfile } = await admin
      .from('users')
      .select('role, is_test_account')
      .eq('user_id', user.id)
      .maybeSingle()

    const hasRazorpayKeys = Boolean(
      (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) &&
      process.env.RAZORPAY_KEY_SECRET
    )

    const isTestAllowed = Boolean(
      booking.is_test_booking ||
      userProfile?.role === 'admin' ||
      userProfile?.is_test_account ||
      !hasRazorpayKeys
    )

    if (!isTestAllowed) {
      return NextResponse.json({
        error: 'Online payment required. Please complete registration via Razorpay.'
      }, { status: 403 })
    }

    const slot = booking.slots as any

    // Re-verify slot capacity (race condition guard)
    if (slot.status === 'full' || slot.teams_booked_count >= slot.capacity) {
      // Mark this booking as failed since slot filled up
      await admin.from('bookings').update({ payment_status: 'failed' }).eq('booking_id', booking_id)
      return NextResponse.json({ error: 'Slot just filled up before payment could complete. Please choose another slot.' }, { status: 409 })
    }

    // ── PAYMENT VERIFIED ──
    // Calculate collision-free room slot number starting from Slot 5 (fills gaps from migrations)
    const room_slot_number = await getNextAvailableRoomSlot(admin, booking.slot_id, booking.team_id)

    // Mark booking as paid & assign custom room slot
    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        amount_paid: slot.entry_fee ?? 40,
        room_slot_number,
      })
      .eq('booking_id', booking_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Fetch global whatsapp fallback if slot has none
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
      whatsapp_link: whatsappLink,
      room_slot_number,
      slot_date: slot.date,
      slot_time: slot.time_label,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
