import { Suspense } from 'react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import LeaderboardClient from './LeaderboardClient'
import { getPlacementPoints } from '@/lib/scoring'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leaderboard | BGFS',
  description: 'Live BGFS Battlegrounds Faceoff Series standings. Best-16 match system, updated after every slot.',
}

export const revalidate = 30 // Cache for 30 seconds — reduces 7-query DB load on every visit

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
    slotWinnersResult,
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

    // Slots (only active tournament/testing cycle slots >= Sept 16)
    supabase
      .from('slots')
      .select('*')
      .gte('date', '2026-09-16')
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

    // Config: Published slots & prize config
    supabase
      .from('config')
      .select('key, value')
      .in('key', ['scores_published_slots', 'slot_first_prize', 'slot_second_prize', 'slot_third_prize', 'slot_prizes_map']),

    // Config: Slot Chicken Dinner Winners
    supabase
      .from('config')
      .select('key, value')
      .like('key', 'slot_winners_%'),
  ])

  const testTeamIds = new Set(testTeamsResult.data?.map(t => t.team_id) || [])

  const configMap: Record<string, string> = {}
  publishedSlotsResult.data?.forEach((r: any) => { configMap[r.key] = r.value })

  // Parse slot winners map: { [slot_id]: { m1, m2, m3 } }
  const slotWinnersMap: Record<string, { m1?: string; m2?: string; m3?: string }> = {}
  slotWinnersResult.data?.forEach((r: any) => {
    const slotId = r.key.replace('slot_winners_', '')
    try {
      slotWinnersMap[slotId] = JSON.parse(r.value)
    } catch {}
  })

  // Parse published slot IDs
  let publishedSlotIds = new Set<string>()
  if (configMap.scores_published_slots) {
    try {
      const parsed = JSON.parse(configMap.scores_published_slots)
      if (Array.isArray(parsed)) publishedSlotIds = new Set(parsed)
    } catch {}
  }

  let slotPrizesMap: Record<string, { first_prize?: number; second_prize?: number; third_prize?: number; third_prize_text?: string }> = {}
  if (configMap.slot_prizes_map) {
    try { slotPrizesMap = JSON.parse(configMap.slot_prizes_map) } catch {}
  }

  const defaultFirst = parseInt(configMap.slot_first_prize || '160', 10)
  const defaultSecond = parseInt(configMap.slot_second_prize || '80', 10)
  const defaultThird = parseInt(configMap.slot_third_prize || '60', 10)

  const enrichedSlots = (slotsResult.data || []).map((s: any) => {
    return {
      ...s,
      first_prize: s.first_prize ?? slotPrizesMap[s.slot_id]?.first_prize ?? defaultFirst,
      second_prize: s.second_prize ?? slotPrizesMap[s.slot_id]?.second_prize ?? defaultSecond,
      third_prize: s.third_prize ?? slotPrizesMap[s.slot_id]?.third_prize ?? defaultThird,
      third_prize_text: s.third_prize_text ?? slotPrizesMap[s.slot_id]?.third_prize_text ?? 'Free Slot Pass',
    }
  })

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
  const completedMatches = allMatchesData.filter(m => {
    if (testTeamIds.has(m.team_id)) return false
    if (!publishedSlotIds.has(m.slot_id)) return false
    if (m.slots?.date && m.slots.date < '2026-09-16') return false
    return true
  })

  // Compute team performance from completed matches only
  const teamSlotMap: Record<string, Record<string, { total_points: number; position_points: number; kills: number; wwcd: number; matches_count: number }>> = {}
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

  // Include teams with completed matches and calculate WWCD
  completedMatches.forEach((m: any) => {
    if (!teamMetaMap[m.team_id]) {
      teamMetaMap[m.team_id] = {
        team_id: m.team_id,
        team_name: m.teams?.team_name || 'Team #' + m.team_id.slice(0, 5),
      }
    }
    if (!teamSlotMap[m.team_id]) teamSlotMap[m.team_id] = {}
    if (!teamSlotMap[m.team_id][m.slot_id]) {
      const winners = slotWinnersMap[m.slot_id]
      let wwcdCount = 0
      if (winners) {
        if (winners.m1 === m.team_id) wwcdCount++
        if (winners.m2 === m.team_id) wwcdCount++
        if (winners.m3 === m.team_id) wwcdCount++
      } else if (Number(m.placement) === 1 || Number(m.position) === 1) {
        wwcdCount = 1
      }

      teamSlotMap[m.team_id][m.slot_id] = {
        total_points: 0,
        position_points: 0,
        kills: 0,
        wwcd: wwcdCount,
        matches_count: 0,
      }
    }
    const posPts = m.placement_points != null ? Number(m.placement_points) : getPlacementPoints(Number(m.placement))
    teamSlotMap[m.team_id][m.slot_id].total_points += Number(m.total_points) || 0
    teamSlotMap[m.team_id][m.slot_id].position_points += posPts || 0
    teamSlotMap[m.team_id][m.slot_id].kills += Number(m.kills) || 0
    teamSlotMap[m.team_id][m.slot_id].matches_count += 1
  })

  const computedStandings = Object.values(teamMetaMap).map(team => {
    const slotsPlayed = Object.values(teamSlotMap[team.team_id] || {})
    // Sort team slots by: 1. Total Points -> 2. Position Points -> 3. WWCD
    slotsPlayed.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      if (b.position_points !== a.position_points) return b.position_points - a.position_points
      if (b.wwcd !== a.wwcd) return b.wwcd - a.wwcd
      return 0
    })
    const top6Slots = slotsPlayed.slice(0, 6)
    const best_6_total = top6Slots.reduce((sum, s) => sum + s.total_points, 0)
    const best_6_position_points = top6Slots.reduce((sum, s) => sum + s.position_points, 0)
    const best_6_kills = top6Slots.reduce((sum, s) => sum + s.kills, 0)
    const best_6_wwcd = top6Slots.reduce((sum, s) => sum + s.wwcd, 0)
    const matches_played = slotsPlayed.reduce((sum, s) => sum + s.matches_count, 0)
    const slots_played = slotsPlayed.length

    return {
      team_id: team.team_id,
      team_name: team.team_name,
      matches_played,
      slots_played,
      wwcd: best_6_wwcd,
      position_points: best_6_position_points,
      finishes: best_6_kills,
      best_16_total: best_6_total,
      total_kills: best_6_kills,
    }
  })

  // Exact Tie-Breaker Ordering:
  // 1. Total Points (best_6_total)
  // 2. Position Points (if Total Points are equal)
  // 3. Chicken Dinners (if Total Points & Position Points are equal)
  computedStandings.sort((a, b) => {
    if (b.best_16_total !== a.best_16_total) return b.best_16_total - a.best_16_total
    if (b.position_points !== a.position_points) return b.position_points - a.position_points
    if (b.wwcd !== a.wwcd) return b.wwcd - a.wwcd
    return 0
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
        slots={enrichedSlots}
        bookings={filteredBookings as any[]}
        slotWinnersMap={slotWinnersMap}
        userTeamId={userTeamId}
      />
    </Suspense>
  )
}
