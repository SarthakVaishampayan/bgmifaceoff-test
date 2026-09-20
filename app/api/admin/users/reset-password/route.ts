import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/admin/users/reset-password
// Safely resets an authenticated player's password directly via Supabase Auth Admin.
// Leaves all teams, bookings, match scores, and user profile data 100% untouched.
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

    if (!isPermAdmin && userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 })
    }

    const { target_user_id, target_email, new_password = 'user12345' } = await request.json()
    if (!target_user_id || !target_email) {
      return NextResponse.json({ error: 'Missing required parameters: target_user_id and target_email' }, { status: 400 })
    }

    // Safety Guard 1: Protect Super Admin from reset
    if (isSuperAdminEmail(target_email)) {
      return NextResponse.json({ error: 'Action blocked: The Super Admin account password cannot be reset via this tool.' }, { status: 403 })
    }

    // Safety Guard 2: Minimum password length
    const cleanPassword = String(new_password).trim()
    if (cleanPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 })
    }

    // Safety Guard 3: Fetch user from database to verify identity
    const { data: targetUser, error: uErr } = await admin
      .from('users')
      .select('user_id, email, team_id, display_name')
      .eq('user_id', target_user_id)
      .maybeSingle()

    if (uErr || !targetUser) {
      return NextResponse.json({ error: 'User record not found in database' }, { status: 404 })
    }

    // Safety Guard 4: Verify email matches target user ID
    if (targetUser.email && targetUser.email.toLowerCase() !== target_email.toLowerCase()) {
      return NextResponse.json({ error: 'Security mismatch: User ID does not match the provided email address.' }, { status: 400 })
    }

    let teamName = targetUser.display_name || 'Team'
    if (targetUser.team_id) {
      const { data: tData } = await admin
        .from('teams')
        .select('team_name')
        .eq('team_id', targetUser.team_id)
        .maybeSingle()
      if (tData?.team_name) teamName = tData.team_name
    }

    // Update password in Supabase Auth service directly
    // This ONLY updates auth.users password hash — strictly zero impact on teams, matches, bookings, or payouts.
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      target_user_id,
      { password: cleanPassword }
    )

    if (updateErr) {
      console.error('Failed to update user password:', updateErr)
      return NextResponse.json({ error: `Failed to update password: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Password for ${teamName} (${target_email}) was successfully reset to: ${cleanPassword}`,
      team_name: teamName,
      email: target_email,
      temp_password: cleanPassword,
    })
  } catch (err: any) {
    console.error('Admin password reset error:', err)
    return NextResponse.json({ error: err?.message || 'Server error while resetting password' }, { status: 500 })
  }
}
