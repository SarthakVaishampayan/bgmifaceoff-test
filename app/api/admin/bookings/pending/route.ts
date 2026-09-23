import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()
    const isPermAdmin = isSuperAdminEmail(user.email)
    const { data: userProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isPermAdmin && userProfile?.role !== 'admin' && userProfile?.role !== 'admin_scores') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 1. Fetch all pending bookings with team and slot details
    const { data: pendingBookings, error: bErr } = await admin
      .from('bookings')
      .select('*, teams(team_id, team_name, captain_user_id), slots(slot_id, date, time_label, capacity, teams_booked_count, status, entry_fee)')
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false })

    if (bErr) {
      return NextResponse.json({ error: bErr.message }, { status: 500 })
    }

    if (!pendingBookings || pendingBookings.length === 0) {
      return NextResponse.json({ success: true, bookings: [] })
    }

    // 2. Fetch all paid bookings for these teams to detect "Superseded by Paid Booking"
    const teamIds = Array.from(new Set(pendingBookings.map(b => b.team_id).filter(Boolean)))
    const { data: paidBookings } = await admin
      .from('bookings')
      .select('team_id, slot_id, room_slot_number, created_at')
      .in('team_id', teamIds)
      .eq('payment_status', 'paid')

    // Map: `${team_id}_${slot_id}` -> paid booking
    const paidMap = new Map<string, any>()
    paidBookings?.forEach(pb => {
      paidMap.set(`${pb.team_id}_${pb.slot_id}`, pb)
    })

    // 3. Fetch captain details from users & auth
    const captainUserIds = Array.from(new Set(pendingBookings.map(b => b.teams?.captain_user_id).filter(Boolean)))
    const { data: usersData } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .in('user_id', captainUserIds)

    const userProfileMap = new Map(usersData?.map(u => [u.user_id, u]) || [])

    // 4. Enrich each pending booking with diagnostic reason
    const now = Date.now()
    const enriched = pendingBookings.map(b => {
      const slot = b.slots
      const team = b.teams
      const captain = team?.captain_user_id ? userProfileMap.get(team.captain_user_id) : null
      const createdTime = new Date(b.created_at).getTime()
      const ageMinutes = Math.floor((now - createdTime) / (60 * 1000))

      const hasPaidForSameSlot = paidMap.has(`${b.team_id}_${b.slot_id}`)
      const paidBooking = hasPaidForSameSlot ? paidMap.get(`${b.team_id}_${b.slot_id}`) : null

      let reasonCategory: 'superseded' | 'in_progress' | 'abandoned' | 'full' | 'closed' = 'abandoned'
      let reasonLabel = 'Checkout Abandoned'
      let reasonDetails = 'Player opened payment modal but exited without completing payment.'

      if (hasPaidForSameSlot) {
        reasonCategory = 'superseded'
        reasonLabel = 'Superseded by Paid Booking'
        reasonDetails = `Team already successfully booked and paid for this slot (Assigned Room Slot #${paidBooking.room_slot_number || 'TBD'}).`
      } else if (slot?.status === 'completed' || slot?.status === 'closed') {
        reasonCategory = 'closed'
        reasonLabel = 'Slot Closed / Match Completed'
        reasonDetails = 'This match slot has already closed or concluded.'
      } else if ((slot?.teams_booked_count || 0) >= (slot?.capacity || 20)) {
        reasonCategory = 'full'
        reasonLabel = 'Slot Full'
        reasonDetails = 'The slot filled up to full capacity after this attempt.'
      } else if (ageMinutes <= 15) {
        reasonCategory = 'in_progress'
        reasonLabel = 'Recent Attempt (< 15 mins)'
        reasonDetails = `Initiated ${ageMinutes}m ago. Player may be in UPI app or verifying payment.`
      }

      // Pre-fill WhatsApp message
      const slotDesc = slot ? `${slot.date} (${slot.time_label})` : 'your slot'
      const waText = encodeURIComponent(
        `Hi ${team?.team_name || 'Captain'}! We saw a pending registration on BGFS for ${slotDesc}. Did your payment go through? If you completed the transfer, please reply with your screenshot so we can confirm your room slot!`
      )

      return {
        booking_id: b.booking_id,
        team_id: b.team_id,
        team_name: team?.team_name || 'Unknown Team',
        captain_email: captain?.email || 'No email',
        captain_name: captain?.display_name || team?.team_name || 'Captain',
        slot_id: b.slot_id,
        slot_date: slot?.date || '—',
        slot_time: slot?.time_label || '—',
        slot_status: slot?.status || 'open',
        slot_entry_fee: slot?.entry_fee ?? 40,
        amount_paid: b.amount_paid || 0,
        created_at: b.created_at,
        age_minutes: ageMinutes,
        reason_category: reasonCategory,
        reason_label: reasonLabel,
        reason_details: reasonDetails,
        has_paid_booking: hasPaidForSameSlot,
        whatsapp_url: `https://wa.me/?text=${waText}`,
      }
    })

    return NextResponse.json({ success: true, bookings: enriched })
  } catch (err: any) {
    console.error('Pending bookings fetch error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
