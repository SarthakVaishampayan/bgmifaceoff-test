import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/admin/users/lookup
// Searches for a user/team by email or team name, returning complete verification details
// including assigned team and slot bookings so the admin can verify identity before resetting password.
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { query } = await request.json()
    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const cleanQuery = query.trim().toLowerCase()

    // 1. Search in public.users table by email or display_name
    let { data: users, error: searchErr } = await admin
      .from('users')
      .select('user_id, email, display_name, role, is_test_account, created_at, team_id')
      .or(`email.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
      .limit(10)

    if (searchErr) {
      console.error('User lookup error:', searchErr)
      return NextResponse.json({ error: searchErr.message }, { status: 500 })
    }

    // 2. Also search by team_name if no direct user match found
    if (!users || users.length === 0) {
      const { data: matchedTeams } = await admin
        .from('teams')
        .select('team_id, team_name, captain_user_id')
        .ilike('team_name', `%${cleanQuery}%`)
        .limit(5)

      if (matchedTeams && matchedTeams.length > 0) {
        const teamIds = matchedTeams.map(t => t.team_id)
        const { data: teamUsers } = await admin
          .from('users')
          .select('user_id, email, display_name, role, is_test_account, created_at, team_id')
          .in('team_id', teamIds)

        users = teamUsers || []
      }
    }

    // 3. Collect unique team IDs to fetch team names safely without ambiguous PostgREST joins
    const teamIds = Array.from(new Set((users || []).map(u => u.team_id).filter(Boolean)))
    const teamMap: Record<string, string> = {}
    if (teamIds.length > 0) {
      const { data: teamsData } = await admin
        .from('teams')
        .select('team_id, team_name')
        .in('team_id', teamIds)

      if (teamsData) {
        teamsData.forEach(t => {
          teamMap[t.team_id] = t.team_name
        })
      }
    }

    // 4. For each matched user, fetch their bookings to provide complete identity verification
    const enrichedUsers = await Promise.all(
      (users || []).map(async u => {
        let bookings: any[] = []
        if (u.team_id) {
          const { data: bData } = await admin
            .from('bookings')
            .select('booking_id, slot_id, payment_status, room_slot_number, slots(date, time_label)')
            .eq('team_id', u.team_id)
            .order('created_at', { ascending: false })
            .limit(5)

          bookings = (bData || []).map(b => ({
            booking_id: b.booking_id,
            slot_date: (b.slots as any)?.date,
            slot_time: (b.slots as any)?.time_label,
            room_slot_number: b.room_slot_number,
            payment_status: b.payment_status,
          }))
        }

        const teamName = (u.team_id && teamMap[u.team_id]) || u.display_name || 'No Team'

        return {
          user_id: u.user_id,
          email: u.email,
          display_name: u.display_name,
          role: u.role || 'player',
          is_test_account: Boolean(u.is_test_account),
          team_id: u.team_id,
          team_name: teamName,
          created_at: u.created_at,
          bookings,
        }
      })
    )

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
    })
  } catch (err: any) {
    console.error('User lookup API error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
