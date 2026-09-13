import { Suspense } from 'react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import LeaderboardClient from './LeaderboardClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leaderboard | BGFS',
  description: 'Live BGFS Battlegrounds Faceoff Series standings. Best-16 match system, updated after every slot.',
}

export const revalidate = 60

export default async function LeaderboardPage() {
  const supabase = await createAdminClient()

  // ALL queries in parallel — no dependencies between them
  const [
    leaderboardResult,
    matchesResult,
    slotsResult,
    testTeamsResult,
    bookingsResult,
    publishedSlotsResult,
  ] = await Promise.all([
    // Overall leaderboard
    supabase
      .from('leaderboard')
      .select('team_id, team_name, matches_played, best_16_total, total_kills')
      .order('best_16_total', { ascending: false })
      .order('total_kills', { ascending: false }),

    // All matches with team details
    (supabase
      .from('matches')
      .select('match_id, team_id, slot_id, match_number, total_points, placement, kills, placement_points, kill_points, teams(team_name), slots(date, time_label)')
      .order('created_at', { ascending: true }) as any),

    // Slots
    supabase
      .from('slots')
      .select('slot_id, date, time_label, status, teams_booked_count')
      .order('date', { ascending: false })
      .order('time_label', { ascending: false }),

    // Test teams to exclude
    supabase
      .from('teams')
      .select('team_id')
      .eq('is_test_account', true),

    // Paid bookings
    supabase
      .from('bookings')
      .select('booking_id, team_id, slot_id, room_slot_number, is_test_booking, created_at, teams(team_name)')
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: true }),

    // Published slots (pushed to points table via "Update The Table")
    supabase
      .from('config')
      .select('value')
      .eq('key', 'scores_published_slots')
      .maybeSingle(),
  ])

  const testTeamIds = new Set(testTeamsResult.data?.map(t => t.team_id) || [])

  // Parse published slot IDs
  let publishedSlotIds = new Set<string>()
  if (publishedSlotsResult?.data?.value) {
    try {
      const parsed = JSON.parse(publishedSlotsResult.data.value)
      if (Array.isArray(parsed)) publishedSlotIds = new Set(parsed)
    } catch {}
  }

  // Handle room_slot_number column missing gracefully
  let filteredBookings: any[] = bookingsResult.data || []
  if (bookingsResult.error?.message?.includes('room_slot_number')) {
    const fallback = await supabase
      .from('bookings')
      .select('booking_id, team_id, slot_id, is_test_booking, created_at, teams(team_name)')
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: true })
    filteredBookings = fallback.data || []
  }

  // CRITICAL: Only matches from slots pushed to the points table via "Update The Table" are published and counted
  const allMatchesData = ((matchesResult.data || []) as any[])
  const completedMatches = allMatchesData.filter(m => !testTeamIds.has(m.team_id) && publishedSlotIds.has(m.slot_id))

  // Compute team performance from completed matches only
  const teamSlotMap: Record<string, Record<string, { total_points: number; kills: number; matches_count: number }>> = {}
  const teamMetaMap: Record<string, { team_id: string; team_name: string }> = {}

  // Include confirmed booking teams
  filteredBookings.forEach((b: any) => {
    if (b.team_id && !testTeamIds.has(b.team_id)) {
      teamMetaMap[b.team_id] = {
        team_id: b.team_id,
        team_name: b.teams?.team_name || 'Team #' + b.team_id.slice(0, 5),
      }
    }
  })

  // Include teams with completed matches
  completedMatches.forEach((m: any) => {
    if (!teamMetaMap[m.team_id]) {
      teamMetaMap[m.team_id] = {
        team_id: m.team_id,
        team_name: m.teams?.team_name || 'Team #' + m.team_id.slice(0, 5),
      }
    }
    if (!teamSlotMap[m.team_id]) teamSlotMap[m.team_id] = {}
    if (!teamSlotMap[m.team_id][m.slot_id]) {
      teamSlotMap[m.team_id][m.slot_id] = { total_points: 0, kills: 0, matches_count: 0 }
    }
    teamSlotMap[m.team_id][m.slot_id].total_points += Number(m.total_points) || 0
    teamSlotMap[m.team_id][m.slot_id].kills += Number(m.kills) || 0
    teamSlotMap[m.team_id][m.slot_id].matches_count += 1
  })

  const computedStandings = Object.values(teamMetaMap).map(team => {
    const slotsPlayed = Object.values(teamSlotMap[team.team_id] || {})
    slotsPlayed.sort((a, b) => b.total_points - a.total_points)
    const top5Slots = slotsPlayed.slice(0, 5)
    const best_5_total = top5Slots.reduce((sum, s) => sum + s.total_points, 0)
    const total_kills = slotsPlayed.reduce((sum, s) => sum + s.kills, 0)
    const matches_played = slotsPlayed.reduce((sum, s) => sum + s.matches_count, 0)

    return {
      team_id: team.team_id,
      team_name: team.team_name,
      matches_played,
      best_16_total: best_5_total,
      total_kills,
    }
  })

  computedStandings.sort((a, b) => {
    if (b.best_16_total !== a.best_16_total) return b.best_16_total - a.best_16_total
    return b.total_kills - a.total_kills
  })

  const ranked = computedStandings.map((row, idx) => ({ ...row, rank: idx + 1 }))

  // Get current user's team_id for "My Slots" filter
  let userTeamId: string | null = null
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('team_id')
        .eq('user_id', user.id)
        .maybeSingle()
      userTeamId = profile?.team_id || null
    }
  } catch {}

  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading Leaderboard...</div>}>
      <LeaderboardClient
        rows={ranked}
        allMatches={completedMatches}
        slots={slotsResult.data || []}
        bookings={filteredBookings as any[]}
        userTeamId={userTeamId}
      />
    </Suspense>
  )
}
