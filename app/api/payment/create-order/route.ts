import { createClient } from '@/lib/supabase/server'
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

    if (!bookingId || !amount) {
      return NextResponse.json({ error: 'Missing bookingId or amount' }, { status: 400 })
    }

    // Check if booking is a test mode booking
    const { data: bookingRec } = await supabase
      .from('bookings')
      .select('is_test_booking')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (bookingRec?.is_test_booking) {
      return NextResponse.json({ error: 'Test mode booking — Razorpay payment bypassed.' }, { status: 400 })
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay keys not configured on server' }, { status: 500 })
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })

    // Amount in paise (₹50 = 5000 paise)
    const options = {
      amount: Math.round(amount * 100),
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
