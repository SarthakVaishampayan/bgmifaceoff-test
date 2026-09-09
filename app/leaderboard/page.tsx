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
  ])

  const testTeamIds = new Set(testTeamsResult.data?.map(t => t.team_id) || [])

  const filteredRows = (leaderboardResult.data || []).filter(r => !testTeamIds.has(r.team_id))
  const filteredMatches = ((matchesResult.data || []) as any[]).filter(m => !testTeamIds.has(m.team_id))

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

  const ranked = filteredRows.map((row, idx) => ({ ...row, rank: idx + 1 }))

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
        allMatches={filteredMatches}
        slots={slotsResult.data || []}
        bookings={filteredBookings as any[]}
        userTeamId={userTeamId}
      />
    </Suspense>
  )
}
