import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/user/toggle-test-mode
export async function POST(request: Request) {
  try {
    const { targetUserId, enabled } = await request.json()

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Determine target user ID (specified or current)
    const userIdToUpdate = targetUserId || user.id
    const isActive = Boolean(enabled)

    // Update is_test_account & test_mode_active in users table
    await admin
      .from('users')
      .upsert({ user_id: userIdToUpdate, is_test_account: isActive, test_mode_active: isActive }, { onConflict: 'user_id' })

    // Find linked team and update team test account status as well
    const { data: userRec } = await admin
      .from('users')
      .select('team_id')
      .eq('user_id', userIdToUpdate)
      .maybeSingle()

    if (userRec?.team_id) {
      await admin
        .from('teams')
        .update({ is_test_account: isActive })
        .eq('team_id', userRec.team_id)
    }

    await admin
      .from('teams')
      .update({ is_test_account: isActive })
      .eq('captain_user_id', userIdToUpdate)

    return NextResponse.json({ success: true, enabled: isActive, user_id: userIdToUpdate })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
