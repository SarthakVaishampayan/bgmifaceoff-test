export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import DashboardClient from './DashboardClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard | BGFS',
  description: 'Player dashboard: slots, standings, and wallet overview.',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = await createAdminClient()

  // Step 1: Fetch user profile (must be first — determines teamId)
  let { data: userProfile } = await admin
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  let teamId = userProfile?.team_id

  // Step 2: Auto-provision team if missing (must be sequential — depends on step 1)
  if (!teamId) {
    let { data: existingTeam } = await admin
      .from('teams')
      .select('*')
      .eq('captain_user_id', user.id)
      .maybeSingle()

    if (!existingTeam) {
      const defaultTeamName =
        user.user_metadata?.display_name?.trim() || user.user_metadata?.team_name?.trim() ||
        user.user_metadata?.full_name?.trim() ||
        (user.email ? `${user.email.split('@')[0]} Squad` : `Team ${user.id.slice(0, 5)}`)

      const { data: newTeam } = await admin
        .from('teams')
        .insert({ team_name: defaultTeamName, captain_user_id: user.id })
        .select()
        .maybeSingle()

      existingTeam = newTeam
    }

    if (existingTeam) {
      teamId = existingTeam.team_id
      const assignedRole = isSuperAdminEmail(user.email)
        ? 'admin'
        : ((userProfile?.role === 'admin' || userProfile?.role === 'admin_scores') ? userProfile.role : 'captain')
      await admin
        .from('users')
        .upsert(
          { user_id: user.id, email: user.email, team_id: teamId, role: assignedRole, display_name: existingTeam.team_name },
          { onConflict: 'user_id' }
        )
    }
  }

  // Step 3: Fetch team info + collect all user team IDs (sequential — depends on teamId)
  const { data: team } = await admin
    .from('teams')
    .select('team_id, team_name, captain_user_id, name_changed')
    .eq('team_id', teamId)
    .maybeSingle()

  const safeTeam = team || {
    team_id: teamId || 'default',
    team_name: 'My Team',
    captain_user_id: user.id,
    name_changed: false,
  }

  const { data: userCaptainedTeams } = await admin
    .from('teams')
    .select('team_id')
    .eq('captain_user_id', user.id)

  const allUserTeamIds = Array.from(
    new Set(
      [safeTeam.team_id, userProfile?.team_id, ...(userCaptainedTeams || []).map(t => t.team_id)].filter(Boolean)
    )
  )

  // Step 4: ALL independent queries in parallel
  const [
    bookingsResult,
    matchesResult,
    configResult,
    leaderboardResult,
    payoutsResult,
    couponsResult,
    publishedSlotsResult,
    slotWinnersConfigsResult,
  ] = await Promise.all([
    // Bookings
    allUserTeamIds.length > 0
      ? admin
          .from('bookings')
          .select('booking_id, slot_id, payment_status, amount_paid, coupon_used, created_at, room_slot_number, slots(slot_id, date, time_label, status, entry_fee, is_grand_finals, whatsapp_link)')
          .in('team_id', allUserTeamIds)
          .eq('payment_status', 'paid')
          .order('created_at', { ascending: false })
          .then(res => {
            // Fallback: if room_slot_number column missing, retry without it
            if (res.error?.message?.includes('room_slot_number')) {
              return admin
                .from('bookings')
                .select('booking_id, slot_id, payment_status, amount_paid, coupon_used, created_at, slots(slot_id, date, time_label, status, entry_fee, is_grand_finals, whatsapp_link)')
                .in('team_id', allUserTeamIds)
                .eq('payment_status', 'paid')
                .order('created_at', { ascending: false })
            }
            return res
          })
      : Promise.resolve({ data: [], error: null }),

    // Matches
    admin
      .from('matches')
      .select('match_id, slot_id, match_number, placement, kills, placement_points, kill_points, total_points, created_at, slots(slot_id, date, time_label, status)')
      .eq('team_id', safeTeam.team_id)
      .order('match_number', { ascending: true }),

    // Config (whatsapp link)
    admin
      .from('config')
      .select('value')
      .eq('key', 'whatsapp_invite_link')
      .maybeSingle(),

    // All matches for leaderboard ranking
    admin
      .from('matches')
      .select('team_id, slot_id, total_points, placement_points, placement, kills'),

    // Payouts
    admin
      .from('payouts')
      .select('amount, status')
      .eq('team_id', safeTeam.team_id),

    // Coupons
    admin
      .from('coupons')
      .select('coupon_id, code, type, status, issued_at')
      .eq('team_id', safeTeam.team_id)
      .order('issued_at', { ascending: false }),

    // Published slots (pushed via "Update The Table")
    admin
      .from('config')
      .select('value')
      .eq('key', 'scores_published_slots')
      .maybeSingle(),

    // Slot winners configs
    admin
      .from('config')
      .select('key, value')
      .like('key', 'slot_winners_%'),
  ])

  let bookings: any[] = bookingsResult.data || []

  // Parse published slot IDs
  let publishedSlotIds = new Set<string>()
  if (publishedSlotsResult?.data?.value) {
    try {
      const parsed = JSON.parse(publishedSlotsResult.data.value)
      if (Array.isArray(parsed)) publishedSlotIds = new Set(parsed)
    } catch {}
  }

  // Populate missing slot objects if join returned null
  if (bookings.length > 0) {
    const missingSlotIds = bookings.filter(b => !b.slots && b.slot_id).map(b => b.slot_id)
    if (missingSlotIds.length > 0) {
      const { data: fetchedSlots } = await admin
        .from('slots')
        .select('slot_id, date, time_label, status, entry_fee, is_grand_finals, whatsapp_link')
        .in('slot_id', missingSlotIds)

      if (fetchedSlots && fetchedSlots.length > 0) {
        const slotMap = new Map(fetchedSlots.map(s => [s.slot_id, s]))
        bookings = bookings.map(b => {
          if (!b.slots && b.slot_id && slotMap.has(b.slot_id)) {
            return { ...b, slots: slotMap.get(b.slot_id) }
          }
          return b
        })
      }
    }
  }

  // Filter out any bookings from test dates (on or before Sept 15)
  bookings = bookings.filter(b => !b.slots?.date || b.slots.date >= '2026-09-16')

  // Fetch room slot layout for booked slots
  const slotIds = Array.from(new Set(bookings.map(b => b.slot_id).filter(Boolean)))
  let slotBookingsMap: Record<string, any[]> = {}

  if (slotIds.length > 0) {
    const { data: allSlotBookings } = await admin
      .from('bookings')
      .select('slot_id, room_slot_number, team_id, teams(team_name)')
      .in('slot_id', slotIds)
      .eq('payment_status', 'paid')
      .order('room_slot_number', { ascending: true })

    if (allSlotBookings) {
      allSlotBookings.forEach(sb => {
        if (!slotBookingsMap[sb.slot_id]) slotBookingsMap[sb.slot_id] = []
        slotBookingsMap[sb.slot_id].push({
          room_slot_number: sb.room_slot_number || 5,
          team_id: sb.team_id,
          team_name: (sb.teams as any)?.team_name || 'Team Registered',
        })
      })
    }
  }

  const slotWinnersMap: Record<string, { m1?: string; m2?: string; m3?: string }> = {}
  if (slotWinnersConfigsResult?.data) {
    slotWinnersConfigsResult.data.forEach((c: any) => {
      const sId = c.key.replace('slot_winners_', '')
      try {
        slotWinnersMap[sId] = JSON.parse(c.value)
      } catch {}
    })
  }

  const allMatchesData = leaderboardResult.data || []
  const completedMatches = allMatchesData.filter((m: any) => publishedSlotIds.has(m.slot_id))
  const teamSlotTotals: Record<string, Record<string, { total_points: number; position_points: number; kills: number; wwcd: number; matches_count: number }>> = {}
  
  completedMatches.forEach((m: any) => {
    if (!teamSlotTotals[m.team_id]) teamSlotTotals[m.team_id] = {}
    if (!teamSlotTotals[m.team_id][m.slot_id]) {
      let wwcdCount = 0
      const winners = slotWinnersMap[m.slot_id]
      if (winners) {
        if (winners.m1 === m.team_id) wwcdCount++
        if (winners.m2 === m.team_id) wwcdCount++
        if (winners.m3 === m.team_id) wwcdCount++
      } else if (Number(m.placement) === 1) {
        wwcdCount = 1
      }
      teamSlotTotals[m.team_id][m.slot_id] = { total_points: 0, position_points: 0, kills: 0, wwcd: wwcdCount, matches_count: 0 }
    }
    const posPts = m.placement_points !== undefined && m.placement_points !== null
      ? Number(m.placement_points)
      : Math.max(0, (Number(m.total_points) || 0) - (Number(m.kills) || 0))

    teamSlotTotals[m.team_id][m.slot_id].total_points += Number(m.total_points) || 0
    teamSlotTotals[m.team_id][m.slot_id].position_points += posPts
    teamSlotTotals[m.team_id][m.slot_id].kills += Number(m.kills) || 0
    teamSlotTotals[m.team_id][m.slot_id].matches_count += 1
  })

  // Ensure current safeTeam is in the map
  if (!teamSlotTotals[safeTeam.team_id]) {
    teamSlotTotals[safeTeam.team_id] = {}
  }

  const computedRankedList = Object.entries(teamSlotTotals).map(([tId, slotMap]) => {
    const slotsPlayed = Object.values(slotMap)
    slotsPlayed.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      if (b.position_points !== a.position_points) return b.position_points - a.position_points
      if (b.wwcd !== a.wwcd) return b.wwcd - a.wwcd
      return 0
    })
    const top6 = slotsPlayed.slice(0, 6)
    const best_16_total = top6.reduce((sum, s) => sum + s.total_points, 0)
    const best_16_pos_points = top6.reduce((sum, s) => sum + s.position_points, 0)
    const best_16_wwcd = top6.reduce((sum, s) => sum + s.wwcd, 0)
    const total_kills = slotsPlayed.reduce((sum, s) => sum + s.kills, 0)
    const matches_played = slotsPlayed.reduce((sum, s) => sum + s.matches_count, 0)
    return {
      team_id: tId,
      best_16_total,
      best_16_pos_points,
      best_16_wwcd,
      total_kills,
      matches_played,
    }
  })

  computedRankedList.sort((a, b) => {
    if (b.best_16_total !== a.best_16_total) return b.best_16_total - a.best_16_total
    if (b.best_16_pos_points !== a.best_16_pos_points) return b.best_16_pos_points - a.best_16_pos_points
    if (b.best_16_wwcd !== a.best_16_wwcd) return b.best_16_wwcd - a.best_16_wwcd
    return 0
  })

  const teamIndex = computedRankedList.findIndex(r => r.team_id === safeTeam.team_id)
  const rank = teamIndex >= 0 ? teamIndex + 1 : 0
  const leaderboardEntry = teamIndex >= 0 ? computedRankedList[teamIndex] : null
  const completedTeamMatches = (matchesResult.data || []).filter((m: any) => publishedSlotIds.has(m.slot_id))
  const isTestAccount = Boolean(userProfile?.is_test_account || (team as any)?.is_test_account)

  return (
    <DashboardClient
      team={safeTeam}
      userEmail={user.email || ''}
      bookings={bookings}
      slotBookingsMap={slotBookingsMap}
      teamMatches={completedTeamMatches}
      globalWhatsappLink={configResult.data?.value || 'https://chat.whatsapp.com/BGFS'}
      leaderboardEntry={leaderboardEntry}
      rank={rank}
      payouts={payoutsResult.data || []}
      coupons={couponsResult.data || []}
      isCaptain={safeTeam.captain_user_id === user.id}
      isTestAccount={isTestAccount}
      hasPhone={Boolean(userProfile?.phone || user.user_metadata?.phone)}
    />
  )
}
