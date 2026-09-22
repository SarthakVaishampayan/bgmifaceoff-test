import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/admin/payout/update
// Updates an existing payout slip (amount, upi_id, place, status)
export async function POST(request: Request) {
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
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const { payout_id, amount, upi_id, place, status } = body

    if (!payout_id) {
      return NextResponse.json({ error: 'payout_id is required' }, { status: 400 })
    }

    // Fetch current payout
    const { data: current, error: fetchErr } = await admin
      .from('payouts')
      .select('*, teams(team_name), slots(date, time_label)')
      .eq('payout_id', payout_id)
      .single()

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Payout slip not found' }, { status: 404 })
    }

    const parsedAmount = amount !== undefined ? Math.round(Number(amount)) : current.amount
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: 'Invalid payout amount' }, { status: 400 })
    }

    const sanitizedPlace = place !== undefined
      ? (place === '1st' || place === '2nd' || place === '3rd' ? place : null)
      : current.place

    const targetStatus = status === 'paid' || status === 'pending' ? status : current.status

    const updatePayload: any = {
      amount: parsedAmount,
      upi_id: upi_id !== undefined ? (upi_id ? upi_id.trim() : null) : current.upi_id,
      place: sanitizedPlace,
      status: targetStatus,
    }

    if (targetStatus === 'paid' && current.status !== 'paid') {
      updatePayload.paid_at = new Date().toISOString()
      updatePayload.paid_by = user.id
    } else if (targetStatus === 'pending' && current.status !== 'pending') {
      updatePayload.paid_at = null
      updatePayload.paid_by = null
    }

    // Persist upi_id to config if updated
    if (updatePayload.upi_id && current.team_id) {
      try {
        await admin.from('config').upsert({
          key: `upi_team_${current.team_id}`,
          value: JSON.stringify({
            upi_id: updatePayload.upi_id,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          }),
          updated_at: new Date().toISOString(),
        })
      } catch (e) {}
    }

    let { data: updatedPayout, error: updateErr } = await admin
      .from('payouts')
      .update(updatePayload)
      .eq('payout_id', payout_id)
      .select('*, teams(team_name), slots(date, time_label)')
      .single()

    if (updateErr && updateErr.message?.includes('payouts_place_check')) {
      // Fallback for check constraint: use place: null for 3rd place
      const retry = await admin
        .from('payouts')
        .update({
          ...updatePayload,
          place: null,
        })
        .eq('payout_id', payout_id)
        .select('*, teams(team_name), slots(date, time_label)')
        .single()
      updatedPayout = retry.data
      updateErr = retry.error
    }

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, payout: updatedPayout })
  } catch (err: any) {
    console.error('Error updating payout slip:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
