import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

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
    }

    // Mark booking as paid
    const { error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        payment_id: razorpayPaymentId,
      })
      .eq('booking_id', bookingId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error verifying payment:', error)
    return NextResponse.json({ error: error?.message || 'Verification failed' }, { status: 500 })
  }
}
