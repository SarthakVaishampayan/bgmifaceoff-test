export const dynamic = 'force-dynamic'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import SlotsClient from './SlotsClient'
import type { Metadata } from 'next'

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

  // Fetch all slots
  const { data: rawSlots } = await supabase
    .from('slots')
    .select('*')
    .order('date', { ascending: true })
    .order('time_label', { ascending: true })

  let slots = rawSlots || []

  // Automatically mark past open slots as completed in DB
  try {
    const admin = await createAdminClient()
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    const pastOpenSlotIds = slots
      .filter(s => String(s.date).split('T')[0] < todayStr && s.status === 'open')
      .map(s => s.slot_id)

    if (pastOpenSlotIds.length > 0) {
      await admin
        .from('slots')
        .update({ status: 'completed' })
        .in('slot_id', pastOpenSlotIds)

      slots = slots.map(s => pastOpenSlotIds.includes(s.slot_id) ? { ...s, status: 'completed' } : s)
    }
  } catch (err) {
    console.error('Error updating past slot statuses:', err)
  }

  // Check if user is logged in and fetch team details via Admin client (bypasses RLS)
  const { data: { user } } = await supabase.auth.getUser()
  let userTeam = null
  let freeCoupon = null
  let unusedCoupons: FreeCoupon[] = []
  let userBookedSlotIds: string[] = []

  let isTestAccount = false

  if (user) {
    const admin = await createAdminClient()

    // 1. Fetch user's linked team ID & test account flag from users table
    let { data: userProfile } = await admin
      .from('users')
      .select('team_id, is_test_account')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userProfile?.is_test_account) isTestAccount = true

    let teamId = userProfile?.team_id

    // 2. Fallback: Check if user is a captain of a team in teams table or auto-provision
    if (!teamId) {
      let { data: teamByCaptain } = await admin
        .from('teams')
        .select('team_id, team_name, is_test_account')
        .eq('captain_user_id', user.id)
        .maybeSingle()

      if (!teamByCaptain) {
        const defaultTeamName =
          user.user_metadata?.display_name?.trim() ||
          user.user_metadata?.team_name?.trim() ||
          user.user_metadata?.full_name?.trim() ||
          (user.email ? `${user.email.split('@')[0]} Squad` : `Team ${user.id.slice(0, 5)}`)

        const { data: createdTeam } = await admin
          .from('teams')
          .insert({
            team_name: defaultTeamName,
            captain_user_id: user.id,
          })
          .select('team_id, team_name, is_test_account')
          .maybeSingle()

        teamByCaptain = createdTeam
      }

      if (teamByCaptain) {
        teamId = teamByCaptain.team_id
        userTeam = teamByCaptain
        if (teamByCaptain.is_test_account) isTestAccount = true

        // Link team_id to user profile
        await admin
          .from('users')
          .upsert(
            {
              user_id: user.id,
              email: user.email,
              team_id: teamId,
              role: 'captain',
              display_name: teamByCaptain.team_name,
            },
            { onConflict: 'user_id' }
          )
      }
    } else {
      // Fetch team details
      const { data: teamData } = await admin
        .from('teams')
        .select('team_id, team_name, is_test_account')
        .eq('team_id', teamId)
        .maybeSingle()

      userTeam = teamData
      if (teamData?.is_test_account) isTestAccount = true
    }

    // Collect all team IDs owned by or linked to this user (for legacy & new accounts compatibility)
    const { data: userCaptainedTeams } = await admin
      .from('teams')
      .select('team_id')
      .eq('captain_user_id', user.id)

    const allUserTeamIds = Array.from(
      new Set(
        [
          teamId,
          userProfile?.team_id,
          ...(userCaptainedTeams || []).map(t => t.team_id)
        ].filter(Boolean)
      )
    )

    if (allUserTeamIds.length > 0) {
      // 3. Fetch unused free slot coupons for this team
      const { data: couponsData } = await admin
        .from('coupons')
        .select('coupon_id, code')
        .in('team_id', allUserTeamIds)
        .eq('status', 'unused')

      unusedCoupons = couponsData || []
      freeCoupon = unusedCoupons.length > 0 ? unusedCoupons[0] : null

      // 4. Fetch all slot IDs already booked by this user/team
      const { data: userBookings } = await admin
        .from('bookings')
        .select('slot_id')
        .in('team_id', allUserTeamIds)

      userBookedSlotIds = Array.from(new Set((userBookings || []).map(b => b.slot_id).filter(Boolean)))
    }
  }

  // Fetch global config fallbacks
  const { data: configRows } = await supabase
    .from('config')
    .select('key, value')
    .in('key', ['whatsapp_invite_link', 'slot_entry_fee'])

  const config: Record<string, string> = {}
  configRows?.forEach(row => { config[row.key] = row.value })

  return (
    <SlotsClient
      slots={slots || []}
      userTeam={userTeam}
      freeCoupon={freeCoupon}
      unusedCoupons={unusedCoupons}
      userBookedSlotIds={userBookedSlotIds}
      whatsappLink={config.whatsapp_invite_link || ''}
      entryFee={parseInt(config.slot_entry_fee || '50')}
      isLoggedIn={!!user}
      isTestAccount={isTestAccount}
    />
  )
}
