import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/setup-team
// Used by OnboardPage to create or join a team.
// Uses service role (bypasses RLS) + UPSERT on users so it works
// even if the handle_new_user trigger didn't create the row.

export async function POST(request: Request) {
  try {
    const { action, teamName, displayName, inviteCode } = await request.json()

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    if (action === 'create') {
      if (!teamName?.trim()) {
        return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
      }

      // Insert team
      let { data: team, error: teamErr } = await admin
        .from('teams')
        .insert({ team_name: teamName.trim(), captain_user_id: user.id })
        .select()
        .single()

      if (teamErr && (teamErr.message?.includes('row-level security') || teamErr.message?.includes('RLS'))) {
        const retryUser = await supabase
          .from('teams')
          .insert({ team_name: teamName.trim(), captain_user_id: user.id })
          .select()
          .single()
        team = retryUser.data
        teamErr = retryUser.error
      }

      if (teamErr) {
        const isUnique = teamErr.code === '23505' || teamErr.message.toLowerCase().includes('unique')
        return NextResponse.json(
          { error: isUnique ? 'Team name already taken. Try another.' : teamErr.message },
          { status: isUnique ? 409 : 500 }
        )
      }

      // Upsert user profile (handles missing row from trigger)
      const { error: userErr } = await admin
        .from('users')
        .upsert({
          user_id: user.id,
          email: user.email,
          team_id: team.team_id,
          role: 'captain',
          display_name: displayName?.trim() || teamName.trim(),
        }, { onConflict: 'user_id' })

      if (userErr) {
        return NextResponse.json({ error: userErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })

    } else if (action === 'join') {
      if (!inviteCode?.trim()) {
        return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
      }

      // Find team by invite code
      const { data: team, error: findErr } = await admin
        .from('teams')
        .select('team_id, team_name')
        .eq('invite_code', inviteCode.trim().toLowerCase())
        .single()

      if (findErr || !team) {
        return NextResponse.json({ error: 'Invalid invite code. Please check and try again.' }, { status: 404 })
      }

      // Upsert user profile linked to the found team
      const { error: userErr } = await admin
        .from('users')
        .upsert({
          user_id: user.id,
          email: user.email,
          team_id: team.team_id,
          role: 'player',
          display_name: displayName?.trim() || null,
        }, { onConflict: 'user_id' })

      if (userErr) {
        return NextResponse.json({ error: userErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, team_name: team.team_name })

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
