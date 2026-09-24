import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'

// POST /api/admin/users/lookup
// Searches for a team by team name, phone number, or email.
// Returns complete dossier: contact (phone/WhatsApp), email, role, UPI ID & holder name,
// and all bookings categorized into future/upcoming and past match history.
export async function POST(request: Request) {
  try {
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

    if (!isPermAdmin && userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { query } = await request.json()
    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const rawQuery = query.trim()
    const cleanQuery = rawQuery.toLowerCase()
    const digitsOnly = rawQuery.replace(/\D/g, '')
    const phoneMatch = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly.length >= 4 ? digitsOnly : null

    const matchedUserMap = new Map<string, any>()

    // 1. Search in public.users table by email, display_name, or phone
    let userFilter = `email.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`
    if (phoneMatch) {
      userFilter += `,phone.ilike.%${phoneMatch}%`
    }

    const { data: directUsers, error: searchErr } = await admin
      .from('users')
      .select('user_id, email, phone, display_name, role, is_test_account, created_at, team_id, upi_id')
      .or(userFilter)
      .limit(15)

    if (searchErr) {
      console.error('User lookup search error:', searchErr)
    } else if (directUsers) {
      directUsers.forEach(u => matchedUserMap.set(u.user_id, u))
    }

    // 2. Search in public.teams table by team_name
    const { data: matchedTeams } = await admin
      .from('teams')
      .select('team_id, team_name, captain_user_id')
      .ilike('team_name', `%${cleanQuery}%`)
      .limit(10)

    if (matchedTeams && matchedTeams.length > 0) {
      const teamIds = matchedTeams.map(t => t.team_id)
      const captainIds = matchedTeams.map(t => t.captain_user_id).filter(Boolean)

      // Fetch users belonging to these teams or captains
      const { data: teamUsers } = await admin
        .from('users')
        .select('user_id, email, phone, display_name, role, is_test_account, created_at, team_id, upi_id')
        .or(`team_id.in.(${teamIds.join(',')})${captainIds.length > 0 ? `,user_id.in.(${captainIds.join(',')})` : ''}`)
        .limit(20)

      if (teamUsers) {
        teamUsers.forEach(u => matchedUserMap.set(u.user_id, u))
      }
    }

    // 3. Search in public.config table if phoneMatch is present (e.g. phone stored in config)
    if (phoneMatch) {
      const { data: configPhoneRows } = await admin
        .from('config')
        .select('key, value')
        .like('key', 'phone_%')
        .ilike('value', `%${phoneMatch}%`)
        .limit(10)

      if (configPhoneRows && configPhoneRows.length > 0) {
        const teamIdsFromConfig: string[] = []
        const userIdsFromConfig: string[] = []

        configPhoneRows.forEach(r => {
          if (r.key.startsWith('phone_team_')) {
            teamIdsFromConfig.push(r.key.replace('phone_team_', ''))
          } else if (r.key.startsWith('phone_user_')) {
            userIdsFromConfig.push(r.key.replace('phone_user_', ''))
          }
        })

        if (teamIdsFromConfig.length > 0 || userIdsFromConfig.length > 0) {
          const conditions: string[] = []
          if (teamIdsFromConfig.length > 0) conditions.push(`team_id.in.(${teamIdsFromConfig.join(',')})`)
          if (userIdsFromConfig.length > 0) conditions.push(`user_id.in.(${userIdsFromConfig.join(',')})`)

          const { data: configMatchedUsers } = await admin
            .from('users')
            .select('user_id, email, phone, display_name, role, is_test_account, created_at, team_id, upi_id')
            .or(conditions.join(','))
            .limit(10)

          if (configMatchedUsers) {
            configMatchedUsers.forEach(u => matchedUserMap.set(u.user_id, u))
          }
        }
      }
    }

    // 4. Also search config for UPI match if query contains '@'
    if (cleanQuery.includes('@')) {
      const { data: configUpiRows } = await admin
        .from('config')
        .select('key, value')
        .like('key', 'upi_%')
        .ilike('value', `%${cleanQuery}%`)
        .limit(10)

      if (configUpiRows && configUpiRows.length > 0) {
        const teamIdsFromUpi: string[] = []
        configUpiRows.forEach(r => {
          if (r.key.startsWith('upi_team_')) {
            teamIdsFromUpi.push(r.key.replace('upi_team_', ''))
          }
        })
        if (teamIdsFromUpi.length > 0) {
          const { data: upiUsers } = await admin
            .from('users')
            .select('user_id, email, phone, display_name, role, is_test_account, created_at, team_id, upi_id')
            .in('team_id', teamIdsFromUpi)
            .limit(10)

          if (upiUsers) {
            upiUsers.forEach(u => matchedUserMap.set(u.user_id, u))
          }
        }
      }
    }

    const matchedUsers = Array.from(matchedUserMap.values())

    // 5. Gather team mapping
    const teamIdsToFetch = Array.from(new Set(matchedUsers.map(u => u.team_id).filter(Boolean)))
    const teamMap: Record<string, string> = {}

    if (teamIdsToFetch.length > 0) {
      const { data: teamsData } = await admin
        .from('teams')
        .select('team_id, team_name')
        .in('team_id', teamIdsToFetch)

      if (teamsData) {
        teamsData.forEach(t => {
          teamMap[t.team_id] = t.team_name
        })
      }
    }

    // Today in YYYY-MM-DD for upcoming/past categorization
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

    // 6. Enrich each team/user with contact, UPI info, and categorized bookings
    const enrichedTeams = await Promise.all(
      matchedUsers.map(async u => {
        let teamId = u.team_id

        // If user has no team_id, check if they are captain of any team
        if (!teamId) {
          const { data: captainTeam } = await admin
            .from('teams')
            .select('team_id, team_name')
            .eq('captain_user_id', u.user_id)
            .maybeSingle()
          if (captainTeam) {
            teamId = captainTeam.team_id
            teamMap[teamId] = captainTeam.team_name
          }
        }

        const teamName = (teamId && teamMap[teamId]) || u.display_name || 'No Team Name'

        // Resolve phone number (priority: users.phone -> config phone_team_ -> config phone_user_)
        let phone = u.phone || null
        if (!phone && teamId) {
          const { data: cPhone } = await admin
            .from('config')
            .select('value')
            .eq('key', `phone_team_${teamId}`)
            .maybeSingle()
          if (cPhone?.value) {
            try {
              const parsed = JSON.parse(cPhone.value)
              phone = parsed.phone || cPhone.value
            } catch {
              phone = cPhone.value
            }
          }
        }
        if (!phone) {
          const { data: uPhone } = await admin
            .from('config')
            .select('value')
            .eq('key', `phone_user_${u.user_id}`)
            .maybeSingle()
          if (uPhone?.value) {
            try {
              const parsed = JSON.parse(uPhone.value)
              phone = parsed.phone || uPhone.value
            } catch {
              phone = uPhone.value
            }
          }
        }

        // Clean phone to 10 digits if present
        const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : null

        // Resolve UPI info (priority: users.upi_id -> config upi_team_ -> config upi_user_)
        let upiId = u.upi_id || ''
        let upiHolderName = ''

        if (teamId) {
          const { data: cUpi } = await admin
            .from('config')
            .select('value')
            .eq('key', `upi_team_${teamId}`)
            .maybeSingle()
          if (cUpi?.value) {
            try {
              const parsed = JSON.parse(cUpi.value)
              if (parsed.upi_id) upiId = parsed.upi_id
              if (parsed.upi_holder_name) upiHolderName = parsed.upi_holder_name
            } catch {}
          }
        }

        if (!upiId) {
          const { data: uUpi } = await admin
            .from('config')
            .select('value')
            .eq('key', `upi_user_${u.user_id}`)
            .maybeSingle()
          if (uUpi?.value) {
            try {
              const parsed = JSON.parse(uUpi.value)
              if (parsed.upi_id) upiId = parsed.upi_id
              if (parsed.upi_holder_name) upiHolderName = parsed.upi_holder_name
            } catch {}
          }
        }

        // Fetch ALL bookings for this team
        let allBookings: any[] = []
        if (teamId) {
          const { data: bData } = await admin
            .from('bookings')
            .select(`
              booking_id,
              slot_id,
              room_slot_number,
              payment_status,
              coupon_used,
              amount_paid,
              is_test_booking,
              created_at,
              slots (
                slot_id,
                date,
                time_label,
                status,
                entry_fee
              )
            `)
            .eq('team_id', teamId)
            .order('created_at', { ascending: false })

          if (bData) {
            allBookings = bData.map(b => {
              const slot = (b.slots as any) || {}
              const slotDate = slot.date || ''
              const slotStatus = slot.status || 'open'
              const isPast = (slotDate && slotDate < todayStr) || slotStatus === 'completed'

              return {
                booking_id: b.booking_id,
                slot_id: b.slot_id,
                slot_date: slotDate,
                slot_time: slot.time_label || '—',
                room_slot_number: b.room_slot_number || 5,
                payment_status: b.payment_status || 'paid',
                amount_paid: b.amount_paid ?? slot.entry_fee ?? 40,
                coupon_used: Boolean(b.coupon_used),
                is_test_booking: Boolean(b.is_test_booking),
                slot_status: slotStatus,
                is_past: isPast,
                created_at: b.created_at,
              }
            })
          }
        }

        // Categorize bookings
        const upcomingBookings = allBookings
          .filter(b => !b.is_past)
          .sort((a, b) => a.slot_date.localeCompare(b.slot_date))

        const pastBookings = allBookings
          .filter(b => b.is_past)
          .sort((a, b) => b.slot_date.localeCompare(a.slot_date))

        const totalSpent = allBookings
          .filter(b => b.payment_status === 'paid' && !b.is_test_booking)
          .reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0)

        return {
          user_id: u.user_id,
          email: u.email,
          phone: cleanPhone,
          display_name: u.display_name,
          role: u.role || 'player',
          is_test_account: Boolean(u.is_test_account),
          team_id: teamId,
          team_name: teamName,
          upi_id: upiId || null,
          upi_holder_name: upiHolderName || null,
          created_at: u.created_at,
          stats: {
            total_bookings: allBookings.length,
            upcoming_count: upcomingBookings.length,
            past_count: pastBookings.length,
            total_spent: totalSpent,
          },
          upcoming_bookings: upcomingBookings,
          past_bookings: pastBookings,
          bookings: allBookings, // complete list
        }
      })
    )

    return NextResponse.json({
      success: true,
      users: enrichedTeams,
    })
  } catch (err: any) {
    console.error('Teams lookup API error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
