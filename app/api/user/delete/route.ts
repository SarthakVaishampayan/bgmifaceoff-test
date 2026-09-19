import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/user/delete
export async function POST(request: Request) {
  try {
    const { target_user_id } = await request.json()

    if (!target_user_id) {
      return NextResponse.json({ error: 'target_user_id is required' }, { status: 400 })
    }

    // Verify auth
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Verify requester is admin
    const isPermAdmin = isSuperAdminEmail(user.email)
    const { data: requesterProfile } = await admin
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!isPermAdmin && requesterProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 })
    }

    // Protect permanent super admin from deletion
    const { data: targetProfile } = await admin
      .from('users')
      .select('team_id, email')
      .eq('user_id', target_user_id)
      .maybeSingle()

    if (isSuperAdminEmail(targetProfile?.email)) {
      return NextResponse.json({ error: 'Cannot delete the primary Super Admin account.' }, { status: 400 })
    }

    if (targetProfile?.team_id) {
      // Clean up bookings & team record
      await admin.from('bookings').delete().eq('team_id', targetProfile.team_id)
      await admin.from('teams').delete().eq('team_id', targetProfile.team_id)
    }

    // Delete user from app users table
    await admin.from('users').delete().eq('user_id', target_user_id)

    // Delete user from Supabase Auth service
    try {
      await admin.auth.admin.deleteUser(target_user_id)
    } catch {
      // Ignore if auth user was already deleted
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete account' }, { status: 500 })
  }
}
