import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getNextAvailableRoomSlot } from '@/lib/utils/roomSlot'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, bookingId } = await request.json()

    if (!razorpayPaymentId || !razorpayOrderId || !bookingId) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

    const secret = process.env.RAZORPAY_KEY_SECRET

    if (secret && razorpaySignature) {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex')

      if (generatedSignature !== razorpaySignature) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
      }
    } else if (!secret) {
      console.warn('RAZORPAY_KEY_SECRET not set, signature check skipped')
    }

    const admin = await createAdminClient()

    // Fetch booking details with slot info
    const { data: booking, error: bookErr } = await admin
      .from('bookings')
      .select('booking_id, team_id, slot_id, payment_status, room_slot_number, slots(slot_id, capacity, teams_booked_count, status, whatsapp_link, entry_fee, date, time_label)')
      .eq('booking_id', bookingId)
      .single()

    if (bookErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const slot = booking.slots as any

    if (booking.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        already_paid: true,
        whatsapp_link: slot?.whatsapp_link || null,
        room_slot_number: booking.room_slot_number,
      })
    }

    // Calculate collision-free room slot number starting from Slot 5 (fills gaps from migrations)
    const room_slot_number = await getNextAvailableRoomSlot(admin, booking.slot_id, booking.team_id)

    // Mark booking as paid & assign room slot number
    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        payment_status: 'paid',
        payment_id: razorpayPaymentId,
        amount_paid: slot?.entry_fee ?? 40,
        room_slot_number,
      })
      .eq('booking_id', bookingId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Increment slot capacity count
    if (slot) {
      const newCount = (slot.teams_booked_count || 0) + 1
      const isFull = newCount >= (slot.capacity || 20)
      await admin
        .from('slots')
        .update({
          teams_booked_count: newCount,
          status: isFull ? 'full' : slot.status,
        })
        .eq('slot_id', booking.slot_id)
    }

    // Fetch global whatsapp fallback if slot has none
    let whatsappLink = slot?.whatsapp_link || null
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
      slot_date: slot?.date,
      slot_time: slot?.time_label,
    })
  } catch (error: any) {
    console.error('Error verifying payment:', error)
    return NextResponse.json({ error: error?.message || 'Verification failed' }, { status: 500 })
  }
}
