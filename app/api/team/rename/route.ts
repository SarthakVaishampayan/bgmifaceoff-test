import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/team/rename
// Allows teams to set or change their team name (1-time edit)
export async function POST(request: Request) {
  try {
    const { new_team_name } = await request.json()

    if (!new_team_name || !new_team_name.trim()) {
      return NextResponse.json({ error: 'New team name is required' }, { status: 400 })
    }

    const trimmedName = new_team_name.trim()
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      return NextResponse.json({ error: 'Team name must be between 2 and 30 characters' }, { status: 400 })
    }

    // Verify auth
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // 1. Get user profile
    let { data: userProfile } = await admin
      .from('users')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let teamId = userProfile?.team_id

    // 2. Fallback: Check if user is captain in teams table
    if (!teamId) {
      const { data: teamByCaptain } = await admin
        .from('teams')
        .select('team_id')
        .eq('captain_user_id', user.id)
        .maybeSingle()

      if (teamByCaptain) {
        teamId = teamByCaptain.team_id
        await admin
          .from('users')
          .upsert({ user_id: user.id, email: user.email, team_id: teamId, role: 'captain' }, { onConflict: 'user_id' })
      }
    }

    // 3. If user STILL has no team record at all: Create team with desired new_team_name!
    if (!teamId) {
      // Check if desired team_name is already taken
      const { data: nameCheck } = await admin
        .from('teams')
        .select('team_id')
        .ilike('team_name', trimmedName)
        .maybeSingle()

      if (nameCheck) {
        return NextResponse.json({ error: 'This team name is already taken. Please pick another name.' }, { status: 409 })
      }

      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: newTeam, error: createErr } = await admin
        .from('teams')
        .insert({
          team_name: trimmedName,
          captain_user_id: user.id,
          invite_code: inviteCode,
          name_changed: true,
        })
        .select('team_id')
        .single()

      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }

      // Link new team to user profile
      await admin
        .from('users')
        .upsert({
          user_id: user.id,
          email: user.email,
          team_id: newTeam.team_id,
          role: 'captain',
          display_name: trimmedName,
        }, { onConflict: 'user_id' })

      return NextResponse.json({
        success: true,
        new_team_name: trimmedName,
        message: 'Team name set successfully!',
      })
    }

    // 4. User has an existing team record -> Check lock & update name
    const { data: team, error: teamErr } = await admin
      .from('teams')
      .select('team_id, team_name, name_changed')
      .eq('team_id', teamId)
      .maybeSingle()

    if (teamErr || !team) {
      return NextResponse.json({ error: 'Team record not found.' }, { status: 404 })
    }

    if (trimmedName.toLowerCase() === team.team_name.toLowerCase()) {
      return NextResponse.json({ error: `Your team name is already set to "${trimmedName}".` }, { status: 400 })
    }

    // Check if new name is already taken by another team
    const { data: existingTeam } = await admin
      .from('teams')
      .select('team_id')
      .ilike('team_name', trimmedName)
      .neq('team_id', team.team_id)
      .maybeSingle()

    if (existingTeam) {
      return NextResponse.json({ error: `The team name "${trimmedName}" is already taken by another team. Please pick a different name.` }, { status: 409 })
    }

    // Update team name and set name_changed to true
    const { error: updateErr } = await admin
      .from('teams')
      .update({
        team_name: trimmedName,
        name_changed: true,
      })
      .eq('team_id', team.team_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Also update display_name in users table
    await admin
      .from('users')
      .update({ display_name: trimmedName })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      new_team_name: trimmedName,
      message: 'Team name updated successfully!',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
