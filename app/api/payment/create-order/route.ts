import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookingId, amount } = await request.json()

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const admin = await createAdminClient()

    // Check if booking is valid & check test mode
    const { data: bookingRec, error: fetchErr } = await admin
      .from('bookings')
      .select('is_test_booking, slot_id, slots(entry_fee)')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (fetchErr || !bookingRec) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (bookingRec.is_test_booking) {
      return NextResponse.json({ error: 'Test mode booking — Razorpay payment bypassed.' }, { status: 400 })
    }

    const slotData = bookingRec.slots as any
    const finalAmount = (slotData?.entry_fee !== undefined && slotData?.entry_fee !== null)
      ? Number(slotData.entry_fee)
      : (Number(amount) || 50)

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay keys not configured on server' }, { status: 500 })
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })

    // Amount in paise (₹199 = 19900 paise)
    const options = {
      amount: Math.round(finalAmount * 100),
      currency: 'INR',
      receipt: bookingId,
      notes: {
        booking_id: bookingId,
        user_id: user.id,
      },
    }

    const order = await razorpay.orders.create(options)

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId,
    })
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create payment order' }, { status: 500 })
  }
}
