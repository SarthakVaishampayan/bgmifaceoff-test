import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/admin/payout/create
// Creates or marks a payout slip as paid for a team in a completed slot
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
    const { slot_id, team_id, amount, place, upi_id } = body

    if (!slot_id || !team_id) {
      return NextResponse.json({ error: 'slot_id and team_id are required' }, { status: 400 })
    }

    const parsedAmount = Math.round(Number(amount))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Please enter a valid payout amount greater than 0' }, { status: 400 })
    }

    // Allow '1st', '2nd', or '3rd'
    let sanitizedPlace = place === '1st' || place === '2nd' || place === '3rd' ? place : null

    // Persist upi_id to config for this team if provided
    if (upi_id && typeof upi_id === 'string' && upi_id.trim()) {
      try {
        await admin.from('config').upsert({
          key: `upi_team_${team_id}`,
          value: JSON.stringify({
            upi_id: upi_id.trim(),
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          }),
          updated_at: new Date().toISOString(),
        })
      } catch (e) {}
    }

    // Check if a payout already exists for this team and slot
    const { data: existingPayout } = await admin
      .from('payouts')
      .select('payout_id')
      .eq('slot_id', slot_id)
      .eq('team_id', team_id)
      .maybeSingle()

    let payoutRecord: any = null

    if (existingPayout) {
      let { data, error } = await admin
        .from('payouts')
        .update({
          amount: parsedAmount,
          status: 'paid',
          place: sanitizedPlace,
          upi_id: upi_id || null,
          paid_at: new Date().toISOString(),
          paid_by: user.id,
        })
        .eq('payout_id', existingPayout.payout_id)
        .select('*, teams(team_name), slots(date, time_label)')
        .single()

      if (error && error.message?.includes('payouts_place_check')) {
        const retry = await admin
          .from('payouts')
          .update({
            amount: parsedAmount,
            status: 'paid',
            place: null,
            upi_id: upi_id || null,
            paid_at: new Date().toISOString(),
            paid_by: user.id,
          })
          .eq('payout_id', existingPayout.payout_id)
          .select('*, teams(team_name), slots(date, time_label)')
          .single()
        data = retry.data
        error = retry.error
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      payoutRecord = data
    } else {
      let { data, error } = await admin
        .from('payouts')
        .insert({
          slot_id,
          team_id,
          amount: parsedAmount,
          place: sanitizedPlace,
          upi_id: upi_id || null,
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: user.id,
        })
        .select('*, teams(team_name), slots(date, time_label)')
        .single()

      if (error && error.message?.includes('payouts_place_check')) {
        const retry = await admin
          .from('payouts')
          .insert({
            slot_id,
            team_id,
            amount: parsedAmount,
            place: null,
            upi_id: upi_id || null,
            status: 'paid',
            paid_at: new Date().toISOString(),
            paid_by: user.id,
          })
          .select('*, teams(team_name), slots(date, time_label)')
          .single()
        data = retry.data
        error = retry.error
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      payoutRecord = data
    }

    return NextResponse.json({ success: true, payout: payoutRecord })
  } catch (err: any) {
    console.error('Error creating payout slip:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
