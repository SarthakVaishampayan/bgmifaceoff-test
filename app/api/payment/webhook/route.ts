import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getNextAvailableRoomSlot } from '@/lib/utils/roomSlot'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature') || ''
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  // Verify signature if secret is provided in environment
  if (webhookSecret && signature) {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      console.error('Invalid Razorpay signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Razorpay event structure for payment.captured or order.paid
  const event = payload?.event
  const paymentEntity = payload?.payload?.payment?.entity
  const orderEntity = payload?.payload?.order?.entity

  const paymentId = paymentEntity?.id || payload?.razorpay_payment_id
  const bookingId = paymentEntity?.notes?.booking_id ||
                    orderEntity?.notes?.booking_id ||
                    orderEntity?.receipt ||
                    payload?.notes?.booking_id

  if (!bookingId) {
    console.log('Webhook received without booking_id, event:', event)
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }

  const supabase = await createAdminClient()

  // Fetch booking
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('booking_id, team_id, slot_id, payment_status, slots(slot_id, capacity, teams_booked_count, status, entry_fee)')
    .eq('booking_id', bookingId)
    .single()

  if (fetchErr || !booking) {
    console.error('Booking not found in webhook:', bookingId)
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // If already marked as paid (e.g. by verify endpoint), succeed idempotently
  if (booking.payment_status === 'paid') {
    return NextResponse.json({ success: true, already_paid: true })
  }

  const slot = booking.slots as any

  // Calculate collision-free room slot number starting from Slot 5 (fills gaps from migrations)
  const room_slot_number = await getNextAvailableRoomSlot(supabase, booking.slot_id, booking.team_id)

  // Update booking to paid
  const { error } = await supabase
    .from('bookings')
    .update({
      payment_status: 'paid',
      payment_id: paymentId,
      amount_paid: slot?.entry_fee ?? 50,
      room_slot_number,
    })
    .eq('booking_id', bookingId)

  if (error) {
    console.error('Failed to update booking from webhook:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Increment slot count
  if (slot) {
    const newCount = (slot.teams_booked_count || 0) + 1
    const isFull = newCount >= (slot.capacity || 20)
    await supabase
      .from('slots')
      .update({
        teams_booked_count: newCount,
        status: isFull ? 'full' : slot.status,
      })
      .eq('slot_id', booking.slot_id)
  }

  return NextResponse.json({ success: true })
}
