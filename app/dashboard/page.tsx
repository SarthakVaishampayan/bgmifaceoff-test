export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
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

  // Fetch user profile
  let { data: userProfile } = await admin
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  let teamId = userProfile?.team_id

  // If user has no team or no profile yet, automatically set up a default team so they never get trapped in an onboard redirect
  if (!teamId) {
    // Check if team already exists for this captain
    let { data: existingTeam } = await admin
      .from('teams')
      .select('*')
      .eq('captain_user_id', user.id)
      .maybeSingle()

    if (!existingTeam) {
      const defaultTeamName =
        user.user_metadata?.display_name?.trim() ||
        user.user_metadata?.team_name?.trim() ||
        user.user_metadata?.full_name?.trim() ||
        (user.email ? `${user.email.split('@')[0]} Squad` : `Team ${user.id.slice(0, 5)}`)

      const { data: newTeam } = await admin
        .from('teams')
        .insert({
          team_name: defaultTeamName,
          captain_user_id: user.id,
        })
        .select()
        .maybeSingle()

      existingTeam = newTeam
    }

    if (existingTeam) {
      teamId = existingTeam.team_id
      await admin
        .from('users')
        .upsert(
          {
            user_id: user.id,
            email: user.email,
            team_id: teamId,
            role: 'captain',
            display_name: existingTeam.team_name,
          },
          { onConflict: 'user_id' }
        )
    }
  }

  // Fetch team info
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

  // Collect all team IDs owned by or linked to this user (for legacy & new accounts compatibility)
  const { data: userCaptainedTeams } = await admin
    .from('teams')
    .select('team_id')
    .eq('captain_user_id', user.id)

  const allUserTeamIds = Array.from(
    new Set(
      [
        safeTeam.team_id,
        userProfile?.team_id,
        ...(userCaptainedTeams || []).map(t => t.team_id)
      ].filter(Boolean)
    )
  )

  // Fetch booked slots for this user/team with slot details & whatsapp_link
  let bookings: any[] = []
  if (allUserTeamIds.length > 0) {
    let { data: bData, error: bookingErr } = await admin
      .from('bookings')
      .select(
        'booking_id, slot_id, payment_status, amount_paid, coupon_used, created_at, room_slot_number, slots(slot_id, date, time_label, status, entry_fee, is_grand_finals, whatsapp_link)'
      )
      .in('team_id', allUserTeamIds)
      .order('created_at', { ascending: false })

    if (bookingErr && bookingErr.message?.includes('room_slot_number')) {
      const fallback = await admin
        .from('bookings')
        .select(
          'booking_id, slot_id, payment_status, amount_paid, coupon_used, created_at, slots(slot_id, date, time_label, status, entry_fee, is_grand_finals, whatsapp_link)'
        )
        .in('team_id', allUserTeamIds)
        .order('created_at', { ascending: false })
      bData = fallback.data as any[]
    }
    bookings = bData || []
  }

  // Populate missing slot objects directly from slots table if join returned null
  if (bookings.length > 0) {
    const missingSlotIds = bookings
      .filter(b => !b.slots && b.slot_id)
      .map(b => b.slot_id)

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

  // Fetch all confirmed team bookings for these slots to show room slot layout table
  const slotIds = Array.from(new Set((bookings || []).map(b => b.slot_id).filter(Boolean)))
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

  // Fetch recorded match score results for past/completed slots
  const { data: teamMatches } = await admin
    .from('matches')
    .select('match_id, slot_id, match_number, map_name, position, kills, position_points, elimination_points, total_points, played_at')
    .eq('team_id', safeTeam.team_id)

  // Fetch global whatsapp link fallback
  const { data: configWA } = await admin
    .from('config')
    .select('value')
    .eq('key', 'whatsapp_invite_link')
    .maybeSingle()
  const globalWhatsappLink = configWA?.value || 'https://chat.whatsapp.com/BGFS'

  // Fetch full leaderboard standings to calculate team rank and stats
  const { data: allLeaderboard } = await admin
    .from('leaderboard')
    .select('team_id, best_16_total, matches_played, total_kills')
    .order('best_16_total', { ascending: false })
    .order('total_kills', { ascending: false })

  const rankedList = allLeaderboard || []
  const teamIndex = rankedList.findIndex(r => r.team_id === safeTeam.team_id)
  const rank = teamIndex >= 0 ? teamIndex + 1 : 0
  const leaderboardEntry = teamIndex >= 0 ? rankedList[teamIndex] : null

  // Fetch payouts for this team
  const { data: payouts } = await admin
    .from('payouts')
    .select('amount, status')
    .eq('team_id', safeTeam.team_id)

  // Fetch coupons/rewards for this team
  const { data: coupons } = await admin
    .from('coupons')
    .select('coupon_id, code, type, status, issued_at')
    .eq('team_id', safeTeam.team_id)
    .order('issued_at', { ascending: false })

  // Check test account status from user profile or team
  const isTestAccount = Boolean(userProfile?.is_test_account || (team as any)?.is_test_account)

  return (
    <DashboardClient
      team={safeTeam}
      userEmail={user.email || ''}
      bookings={bookings || []}
      slotBookingsMap={slotBookingsMap}
      teamMatches={teamMatches || []}
      globalWhatsappLink={globalWhatsappLink}
      leaderboardEntry={leaderboardEntry}
      rank={rank}
      payouts={payouts || []}
      coupons={coupons || []}
      isCaptain={safeTeam.captain_user_id === user.id}
      isTestAccount={isTestAccount}
    />
  )
}
