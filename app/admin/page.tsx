export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { syncPendingPayouts } from '@/lib/payouts/sync'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import AdminClient from './AdminClient'

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string }
}) {
  const resolvedParams = searchParams ? await searchParams : {}
  const validTabs = ['scores', 'upi_info', 'slots', 'users', 'payouts', 'bookings', 'coupons', 'config', 'test_data']
  const initialTab = validTabs.includes(resolvedParams?.tab || '') ? (resolvedParams?.tab as any) : undefined

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  const admin = await createAdminClient()

  // Immutable super admin check
  const isPermanentAdmin = isSuperAdminEmail(user.email)

  // Check admin or admin_scores role
  let { data: userProfile } = await admin
    .from('users')
    .select('role, is_test_account')
    .eq('user_id', user.id)
    .maybeSingle()

  let role = isPermanentAdmin ? 'admin' : userProfile?.role

  // Self-heal: If permanent admin ever drifts away from 'admin' in database, automatically repair it
  if (isPermanentAdmin && userProfile?.role !== 'admin') {
    await admin
      .from('users')
      .upsert({ user_id: user.id, email: user.email, role: 'admin' }, { onConflict: 'user_id' })
  }

  if (role !== 'admin' && role !== 'admin_scores') {
    redirect('/')
  }

  // Automatically ensure top 2 pending payouts exist for completed slots
  await syncPendingPayouts(admin)

  // Fetch data for admin
  const [
    { data: slots },
    { data: teams },
    { data: payouts },
    { data: bookings },
    { data: coupons },
    { data: configRows },
  ] = await Promise.all([
    admin.from('slots').select('*').gte('date', '2026-09-16').order('date', { ascending: false }),
    admin.from('teams').select('team_id, team_name, invite_code').order('team_name'),
    admin.from('payouts').select('*, teams(team_name), slots(date, time_label)').order('created_at', { ascending: false }),
    admin.from('bookings').select('*, teams(team_name), slots(date, time_label)').eq('payment_status', 'paid').order('created_at', { ascending: false }),
    admin.from('coupons').select('*, teams(team_name), slots!issued_from_slot(date, time_label), bookings(slot_id, created_at, slots(date, time_label))').order('issued_at', { ascending: false }),
    admin.from('config').select('key, value'),
  ])

  const filteredPayouts = (payouts || []).filter(p => !p.slots?.date || p.slots.date >= '2026-09-16')
  const filteredBookings = (bookings || []).filter(b => !b.slots?.date || b.slots.date >= '2026-09-16')
  const filteredCoupons = (coupons || []).filter(c => !c.slots?.date || c.slots.date >= '2026-09-16')

  // Fetch complete user list combining Supabase Auth service & public.users table
  let finalUserList: any[] = []
  if (role === 'admin') {
    try {
      // 1. Get user records from public.users table
      const { data: publicProfiles } = await admin.from('users').select('user_id, email, display_name, role, is_test_account')
      const profileMap = new Map((publicProfiles || []).map(p => [p.user_id, p]))

      // 2. Fetch all registered users from Supabase Auth service
      const { data: authData } = await admin.auth.admin.listUsers()
      const authUsers = authData?.users || []

      if (authUsers.length > 0) {
        finalUserList = authUsers.map(au => {
          const prof = profileMap.get(au.id)
          return {
            user_id: au.id,
            email: au.email || prof?.email || 'No email',
            display_name: prof?.display_name || au.user_metadata?.display_name || au.user_metadata?.full_name || (au.email ? au.email.split('@')[0] : '—'),
            role: prof?.role || 'player',
            is_test_account: Boolean(prof?.is_test_account),
          }
        })
      } else {
        finalUserList = publicProfiles || []
      }
    } catch (err) {
      console.error('Error listing auth users:', err)
      const { data: fallbackUsers } = await admin.from('users').select('user_id, email, display_name, role, is_test_account')
      finalUserList = fallbackUsers || []
    }
  }

  const config: Record<string, string> = {}
  configRows?.forEach(row => { config[row.key] = row.value })

  let slotPrizesMap: Record<string, { first_prize?: number; second_prize?: number; third_prize_text?: string }> = {}
  if (config.slot_prizes_map) {
    try { slotPrizesMap = JSON.parse(config.slot_prizes_map) } catch {}
  }

  const defaultFirst = parseInt(config.slot_first_prize || '200', 10)
  const defaultSecond = parseInt(config.slot_second_prize || '150', 10)

  const enrichedSlots = (slots || []).map((s: any) => ({
    ...s,
    first_prize: s.first_prize ?? slotPrizesMap[s.slot_id]?.first_prize ?? defaultFirst,
    second_prize: s.second_prize ?? slotPrizesMap[s.slot_id]?.second_prize ?? defaultSecond,
    third_prize_text: s.third_prize_text ?? slotPrizesMap[s.slot_id]?.third_prize_text ?? '100% Free Slot Pass',
  }))

  return (
    <AdminClient
      userRole={role}
      slots={enrichedSlots}
      teams={teams || []}
      payouts={filteredPayouts}
      bookings={filteredBookings}
      coupons={filteredCoupons}
      config={config}
      usersList={finalUserList}
      initialTab={initialTab}
    />
  )
}
