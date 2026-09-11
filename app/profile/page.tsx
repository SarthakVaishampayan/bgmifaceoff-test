export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profile & Settings | BGFS',
  description: 'Manage your BGFS team name, security settings, and account details.',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = await createAdminClient()

  // Step 1: Fetch user profile
  let { data: userProfile } = await admin
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  let teamId = userProfile?.team_id

  // Step 2: Auto-provision team if missing
  if (!teamId) {
    let { data: existingTeam } = await admin
      .from('teams')
      .select('*')
      .eq('captain_user_id', user.id)
      .maybeSingle()

    if (!existingTeam) {
      const defaultTeamName =
        user.user_metadata?.display_name?.trim() || user.user_metadata?.team_name?.trim() ||
        user.user_metadata?.full_name?.trim() ||
        (user.email ? `${user.email.split('@')[0]} Squad` : `Team ${user.id.slice(0, 5)}`)

      const { data: newTeam } = await admin
        .from('teams')
        .insert({ team_name: defaultTeamName, captain_user_id: user.id })
        .select()
        .maybeSingle()

      existingTeam = newTeam
    }

    if (existingTeam) {
      teamId = existingTeam.team_id
      await admin
        .from('users')
        .upsert(
          { user_id: user.id, email: user.email, team_id: teamId, role: 'captain', display_name: existingTeam.team_name },
          { onConflict: 'user_id' }
        )
    }
  }

  // Step 3: Fetch team info
  const { data: team } = await admin
    .from('teams')
    .select('team_id, team_name, captain_user_id, name_changed, is_test_account')
    .eq('team_id', teamId)
    .maybeSingle()

  const safeTeam = team || {
    team_id: teamId || 'default',
    team_name: 'My Team',
    captain_user_id: user.id,
    name_changed: false,
    is_test_account: false,
  }

  const isTestAccount = Boolean(userProfile?.is_test_account || (team as any)?.is_test_account)
  const isCaptain = safeTeam.captain_user_id === user.id

  return (
    <ProfileClient
      user={{
        id: user.id,
        email: user.email || '',
        created_at: user.created_at || '',
      }}
      team={safeTeam}
      isCaptain={isCaptain}
      isTestAccount={isTestAccount}
    />
  )
}
