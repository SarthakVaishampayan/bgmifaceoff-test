import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/booking/cancel
// Called when user cancels Razorpay checkout modal or closes it without paying
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { booking_id } = await request.json()
    if (!booking_id) {
      return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })
    }

    const admin = await createAdminClient()

    // Delete ONLY pending bookings — strictly protect paid bookings
    const { error: deleteErr } = await admin
      .from('bookings')
      .delete()
      .eq('booking_id', booking_id)
      .eq('payment_status', 'pending')

    if (deleteErr) {
      console.error('Error deleting pending booking:', deleteErr)
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Cancel booking error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
