import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
      .select('booking_id, team_id, slot_id, payment_status, slots(slot_id, capacity, teams_booked_count, status, whatsapp_link, entry_fee, date, time_label)')
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

    const slot = booking.slots as any

    // Re-verify slot capacity (race condition guard)
    if (slot.status === 'full' || slot.teams_booked_count >= slot.capacity) {
      // Mark this booking as failed since slot filled up
      await admin.from('bookings').update({ payment_status: 'failed' }).eq('booking_id', booking_id)
      return NextResponse.json({ error: 'Slot just filled up before payment could complete. Please choose another slot.' }, { status: 409 })
    }

    // ── PAYMENT VERIFIED ──
    // Calculate FCFS room slot number starting from Slot 5 for this specific slot
    const { count: otherPaidCount } = await admin
      .from('bookings')
      .select('booking_id', { count: 'exact', head: true })
      .eq('slot_id', booking.slot_id)
      .eq('payment_status', 'paid')
      .neq('team_id', booking.team_id)

    const room_slot_number = 5 + (otherPaidCount || 0)

    // Mark booking as paid & assign custom room slot
    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        amount_paid: slot.entry_fee ?? 50,
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
      slot_date: slot.date,
      slot_time: slot.time_label,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
