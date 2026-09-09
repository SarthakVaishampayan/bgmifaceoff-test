import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

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

  // Update booking to paid
  const { error } = await supabase
    .from('bookings')
    .update({ payment_status: 'paid', payment_id: paymentId })
    .eq('booking_id', bookingId)

  if (error) {
    console.error('Failed to update booking from webhook:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
