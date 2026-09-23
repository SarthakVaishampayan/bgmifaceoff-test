import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, teamName } = await request.json()

    const cleanEmail = email?.trim()?.toLowerCase()
    const cleanTeamName = teamName?.trim()

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    if (!cleanTeamName || cleanTeamName.length < 2) {
      return NextResponse.json({ error: 'Team name must be at least 2 characters.' }, { status: 400 })
    }

    const admin = await createAdminClient()

    // 1. Check if team name is already taken (case-insensitive)
    const { data: existingTeam } = await admin
      .from('teams')
      .select('team_id, team_name')
      .ilike('team_name', cleanTeamName)
      .maybeSingle()

    if (existingTeam) {
      return NextResponse.json(
        { error: `The team name "${cleanTeamName}" is already taken by another team. Please choose a different team name.` },
        { status: 409 }
      )
    }

    // 2. Check if email is already in users profile table
    const { data: existingProfile } = await admin
      .from('users')
      .select('user_id')
      .ilike('email', cleanEmail)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'This email is already registered. Please sign in instead.' },
        { status: 409 }
      )
    }

    // 3. Double-check if email already exists in Supabase auth
    const { data: authUser } = await admin.auth.admin.listUsers()
    const emailExistsInAuth = authUser?.users?.some(
      u => u.email?.toLowerCase() === cleanEmail
    )

    if (emailExistsInAuth) {
      return NextResponse.json(
        { error: 'This email is already registered. Please sign in instead.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ valid: true })
  } catch (err: any) {
    console.error('Signup validation error:', err)
    return NextResponse.json({ error: err?.message || 'Validation error' }, { status: 500 })
  }
}
