import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Synchronizes pending payouts for all completed slots.
 * For every completed slot:
 * 1. If match performance records exist, ranks the top 2 teams by total points / kills.
 * 2. If no match scores were entered yet, uses the booked teams (up to 2).
 * If a team does not have a payout record yet, generates a pending payout with amount: 0.
 */
export async function syncPendingPayouts(admin: SupabaseClient) {
  try {
    // 1. Fetch completed slots
    const { data: completedSlots, error: slotsErr } = await admin
      .from('slots')
      .select('slot_id, date, time_label')
      .eq('status', 'completed')

    if (slotsErr || !completedSlots || completedSlots.length === 0) {
      return []
    }

    const slotIds = completedSlots.map(s => s.slot_id)

    // 2. Fetch all matches for these slots
    const { data: matches } = await admin
      .from('matches')
      .select('slot_id, team_id, total_points, kills, teams(team_id, team_name, captain_user_id)')
      .in('slot_id', slotIds)

    // 3. Fetch bookings for these slots (fallback when no matches were entered)
    const { data: bookings } = await admin
      .from('bookings')
      .select('slot_id, team_id, room_slot_number, teams(team_id, team_name, captain_user_id)')
      .in('slot_id', slotIds)
      .eq('payment_status', 'paid')
      .order('room_slot_number', { ascending: true })

    // 4. Fetch existing payouts for these slots and auto-clean any duplicate records
    const { data: existingPayouts } = await admin
      .from('payouts')
      .select('payout_id, slot_id, team_id, place, status, created_at')
      .in('slot_id', slotIds)
      .order('created_at', { ascending: true })

    const seenMap = new Map<string, string>()
    const duplicateIdsToDelete: string[] = []

    for (const p of (existingPayouts || [])) {
      const key = `${p.slot_id}_${p.team_id}`
      if (seenMap.has(key)) {
        if (p.status === 'pending') {
          duplicateIdsToDelete.push(p.payout_id)
        }
      } else {
        seenMap.set(key, p.payout_id)
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      await admin.from('payouts').delete().in('payout_id', duplicateIdsToDelete)
    }

    const existingPayoutMap = new Set(seenMap.keys())

    // 5. Fetch UPI configs
    const { data: upiConfigs } = await admin
      .from('config')
      .select('key, value')
      .like('key', 'upi_team_%')

    const teamUpiMap = new Map<string, string>()
    upiConfigs?.forEach(c => {
      const tId = c.key.replace('upi_team_', '')
      try {
        const parsed = JSON.parse(c.value)
        if (parsed.upi_id) teamUpiMap.set(tId, parsed.upi_id)
      } catch (e) {}
    })

    // Fetch captain users for fallback UPI
    const captainIds = Array.from(new Set([
      ...(matches || []).map((m: any) => m.teams?.captain_user_id),
      ...(bookings || []).map((b: any) => b.teams?.captain_user_id),
    ].filter(Boolean)))

    const captainUpiMap = new Map<string, string>()
    if (captainIds.length > 0) {
      const { data: capUsers } = await admin
        .from('users')
        .select('user_id, upi_id')
        .in('user_id', captainIds)
      capUsers?.forEach(u => {
        if (u.upi_id) captainUpiMap.set(u.user_id, u.upi_id)
      })
    }

    // 6. Group matches by slot
    const slotMatchesMap = new Map<string, Map<string, { team_id: string; total_points: number; total_kills: number; captain_user_id?: string }>>()
    matches?.forEach((m: any) => {
      if (!slotMatchesMap.has(m.slot_id)) {
        slotMatchesMap.set(m.slot_id, new Map())
      }
      const teamsMap = slotMatchesMap.get(m.slot_id)!
      if (!teamsMap.has(m.team_id)) {
        teamsMap.set(m.team_id, {
          team_id: m.team_id,
          total_points: 0,
          total_kills: 0,
          captain_user_id: m.teams?.captain_user_id,
        })
      }
      const t = teamsMap.get(m.team_id)!
      t.total_points += (m.total_points || 0)
      t.total_kills += (m.kills || 0)
    })

    // 7. Group bookings by slot
    const slotBookingsMap = new Map<string, Array<{ team_id: string; captain_user_id?: string }>>()
    bookings?.forEach((b: any) => {
      if (!slotBookingsMap.has(b.slot_id)) {
        slotBookingsMap.set(b.slot_id, [])
      }
      const list = slotBookingsMap.get(b.slot_id)!
      if (!list.some(x => x.team_id === b.team_id)) {
        list.push({
          team_id: b.team_id,
          captain_user_id: b.teams?.captain_user_id,
        })
      }
    })

    // 8. For each completed slot, determine top 2 candidates
    const payoutsToInsert: any[] = []

    for (const slot of completedSlots) {
      const slotId = slot.slot_id
      let top2: Array<{ team_id: string; captain_user_id?: string }> = []

      if (slotMatchesMap.has(slotId) && slotMatchesMap.get(slotId)!.size > 0) {
        const teamsMap = slotMatchesMap.get(slotId)!
        const sorted = Array.from(teamsMap.values()).sort((a, b) => {
          if (b.total_points !== a.total_points) return b.total_points - a.total_points
          return b.total_kills - a.total_kills
        })
        top2 = sorted.slice(0, 2)
      } else if (slotBookingsMap.has(slotId) && slotBookingsMap.get(slotId)!.length > 0) {
        top2 = slotBookingsMap.get(slotId)!.slice(0, 2)
      }

      top2.forEach((team, index) => {
        const key = `${slotId}_${team.team_id}`
        if (!existingPayoutMap.has(key)) {
          const place = index === 0 ? '1st' : '2nd'
          const upiId = teamUpiMap.get(team.team_id) || (team.captain_user_id ? captainUpiMap.get(team.captain_user_id) : null)

          payoutsToInsert.push({
            slot_id: slotId,
            team_id: team.team_id,
            amount: 0, // No fixed amount; admin enters actual amount on disbursement
            place,
            status: 'pending',
            upi_id: upiId || null,
          })
          // Mark in local map so we don't duplicate
          existingPayoutMap.add(key)
        }
      })
    }

    if (payoutsToInsert.length > 0) {
      await admin.from('payouts').insert(payoutsToInsert)
    }

    // 9. For each completed slot, issue a free slot coupon to the 3rd position team if not already issued
    const { data: existingSlotCoupons } = await admin
      .from('coupons')
      .select('coupon_id, issued_from_slot, team_id')
      .in('issued_from_slot', slotIds)

    const issuedSlotIds = new Set(
      (existingSlotCoupons || [])
        .map(c => c.issued_from_slot)
        .filter(Boolean)
    )

    const couponsToInsert: any[] = []

    for (const slot of completedSlots) {
      const slotId = slot.slot_id
      if (issuedSlotIds.has(slotId)) continue

      if (slotMatchesMap.has(slotId) && slotMatchesMap.get(slotId)!.size > 0) {
        const teamsMap = slotMatchesMap.get(slotId)!
        const sorted = Array.from(teamsMap.values()).sort((a, b) => {
          if (b.total_points !== a.total_points) return b.total_points - a.total_points
          return b.total_kills - a.total_kills
        })

        const thirdTeam = sorted[2]
        if (thirdTeam && thirdTeam.team_id) {
          const code = `FREE3RD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
          couponsToInsert.push({
            team_id: thirdTeam.team_id,
            type: 'free_slot',
            status: 'unused',
            issued_from_slot: slotId,
            code,
          })
          issuedSlotIds.add(slotId)
        }
      }
    }

    if (couponsToInsert.length > 0) {
      await admin.from('coupons').insert(couponsToInsert)
    }

    return payoutsToInsert
  } catch (err) {
    console.error('Error syncing pending payouts & coupons:', err)
    return []
  }
}
