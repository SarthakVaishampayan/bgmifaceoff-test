import { createAdminClient, createClient } from '@/lib/supabase/server'
import { syncPendingPayouts } from '@/lib/payouts/sync'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/admin/payout/sync-pending
// Syncs and returns all payouts, ensuring completed slots have pending records for top 2 teams
export async function POST() {
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

    await syncPendingPayouts(admin)

    const { data: allPayouts } = await admin
      .from('payouts')
      .select('*, teams(team_name), slots(date, time_label)')
      .order('created_at', { ascending: false })

    return NextResponse.json({ success: true, payouts: allPayouts || [] })
  } catch (err: any) {
    console.error('Error syncing pending payouts:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
