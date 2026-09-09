import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/register-team
// Called client-side after signUp+signIn succeeds.
// Uses service role to bypass RLS and reliably write team + user profile.
export async function POST(request: Request) {
  try {
    const { teamName, displayName, userId: bodyUserId } = await request.json()

    if (!teamName?.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user: sessionUser } } = await supabase.auth.getUser()

    const admin = await createAdminClient()

    let targetUser = sessionUser
    let targetUserId = sessionUser?.id || bodyUserId

    if (!targetUser && bodyUserId) {
      const { data: authUserData } = await admin.auth.admin.getUserById(bodyUserId)
      if (authUserData?.user) {
        targetUser = authUserData.user
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if team name is already taken by another squad (case insensitive)
    const { data: nameCheck } = await admin
      .from('teams')
      .select('team_id, captain_user_id')
      .ilike('team_name', teamName.trim())
      .maybeSingle()

    if (nameCheck && nameCheck.captain_user_id !== targetUserId) {
      return NextResponse.json(
        { error: `The team name "${teamName.trim()}" is already taken by another team. Please choose a different team name.` },
        { status: 409 }
      )
    }

    // First check if a team already exists for this captain
    let { data: team } = await admin
      .from('teams')
      .select('*')
      .eq('captain_user_id', targetUserId)
      .maybeSingle()

    let teamErr: any = null

    if (!team) {
      // Try inserting team with admin client
      const res = await admin
        .from('teams')
        .insert({
          team_name: teamName.trim(),
          captain_user_id: targetUserId,
          name_changed: false,
        })
        .select()
        .maybeSingle()

      team = res.data
      teamErr = res.error

      // If RLS error or service role fallback fails, retry using authenticated user client
      if (teamErr && (teamErr.code === '42501' || teamErr.message?.toLowerCase().includes('security') || teamErr.message?.toLowerCase().includes('rls'))) {
        const userRes = await supabase
          .from('teams')
          .insert({
            team_name: teamName.trim(),
            captain_user_id: targetUserId,
            name_changed: false,
          })
          .select()
          .maybeSingle()

        if (userRes.data) {
          team = userRes.data
          teamErr = null
        }
      }
    }

    if (teamErr) {
      const isUnique = teamErr.message?.toLowerCase().includes('unique') || teamErr.code === '23505'
      return NextResponse.json(
        { error: isUnique ? 'Team name already taken. Please choose a different team name.' : teamErr.message },
        { status: isUnique ? 409 : 500 }
      )
    }

    const teamId = team?.team_id || null

    // Upsert user profile — service role ignores RLS
    const { error: userErr } = await admin
      .from('users')
      .upsert({
        user_id: targetUserId,
        email: targetUser?.email || '',
        team_id: teamId,
        role: 'captain',
        display_name: displayName?.trim() || teamName.trim(),
      }, { onConflict: 'user_id' })

    if (userErr) {
      // Try fallback upsert via user client
      await supabase
        .from('users')
        .upsert({
          user_id: targetUserId,
          email: targetUser?.email || '',
          team_id: teamId,
          role: 'captain',
          display_name: displayName?.trim() || teamName.trim(),
        }, { onConflict: 'user_id' })
    }

    return NextResponse.json({ success: true, team_id: team.team_id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
