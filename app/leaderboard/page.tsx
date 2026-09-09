import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import LeaderboardClient from './LeaderboardClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leaderboard | BGFS',
  description: 'Live BGFS Battlegrounds Faceoff Series standings. Best-16 match system, updated after every slot.',
}

export const revalidate = 60

export default async function LeaderboardPage() {
  // Use admin client so RLS does not filter out other teams' bookings/matches
  const supabase = await createAdminClient()

  // Fetch overall leaderboard
  const { data: rows } = await supabase
    .from('leaderboard')
    .select('team_id, team_name, matches_played, best_16_total, total_kills')
    .order('best_16_total', { ascending: false })
    .order('total_kills', { ascending: false })

  // Fetch all matches with team details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allMatchesRaw } = await (supabase
    .from('matches')
    .select('match_id, team_id, slot_id, match_number, total_points, placement, kills, placement_points, kill_points, teams(team_name), slots(date, time_label)')
    .order('created_at', { ascending: true }) as any)
  const allMatches = (allMatchesRaw || []) as any[]

  // Fetch slots for per-slot leaderboard filter
  const { data: slots } = await supabase
    .from('slots')
    .select('slot_id, date, time_label, status, teams_booked_count')
    .order('date', { ascending: false })
    .order('time_label', { ascending: false })

  // Fetch test teams to exclude from public standings
  const { data: testTeams } = await supabase
    .from('teams')
    .select('team_id')
    .eq('is_test_account', true)

  const testTeamIds = new Set(testTeams?.map(t => t.team_id) || [])

  const filteredRows = (rows || []).filter(r => !testTeamIds.has(r.team_id))
  const filteredMatches = (allMatches || []).filter(m => !testTeamIds.has(m.team_id))

  // Fetch all paid bookings with team names & custom room slot numbers (ordered by created_at ASC)
  let { data: bookingsRaw, error: bookingErr } = await supabase
    .from('bookings')
    .select('booking_id, team_id, slot_id, room_slot_number, is_test_booking, created_at, teams(team_name)')
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: true })

  if (bookingErr && bookingErr.message?.includes('room_slot_number')) {
    const fallback = await supabase
      .from('bookings')
      .select('booking_id, team_id, slot_id, is_test_booking, created_at, teams(team_name)')
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: true })
    bookingsRaw = fallback.data as any[]
  }

  const filteredBookings = bookingsRaw || []

  // Rank the overall rows
  const ranked = filteredRows.map((row, idx) => ({ ...row, rank: idx + 1 }))

  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Loading Leaderboard...</div>}>
      <LeaderboardClient
        rows={ranked}
        allMatches={filteredMatches}
        slots={slots || []}
        bookings={filteredBookings as any[]}
      />
    </Suspense>
  )
}
