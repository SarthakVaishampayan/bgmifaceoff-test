export const dynamic = 'force-dynamic'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import SlotsClient from './SlotsClient'
import type { Metadata } from 'next'

import { isSlotPastOrEnded, getSlotStartMinutes } from '@/lib/utils/slotTime'

export const metadata: Metadata = {
  title: 'Slot Booking | BGFS',
  description: 'Book your match slots for Battlegrounds Faceoff Series.',
}

interface FreeCoupon {
  coupon_id: string
  code: string
}

export default async function SlotsPage() {
  const supabase = await createClient()

  // Step 1: Fetch slots + config in parallel (no dependencies)
  const [slotsResult, configResult] = await Promise.all([
    supabase
      .from('slots')
      .select('*')
      .gte('date', '2026-09-16')
      .order('date', { ascending: true }),
    supabase
      .from('config')
      .select('key, value')
      .in('key', ['whatsapp_invite_link', 'slot_entry_fee', 'slot_first_prize', 'slot_second_prize', 'slot_prizes_map']),
  ])

  let slots = slotsResult.data || []

  const configObj: Record<string, string> = {}
  configResult.data?.forEach(r => { configObj[r.key] = r.value })

  let slotPrizesMap: Record<string, { first_prize?: number; second_prize?: number; third_prize_text?: string }> = {}
  if (configObj.slot_prizes_map) {
    try { slotPrizesMap = JSON.parse(configObj.slot_prizes_map) } catch {}
  }

  const defaultFirst = parseInt(configObj.slot_first_prize || '200', 10)
  const defaultSecond = parseInt(configObj.slot_second_prize || '150', 10)

  slots = slots.map(s => ({
    ...s,
    first_prize: s.first_prize ?? slotPrizesMap[s.slot_id]?.first_prize ?? defaultFirst,
    second_prize: s.second_prize ?? slotPrizesMap[s.slot_id]?.second_prize ?? defaultSecond,
    third_prize_text: s.third_prize_text ?? slotPrizesMap[s.slot_id]?.third_prize_text ?? '100% Free Slot Pass',
  }))

  // Ensure slots are strictly ordered: latest date first (descending), then morning to night asc within each day
  slots.sort((a, b) => {
    const aDate = String(a.date || '').split('T')[0]
    const bDate = String(b.date || '').split('T')[0]
    const dateComp = bDate.localeCompare(aDate)
    if (dateComp !== 0) return dateComp

    const aMins = getSlotStartMinutes(a.time_label)
    const bMins = getSlotStartMinutes(b.time_label)
    return aMins - bMins
  })

  // Auto-close slots whose registration cutoff (10 mins before start) has passed
  const autoCloseSlotIds = slots
    .filter(s => s.status === 'open' && isSlotPastOrEnded(s.date, s.time_label, s.status))
    .map(s => s.slot_id)

  if (autoCloseSlotIds.length > 0) {
    // Update local state immediately so UI shows correct status
    slots = slots.map(s => autoCloseSlotIds.includes(s.slot_id) ? { ...s, status: 'closed' as const } : s)
    // Fire-and-forget DB update to sync DB status
    createAdminClient().then(admin =>
      admin.from('slots').update({ status: 'closed' }).in('slot_id', autoCloseSlotIds)
    ).catch(() => {})
  }

  // Step 2: Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  let userTeam = null
  let freeCoupon = null
  let unusedCoupons: FreeCoupon[] = []
  let userBookedSlotIds: string[] = []
  let userBookedSlotsMap: Record<string, number> = {}
  let isTestAccount = false

  if (user) {
    const admin = await createAdminClient()

    // Fetch user profile
    let { data: userProfile } = await admin
      .from('users')
      .select('team_id, is_test_account, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userProfile?.is_test_account) isTestAccount = true

    let teamId = userProfile?.team_id

    // Auto-provision team if missing
    if (!teamId) {
      let { data: teamByCaptain } = await admin
        .from('teams')
        .select('team_id, team_name, is_test_account')
        .eq('captain_user_id', user.id)
        .maybeSingle()

      if (!teamByCaptain) {
        const defaultTeamName =
          user.user_metadata?.display_name?.trim() || user.user_metadata?.team_name?.trim() ||
          user.user_metadata?.full_name?.trim() ||
          (user.email ? `${user.email.split('@')[0]} Squad` : `Team ${user.id.slice(0, 5)}`)

        const { data: createdTeam } = await admin
          .from('teams')
          .insert({ team_name: defaultTeamName, captain_user_id: user.id })
          .select('team_id, team_name, is_test_account')
          .maybeSingle()

        teamByCaptain = createdTeam
      }

      if (teamByCaptain) {
        teamId = teamByCaptain.team_id
        userTeam = teamByCaptain
        if (teamByCaptain.is_test_account) isTestAccount = true

        const assignedRole = isSuperAdminEmail(user.email)
          ? 'admin'
          : ((userProfile?.role === 'admin' || userProfile?.role === 'admin_scores') ? userProfile.role : 'captain')
        await admin
          .from('users')
          .upsert(
            { user_id: user.id, email: user.email, team_id: teamId, role: assignedRole, display_name: teamByCaptain.team_name },
            { onConflict: 'user_id' }
          )
      }
    } else {
      const { data: teamData } = await admin
        .from('teams')
        .select('team_id, team_name, is_test_account')
        .eq('team_id', teamId)
        .maybeSingle()

      userTeam = teamData
      if (teamData?.is_test_account) isTestAccount = true
    }

    // Collect all team IDs
    const { data: userCaptainedTeams } = await admin
      .from('teams')
      .select('team_id')
      .eq('captain_user_id', user.id)

    const allUserTeamIds = Array.from(
      new Set([teamId, userProfile?.team_id, ...(userCaptainedTeams || []).map(t => t.team_id)].filter(Boolean))
    )

    userBookedSlotsMap = {}

    // Fetch coupons and bookings in parallel
    if (allUserTeamIds.length > 0) {
      const [couponsRes, bookingsRes] = await Promise.all([
        admin.from('coupons').select('coupon_id, code').in('team_id', allUserTeamIds).eq('status', 'unused'),
        admin.from('bookings').select('slot_id, room_slot_number').in('team_id', allUserTeamIds).eq('payment_status', 'paid'),
      ])

      unusedCoupons = couponsRes.data || []
      freeCoupon = unusedCoupons.length > 0 ? unusedCoupons[0] : null
      userBookedSlotIds = Array.from(new Set((bookingsRes.data || []).map(b => b.slot_id).filter(Boolean)))
      bookingsRes.data?.forEach(b => {
        if (b.slot_id) {
          userBookedSlotsMap[b.slot_id] = b.room_slot_number || 5
        }
      })
    }
  }

  const config: Record<string, string> = {}
  configResult.data?.forEach(row => { config[row.key] = row.value })

  return (
    <SlotsClient
      slots={slots}
      userTeam={userTeam}
      freeCoupon={freeCoupon}
      unusedCoupons={unusedCoupons}
      userBookedSlotIds={userBookedSlotIds}
      userBookedSlotsMap={userBookedSlotsMap}
      whatsappLink={config.whatsapp_invite_link || ''}
      entryFee={parseInt(config.slot_entry_fee || '40')}
      firstPrize={parseInt(config.slot_first_prize || '200')}
      secondPrize={parseInt(config.slot_second_prize || '150')}
      isLoggedIn={!!user}
      isTestAccount={isTestAccount}
    />
  )
}
