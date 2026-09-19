import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// GET /api/admin/upi-info?slot_id=<UUID>
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slotId = searchParams.get('slot_id')

    if (!slotId) {
      return NextResponse.json({ error: 'slot_id parameter is required' }, { status: 400 })
    }

    // Auth check
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

    // 1. Fetch Slot Details
    const { data: slot } = await admin
      .from('slots')
      .select('*')
      .eq('slot_id', slotId)
      .maybeSingle()

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    // 2. Fetch Matches for this slot
    const { data: matches } = await admin
      .from('matches')
      .select('match_id, slot_id, match_number, team_id, placement, kills, placement_points, kill_points, total_points, teams(team_id, team_name, captain_user_id)')
      .eq('slot_id', slotId)
      .order('match_number', { ascending: true })

    // 3. Fetch Bookings for this slot (to also get room slot numbers and teams that played)
    const { data: bookings } = await admin
      .from('bookings')
      .select('team_id, room_slot_number, teams(team_id, team_name, captain_user_id)')
      .eq('slot_id', slotId)
      .eq('payment_status', 'paid')

    // 4. Fetch all UPI config records for teams
    const { data: upiConfigs } = await admin
      .from('config')
      .select('key, value')
      .like('key', 'upi_team_%')

    const upiMap = new Map<string, { upi_id: string; upi_holder_name: string }>()
    upiConfigs?.forEach(c => {
      const tId = c.key.replace('upi_team_', '')
      try {
        const parsed = JSON.parse(c.value)
        upiMap.set(tId, {
          upi_id: parsed.upi_id || '',
          upi_holder_name: parsed.upi_holder_name || '',
        })
      } catch (e) {}
    })

    // 5. Fetch captain users for fallback upi_id
    const captainIds = Array.from(new Set([
      ...(matches || []).map((m: any) => m.teams?.captain_user_id),
      ...(bookings || []).map((b: any) => b.teams?.captain_user_id),
    ].filter(Boolean)))

    const userUpiMap = new Map<string, string>()
    if (captainIds.length > 0) {
      const { data: capUsers } = await admin
        .from('users')
        .select('user_id, upi_id')
        .in('user_id', captainIds)
      capUsers?.forEach(u => {
        if (u.upi_id) userUpiMap.set(u.user_id, u.upi_id)
      })
    }

    // 6. Aggregate scores per team
    const teamAggregation = new Map<string, {
      team_id: string
      team_name: string
      captain_user_id?: string
      room_slot_number?: number | null
      matches: Array<{
        match_number: number
        placement: number
        kills: number
        total_points: number
      }>
      total_points: number
      total_kills: number
      upi_id: string
      upi_holder_name: string
    }>()

    // Initialize from bookings
    bookings?.forEach((b: any) => {
      if (!b.team_id) return
      const t = b.teams || {}
      teamAggregation.set(b.team_id, {
        team_id: b.team_id,
        team_name: t.team_name || 'Team Registered',
        captain_user_id: t.captain_user_id,
        room_slot_number: b.room_slot_number || null,
        matches: [],
        total_points: 0,
        total_kills: 0,
        upi_id: '',
        upi_holder_name: '',
      })
    })

    // Add match performances
    matches?.forEach((m: any) => {
      if (!m.team_id) return
      let entry = teamAggregation.get(m.team_id)
      if (!entry) {
        const t = m.teams || {}
        entry = {
          team_id: m.team_id,
          team_name: t.team_name || 'Team Registered',
          captain_user_id: t.captain_user_id,
          room_slot_number: null,
          matches: [],
          total_points: 0,
          total_kills: 0,
          upi_id: '',
          upi_holder_name: '',
        }
        teamAggregation.set(m.team_id, entry)
      }

      entry.matches.push({
        match_number: m.match_number,
        placement: m.placement || 0,
        kills: Number(m.kills) || 0,
        total_points: Number(m.total_points) || 0,
      })
    })

    // Compute totals and assign UPI details
    const rankedList = Array.from(teamAggregation.values()).map(t => {
      t.matches.sort((a, b) => a.match_number - b.match_number)
      t.total_points = t.matches.reduce((sum, m) => sum + m.total_points, 0)
      t.total_kills = t.matches.reduce((sum, m) => sum + m.kills, 0)

      // Look up UPI info
      const savedUpi = upiMap.get(t.team_id)
      if (savedUpi) {
        t.upi_id = savedUpi.upi_id
        t.upi_holder_name = savedUpi.upi_holder_name
      } else if (t.captain_user_id && userUpiMap.has(t.captain_user_id)) {
        t.upi_id = userUpiMap.get(t.captain_user_id) || ''
      }

      return t
    })

    // Sort by total points descending (tie-breaker: kills)
    rankedList.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points
      }
      return b.total_kills - a.total_kills
    })

    const teamsWithRank = rankedList.map((t, idx) => ({
      rank: idx + 1,
      ...t,
    }))

    return NextResponse.json({
      slot,
      teams: teamsWithRank,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
