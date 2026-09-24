'use client'

import { useState, useMemo, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPlacementPoints, getPositionPoints, getKillPoints } from '@/lib/scoring'
import { formatShortDate, formatMonthDay, formatFullLongDate, formatNumericDate, formatTime, formatNumericDateTime } from '@/lib/utils/formatDate'
import { isSlotPastOrEnded, getSlotStartMinutes } from '@/lib/utils/slotTime'
import { Copy, Check, Eye, CreditCard, AlertCircle, X, CheckCircle, ChevronDown, Repeat, Search, Calendar, RefreshCw, KeyRound, Edit3, MessageCircle, Trash2, ShieldAlert } from 'lucide-react'
import styles from './page.module.css'

type AdminTab = 'scores' | 'slots' | 'payouts' | 'upi_info' | 'bookings' | 'pending_bookings' | 'coupons' | 'finances' | 'config' | 'users'

/**
 * Sorts slots in descending order:
 * 1. Latest date first (e.g. 2026-09-12 before 2026-09-11)
 * 2. Latest start time first within the same date (e.g. 9:00 PM before 6:00 PM before 1:00 PM)
 */
export function sortSlotsDescending(slotsList: any[]): any[] {
  return [...slotsList].sort((a, b) => {
    const aDate = String(a.date || '').split('T')[0]
    const bDate = String(b.date || '').split('T')[0]
    const dateComp = bDate.localeCompare(aDate)
    if (dateComp !== 0) return dateComp

    const aMins = getSlotStartMinutes(a.time_label)
    const bMins = getSlotStartMinutes(b.time_label)
    return bMins - aMins
  })
}

export function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getTomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getDayAfterStr() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  userRole?: string
  slots: any[]
  teams: any[]
  payouts: any[]
  bookings: any[]
  coupons: any[]
  config: Record<string, string>
  usersList?: any[]
  initialTab?: AdminTab
}

export default function AdminClient({ userRole = 'admin', slots: initialSlots, teams, payouts: initialPayouts, bookings, coupons, config, usersList = [], initialTab }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>(initialTab || 'scores')
  const [slots, setSlots] = useState(initialSlots)
  const [payouts, setPayouts] = useState(initialPayouts)
  const [bookingsList, setBookingsList] = useState(bookings)
  const [users, setUsers] = useState(usersList)

  useEffect(() => {
    setBookingsList(bookings)
  }, [bookings])
  const [configState, setConfigState] = useState<Record<string, string>>(config || {})
  const [savingUserRole, setSavingUserRole] = useState<string | null>(null)
  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  const dayAfterStr = getDayAfterStr()
  const [selectedDate, setSelectedDate] = useState(tomorrowStr)
  const [adminEmail, setAdminEmail] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function switchTab(newTab: AdminTab) {
    setTab(newTab)
    setMobileMenuOpen(false)
    window.history.replaceState(null, '', `/admin?tab=${newTab}`)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAdminEmail(data.user.email || '')
    })
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleSignOut() {
    window.dispatchEvent(new Event('app:showLoader'))
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const isSuperAdmin = userRole === 'admin'
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0)

  useEffect(() => {
    fetch('/api/admin/bookings/pending')
      .then(res => res.json())
      .then(data => {
        if (data.bookings) setPendingBookingsCount(data.bookings.length)
      })
      .catch(() => {})
  }, [])

  const uniquePendingKeys = new Set(payouts.filter(p => p.status === 'pending').map(p => `${p.slot_id}_${p.team_id}`))
  const pendingPayoutsCount = uniquePendingKeys.size

  const allTabs: { id: AdminTab; label: string; superOnly?: boolean }[] = [
    { id: 'scores', label: 'Score Entry' },
    { id: 'slots', label: 'Slots', superOnly: true },
    { id: 'upi_info', label: 'UPI Info', superOnly: false },
    { id: 'payouts', label: pendingPayoutsCount > 0 ? `Payouts (${pendingPayoutsCount})` : 'Payouts', superOnly: true },
    { id: 'bookings', label: 'Bookings', superOnly: true },
    { id: 'pending_bookings', label: pendingBookingsCount > 0 ? `Pending (${pendingBookingsCount})` : 'Pending Bookings', superOnly: true },
    { id: 'coupons', label: 'Coupons', superOnly: true },
    { id: 'finances', label: '💵 Finances', superOnly: true },
    { id: 'config', label: 'Config', superOnly: true },
    { id: 'users', label: 'Users & Passwords', superOnly: true },
  ]

  const visibleTabs = isSuperAdmin ? allTabs : allTabs.filter(t => !t.superOnly)

  async function refreshPayouts() {
    try {
      const res = await fetch('/api/admin/payout/sync-pending', { method: 'POST' })
      const data = await res.json()
      if (data.payouts) setPayouts(data.payouts)
    } catch (e) {}
  }

  async function markPayoutPaid(payoutId: string) {
    await supabase
      .from('payouts')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('payout_id', payoutId)

    setPayouts(prev => prev.map(p =>
      p.payout_id === payoutId ? { ...p, status: 'paid', paid_at: new Date().toISOString() } : p
    ))
  }

  async function updateUserRole(userId: string, newRole: string) {
    const target = users.find(u => u.user_id === userId)
    if (target?.email?.toLowerCase() === 'admin@gmail.com' && newRole !== 'admin') {
      alert('Cannot change or demote the primary Super Admin account (admin@gmail.com).')
      return
    }

    await supabase
      .from('users')
      .update({ role: newRole })
      .eq('user_id', userId)

    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u))
  }

  async function deleteUser(userId: string) {
    const target = users.find(u => u.user_id === userId)
    if (target?.email?.toLowerCase() === 'admin@gmail.com') {
      alert('Cannot delete the primary Super Admin account.')
      return
    }

    if (!confirm('Are you sure you want to completely delete this user account? This will also remove their team bookings and registration.')) return
    try {
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: userId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setUsers(prev => prev.filter(u => u.user_id !== userId))
        alert('User account successfully deleted.')
      } else {
        alert(data.error || 'Failed to delete user account')
      }
    } catch {
      alert('Error deleting user account')
    }
  }

  async function toggleUserTestMode(userId: string, currentStatus: boolean) {
    const newStatus = !currentStatus
    try {
      const res = await fetch('/api/user/toggle-test-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, enabled: newStatus }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_test_account: newStatus } : u))
      } else {
        alert(data.error || 'Failed to toggle test mode')
      }
    } catch {
      alert('Error toggling test mode')
    }
  }

  const activeTabObj = visibleTabs.find(t => t.id === tab)

  return (
    <div className={styles.adminPage}>
      {/* Mobile Top Bar */}
      <header className={styles.mobileHeader}>
        <button
          className={styles.hamburgerBtn}
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.lineOpen1 : ''}`} />
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.lineOpen2 : ''}`} />
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.lineOpen3 : ''}`} />
        </button>
        <div className={styles.mobileHeaderBrand}>
          <span className={styles.mobileLogoText}>BGFS</span>
          <span className={styles.mobileRoleBadge}>
            {isSuperAdmin ? 'Super Admin' : 'Score Admin'}
          </span>
          <span className={styles.mobileHeaderDivider}>•</span>
          <span className={styles.mobileHeaderTitle}>{activeTabObj?.label || 'Score Entry'}</span>
        </div>
      </header>

      {/* Backdrop for Mobile Drawer */}
      <div
        className={`${styles.drawerBackdrop} ${mobileMenuOpen ? styles.backdropActive : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar (Desktop sticky sidebar & Mobile left off-canvas drawer) */}
      <aside className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <div className={styles.sidebarLogoContent}>
            <span className={styles.logoText}>BGFS</span>
            <span className={styles.logoLabel}>
              {isSuperAdmin ? 'Super Admin' : 'Score Admin'}
            </span>
          </div>
          <button
            className={styles.sidebarCloseBtn}
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              className={`${styles.sidebarBtn} ${tab === t.id ? styles.sidebarActive : ''}`}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* User Info + Sign Out */}
        <div className={styles.sidebarFooter}>
          {adminEmail && (
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                {adminEmail.charAt(0).toUpperCase()}
              </div>
              <div className={styles.userDetails}>
                <div className={styles.userEmail}>{adminEmail}</div>
                <div className={styles.userRole}>
                  {isSuperAdmin ? 'Administrator' : 'Score Admin'}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => {
              setMobileMenuOpen(false)
              handleSignOut()
            }}
            className={styles.signOutBtn}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.adminMain}>
        <div className={styles.adminContent}>
          {tab === 'scores' && (
            <ScoreEntryTab
              slots={slots}
              teams={teams}
              supabase={supabase}
              onSyncPayouts={refreshPayouts}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              config={configState}
            />
          )}
          {isSuperAdmin && tab === 'slots' && (
            <SlotsTab
              slots={slots}
              setSlots={setSlots}
              supabase={supabase}
              teams={teams}
              onSyncPayouts={refreshPayouts}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              config={configState}
              setConfig={setConfigState}
            />
          )}
          {tab === 'upi_info' && (
            <UpiInfoTab
              slots={slots}
              payouts={payouts}
              onPayoutCreated={(newPayout) => setPayouts(prev => [newPayout, ...prev.filter(p => p.payout_id !== newPayout.payout_id)])}
            />
          )}
          {isSuperAdmin && tab === 'payouts' && (
            <PayoutsTab
              payouts={payouts}
              onPayoutSettled={(newPayout) => setPayouts(prev => [newPayout, ...prev.filter(p => p.payout_id !== newPayout.payout_id)])}
              onPayoutUpdated={(updated) => setPayouts(prev => prev.map(p => p.payout_id === updated.payout_id ? updated : p))}
              onSyncPayouts={refreshPayouts}
            />
          )}
          {isSuperAdmin && tab === 'bookings' && (
            <BookingsTab
              bookings={bookingsList}
              setBookings={setBookingsList}
              slots={slots}
              setSlots={setSlots}
            />
          )}
          {isSuperAdmin && tab === 'pending_bookings' && (
            <PendingBookingsTab onCountChange={setPendingBookingsCount} />
          )}
          {isSuperAdmin && tab === 'coupons' && <CouponsTab coupons={coupons} teams={teams} supabase={supabase} />}
          {isSuperAdmin && tab === 'finances' && <FinancesTab />}
          {isSuperAdmin && tab === 'config' && <ConfigTab config={configState} setConfig={setConfigState} supabase={supabase} />}
          {isSuperAdmin && tab === 'users' && (
            <UsersTab
              users={users}
              onUpdateRole={updateUserRole}
              onDeleteUser={deleteUser}
              onToggleTestMode={toggleUserTestMode}
            />
          )}
        </div>
      </main>
    </div>
  )
}

// ── SCORE ENTRY TAB ──────────────────────────────────────────────
function ScoreEntryTab({ slots, teams, supabase, onSyncPayouts, selectedDate, setSelectedDate, config }: any) {
  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  const dayAfterStr = getDayAfterStr()
  const [showAllDates, setShowAllDates] = useState(false)

  // Track published slots (pushed to leaderboard via "Update The Table")
  const initialPublished = useMemo(() => {
    try {
      if (config?.scores_published_slots) {
        const arr = JSON.parse(config.scores_published_slots)
        if (Array.isArray(arr)) return arr
      }
    } catch {}
    return []
  }, [config])

  const [publishedSlotIds, setPublishedSlotIds] = useState<string[]>(initialPublished)
  const [isPublishingTable, setIsPublishingTable] = useState(false)
  const [publishMsg, setPublishMsg] = useState('')

  // Sync published slots list on mount
  useEffect(() => {
    supabase
      .from('config')
      .select('value')
      .eq('key', 'scores_published_slots')
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.value) {
          try {
            const arr = JSON.parse(data.value)
            if (Array.isArray(arr)) setPublishedSlotIds(arr)
          } catch {}
        }
      })
  }, [supabase])

  async function handleUpdateTable() {
    if (!selectedSlot) return
    setIsPublishingTable(true)
    setPublishMsg('')
    try {
      const res = await fetch('/api/admin/slots/publish-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: selectedSlot }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update table')
      }
      setPublishedSlotIds(prev => Array.from(new Set([...prev, selectedSlot])))
      setPublishMsg('✅ Points table updated! Scores for this slot are now live on the leaderboard.')
    } catch (err: any) {
      setPublishMsg('❌ Error updating table: ' + err.message)
    } finally {
      setIsPublishingTable(false)
    }
  }

  // Only slots that are CLOSED (full, manually closed, marked completed, or 10m before start if registered teams exist)
  const isSlotClosed = useCallback((s: any) => {
    if (!s) return false
    // 1. Manually completed or closed by admin
    if (s.status === 'completed' || s.status === 'closed') return true
    // 2. Full capacity reached
    if (s.status === 'full' || (s.capacity > 0 && s.teams_booked_count >= s.capacity)) return true
    // 3. For the slot date: 10-minute auto cutoff before match start time (only if slot has bookings)
    if ((s.teams_booked_count || 0) > 0 && isSlotPastOrEnded(s.date, s.time_label, s.status)) {
      return true
    }
    return false
  }, [])

  const sortedSlots = useMemo(() => {
    const closedSlots = (slots || []).filter((s: any) => {
      if (!isSlotClosed(s)) return false
      if (showAllDates) return true
      return s.date === selectedDate
    })
    return sortSlotsDescending(closedSlots)
  }, [slots, isSlotClosed, selectedDate, showAllDates])

  const [selectedSlot, setSelectedSlot] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [posPoints, setPosPoints] = useState('')
  const [kills, setKills] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [bookedTeams, setBookedTeams] = useState<any[]>([])
  const [recordedMatches, setRecordedMatches] = useState<any[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)

  // 🍗 3 Match Chicken Dinner Winner Selection State
  const [match1Winner, setMatch1Winner] = useState('')
  const [match2Winner, setMatch2Winner] = useState('')
  const [match3Winner, setMatch3Winner] = useState('')
  const [savingWinners, setSavingWinners] = useState(false)
  const [winnersMsg, setWinnersMsg] = useState('')

  // ➕ False / Spot Team Management State
  const [showAddFalseTeamModal, setShowAddFalseTeamModal] = useState(false)
  const [falseTeamName, setFalseTeamName] = useState('')
  const [isAddingFalseTeam, setIsAddingFalseTeam] = useState(false)
  const [falseTeamError, setFalseTeamError] = useState('')
  const [existingTeamPrompt, setExistingTeamPrompt] = useState<{ team_id: string; team_name: string } | null>(null)
  const [isRemovingFalseTeam, setIsRemovingFalseTeam] = useState<string | null>(null)

  // Automatically load data for the latest closed slot on initial render or when sortedSlots update
  useEffect(() => {
    if (sortedSlots.length > 0) {
      if (!selectedSlot || !sortedSlots.some((s: any) => s.slot_id === selectedSlot)) {
        const nextId = sortedSlots[0].slot_id
        setSelectedSlot(nextId)
        loadSlotData(nextId)
      } else {
        loadSlotData(selectedSlot)
      }
    } else {
      setSelectedSlot('')
      loadSlotData('')
    }
  }, [sortedSlots])

  // Live Mathematical Auto-Calculations
  const posNum = parseInt(posPoints) || 0
  const killsNum = parseInt(kills) || 0
  const totalPoints = posNum + killsNum

  // Team Slot Totals with Chicken Dinner (WWCD) Tracking
  const teamSlotTotals = useMemo(() => {
    const map: Record<string, {
      team_id: string
      team_name: string
      room_slot_number: number
      total_points: number
      total_kills: number
      total_pos_points: number
      wwcd: number
      matches_won: string[]
      is_scored: boolean
      match_id?: string
    }> = {}

    bookedTeams.forEach(t => {
      const won: string[] = []
      if (match1Winner === t.team_id) won.push('M1')
      if (match2Winner === t.team_id) won.push('M2')
      if (match3Winner === t.team_id) won.push('M3')

      map[t.team_id] = {
        team_id: t.team_id,
        team_name: t.team_name,
        room_slot_number: t.room_slot_number || 5,
        total_points: 0,
        total_kills: 0,
        total_pos_points: 0,
        wwcd: won.length,
        matches_won: won,
        is_scored: false,
      }
    })

    recordedMatches.forEach((m: any) => {
      const won: string[] = []
      if (match1Winner === m.team_id) won.push('M1')
      if (match2Winner === m.team_id) won.push('M2')
      if (match3Winner === m.team_id) won.push('M3')

      if (!map[m.team_id]) {
        map[m.team_id] = {
          team_id: m.team_id,
          team_name: m.teams?.team_name || 'Team #' + String(m.team_id).slice(0, 5),
          room_slot_number: 5,
          total_points: 0,
          total_kills: 0,
          total_pos_points: 0,
          wwcd: won.length,
          matches_won: won,
          is_scored: false,
        }
      }
      const entry = map[m.team_id]
      entry.total_points += (m.total_points || 0)
      entry.total_kills += (m.kills || 0)
      const posPts = m.placement_points !== undefined && m.placement_points !== null 
        ? m.placement_points 
        : Math.max(0, (m.total_points || 0) - (m.kills || 0))
      entry.total_pos_points += posPts
      entry.is_scored = true
      entry.match_id = m.match_id
    })

    return map
  }, [bookedTeams, recordedMatches, match1Winner, match2Winner, match3Winner])

  // Strict Tie-Breaker Ordering: 1. Total Points -> 2. Position Points -> 3. Chicken Dinners (#1 / WWCD)
  const slotStandingsList = useMemo(() => {
    return Object.values(teamSlotTotals)
      .filter(t => t.is_scored)
      .sort((a, b) => {
        // 1st Priority: Total Points
        if (b.total_points !== a.total_points) return b.total_points - a.total_points
        // 2nd Priority: Position Points
        if (b.total_pos_points !== a.total_pos_points) return b.total_pos_points - a.total_pos_points
        // 3rd Priority: Chicken Dinners (#1 / WWCD)
        if (b.wwcd !== a.wwcd) return b.wwcd - a.wwcd
        return 0
      })
      .map((item, idx) => ({ ...item, rank: idx + 1 }))
  }, [teamSlotTotals])

  async function loadSlotData(slotId: string) {
    if (!slotId) {
      setBookedTeams([])
      setRecordedMatches([])
      setMatch1Winner('')
      setMatch2Winner('')
      setMatch3Winner('')
      return
    }

    // Load booked teams for slot
    const { data: bData } = await supabase
      .from('bookings')
      .select('team_id, room_slot_number, payment_id, teams(team_id, team_name)')
      .eq('slot_id', slotId)
      .eq('payment_status', 'paid')
    setBookedTeams(bData?.map((b: any) => ({
      ...(b.teams || {}),
      room_slot_number: b.room_slot_number || 5,
      is_false_team: b.payment_id === 'FREE_SPOT_ENTRY',
    })).filter(Boolean) || [])

    // Load recorded matches for slot
    setLoadingMatches(true)
    const { data: mData } = await supabase
      .from('matches')
      .select('*, teams(team_name)')
      .eq('slot_id', slotId)
      .order('created_at', { ascending: true })
    setRecordedMatches(mData || [])
    setLoadingMatches(false)

    // Load Chicken Dinner Winners from config for this slot
    const { data: winConfig } = await supabase
      .from('config')
      .select('value')
      .eq('key', `slot_winners_${slotId}`)
      .maybeSingle()

    if (winConfig?.value) {
      try {
        const parsed = JSON.parse(winConfig.value)
        setMatch1Winner(parsed.m1 || '')
        setMatch2Winner(parsed.m2 || '')
        setMatch3Winner(parsed.m3 || '')
      } catch {
        setMatch1Winner('')
        setMatch2Winner('')
        setMatch3Winner('')
      }
    } else {
      setMatch1Winner('')
      setMatch2Winner('')
      setMatch3Winner('')
    }
  }

  async function handleSaveWinners() {
    if (!selectedSlot) return
    setSavingWinners(true)
    setWinnersMsg('')
    try {
      const payload = {
        m1: match1Winner,
        m2: match2Winner,
        m3: match3Winner,
      }
      const { error } = await supabase.from('config').upsert({
        key: `slot_winners_${selectedSlot}`,
        value: JSON.stringify(payload),
      }, { onConflict: 'key' })

      if (error) throw error
      setWinnersMsg('✅ Chicken Dinner winners saved!')
      if (onSyncPayouts) onSyncPayouts()
    } catch (err: any) {
      setWinnersMsg('❌ Failed to save winners: ' + err.message)
    } finally {
      setSavingWinners(false)
    }
  }

  function handleEditTeamScore(t: any) {
    setEditingMatchId(t.match_id || t.team_id)
    setSelectedTeam(t.team_id)
    setPosPoints(String(t.total_pos_points ?? ''))
    setKills(String(t.total_kills ?? ''))
    setMsg(`✏️ Editing slot score for ${t.team_name}`)
  }

  function handleCancelEdit() {
    setEditingMatchId(null)
    setPosPoints('')
    setKills('')
    setSelectedTeam('')
    setMsg('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setSaving(true)

    const pos = parseInt(posPoints) || 0
    const k = parseInt(kills) || 0
    const total = pos + k
    const isWinner = (match1Winner === selectedTeam || match2Winner === selectedTeam || match3Winner === selectedTeam)

    const { error } = await supabase
      .from('matches')
      .upsert({
        slot_id: selectedSlot,
        match_number: 1, // 1 consolidated record per team for the slot
        team_id: selectedTeam,
        placement: isWinner ? 1 : null,
        kills: k,
        placement_points: pos,
        kill_points: k,
        total_points: total,
      }, { onConflict: 'slot_id,match_number,team_id' })

    setSaving(false)
    if (error) {
      setMsg('❌ Error: ' + error.message)
    } else {
      const teamObj = bookedTeams.find(t => String(t.team_id) === String(selectedTeam))
      const name = teamObj?.team_name || 'Team'
      const message = editingMatchId 
        ? `✅ Slot score updated for ${name}!` 
        : `✅ Saved! ${name}: ${pos} Pos Pts + ${k} Elims = ${total} Total Slot Points`

      setMsg(message)
      setEditingMatchId(null)
      setPosPoints('')
      setKills('')
      setSelectedTeam('')
      await loadSlotData(selectedSlot)
      if (onSyncPayouts) onSyncPayouts()
    }
  }

  async function handleDeleteMatch(matchId: string, teamName?: string) {
    if (!confirm(`Delete score entry for ${teamName || 'this team'}?`)) return
    
    if (editingMatchId === matchId) handleCancelEdit()
    setMsg('')
    setRecordedMatches(prev => prev.filter(m => String(m.match_id) !== String(matchId)))

    const { error } = await supabase.from('matches').delete().eq('match_id', matchId)
    if (error) {
      setMsg('❌ Failed to delete score: ' + error.message)
      await loadSlotData(selectedSlot)
    } else {
      setMsg(`✅ Score deleted for ${teamName || 'team'}.`)
      await loadSlotData(selectedSlot)
      if (onSyncPayouts) onSyncPayouts()
    }
  }

  async function handleAddFalseTeam(reuseExisting = false) {
    if (!selectedSlot) {
      setFalseTeamError('Please select a slot first.')
      return
    }
    const nameToSubmit = existingTeamPrompt ? existingTeamPrompt.team_name : falseTeamName.trim()
    if (!nameToSubmit) {
      setFalseTeamError('Please enter a team name.')
      return
    }

    setIsAddingFalseTeam(true)
    setFalseTeamError('')
    try {
      const res = await fetch('/api/admin/slots/add-false-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot,
          team_name: nameToSubmit,
          reuse_existing: reuseExisting,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFalseTeamError(data.error || 'Failed to add team')
        return
      }

      if (data.team_exists && data.existing_team) {
        setExistingTeamPrompt(data.existing_team)
        return
      }

      // Successfully added!
      setShowAddFalseTeamModal(false)
      setFalseTeamName('')
      setExistingTeamPrompt(null)
      setFalseTeamError('')
      setMsg(`✅ ${data.message || 'Team added successfully!'}`)

      // Refresh slot bookings & auto-select the new team in the form
      await loadSlotData(selectedSlot)
      if (data.team?.team_id) {
        setSelectedTeam(data.team.team_id)
        setPosPoints('')
        setKills('')
      }
    } catch (err: any) {
      setFalseTeamError(err.message || 'Error adding false team')
    } finally {
      setIsAddingFalseTeam(false)
    }
  }

  async function handleRemoveFalseTeam(teamId: string, teamName: string) {
    if (!confirm(`Are you sure you want to remove false team "${teamName}" from this slot?\nAny entered scores for this team in this slot will also be deleted.`)) {
      return
    }
    setIsRemovingFalseTeam(teamId)
    setFalseTeamError('')
    try {
      const res = await fetch('/api/admin/slots/add-false-team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot,
          team_id: teamId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to remove false team')
        return
      }

      setMsg(`✅ ${data.message || 'False team removed successfully!'}`)
      if (selectedTeam === teamId) {
        setSelectedTeam('')
        setPosPoints('')
        setKills('')
        setEditingMatchId(null)
      }
      await loadSlotData(selectedSlot)
      if (onSyncPayouts) onSyncPayouts()
    } catch (err: any) {
      alert(err.message || 'Error removing false team')
    } finally {
      setIsRemovingFalseTeam(null)
    }
  }

  const [backupMsg, setBackupMsg] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  async function handleExportBackup() {
    setIsExporting(true)
    setBackupMsg('')
    try {
      const { data: allMatches, error: matchesErr } = await supabase.from('matches').select('*, teams(team_name), slots(date, time_label)')
      if (matchesErr) throw matchesErr

      const backupData = {
        exported_at: new Date().toISOString(),
        total_records: allMatches?.length || 0,
        matches: allMatches || [],
      }

      const jsonStr = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bgfs-leaderboard-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setBackupMsg(`✅ Backup downloaded! (${allMatches?.length || 0} score records)`)
    } catch (err: any) {
      setBackupMsg(`❌ Export failed: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBackupMsg('')
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      if (!json.matches || !Array.isArray(json.matches)) {
        throw new Error('Invalid backup file format')
      }
      if (!confirm(`Are you sure you want to restore ${json.matches.length} score records from this backup?`)) return

      let restoredCount = 0
      for (const m of json.matches) {
        const { error } = await supabase.from('matches').upsert({
          slot_id: m.slot_id,
          match_number: m.match_number || 1,
          team_id: m.team_id,
          placement: m.placement,
          kills: m.kills,
          placement_points: m.placement_points,
          kill_points: m.kill_points,
          total_points: m.total_points,
        }, { onConflict: 'slot_id,match_number,team_id' })
        if (!error) restoredCount++
      }

      setBackupMsg(`✅ Successfully restored ${restoredCount} score records!`)
      if (selectedSlot) await loadSlotData(selectedSlot)
    } catch (err: any) {
      setBackupMsg(`❌ Restore failed: ${err.message}`)
    }
  }

  const [showImportModal, setShowImportModal] = useState(false)
  const [copyTemplateToast, setCopyTemplateToast] = useState(false)

  function handleCopyJsonTemplate() {
    if (!selectedSlot) {
      setMsg('❌ Please select a slot first to copy its AI JSON template.')
      return
    }

    const slotObj = sortedSlots.find((s: any) => s.slot_id === selectedSlot)
    const slotTitle = slotObj ? `${formatShortDate(slotObj.date)} • ${slotObj.time_label}` : 'Selected Slot'
    const sortedBooked = [...bookedTeams].sort((a, b) => (a.room_slot_number || 5) - (b.room_slot_number || 5))

    const templateObj = {
      _instructions: "Extract match scores from the screenshot for the 3 matches in this slot. Calculate total Position Points (pos_points) and total Eliminations (elims) per team across all 3 matches. Enter the room slot numbers (5-24) of the 3 match winners in match_winners.",
      slot_info: slotTitle,
      match_winners: [
        sortedBooked[0]?.room_slot_number || 5,
        sortedBooked[1]?.room_slot_number || 6,
        sortedBooked[2]?.room_slot_number || 7,
      ],
      scores: sortedBooked.map((t: any) => ({
        slot: t.room_slot_number || 5,
        team_name: t.team_name,
        pos_points: 0,
        elims: 0,
      })),
    }

    const promptText = `Convert the match score screenshot into the following JSON format. Match each team by their room slot number (5-24) or team name. Calculate total position points and total eliminations across all 3 matches:

\`\`\`json
${JSON.stringify(templateObj, null, 2)}
\`\`\`

Return ONLY the raw JSON block without markdown wrap.`

    navigator.clipboard.writeText(promptText)
    setBackupMsg('📋 AI Prompt & JSON Template copied to clipboard! Paste it with your screenshot into ChatGPT / Claude / Gemini.')
    setCopyTemplateToast(true)
    setTimeout(() => setCopyTemplateToast(false), 3000)
  }

  async function handleApplyJsonScores(rawJsonText: string) {
    if (!selectedSlot) {
      throw new Error('Please select a slot first.')
    }
    const cleanText = rawJsonText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
    let parsed: any
    try {
      parsed = JSON.parse(cleanText)
    } catch (e: any) {
      throw new Error('Invalid JSON format: ' + e.message)
    }

    const scoresList: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.scores) ? parsed.scores : [])
    if (scoresList.length === 0) {
      throw new Error('No scores array found in JSON. Expected an array of team scores or { "scores": [...] }')
    }

    const rawWinners: any[] = Array.isArray(parsed.match_winners)
      ? parsed.match_winners
      : Array.isArray(parsed.winners)
      ? parsed.winners
      : []

    const resolveTeamId = (val: any): string | null => {
      if (val === undefined || val === null || val === '') return null
      const strVal = String(val).trim().toLowerCase()
      const numVal = parseInt(strVal)
      
      if (!isNaN(numVal)) {
        const found = bookedTeams.find((t: any) => (t.room_slot_number || 5) === numVal)
        if (found) return found.team_id
      }
      const foundByName = bookedTeams.find((t: any) => 
        t.team_name.toLowerCase() === strVal ||
        t.team_name.toLowerCase().includes(strVal) ||
        strVal.includes(t.team_name.toLowerCase())
      )
      if (foundByName) return foundByName.team_id
      const foundById = bookedTeams.find((t: any) => t.team_id === strVal)
      if (foundById) return foundById.team_id

      return null
    }

    const w1Id = rawWinners[0] !== undefined ? resolveTeamId(rawWinners[0]) : ''
    const w2Id = rawWinners[1] !== undefined ? resolveTeamId(rawWinners[1]) : ''
    const w3Id = rawWinners[2] !== undefined ? resolveTeamId(rawWinners[2]) : ''

    if (w1Id || w2Id || w3Id) {
      if (w1Id) setMatch1Winner(w1Id)
      if (w2Id) setMatch2Winner(w2Id)
      if (w3Id) setMatch3Winner(w3Id)

      await supabase.from('config').upsert({
        key: `slot_winners_${selectedSlot}`,
        value: JSON.stringify({ m1: w1Id || '', m2: w2Id || '', m3: w3Id || '' }),
      })
    }

    let importedCount = 0
    const errors: string[] = []

    for (const item of scoresList) {
      const teamId = resolveTeamId(item.slot ?? item.room_slot ?? item.room_slot_number ?? item.team_name ?? item.team ?? item.team_id)
      if (!teamId) {
        errors.push(`Could not match team: ${item.team_name || item.slot || JSON.stringify(item)}`)
        continue
      }

      const pos = parseInt(item.pos_points ?? item.position_points ?? item.placement_points ?? item.pos ?? 0) || 0
      const k = parseInt(item.elims ?? item.kills ?? item.eliminations ?? item.kill_points ?? 0) || 0
      const total = pos + k
      const isWinner = (teamId === w1Id || teamId === w2Id || teamId === w3Id)

      const { error } = await supabase.from('matches').upsert({
        slot_id: selectedSlot,
        match_number: 1,
        team_id: teamId,
        placement: isWinner ? 1 : null,
        kills: k,
        placement_points: pos,
        kill_points: k,
        total_points: total,
      }, { onConflict: 'slot_id,match_number,team_id' })

      if (!error) {
        importedCount++
      } else {
        errors.push(`DB Error for ${teamId}: ${error.message}`)
      }
    }

    await loadSlotData(selectedSlot)
    if (onSyncPayouts) onSyncPayouts()

    return { importedCount, totalInFile: scoresList.length, errors }
  }

  const selectedTeamData = selectedTeam ? teamSlotTotals[selectedTeam] : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 className={styles.tabTitle}>Points Table Score Entry</h2>
        </div>

        {/* 💾 Actions: Update The Table, Copy AI Template, Import AI/JSON, Export, Restore */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              fontSize: '0.78rem',
              background: '#22c55e',
              borderColor: '#22c55e',
              color: '#111111',
              fontWeight: 800,
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              cursor: !selectedSlot || sortedSlots.length === 0 || isPublishingTable ? 'not-allowed' : 'pointer',
              opacity: !selectedSlot || sortedSlots.length === 0 || isPublishingTable ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 0 10px rgba(34, 197, 94, 0.25)',
            }}
            onClick={handleUpdateTable}
            disabled={!selectedSlot || sortedSlots.length === 0 || isPublishingTable}
          >
            {isPublishingTable ? '⏳ Updating Table...' : '📊 Update The Table'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '0.78rem',
              background: copyTemplateToast ? 'rgba(251, 191, 36, 0.2)' : '#1e1e1e',
              borderColor: '#fbbf24',
              color: '#fbbf24',
              fontWeight: 800,
              padding: '0.45rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            onClick={handleCopyJsonTemplate}
            disabled={!selectedSlot || sortedSlots.length === 0}
          >
            {copyTemplateToast ? '✅ Copied!' : '📋 Copy AI Template'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '0.78rem',
              background: '#1e1e1e',
              borderColor: '#38bdf8',
              color: '#38bdf8',
              fontWeight: 800,
              padding: '0.45rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            onClick={() => setShowImportModal(true)}
            disabled={!selectedSlot || sortedSlots.length === 0}
          >
            🤖 Import AI / JSON
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.78rem', background: '#1e1e1e', borderColor: '#333333', color: '#aaaaaa', fontWeight: 700 }}
            onClick={handleExportBackup}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : '📥 Export Backup'}
          </button>
          
          <label
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.78rem', background: '#1e1e1e', borderColor: '#333333', color: '#60a5fa', fontWeight: 700, cursor: 'pointer', margin: 0 }}
          >
            📤 Restore Backup
            <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {publishMsg && (
        <div
          style={{
            padding: '0.5rem 0.85rem',
            borderRadius: '6px',
            marginBottom: '0.75rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            background: publishMsg.includes('❌') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: publishMsg.includes('❌') ? '1px solid #ef4444' : '1px solid #22c55e',
            color: publishMsg.includes('❌') ? '#ef4444' : '#4ade80',
          }}
        >
          {publishMsg}
        </div>
      )}

      {backupMsg && (
        <div
          style={{
            padding: '0.5rem 0.85rem',
            borderRadius: '6px',
            marginBottom: '0.75rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            background: backupMsg.includes('❌') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: backupMsg.includes('❌') ? '1px solid #ef4444' : '1px solid #22c55e',
            color: backupMsg.includes('❌') ? '#ef4444' : '#4ade80',
          }}
        >
          {backupMsg}
        </div>
      )}

      {/* ── DATE SELECTOR BAR ── */}
      <div
        style={{
          background: '#141414',
          border: '1px solid #282828',
          borderRadius: '12px',
          padding: '0.85rem 1.15rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#aaaaaa', fontSize: '0.82rem', fontWeight: 700 }}>SELECT DATE:</span>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              background: !showAllDates && selectedDate === todayStr ? '#fbbf24' : '#1e1e1e',
              color: !showAllDates && selectedDate === todayStr ? '#111111' : '#ffffff',
              fontWeight: 800,
              borderColor: !showAllDates && selectedDate === todayStr ? '#fbbf24' : '#333333',
            }}
            onClick={() => {
              setShowAllDates(false)
              setSelectedDate(todayStr)
            }}
          >
            Today ({formatMonthDay(todayStr)})
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              background: !showAllDates && selectedDate === tomorrowStr ? '#fbbf24' : '#1e1e1e',
              color: !showAllDates && selectedDate === tomorrowStr ? '#111111' : '#ffffff',
              fontWeight: 800,
              borderColor: !showAllDates && selectedDate === tomorrowStr ? '#fbbf24' : '#333333',
            }}
            onClick={() => {
              setShowAllDates(false)
              setSelectedDate(tomorrowStr)
            }}
          >
            Tomorrow ({formatMonthDay(tomorrowStr)})
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              background: !showAllDates && selectedDate === dayAfterStr ? '#fbbf24' : '#1e1e1e',
              color: !showAllDates && selectedDate === dayAfterStr ? '#111111' : '#ffffff',
              fontWeight: 800,
              borderColor: !showAllDates && selectedDate === dayAfterStr ? '#fbbf24' : '#333333',
            }}
            onClick={() => {
              setShowAllDates(false)
              setSelectedDate(dayAfterStr)
            }}
          >
            Day After ({formatMonthDay(dayAfterStr)})
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              background: showAllDates ? '#fbbf24' : '#1e1e1e',
              color: showAllDates ? '#111111' : '#ffffff',
              fontWeight: 800,
              borderColor: showAllDates ? '#fbbf24' : '#333333',
            }}
            onClick={() => setShowAllDates(true)}
          >
            All Dates (History)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.78rem', color: '#888888', fontWeight: 600 }}>Custom Date:</label>
          <input
            type="date"
            className="form-input"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', width: 'auto' }}
            value={selectedDate}
            onChange={e => {
              setShowAllDates(false)
              setSelectedDate(e.target.value)
            }}
          />
        </div>
      </div>

      {sortedSlots.length === 0 && (
        <div
          style={{
            background: 'rgba(251, 191, 36, 0.05)',
            border: '1px dashed rgba(251, 191, 36, 0.3)',
            borderRadius: '10px',
            padding: '1.25rem',
            textAlign: 'center',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>🔍</div>
          <div style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            No closed or completed slots found for {showAllDates ? 'all history' : formatFullLongDate(selectedDate)}
          </div>
          <div style={{ color: '#888888', fontSize: '0.82rem' }}>
            None of the slots on this date are currently closed or completed. Slots only appear here once closed (via 10m auto-cutoff, full capacity, manual close, or marked completed).
          </div>
        </div>
      )}

      <div className={styles.scoreEntryLayout}>
        {/* ── LEFT COLUMN: Team Slot Score Entry Form ── */}
        <div className={styles.scoreFormCard}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Top Row: Slot & Team Selection */}
            <div className={styles.scoreFormTopRow}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span>Select Slot</span>
                  {selectedSlot && (
                    publishedSlotIds.includes(selectedSlot) ? (
                      <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.72rem' }}>
                        ● Live on Points Table
                      </span>
                    ) : (
                      <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.72rem' }}>
                        ○ Draft Scores (Click &quot;Update The Table&quot; to publish)
                      </span>
                    )
                  )}
                </label>
                <select
                  className="form-input"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%' }}
                  value={selectedSlot}
                  onChange={e => {
                    setSelectedSlot(e.target.value)
                    setSelectedTeam('')
                    loadSlotData(e.target.value)
                  }}
                  disabled={sortedSlots.length === 0}
                  required
                >
                  <option value="">
                    {sortedSlots.length === 0
                      ? `No closed/completed slots for ${showAllDates ? 'any date' : formatMonthDay(selectedDate)}`
                      : 'Select slot...'}
                  </option>
                  {sortedSlots.map((s: any) => {
                    const isLive = publishedSlotIds.includes(s.slot_id)
                    return (
                      <option key={s.slot_id} value={s.slot_id}>
                        {formatShortDate(s.date)} • {s.time_label} {isLive ? '📊 (Live on Table)' : '📝 (Draft)'} {s.status === 'completed' ? '🟣 (Done)' : '🔒 (Closed)'}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                {(() => {
                  const totalRegistered = bookedTeams.length
                  const scoredCount = bookedTeams.filter((t: any) => teamSlotTotals[t.team_id]?.is_scored).length
                  const pendingCount = totalRegistered - scoredCount
                  const pendingTeams = bookedTeams.filter((t: any) => {
                    if (selectedTeam === t.team_id) return true
                    const existing = teamSlotTotals[t.team_id]
                    return !existing || !existing.is_scored
                  })

                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>
                          Select Team {totalRegistered > 0 && (
                            <span style={{ color: pendingCount === 0 ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                              ({pendingCount === 0 ? `All ${totalRegistered} Scored` : `${pendingCount} pending / ${totalRegistered} registered`})
                            </span>
                          )}
                        </label>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {selectedTeam && bookedTeams.find((t: any) => t.team_id === selectedTeam)?.is_false_team && (
                            <button
                              type="button"
                              onClick={() => {
                                const curTeam = bookedTeams.find((t: any) => t.team_id === selectedTeam)
                                if (curTeam) handleRemoveFalseTeam(curTeam.team_id, curTeam.team_name)
                              }}
                              disabled={Boolean(isRemovingFalseTeam)}
                              className="btn btn-danger btn-xs"
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#ef4444',
                                fontWeight: 700,
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                              }}
                              title="Remove this false team from the slot"
                            >
                              {isRemovingFalseTeam === selectedTeam ? 'Removing...' : '🗑️ Remove False Team'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setFalseTeamName('')
                              setFalseTeamError('')
                              setExistingTeamPrompt(null)
                              setShowAddFalseTeamModal(true)
                            }}
                            disabled={!selectedSlot}
                            className="btn btn-secondary btn-xs"
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              background: 'rgba(251, 191, 36, 0.12)',
                              border: '1px solid rgba(251, 191, 36, 0.4)',
                              color: '#fbbf24',
                              fontWeight: 700,
                              cursor: selectedSlot ? 'pointer' : 'not-allowed',
                              borderRadius: '5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title={selectedSlot ? 'Add an on-spot / giveaway team to this slot' : 'Select a slot first'}
                          >
                            + Add False Team
                          </button>
                        </div>
                      </div>
                      <select
                        className="form-input"
                        style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%' }}
                        value={selectedTeam}
                        onChange={e => {
                          setSelectedTeam(e.target.value)
                          const existing = teamSlotTotals[e.target.value]
                          if (existing && existing.is_scored) {
                            setPosPoints(String(existing.total_pos_points))
                            setKills(String(existing.total_kills))
                          } else {
                            setPosPoints('')
                            setKills('')
                          }
                        }}
                        required
                      >
                        <option value="">
                          {!selectedSlot
                            ? 'Select a slot first'
                            : totalRegistered === 0
                            ? 'No registered teams in slot'
                            : pendingCount === 0 && !editingMatchId
                            ? `✅ All teams scored (${totalRegistered}/${totalRegistered})`
                            : 'Select registered team...'}
                        </option>
                        {pendingTeams.map((t: any) => {
                          const isCurrentlyEditing = selectedTeam === t.team_id && editingMatchId
                          return (
                            <option key={t.team_id} value={t.team_id}>
                              {t.team_name} [Slot {t.room_slot_number || 5}]{t.is_false_team ? ' 🏷️ [False Team]' : ''}{isCurrentlyEditing ? ' • [Editing]' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Second Row: Direct Total Position Points & Total Eliminations */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                  Total Position Points
                </label>
                <input
                  type="number"
                  className="form-input"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%' }}
                  min={0}
                  max={150}
                  value={posPoints}
                  onChange={e => setPosPoints(e.target.value)}
                  placeholder="e.g. 15"
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                  Total Eliminations
                </label>
                <input
                  type="number"
                  className="form-input"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%' }}
                  min={0}
                  max={99}
                  value={kills}
                  onChange={e => setKills(e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
            </div>

            {/* Live Mathematical Calculation Strip */}
            <div className={styles.calcStrip}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#888888', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700 }}>Pos Pts:</span>
                <strong style={{ color: '#fbbf24', fontSize: '0.9rem' }}>{posPoints ? posNum : '—'}</strong>
              </div>

              <span style={{ color: '#444444' }}>+</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#888888', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700 }}>Elims:</span>
                <strong style={{ color: '#4ade80', fontSize: '0.9rem' }}>{killsNum}</strong>
              </div>

              <span style={{ color: '#444444' }}>=</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#888888', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700 }}>Slot Total:</span>
                <strong
                  style={{
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    background: 'rgba(251, 191, 36, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                  }}
                >
                  {posPoints ? `${totalPoints} PTS` : '—'}
                </strong>
              </div>

              {selectedTeamData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(234, 179, 8, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                  <span style={{ fontSize: '0.75rem' }}>🍗</span>
                  <span style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800 }}>
                    {selectedTeamData.wwcd} WWCD {selectedTeamData.matches_won.length > 0 ? `(${selectedTeamData.matches_won.join(', ')})` : ''}
                  </span>
                </div>
              )}
            </div>

            {msg && (
              <p className={`${styles.scoreMsg} ${msg.includes('✅') ? styles.scoreMsgOk : styles.scoreMsgErr}`} style={{ padding: '0.4rem 0.6rem', margin: 0, fontSize: '0.8rem' }}>
                {msg}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                id="save-score-btn"
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.55rem', fontWeight: 800, fontSize: '0.85rem' }}
                disabled={saving || !selectedSlot || sortedSlots.length === 0}
              >
                {saving ? 'Saving Score...' : editingMatchId ? 'Update Slot Score →' : 'Save Slot Score →'}
              </button>
              {editingMatchId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem', borderColor: '#444' }}
                  onClick={handleCancelEdit}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── RIGHT COLUMN: Match Winners (Chicken Dinner / WWCD) Card ── */}
        <div className={styles.cheatSheetCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fbbf24', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🍗</span> Match Winners (#1 / WWCD)
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '3px' }}>
                MATCH 1 WINNER
              </label>
              <select
                className="form-input"
                style={{ padding: '0.38rem 0.55rem', fontSize: '0.8rem', width: '100%' }}
                value={match1Winner}
                onChange={e => setMatch1Winner(e.target.value)}
                disabled={!selectedSlot}
              >
                <option value="">— No Winner Selected —</option>
                {bookedTeams.map((t: any) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.team_name} [Slot {t.room_slot_number || 5}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '3px' }}>
                MATCH 2 WINNER
              </label>
              <select
                className="form-input"
                style={{ padding: '0.38rem 0.55rem', fontSize: '0.8rem', width: '100%' }}
                value={match2Winner}
                onChange={e => setMatch2Winner(e.target.value)}
                disabled={!selectedSlot}
              >
                <option value="">— No Winner Selected —</option>
                {bookedTeams.map((t: any) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.team_name} [Slot {t.room_slot_number || 5}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '3px' }}>
                MATCH 3 WINNER
              </label>
              <select
                className="form-input"
                style={{ padding: '0.38rem 0.55rem', fontSize: '0.8rem', width: '100%' }}
                value={match3Winner}
                onChange={e => setMatch3Winner(e.target.value)}
                disabled={!selectedSlot}
              >
                <option value="">— No Winner Selected —</option>
                {bookedTeams.map((t: any) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.team_name} [Slot {t.room_slot_number || 5}]
                  </option>
                ))}
              </select>
            </div>

            {winnersMsg && (
              <div style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', borderRadius: '4px', background: winnersMsg.includes('❌') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: winnersMsg.includes('❌') ? '#ef4444' : '#4ade80', fontWeight: 600 }}>
                {winnersMsg}
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', fontWeight: 700, borderColor: '#fbbf24', color: '#fbbf24' }}
              onClick={handleSaveWinners}
              disabled={savingWinners || !selectedSlot}
            >
              {savingWinners ? 'Saving...' : '💾 Save Match Winners'}
            </button>
          </div>
        </div>
      </div>

      {/* ── SLOT TEAM STANDINGS & SCORES TABLE ── */}
      {selectedSlot && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🏆</span> Slot Team Standings &amp; Scores ({slotStandingsList.length} / {bookedTeams.length} Teams Scored)
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#888888' }}>
              Tie-Breaker Priority: 1. Total Points → 2. Position Points → 3. Chicken Dinners (#1)
            </span>
          </div>

          <div className="table-wrapper">
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#161616' }}>
                  <th style={{ padding: '0.45rem 0.6rem', width: '50px' }}>Rank</th>
                  <th style={{ padding: '0.45rem 0.6rem' }}>Team Name</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', width: '100px', color: '#facc15' }}>🍗 Chicken</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: '#fbbf24' }}>Position Pts</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: '#4ade80' }}>Eliminations</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: '#60a5fa' }}>Total Points</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slotStandingsList.map((t: any) => (
                  <tr key={t.team_id} style={editingMatchId === t.match_id ? { background: 'rgba(251, 191, 36, 0.1)' } : {}}>
                    <td style={{ padding: '0.45rem 0.6rem' }}>
                      <strong style={{ color: t.rank === 1 ? '#fbbf24' : t.rank === 2 ? '#94a3b8' : t.rank === 3 ? '#cd7f32' : '#aaaaaa' }}>
                        #{t.rank}
                      </strong>
                    </td>
                    <td style={{ padding: '0.45rem 0.6rem' }}>
                      <strong>{t.team_name}</strong>
                      <span style={{ color: '#666', fontSize: '0.72rem', marginLeft: '6px' }}>[Slot {t.room_slot_number}]</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                      {t.wwcd > 0 ? (
                        <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', padding: '2px 7px', borderRadius: '4px', fontWeight: 800, fontSize: '0.75rem', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                          🍗 {t.wwcd} {t.matches_won.length > 0 ? `(${t.matches_won.join(',')})` : ''}
                        </span>
                      ) : (
                        <span style={{ color: '#555' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: '#fbbf24', fontWeight: 700 }}>
                      {t.total_pos_points} pts
                    </td>
                    <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>
                      {t.total_kills} elims
                    </td>
                    <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                      <strong style={{ color: '#60a5fa', fontSize: '0.92rem', fontWeight: 800 }}>
                        {t.total_points} PTS
                      </strong>
                    </td>
                    <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#fbbf24', borderColor: '#fbbf24', padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                          onClick={() => handleEditTeamScore(t)}
                        >
                          ✏️ Edit
                        </button>
                        {t.match_id && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                            onClick={() => handleDeleteMatch(t.match_id, t.team_name)}
                          >
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {slotStandingsList.length === 0 && !loadingMatches && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#777777', padding: '1.5rem' }}>
                      No score entries recorded for this slot yet. Select a team above to enter scores.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── IMPORT AI / JSON MODAL ── */}
      {showImportModal && (
        <ImportSlotJsonModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          selectedSlot={selectedSlot}
          slotTitle={(() => {
            const slotObj = sortedSlots.find((s: any) => s.slot_id === selectedSlot)
            return slotObj ? `${formatShortDate(slotObj.date)} • ${slotObj.time_label}` : 'Selected Slot'
          })()}
          bookedTeams={bookedTeams}
          onApplyScores={handleApplyJsonScores}
        />
      )}
      {/* ── ADD FALSE / SPOT TEAM MODAL ── */}
      {showAddFalseTeamModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => {
            if (!isAddingFalseTeam) {
              setShowAddFalseTeamModal(false)
              setExistingTeamPrompt(null)
              setFalseTeamError('')
            }
          }}
        >
          <div
            style={{
              background: '#121212',
              border: '1px solid #282828',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '460px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>➕ Add False / Spot Team</span>
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                  {sortedSlots.find((s: any) => s.slot_id === selectedSlot)
                    ? `For Slot: ${formatShortDate(sortedSlots.find((s: any) => s.slot_id === selectedSlot).date)} • ${sortedSlots.find((s: any) => s.slot_id === selectedSlot).time_label}`
                    : 'Add on-spot team to selected slot'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddFalseTeamModal(false)
                  setExistingTeamPrompt(null)
                  setFalseTeamError('')
                }}
                disabled={isAddingFalseTeam}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {falseTeamError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#f87171',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                  lineHeight: 1.4,
                }}
              >
                {falseTeamError}
              </div>
            )}

            {existingTeamPrompt ? (
              <div style={{ marginBottom: '1.25rem' }}>
                <div
                  style={{
                    background: 'rgba(251, 191, 36, 0.12)',
                    border: '1px solid rgba(251, 191, 36, 0.35)',
                    color: '#fbbf24',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                    marginBottom: '1rem',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#fff' }}>
                    ⚠️ Team Name Already Exists
                  </strong>
                  A team named <strong style={{ color: '#fff' }}>&quot;{existingTeamPrompt.team_name}&quot;</strong> already exists in the system database.
                  <div style={{ marginTop: '6px', color: '#e5e7eb' }}>
                    Would you like to assign this existing team to this slot, or choose a different name?
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isAddingFalseTeam}
                    onClick={() => {
                      setExistingTeamPrompt(null)
                      setFalseTeamError('')
                    }}
                  >
                    Change Name
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={isAddingFalseTeam}
                    onClick={() => handleAddFalseTeam(true)}
                    style={{ background: '#fbbf24', borderColor: '#fbbf24', color: '#000', fontWeight: 800 }}
                  >
                    {isAddingFalseTeam ? 'Adding Team...' : '✓ Yes, Add Existing Team to Slot'}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault()
                  handleAddFalseTeam(false)
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px', display: 'block' }}>
                    Team Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.9rem', padding: '0.55rem 0.75rem' }}
                    placeholder="e.g. TEAM SOUL or GODLIKE"
                    value={falseTeamName}
                    onChange={e => {
                      setFalseTeamName(e.target.value)
                      if (falseTeamError) setFalseTeamError('')
                    }}
                    autoFocus
                    required
                    disabled={isAddingFalseTeam}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '6px', lineHeight: 1.4 }}>
                    • Checks for name duplication automatically.<br />
                    • Allocates next available room slot number.<br />
                    • Adds team to Score Entry &amp; Leaderboard immediately.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isAddingFalseTeam}
                    onClick={() => {
                      setShowAddFalseTeamModal(false)
                      setFalseTeamError('')
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={isAddingFalseTeam || !falseTeamName.trim()}
                    style={{ background: '#fbbf24', borderColor: '#fbbf24', color: '#000', fontWeight: 800 }}
                  >
                    {isAddingFalseTeam ? 'Checking & Adding...' : '+ Add Team to Slot'}
                  </button>
                </div>
              </form>
            )}

            {/* List of existing false teams in this slot */}
            {bookedTeams.some((t: any) => t.is_false_team) && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #222' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  False Teams in this Slot ({bookedTeams.filter((t: any) => t.is_false_team).length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {bookedTeams.filter((t: any) => t.is_false_team).map((ft: any) => (
                    <div
                      key={ft.team_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#181818',
                        border: '1px solid #2e2e2e',
                        borderRadius: '6px',
                        padding: '6px 10px',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.82rem', color: '#fff' }}>{ft.team_name}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#fbbf24', marginLeft: '6px' }}>Room Slot #{ft.room_slot_number || 5}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFalseTeam(ft.team_id, ft.team_name)}
                        disabled={isRemovingFalseTeam === ft.team_id}
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#ef4444',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        {isRemovingFalseTeam === ft.team_id ? 'Removing...' : '🗑️ Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ImportSlotJsonModal({
  isOpen,
  onClose,
  selectedSlot,
  slotTitle,
  bookedTeams,
  onApplyScores,
}: {
  isOpen: boolean
  onClose: () => void
  selectedSlot: string
  slotTitle: string
  bookedTeams: any[]
  onApplyScores: (jsonText: string) => Promise<{ importedCount: number; totalInFile: number; errors: string[] }>
}) {
  const [jsonInput, setJsonInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('')

  if (!isOpen) return null

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setJsonInput(text)
      setStatusMsg(`Loaded ${file.name}`)
      setStatusType('')
    } catch (err: any) {
      setStatusMsg('Failed to read file: ' + err.message)
      setStatusType('error')
    }
  }

  async function handleSubmit() {
    if (!jsonInput.trim()) {
      setStatusMsg('Please paste JSON or upload a file first.')
      setStatusType('error')
      return
    }

    setIsProcessing(true)
    setStatusMsg('')
    setStatusType('')

    try {
      const res = await onApplyScores(jsonInput)
      if (res.importedCount > 0) {
        setStatusMsg(`✅ Successfully imported scores for ${res.importedCount} teams into Draft!`)
        setStatusType('success')
        setTimeout(() => {
          onClose()
          setJsonInput('')
          setStatusMsg('')
        }, 1200)
      } else {
        setStatusMsg('❌ No team scores could be imported. Please check JSON format.')
        setStatusType('error')
      }
    } catch (err: any) {
      setStatusMsg('❌ ' + err.message)
      setStatusType('error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#121212',
          border: '1px solid #333333',
          borderRadius: '14px',
          padding: '1.5rem',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.9)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #282828', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
              🤖 AI & JSON Score Importer
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f3f4f6', margin: 0 }}>
              Import Slot Scores
            </h3>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
              {slotTitle} • {bookedTeams.length} Registered Teams
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: '#888888', fontSize: '1.1rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Instructions */}
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.85rem', fontSize: '0.75rem', color: '#bae6fd' }}>
          Paste the JSON generated by ChatGPT / Claude / Gemini from your match screenshot, or upload a <code>.json</code> file.
        </div>

        {/* File upload shortcut */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e5e7eb' }}>
            Paste Raw JSON or AI Output:
          </label>
          <label
            style={{
              fontSize: '0.72rem',
              color: '#38bdf8',
              cursor: 'pointer',
              fontWeight: 700,
              textDecoration: 'underline',
            }}
          >
            📁 Or Upload .json file
            <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Text Area */}
        <textarea
          className="form-input"
          style={{
            width: '100%',
            height: '220px',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            padding: '0.6rem',
            background: '#0a0a0a',
            border: '1px solid #333333',
            borderRadius: '6px',
            resize: 'vertical',
            lineHeight: 1.4,
            marginBottom: '0.85rem',
          }}
          placeholder={`{\n  "match_winners": [17, 8, 13],\n  "scores": [\n    { "slot": 5, "pos_points": 0, "elims": 5 },\n    { "slot": 6, "pos_points": 0, "elims": 0 },\n    { "slot": 7, "pos_points": 10, "elims": 7 }\n  ]\n}`}
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
        />

        {/* Status Message */}
        {statusMsg && (
          <div
            style={{
              fontSize: '0.75rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              marginBottom: '0.85rem',
              fontWeight: 600,
              background: statusType === 'success' ? 'rgba(34, 197, 94, 0.15)' : statusType === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: statusType === 'success' ? '#4ade80' : statusType === 'error' ? '#ef4444' : '#d1d5db',
              border: statusType === 'success' ? '1px solid #22c55e' : statusType === 'error' ? '1px solid #ef4444' : '1px solid #444',
            }}
          >
            {statusMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderColor: '#444' }}
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              background: '#38bdf8',
              borderColor: '#38bdf8',
              color: '#000000',
            }}
            onClick={handleSubmit}
            disabled={isProcessing || !jsonInput.trim()}
          >
            {isProcessing ? 'Importing Scores...' : '⚡ Apply Scores to Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FIXED 6 DAILY SLOTS PRESETS ────────────────────────────────────
const FIXED_DAILY_SLOTS = [
  { id: 1, name: 'Slot 1', defaultLabel: '1:00 PM – 3:00 PM', shortTime: '1:00 PM' },
  { id: 2, name: 'Slot 2', defaultLabel: '3:00 PM – 5:00 PM', shortTime: '3:00 PM' },
  { id: 3, name: 'Slot 3', defaultLabel: '5:00 PM – 7:00 PM', shortTime: '5:00 PM' },
  { id: 4, name: 'Slot 4', defaultLabel: '7:00 PM – 9:00 PM', shortTime: '7:00 PM' },
  { id: 5, name: 'Slot 5', defaultLabel: '9:00 PM – 11:00 PM', shortTime: '9:00 PM' },
  { id: 6, name: 'Slot 6', defaultLabel: '11:00 PM – 1:00 AM', shortTime: '11:00 PM' },
]

function parseMatchTimeFromLabel(timeLabelStr: string, matchNum: number): string {
  if (!timeLabelStr) return ''
  const regex = new RegExp(`(?:match\\s*${matchNum}|m${matchNum})\\D*(\\d{1,2}:?\\d{2}?\\s*(?:AM|PM))`, 'i')
  const hit = timeLabelStr.match(regex)
  return hit ? hit[1].trim() : ''
}

function buildTimeLabel(baseWindow: string, m1?: string, m2?: string, m3?: string): string {
  const parts: string[] = []
  if (m1?.trim()) parts.push(`Match 1: ${m1.trim()}`)
  if (m2?.trim()) parts.push(`Match 2: ${m2.trim()}`)
  if (m3?.trim()) parts.push(`Match 3: ${m3.trim()}`)

  const windowStr = baseWindow.trim() || '1:00 PM – 3:00 PM'
  if (parts.length > 0) {
    return `${windowStr} (${parts.join(', ')})`
  }
  return windowStr
}

function normalizeStartTime(timeStr: string): string {
  if (!timeStr) return ''
  const cleaned = timeStr.trim().toLowerCase().replace(/\s+/g, '')
  const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/)
  if (m) {
    const hour = parseInt(m[1], 10)
    const min = m[2] || '00'
    const ampm = m[3]
    return `${hour}:${min}${ampm}`
  }
  return cleaned
}

function getSlotStartTime(rawLabel: string): string {
  if (!rawLabel) return ''
  const windowPart = rawLabel.split('(')[0].trim()
  const splitDash = windowPart.split(/\s*(?:–|-|to)\s*/i)
  if (splitDash.length > 0) {
    const rawStart = splitDash[0].replace(/^.*[•·|]\s*/, '').trim()
    return normalizeStartTime(rawStart)
  }
  return ''
}

// ── SLOTS MANAGEMENT TAB ──────────────────────────────────────────
function SlotsTab({ slots, setSlots, supabase, teams, onSyncPayouts, selectedDate, setSelectedDate, config, setConfig }: any) {
  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  const dayAfterStr = getDayAfterStr()

  const defaultFirstPrize = parseInt(config?.slot_first_prize || '160', 10)
  const defaultSecondPrize = parseInt(config?.slot_second_prize || '80', 10)
  const defaultThirdPrize = parseInt(config?.slot_third_prize || '60', 10)

  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'not_open' | 'completed'>('all')
  const [msg, setMsg] = useState('')
  const [loadingPresetId, setLoadingPresetId] = useState<number | null>(null)

  async function persistSlotPrizeOverride(slotId: string, p1: number, p2: number, p3?: number) {
    try {
      let currentMap: Record<string, any> = {}
      if (config?.slot_prizes_map) {
        try { currentMap = JSON.parse(config.slot_prizes_map) } catch {}
      }
      currentMap[slotId] = { first_prize: p1, second_prize: p2, third_prize: p3 ?? defaultThirdPrize }
      const mapJson = JSON.stringify(currentMap)
      await supabase.from('config').upsert([{ key: 'slot_prizes_map', value: mapJson }], { onConflict: 'key' })
      if (setConfig) {
        setConfig((prev: any) => ({ ...prev, slot_prizes_map: mapJson }))
      }
    } catch (e) {
      console.error('Failed to persist slot prize override to config:', e)
    }
  }

  // Compute standard 4-state slot status
  function computeSlotStatus(
    existingSlot: any,
    dateStr: string,
    timeLabelStr: string
  ): 'open' | 'closed' | 'not_open' | 'completed' {
    if (existingSlot && existingSlot.status === 'completed') {
      return 'completed'
    }
    if (!existingSlot) {
      return 'not_open'
    }
    const isAutoPast = isSlotPastOrEnded(dateStr, timeLabelStr)
    const isFullCapacity = (existingSlot.teams_booked_count || 0) >= (existingSlot.capacity || 20)
    const isExplicitClosed = existingSlot.status === 'closed' || existingSlot.status === 'full'

    if (isExplicitClosed || isAutoPast || isFullCapacity) {
      return 'closed'
    }
    if (existingSlot.status === 'open') {
      return 'open'
    }
    return 'not_open'
  }

  // Local state for editable fields per preset ID and date
  const [presetForms, setPresetForms] = useState<Record<string, {
    time_label?: string
    m1_time?: string
    m2_time?: string
    m3_time?: string
    whatsapp_link?: string
    entry_fee?: number
    capacity?: number
    first_prize?: any
    second_prize?: any
    third_prize?: any
  }>>({})

  // Local state to track which slot tiles are expanded (default: all collapsed)
  const [expandedSlots, setExpandedSlots] = useState<Record<number, boolean>>({})
  const [expandedCustomSlots, setExpandedCustomSlots] = useState<Record<string, boolean>>({})

  const toggleSlotExpand = (presetId: number) => {
    setExpandedSlots(prev => ({
      ...prev,
      [presetId]: !prev[presetId],
    }))
  }

  const toggleCustomSlotExpand = (slotId: string) => {
    setExpandedCustomSlots(prev => ({
      ...prev,
      [slotId]: !prev[slotId],
    }))
  }

  function getForm(presetId: number) {
    const formKey = `${selectedDate}_${presetId}`
    return presetForms[formKey] || {}
  }

  function updatePresetFormField(presetId: number, field: string, value: any) {
    const formKey = `${selectedDate}_${presetId}`
    setPresetForms(prev => ({
      ...prev,
      [formKey]: {
        ...(prev[formKey] || {}),
        [field]: value,
      },
    }))
  }

  // Helper to find matching DB slot for a preset slot on selectedDate (STRICT START TIME MATCHING ONLY)
  function getExistingSlot(preset: typeof FIXED_DAILY_SLOTS[0]) {
    const presetStartTime = normalizeStartTime(preset.shortTime)
    const presetLabelNorm = preset.defaultLabel.toLowerCase().replace(/\s+/g, ' ').trim()

    return slots.find((s: any) => {
      if (s.date !== selectedDate) return false
      const rawLabel = (s.time_label || '').trim()

      // 1. Explicit preset name tag like "Slot 1:" or "Slot 1 •"
      const nameRegex = new RegExp(`\\b${preset.name}\\b`, 'i')
      if (nameRegex.test(rawLabel)) return true

      // 2. Strict start time match (e.g. "1:00 PM" matches "1:00 PM - 3:00 PM")
      const slotStartTime = getSlotStartTime(rawLabel)
      if (slotStartTime && presetStartTime && slotStartTime === presetStartTime) {
        return true
      }

      // 3. Fallback: Base time label string includes normalized preset window
      const cleanLabel = rawLabel.split('(')[0].toLowerCase().replace(/\s+/g, ' ').trim()
      if (cleanLabel.includes(presetLabelNorm) || presetLabelNorm.includes(cleanLabel)) {
        return true
      }

      return false
    })
  }

  // 1-Click Open or Re-open Slot
  async function handleOpenSlot(preset: typeof FIXED_DAILY_SLOTS[0]) {
    setLoadingPresetId(preset.id)
    setMsg('')
    const existing = getExistingSlot(preset)
    const form = getForm(preset.id)

    const baseLabel = form.time_label ?? (existing?.time_label ? existing.time_label.split('(')[0].trim() : preset.defaultLabel)
    const m1 = form.m1_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 1)
    const m2 = form.m2_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 2)
    const m3 = form.m3_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 3)

    const timeLabel = buildTimeLabel(baseLabel, m1, m2, m3)
    const whatsappLink = form.whatsapp_link !== undefined ? form.whatsapp_link.trim() : (existing?.whatsapp_link || null)
    const entryFee = form.entry_fee || existing?.entry_fee || 40
    const capacity = form.capacity || existing?.capacity || 20
    const firstPrize = (form.first_prize !== undefined && form.first_prize !== '') ? Number(form.first_prize) : (existing?.first_prize ?? defaultFirstPrize)
    const secondPrize = (form.second_prize !== undefined && form.second_prize !== '') ? Number(form.second_prize) : (existing?.second_prize ?? defaultSecondPrize)
    const thirdPrize = (form.third_prize !== undefined && form.third_prize !== '') ? Number(form.third_prize) : (existing?.third_prize ?? defaultThirdPrize)

    if (existing) {
      let updatePayload: any = {
        status: 'open',
        time_label: timeLabel,
        whatsapp_link: whatsappLink,
        entry_fee: entryFee,
        capacity: capacity,
        first_prize: firstPrize,
        second_prize: secondPrize,
      }
      let { data, error } = await supabase
        .from('slots')
        .update(updatePayload)
        .eq('slot_id', existing.slot_id)
        .select()
        .single()

      if (error && (error.message?.includes('first_prize') || error.message?.includes('column of \'slots\''))) {
        delete updatePayload.first_prize
        delete updatePayload.second_prize
        const fallback = await supabase
          .from('slots')
          .update(updatePayload)
          .eq('slot_id', existing.slot_id)
          .select()
          .single()
        data = fallback.data
        error = fallback.error
        if (!error && data) {
          await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
        }
      } else if (!error && data) {
        await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
      }

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        const enriched = { ...data, first_prize: firstPrize, second_prize: secondPrize, third_prize: thirdPrize }
        setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? enriched : s))
      }
      setMsg(`✅ ${preset.name} (${selectedDate}) OPENED for registrations!`)
    } else {
      let insertPayload: any = {
        date: selectedDate,
        time_label: timeLabel,
        capacity: capacity,
        entry_fee: entryFee,
        status: 'open',
        whatsapp_link: whatsappLink,
        first_prize: firstPrize,
        second_prize: secondPrize,
      }
      let { data, error } = await supabase.from('slots').insert(insertPayload).select().single()

      if (error && (error.message?.includes('first_prize') || error.message?.includes('column of \'slots\''))) {
        delete insertPayload.first_prize
        delete insertPayload.second_prize
        const fallback = await supabase.from('slots').insert(insertPayload).select().single()
        data = fallback.data
        error = fallback.error
        if (!error && data) {
          await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
        }
      } else if (!error && data) {
        await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
      }

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        const enriched = { ...data, first_prize: firstPrize, second_prize: secondPrize, third_prize: thirdPrize }
        setSlots((prev: any[]) => [...prev, enriched])
      }
      setMsg(`✅ ${preset.name} (${selectedDate}) OPENED for registrations!`)
    }

    setLoadingPresetId(null)
  }

  // Mark Slot Not Open (turns slot disabled for this date)
  async function handleMarkNotOpen(preset: typeof FIXED_DAILY_SLOTS[0]) {
    setLoadingPresetId(preset.id)
    setMsg('')
    const existing = getExistingSlot(preset)
    if (!existing) {
      setLoadingPresetId(null)
      return
    }

    if (existing.teams_booked_count > 0) {
      const confirmDelete = window.confirm(
        `This slot currently has ${existing.teams_booked_count} registered teams. Marking it NOT OPEN will disable and remove the slot for ${formatMonthDay(selectedDate)}. Are you sure?`
      )
      if (!confirmDelete) {
        setLoadingPresetId(null)
        return
      }
    }

    const { error } = await supabase.from('slots').delete().eq('slot_id', existing.slot_id)
    if (error) {
      setMsg('❌ ' + error.message)
      setLoadingPresetId(null)
      return
    }

    if (setSlots) {
      setSlots((prev: any[]) => prev.filter((s: any) => s.slot_id !== existing.slot_id))
    }
    setMsg(`✅ ${preset.name} (${selectedDate}) turned disabled / NOT OPEN`)
    setLoadingPresetId(null)
  }

  // Close Slot to new registrations (sets status to 'full' so no bookings accepted)
  async function handleCloseSlot(preset: typeof FIXED_DAILY_SLOTS[0]) {
    setLoadingPresetId(preset.id)
    setMsg('')
    const existing = getExistingSlot(preset)

    if (!existing) {
      // If slot not yet saved in DB, create it directly as closed (status: 'full')
      const form = getForm(preset.id)
      const baseLabel = form.time_label ?? preset.defaultLabel
      const m1 = form.m1_time ?? parseMatchTimeFromLabel('', 1)
      const m2 = form.m2_time ?? parseMatchTimeFromLabel('', 2)
      const m3 = form.m3_time ?? parseMatchTimeFromLabel('', 3)
      const timeLabel = buildTimeLabel(baseLabel, m1, m2, m3)
      const whatsappLink = form.whatsapp_link !== undefined ? form.whatsapp_link.trim() : null
      const entryFee = form.entry_fee || 40
      const capacity = form.capacity || 20
      const firstPrize = (form.first_prize !== undefined && form.first_prize !== '') ? Number(form.first_prize) : defaultFirstPrize
      const secondPrize = (form.second_prize !== undefined && form.second_prize !== '') ? Number(form.second_prize) : defaultSecondPrize
      const thirdPrize = (form.third_prize !== undefined && form.third_prize !== '') ? Number(form.third_prize) : defaultThirdPrize

      let insertPayload: any = {
        date: selectedDate,
        time_label: timeLabel,
        capacity: capacity,
        entry_fee: entryFee,
        status: 'full',
        whatsapp_link: whatsappLink,
        first_prize: firstPrize,
        second_prize: secondPrize,
      }

      let { data, error } = await supabase.from('slots').insert(insertPayload).select().single()

      if (error && (error.message?.includes('first_prize') || error.message?.includes('column of \'slots\''))) {
        delete insertPayload.first_prize
        delete insertPayload.second_prize
        const fallback = await supabase.from('slots').insert(insertPayload).select().single()
        data = fallback.data
        error = fallback.error
        if (!error && data) {
          await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
        }
      } else if (!error && data) {
        await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
      }

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        const enriched = { ...data, first_prize: firstPrize, second_prize: secondPrize, third_prize: thirdPrize }
        setSlots((prev: any[]) => [...prev, enriched])
      }
      setMsg(`✅ ${preset.name} (${selectedDate}) marked CLOSED to registrations`)
      setLoadingPresetId(null)
      return
    }

    const { data, error } = await supabase
      .from('slots')
      .update({ status: 'full' })
      .eq('slot_id', existing.slot_id)
      .select()
      .single()

    if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
    if (data && setSlots) {
      setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
    }
    setMsg(`✅ ${preset.name} (${selectedDate}) CLOSED to new registrations`)
    setLoadingPresetId(null)
  }

  // Save changes to time, whatsapp link, entry fee, capacity, prizes
  async function handleSaveSlotDetails(preset: typeof FIXED_DAILY_SLOTS[0]) {
    setLoadingPresetId(preset.id)
    setMsg('')
    const existing = getExistingSlot(preset)
    const form = getForm(preset.id)

    const baseLabel = form.time_label ?? (existing?.time_label ? existing.time_label.split('(')[0].trim() : preset.defaultLabel)
    const m1 = form.m1_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 1)
    const m2 = form.m2_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 2)
    const m3 = form.m3_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 3)

    const timeLabel = buildTimeLabel(baseLabel, m1, m2, m3)
    const whatsappLink = form.whatsapp_link !== undefined ? form.whatsapp_link.trim() : (existing?.whatsapp_link || null)
    const entryFee = form.entry_fee || existing?.entry_fee || 40
    const capacity = form.capacity || existing?.capacity || 20
    const firstPrize = (form.first_prize !== undefined && form.first_prize !== '') ? Number(form.first_prize) : (existing?.first_prize ?? defaultFirstPrize)
    const secondPrize = (form.second_prize !== undefined && form.second_prize !== '') ? Number(form.second_prize) : (existing?.second_prize ?? defaultSecondPrize)
    const thirdPrize = (form.third_prize !== undefined && form.third_prize !== '') ? Number(form.third_prize) : (existing?.third_prize ?? defaultThirdPrize)

    if (existing) {
      let updatePayload: any = {
        time_label: timeLabel,
        whatsapp_link: whatsappLink,
        entry_fee: entryFee,
        capacity: capacity,
        first_prize: firstPrize,
        second_prize: secondPrize,
      }
      let { data, error } = await supabase
        .from('slots')
        .update(updatePayload)
        .eq('slot_id', existing.slot_id)
        .select()
        .single()

      if (error && (error.message?.includes('first_prize') || error.message?.includes('column of \'slots\''))) {
        delete updatePayload.first_prize
        delete updatePayload.second_prize
        const fallback = await supabase
          .from('slots')
          .update(updatePayload)
          .eq('slot_id', existing.slot_id)
          .select()
          .single()
        data = fallback.data
        error = fallback.error
        if (!error && data) {
          await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
        }
      } else if (!error && data) {
        await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
      }

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        const enriched = { ...data, first_prize: firstPrize, second_prize: secondPrize, third_prize: thirdPrize }
        setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? enriched : s))
      }
      setMsg(`✅ Details saved for ${preset.name}!`)
    } else {
      let insertPayload: any = {
        date: selectedDate,
        time_label: timeLabel,
        capacity: capacity,
        entry_fee: entryFee,
        status: 'open',
        whatsapp_link: whatsappLink,
        first_prize: firstPrize,
        second_prize: secondPrize,
      }
      let { data, error } = await supabase.from('slots').insert(insertPayload).select().single()

      if (error && (error.message?.includes('first_prize') || error.message?.includes('column of \'slots\''))) {
        delete insertPayload.first_prize
        delete insertPayload.second_prize
        const fallback = await supabase.from('slots').insert(insertPayload).select().single()
        data = fallback.data
        error = fallback.error
        if (!error && data) {
          await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
        }
      } else if (!error && data) {
        await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
      }

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        const enriched = { ...data, first_prize: firstPrize, second_prize: secondPrize, third_prize: thirdPrize }
        setSlots((prev: any[]) => [...prev, enriched])
      }
      setMsg(`✅ Created and saved details for ${preset.name}!`)
    }

    setLoadingPresetId(null)
  }

  // Toggle Completed status
  async function handleToggleCompleted(preset: typeof FIXED_DAILY_SLOTS[0]) {
    setLoadingPresetId(preset.id)
    setMsg('')
    const existing = getExistingSlot(preset)
    const form = getForm(preset.id)

    const firstPrize = (form.first_prize !== undefined && form.first_prize !== '') ? Number(form.first_prize) : (existing?.first_prize ?? defaultFirstPrize)
    const secondPrize = (form.second_prize !== undefined && form.second_prize !== '') ? Number(form.second_prize) : (existing?.second_prize ?? defaultSecondPrize)
    const thirdPrize = (form.third_prize !== undefined && form.third_prize !== '') ? Number(form.third_prize) : (existing?.third_prize ?? defaultThirdPrize)

    if (!existing) {
      const baseLabel = form.time_label ?? preset.defaultLabel
      const m1 = form.m1_time
      const m2 = form.m2_time
      const m3 = form.m3_time
      const timeLabel = buildTimeLabel(baseLabel, m1, m2, m3)
      const whatsappLink = form.whatsapp_link !== undefined ? form.whatsapp_link.trim() : null
      const entryFee = form.entry_fee || 40
      const capacity = form.capacity || 20

      let insertPayload: any = {
        date: selectedDate,
        time_label: timeLabel,
        capacity,
        entry_fee: entryFee,
        status: 'completed',
        whatsapp_link: whatsappLink,
        first_prize: firstPrize,
        second_prize: secondPrize,
      }

      let { data, error } = await supabase.from('slots').insert(insertPayload).select().single()

      if (error && (error.message?.includes('first_prize') || error.message?.includes('column of \'slots\''))) {
        delete insertPayload.first_prize
        delete insertPayload.second_prize
        const fallback = await supabase.from('slots').insert(insertPayload).select().single()
        data = fallback.data
        error = fallback.error
        if (!error && data) {
          await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
        }
      } else if (!error && data) {
        await persistSlotPrizeOverride(data.slot_id, firstPrize, secondPrize, thirdPrize)
      }

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        const enriched = { ...data, first_prize: firstPrize, second_prize: secondPrize, third_prize: thirdPrize }
        setSlots((prev: any[]) => [...prev, enriched])
      }
      setMsg(`✅ ${preset.name} (${selectedDate}) marked as DONE! Payout slips (top 3) & 4th-place coupon generated.`)
      if (onSyncPayouts) onSyncPayouts()
    } else {
      const nextStatus = existing.status === 'completed' ? 'open' : 'completed'
      const { data, error } = await supabase
        .from('slots')
        .update({ status: nextStatus })
        .eq('slot_id', existing.slot_id)
        .select()
        .single()

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
      }
      if (nextStatus === 'completed') {
        setMsg(`✅ ${preset.name} (${selectedDate}) marked as DONE! Payout slips (top 2) & 3rd-place coupon generated.`)
        if (onSyncPayouts) onSyncPayouts()
      } else {
        setMsg(`↩️ ${preset.name} (${selectedDate}) reverted to OPEN status.`)
      }
    }

    setLoadingPresetId(null)
  }


  return (
    <div>
      <div className={styles.tabHeader} style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 className={styles.tabTitle}>Daily Slots Management (6 Fixed Slots)</h2>
          <p className={styles.tabDesc}>
            Select a date below to configure match schedules and open/close bookings. Once match scores are pushed via &apos;Update The Table&apos; in Score Entry, mark a slot as Done here to generate UPI payout slips (top 2) and 3rd-place coupon code.
          </p>
        </div>
      </div>

      {/* ── DATE SELECTION BAR ────────────────────────────────────── */}
      <div
        style={{
          background: '#141414',
          border: '1px solid #282828',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#aaaaaa', fontSize: '0.85rem', fontWeight: 700 }}>SELECT DATE:</span>
          
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              background: selectedDate === todayStr ? '#fbbf24' : '#1e1e1e',
              color: selectedDate === todayStr ? '#111111' : '#ffffff',
              fontWeight: 800,
              borderColor: selectedDate === todayStr ? '#fbbf24' : '#333333',
            }}
            onClick={() => setSelectedDate(todayStr)}
          >
            Today ({formatMonthDay(todayStr)})
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              background: selectedDate === tomorrowStr ? '#fbbf24' : '#1e1e1e',
              color: selectedDate === tomorrowStr ? '#111111' : '#ffffff',
              fontWeight: 800,
              borderColor: selectedDate === tomorrowStr ? '#fbbf24' : '#333333',
            }}
            onClick={() => setSelectedDate(tomorrowStr)}
          >
            Tomorrow ({formatMonthDay(tomorrowStr)})
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              background: selectedDate === dayAfterStr ? '#fbbf24' : '#1e1e1e',
              color: selectedDate === dayAfterStr ? '#111111' : '#ffffff',
              fontWeight: 800,
              borderColor: selectedDate === dayAfterStr ? '#fbbf24' : '#333333',
            }}
            onClick={() => setSelectedDate(dayAfterStr)}
          >
            Day After ({formatMonthDay(dayAfterStr)})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.78rem', color: '#888888', fontWeight: 600 }}>Custom Date:</label>
          <input
            type="date"
            className="form-input"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', width: 'auto' }}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>

        {/* ── STATUS FILTER DROPDOWN (Right next to date) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <label style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            Filter:
          </label>
          <select
            className="form-input"
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: '#181818',
              color: '#ffffff',
              borderColor: statusFilter !== 'all' ? '#fbbf24' : '#383838',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Statuses (Default)</option>
            <option value="open">🟢 Open (Accepting Bookings)</option>
            <option value="closed">🔒 Closed (10m Cutoff / Full)</option>
            <option value="not_open">⚪ Not Open (Disabled)</option>
            <option value="completed">🟣 Completed (Scores Finalized)</option>
          </select>
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            background: msg.includes('❌') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: msg.includes('❌') ? '1px solid #ef4444' : '1px solid #22c55e',
            color: msg.includes('❌') ? '#ef4444' : '#4ade80',
          }}
        >
          {msg}
        </div>
      )}

      {/* ── 6 FIXED SLOTS GRID ───────────────────────────────────── */}
      {(() => {
        const filteredFixedSlots = FIXED_DAILY_SLOTS.filter(preset => {
          if (statusFilter === 'all') return true
          const existingSlot = getExistingSlot(preset)
          const form = getForm(preset.id)
          const currentLabel = form.time_label ?? (existingSlot?.time_label ? existingSlot.time_label.split('(')[0].trim() : preset.defaultLabel)
          const st = computeSlotStatus(existingSlot, selectedDate, currentLabel)
          return st === statusFilter
        })

        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚡ 6 Fixed Slots for {formatFullLongDate(selectedDate)}
                {statusFilter !== 'all' && (
                  <span style={{ fontSize: '0.78rem', color: '#60a5fa', marginLeft: '0.5rem', fontWeight: 700 }}>
                    (Showing {filteredFixedSlots.length} of 6 matching {statusFilter.toUpperCase().replace('_', ' ')})
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', fontWeight: 800, background: '#1c1c1c', borderColor: '#3a3a3a' }}
                  onClick={() => {
                    const all: Record<number, boolean> = {}
                    FIXED_DAILY_SLOTS.forEach(p => { all[p.id] = true })
                    setExpandedSlots(all)
                  }}
                >
                  Expand All ▼
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', fontWeight: 800, background: '#1c1c1c', borderColor: '#3a3a3a' }}
                  onClick={() => setExpandedSlots({})}
                >
                  Collapse All ▲
                </button>
              </div>
            </div>

            {filteredFixedSlots.length === 0 ? (
              <div
                style={{
                  background: '#141414',
                  border: '1px dashed #333333',
                  borderRadius: '12px',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.6rem',
                  marginBottom: '1.5rem',
                }}
              >
                <span style={{ fontSize: '1.8rem' }}>🔍</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                  No fixed slots found matching status "{statusFilter.toUpperCase().replace('_', ' ')}"
                </div>
                <div style={{ fontSize: '0.78rem', color: '#888888' }}>
                  None of the 6 fixed slots for {formatMonthDay(selectedDate)} are currently in this state.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.5rem', fontWeight: 700, fontSize: '0.8rem' }}
                  onClick={() => setStatusFilter('all')}
                >
                  Reset Filter to All
                </button>
              </div>
            ) : (
              <div className={styles.slotsGrid}>
                {filteredFixedSlots.map(preset => {
                  const existingSlot = getExistingSlot(preset)
                  const form = getForm(preset.id)
                  const isLoading = loadingPresetId === preset.id
                  const isExpanded = !!expandedSlots[preset.id]

                  const currentLabel = form.time_label ?? (existingSlot?.time_label ? existingSlot.time_label.split('(')[0].trim() : preset.defaultLabel)
                  const slotStatus = computeSlotStatus(existingSlot, selectedDate, currentLabel)
                  const isAutoClosed = isSlotPastOrEnded(selectedDate, currentLabel)
                  const isFullCapacity = (existingSlot?.teams_booked_count || 0) >= (existingSlot?.capacity || 20)
                  const isCompleted = slotStatus === 'completed'
                  const isOpen = slotStatus === 'open'
                  const isClosed = slotStatus === 'closed'
                  const isNotOpen = slotStatus === 'not_open'

                  const currentM1 = form.m1_time ?? parseMatchTimeFromLabel(existingSlot?.time_label || '', 1)
                  const currentM2 = form.m2_time ?? parseMatchTimeFromLabel(existingSlot?.time_label || '', 2)
                  const currentM3 = form.m3_time ?? parseMatchTimeFromLabel(existingSlot?.time_label || '', 3)
                  const currentWhatsapp = form.whatsapp_link ?? existingSlot?.whatsapp_link ?? ''
                  const currentFee = form.entry_fee ?? existingSlot?.entry_fee ?? 40
                  const currentCap = form.capacity ?? existingSlot?.capacity ?? 20
                  const currentFirstPrize = form.first_prize ?? existingSlot?.first_prize ?? defaultFirstPrize
                  const currentSecondPrize = form.second_prize ?? existingSlot?.second_prize ?? defaultSecondPrize
                  const currentThirdPrize = form.third_prize ?? existingSlot?.third_prize ?? defaultThirdPrize

                  return (
                    <div
                      key={preset.id}
                      style={{
                        background: '#121212',
                        border: isCompleted
                          ? '1px solid #8b5cf6'
                          : isClosed
                          ? '1px solid #ef4444'
                          : isOpen
                          ? '1px solid #22c55e'
                          : '1px solid #2b2b2b',
                        borderRadius: '14px',
                        padding: '1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: isCompleted
                          ? '0 4px 20px rgba(139, 92, 246, 0.12)'
                          : isClosed
                          ? '0 4px 20px rgba(239, 68, 68, 0.12)'
                          : isOpen
                          ? '0 4px 20px rgba(34, 197, 94, 0.1)'
                          : 'none',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Slot Header: Clickable row with Name, Time Label, Status Badge & Prominent Down Arrow Expand Button */}
                      <div
                        onClick={() => toggleSlotExpand(preset.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.6rem',
                          flexWrap: 'wrap',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {preset.name}
                          </span>
                          <h4 style={{ margin: '2px 0 0 0', fontSize: '1.08rem', fontWeight: 900, color: '#ffffff' }}>
                            {currentLabel}
                          </h4>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 900,
                              padding: '4px 9px',
                              borderRadius: '6px',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              background: isCompleted
                                ? 'rgba(139, 92, 246, 0.2)'
                                : isClosed
                                ? 'rgba(239, 68, 68, 0.18)'
                                : isOpen
                                ? 'rgba(34, 197, 94, 0.2)'
                                : 'rgba(107, 114, 128, 0.18)',
                              color: isCompleted
                                ? '#c084fc'
                                : isClosed
                                ? '#f87171'
                                : isOpen
                                ? '#4ade80'
                                : '#9ca3af',
                              border: isCompleted
                                ? '1px solid #8b5cf6'
                                : isClosed
                                ? '1px solid #ef4444'
                                : isOpen
                                ? '1px solid #22c55e'
                                : '1px solid #4b5563',
                            }}
                          >
                            {isCompleted
                              ? 'COMPLETED'
                              : isClosed
                              ? isAutoClosed
                                ? 'CLOSED (AUTO 10M)'
                                : isFullCapacity
                                ? 'CLOSED (FULL)'
                                : 'CLOSED'
                              : isOpen
                              ? `OPEN (${existingSlot?.teams_booked_count || 0}/${existingSlot?.capacity || 20})`
                              : 'NOT OPEN'}
                          </span>

                          {/* Prominent Down Arrow Expand Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSlotExpand(preset.id)
                            }}
                            title={isExpanded ? 'Collapse slot details' : 'Expand to edit timings, WhatsApp & capacity'}
                            style={{
                              background: isExpanded ? '#fbbf24' : '#1e1e1e',
                              color: isExpanded ? '#111111' : '#fbbf24',
                              border: isExpanded ? '1px solid #fbbf24' : '1px solid #444444',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              transition: 'all 0.2s ease',
                              boxShadow: isExpanded ? '0 0 10px rgba(251, 191, 36, 0.35)' : 'none',
                            }}
                          >
                            <span>{isExpanded ? 'Less' : 'Edit'}</span>
                            <ChevronDown
                              size={17}
                              style={{
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            />
                          </button>
                        </div>
                      </div>

                      {isClosed && isAutoClosed && (
                        <div
                          style={{
                            fontSize: '0.73rem',
                            color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            borderRadius: '6px',
                            padding: '0.35rem 0.6rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontWeight: 600,
                          }}
                        >
                          <span>⏱️</span>
                          <span>Auto-closed: registration cutoff reached</span>
                        </div>
                      )}

                      {isClosed && isFullCapacity && !isAutoClosed && (
                        <div
                          style={{
                            fontSize: '0.73rem',
                            color: '#f87171',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '6px',
                            padding: '0.35rem 0.6rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontWeight: 600,
                          }}
                        >
                          <span>🔒</span>
                          <span>Closed: slot is at full capacity ({existingSlot?.teams_booked_count}/{existingSlot?.capacity})</span>
                        </div>
                      )}

                      {/* ── ALL 4 STATUS CHANGING BUTTONS (2x2 GRID, FULLY RESPONSIVE FOR MOBILE & DESKTOP) ── */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                        {/* 1. Open / Re-Open Slot */}
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            width: '100%',
                            minHeight: '40px',
                            background: isOpen ? 'rgba(34, 197, 94, 0.16)' : '#22c55e',
                            color: isOpen ? '#4ade80' : '#000000',
                            border: isOpen ? '1px solid #22c55e' : 'none',
                            fontWeight: 900,
                            fontSize: '0.78rem',
                            padding: '0.5rem 0.35rem',
                            borderRadius: '8px',
                            cursor: isOpen ? 'default' : 'pointer',
                            opacity: isOpen ? 0.9 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                          }}
                          disabled={isLoading || isOpen}
                          onClick={() => handleOpenSlot(preset)}
                        >
                          {isLoading ? '...' : isOpen ? '🟢 Open' : isClosed ? '🔓 Re-Open' : '🔓 Open Slot'}
                        </button>

                        {/* 2. Close Slot */}
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            width: '100%',
                            minHeight: '40px',
                            background: isClosed ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.1)',
                            color: isClosed ? '#fca5a5' : '#f87171',
                            border: isClosed ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.45)',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            padding: '0.5rem 0.35rem',
                            borderRadius: '8px',
                            cursor: (isClosed || isNotOpen) ? 'not-allowed' : 'pointer',
                            opacity: (isClosed || isNotOpen) ? 0.45 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                          }}
                          disabled={isLoading || isNotOpen || isClosed}
                          onClick={() => handleCloseSlot(preset)}
                        >
                          {isLoading ? '...' : isClosed ? '🔒 Closed' : '🔒 Close Slot'}
                        </button>

                        {/* 3. Mark Not Open */}
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            width: '100%',
                            minHeight: '40px',
                            background: isNotOpen ? 'rgba(107, 114, 128, 0.12)' : '#1a1a1a',
                            color: isNotOpen ? '#6b7280' : '#e5e7eb',
                            border: isNotOpen ? '1px solid #374151' : '1px solid #404040',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            padding: '0.5rem 0.35rem',
                            borderRadius: '8px',
                            cursor: isNotOpen ? 'default' : 'pointer',
                            opacity: isNotOpen ? 0.55 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                          }}
                          disabled={isLoading || isNotOpen}
                          onClick={() => handleMarkNotOpen(preset)}
                        >
                          {isLoading ? '...' : isNotOpen ? '⚪ Not Open' : '🚫 Not Open'}
                        </button>

                        {/* 4. Mark Completed / Revert to Open */}
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            width: '100%',
                            minHeight: '40px',
                            background: isCompleted ? 'rgba(251, 191, 36, 0.18)' : '#8b5cf6',
                            color: isCompleted ? '#fbbf24' : '#ffffff',
                            border: isCompleted ? '1px solid #fbbf24' : 'none',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            padding: '0.5rem 0.35rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                          }}
                          disabled={isLoading}
                          onClick={() => handleToggleCompleted(preset)}
                        >
                          {isLoading ? '...' : isCompleted ? '↩️ Revert Open' : '🏆 Mark as Done'}
                        </button>
                      </div>

                      {/* ── EXPANDABLE SECTION (OPERATE ON TIMINGS, SCHEDULE, WHATSAPP, FEE & CAPACITY) ── */}
                      {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #222222', paddingTop: '0.85rem' }}>
                          {/* Custom Match Timings Box */}
                          <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                ⏱️ MATCH TIMINGS & SCHEDULE
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#888888' }}>
                                Leave blank for defaults
                              </span>
                            </div>

                            <div>
                              <label style={{ fontSize: '0.7rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                                Slot Window Label:
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                                value={currentLabel}
                                onChange={e => updatePresetFormField(preset.id, 'time_label', e.target.value)}
                                placeholder="e.g. 1:00 PM – 3:00 PM"
                              />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '0.4rem' }}>
                              <div>
                                <label style={{ fontSize: '0.66rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                                  Match 1 (Erangel):
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '0.35rem 0.45rem', fontSize: '0.75rem' }}
                                  value={currentM1}
                                  onChange={e => updatePresetFormField(preset.id, 'm1_time', e.target.value)}
                                  placeholder="1:12 PM"
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '0.66rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                                  Match 2 (Rondo):
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '0.35rem 0.45rem', fontSize: '0.75rem' }}
                                  value={currentM2}
                                  onChange={e => updatePresetFormField(preset.id, 'm2_time', e.target.value)}
                                  placeholder="1:52 PM"
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '0.66rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                                  Match 3 (Miramar):
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '0.35rem 0.45rem', fontSize: '0.75rem' }}
                                  value={currentM3}
                                  onChange={e => updatePresetFormField(preset.id, 'm3_time', e.target.value)}
                                  placeholder="2:32 PM"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.72rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '3px', display: 'block' }}>
                              WhatsApp Group Link (changes daily):
                            </label>
                            <input
                              type="url"
                              className="form-input"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                              value={currentWhatsapp}
                              onChange={e => updatePresetFormField(preset.id, 'whatsapp_link', e.target.value)}
                              placeholder="https://chat.whatsapp.com/..."
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '3px', display: 'block' }}>
                                Entry Fee (₹):
                              </label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                                value={currentFee}
                                onChange={e => updatePresetFormField(preset.id, 'entry_fee', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.72rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '3px', display: 'block' }}>
                                Capacity:
                              </label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                                value={currentCap}
                                onChange={e => updatePresetFormField(preset.id, 'capacity', parseInt(e.target.value) || 20)}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.1fr', gap: '0.45rem', background: '#18181b', padding: '0.5rem', borderRadius: '8px', border: '1px solid #27272a' }}>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: '#facc15', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                                🥇 1st Prize (₹):
                              </label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', borderColor: '#854d0e', background: '#09090b' }}
                                value={currentFirstPrize}
                                onChange={e => updatePresetFormField(preset.id, 'first_prize', e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0))}
                                placeholder={String(defaultFirstPrize)}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                                🥈 2nd Prize (₹):
                              </label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', borderColor: '#475569', background: '#09090b' }}
                                value={currentSecondPrize}
                                onChange={e => updatePresetFormField(preset.id, 'second_prize', e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0))}
                                placeholder={String(defaultSecondPrize)}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                                🥉 3rd Prize (₹):
                              </label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', borderColor: '#b45309', background: '#09090b' }}
                                value={currentThirdPrize}
                                onChange={e => updatePresetFormField(preset.id, 'third_prize', e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0))}
                                placeholder={String(defaultThirdPrize)}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                                🎟️ 4th Prize:
                              </label>
                              <div
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '0.74rem',
                                  background: 'rgba(74, 222, 128, 0.1)',
                                  color: '#4ade80',
                                  border: '1px dashed #16a34a',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textAlign: 'center'
                                }}
                                title="4th Prize is an automated Free Slot Pass coupon"
                              >
                                🎟️ Free Slot
                              </div>
                            </div>
                          </div>

                          {/* ── Save Details & Collapse Action ── */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.55rem', marginTop: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                padding: '0.55rem 0.75rem',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                background: '#fbbf24',
                                color: '#111111',
                                border: '1px solid #fbbf24',
                              }}
                              disabled={isLoading}
                              onClick={() => handleSaveSlotDetails(preset)}
                            >
                              💾 Save Slot Details
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                padding: '0.55rem 0.75rem',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                background: '#1a1a1a',
                                color: '#9ca3af',
                                borderColor: '#333333',
                              }}
                              onClick={() => toggleSlotExpand(preset.id)}
                            >
                              ▲ Collapse
                            </button>
                          </div>

                          {/* Optional subtle delete button if slot exists and has 0 bookings */}
                          {existingSlot && existingSlot.teams_booked_count === 0 && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm(`Permanently delete ${preset.name} (${selectedDate})?`)) return
                                await supabase.from('slots').delete().eq('slot_id', existingSlot.slot_id)
                                if (setSlots) {
                                  setSlots((prev: any[]) => prev.filter((s: any) => s.slot_id !== existingSlot.slot_id))
                                }
                                setMsg(`🗑️ ${preset.name} deleted`)
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                textAlign: 'center',
                                textDecoration: 'underline',
                                marginTop: '0.15rem',
                                opacity: 0.8,
                              }}
                            >
                              Delete Slot
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      })()}

      {/* Additional / Custom Slots on this date if any exist */}
      {(() => {
        const matchedSlotIds = new Set(
          FIXED_DAILY_SLOTS.map(p => getExistingSlot(p)?.slot_id).filter(Boolean)
        )
        const additionalSlots = slots.filter((s: any) => s.date === selectedDate && !matchedSlotIds.has(s.slot_id))
        const filteredAdditionalSlots = additionalSlots.filter((extraSlot: any) => {
          if (statusFilter === 'all') return true
          const st = computeSlotStatus(extraSlot, selectedDate, extraSlot.time_label)
          return st === statusFilter
        })

        if (additionalSlots.length === 0) return null
        if (filteredAdditionalSlots.length === 0 && statusFilter !== 'all') return null

        return (
          <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#60a5fa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚡ Additional Custom Slots for {formatFullLongDate(selectedDate)} ({filteredAdditionalSlots.length})
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', fontWeight: 800, background: '#1c1c1c', borderColor: '#3a3a3a' }}
                  onClick={() => {
                    const allCustom: Record<string, boolean> = {}
                    filteredAdditionalSlots.forEach((s: any) => { allCustom[s.slot_id] = true })
                    setExpandedCustomSlots(allCustom)
                  }}
                >
                  Expand All ▼
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', fontWeight: 800, background: '#1c1c1c', borderColor: '#3a3a3a' }}
                  onClick={() => setExpandedCustomSlots({})}
                >
                  Collapse All ▲
                </button>
              </div>
            </div>

            <div className={styles.slotsGrid}>
              {filteredAdditionalSlots.map((extraSlot: any) => {
                const extraStatus = computeSlotStatus(extraSlot, selectedDate, extraSlot.time_label)
                const isExtraAutoClosed = isSlotPastOrEnded(selectedDate, extraSlot.time_label)
                const isExtraFullCapacity = (extraSlot.teams_booked_count || 0) >= (extraSlot.capacity || 20)
                const isExtraCompleted = extraStatus === 'completed'
                const isExtraOpen = extraStatus === 'open'
                const isExtraClosed = extraStatus === 'closed'
                const isExtraNotOpen = extraStatus === 'not_open'
                const isCustomExpanded = !!expandedCustomSlots[extraSlot.slot_id]

                return (
                  <div
                    key={extraSlot.slot_id}
                    style={{
                      background: '#121212',
                      border: isExtraCompleted
                        ? '1px solid #8b5cf6'
                        : isExtraClosed
                        ? '1px solid #ef4444'
                        : isExtraOpen
                        ? '1px solid #22c55e'
                        : '1px solid #2b2b2b',
                      borderRadius: '14px',
                      padding: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      boxShadow: isExtraCompleted
                        ? '0 4px 20px rgba(139, 92, 246, 0.12)'
                        : isExtraClosed
                        ? '0 4px 20px rgba(239, 68, 68, 0.12)'
                        : isExtraOpen
                        ? '0 4px 20px rgba(34, 197, 94, 0.1)'
                        : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Header: Clickable row with time, status and Down Arrow Expand button */}
                    <div
                      onClick={() => toggleCustomSlotExpand(extraSlot.slot_id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.6rem',
                        flexWrap: 'wrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 900, textTransform: 'uppercase' }}>
                          Custom Slot
                        </span>
                        <h4 style={{ margin: '2px 0 0 0', fontSize: '1.08rem', fontWeight: 900, color: '#ffffff' }}>
                          {extraSlot.time_label}
                        </h4>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            padding: '4px 9px',
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                            background: isExtraCompleted
                              ? 'rgba(139, 92, 246, 0.2)'
                              : isExtraClosed
                              ? 'rgba(239, 68, 68, 0.18)'
                              : isExtraOpen
                              ? 'rgba(34, 197, 94, 0.2)'
                              : 'rgba(107, 114, 128, 0.18)',
                            color: isExtraCompleted
                              ? '#c084fc'
                              : isExtraClosed
                              ? '#f87171'
                              : isExtraOpen
                              ? '#4ade80'
                              : '#9ca3af',
                            border: isExtraCompleted
                              ? '1px solid #8b5cf6'
                              : isExtraClosed
                              ? '1px solid #ef4444'
                              : isExtraOpen
                              ? '1px solid #22c55e'
                              : '1px solid #4b5563',
                          }}
                        >
                          {isExtraCompleted
                            ? 'COMPLETED'
                            : isExtraClosed
                            ? isExtraAutoClosed
                              ? 'CLOSED (AUTO 10M)'
                              : isExtraFullCapacity
                              ? 'CLOSED (FULL)'
                              : 'CLOSED'
                            : isExtraOpen
                            ? `OPEN (${extraSlot.teams_booked_count || 0}/${extraSlot.capacity || 20})`
                            : 'NOT OPEN'}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleCustomSlotExpand(extraSlot.slot_id)
                          }}
                          title={isCustomExpanded ? 'Collapse slot details' : 'Expand slot details'}
                          style={{
                            background: isCustomExpanded ? '#fbbf24' : '#1e1e1e',
                            color: isCustomExpanded ? '#111111' : '#fbbf24',
                            border: isCustomExpanded ? '1px solid #fbbf24' : '1px solid #444444',
                            borderRadius: '8px',
                            padding: '5px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            transition: 'all 0.2s ease',
                            boxShadow: isCustomExpanded ? '0 0 10px rgba(251, 191, 36, 0.35)' : 'none',
                          }}
                        >
                          <span>{isCustomExpanded ? 'Less' : 'Edit'}</span>
                          <ChevronDown
                            size={17}
                            style={{
                              transform: isCustomExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                        </button>
                      </div>
                    </div>

                    {isExtraClosed && isExtraAutoClosed && (
                      <div
                        style={{
                          fontSize: '0.73rem',
                          color: '#fbbf24',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: '6px',
                          padding: '0.35rem 0.6rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontWeight: 600,
                        }}
                      >
                        <span>⏱️</span>
                        <span>Auto-closed: registration cutoff reached</span>
                      </div>
                    )}

                    {/* ── 4 STATUS BUTTONS FOR CUSTOM SLOT ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          width: '100%',
                          minHeight: '40px',
                          background: isExtraOpen ? 'rgba(34, 197, 94, 0.16)' : '#22c55e',
                          color: isExtraOpen ? '#4ade80' : '#000000',
                          border: isExtraOpen ? '1px solid #22c55e' : 'none',
                          fontWeight: 900,
                          fontSize: '0.78rem',
                          padding: '0.5rem 0.35rem',
                          borderRadius: '8px',
                          cursor: isExtraOpen ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        disabled={isExtraOpen}
                        onClick={async () => {
                          const { data, error } = await supabase.from('slots').update({ status: 'open' }).eq('slot_id', extraSlot.slot_id).select().single()
                          if (error) { setMsg('❌ ' + error.message); return }
                          if (data && setSlots) {
                            setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                          }
                          setMsg(`✅ Custom Slot (${extraSlot.time_label}) OPENED for booking`)
                        }}
                      >
                        {isExtraOpen ? '🟢 Open' : isExtraClosed ? '🔓 Re-Open' : '🔓 Open Slot'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          width: '100%',
                          minHeight: '40px',
                          background: isExtraClosed ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.1)',
                          color: isExtraClosed ? '#fca5a5' : '#f87171',
                          border: isExtraClosed ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.45)',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          padding: '0.5rem 0.35rem',
                          borderRadius: '8px',
                          cursor: (isExtraClosed || isExtraNotOpen) ? 'not-allowed' : 'pointer',
                          opacity: (isExtraClosed || isExtraNotOpen) ? 0.45 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        disabled={isExtraNotOpen || isExtraClosed}
                        onClick={async () => {
                          const { data, error } = await supabase.from('slots').update({ status: 'full' }).eq('slot_id', extraSlot.slot_id).select().single()
                          if (error) { setMsg('❌ ' + error.message); return }
                          if (data && setSlots) {
                            setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                          }
                          setMsg(`✅ Custom Slot (${extraSlot.time_label}) CLOSED to new registrations`)
                        }}
                      >
                        {isExtraClosed ? '🔒 Closed' : '🔒 Close Slot'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          width: '100%',
                          minHeight: '40px',
                          background: '#1a1a1a',
                          color: '#d1d5db',
                          border: '1px solid #404040',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          padding: '0.5rem 0.35rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={async () => {
                          if (extraSlot.teams_booked_count > 0) {
                            const ok = confirm(`This custom slot has ${extraSlot.teams_booked_count} bookings. Mark Not Open and delete?`)
                            if (!ok) return
                          }
                          const { error } = await supabase.from('slots').delete().eq('slot_id', extraSlot.slot_id)
                          if (error) { setMsg('❌ ' + error.message); return }
                          if (setSlots) {
                            setSlots((prev: any[]) => prev.filter((s: any) => s.slot_id !== extraSlot.slot_id))
                          }
                          setMsg(`✅ Custom Slot (${extraSlot.time_label}) turned disabled / NOT OPEN`)
                        }}
                      >
                        🚫 Not Open
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          width: '100%',
                          minHeight: '40px',
                          background: isExtraCompleted ? 'rgba(251, 191, 36, 0.18)' : '#8b5cf6',
                          color: isExtraCompleted ? '#fbbf24' : '#ffffff',
                          border: isExtraCompleted ? '1px solid #fbbf24' : 'none',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          padding: '0.5rem 0.35rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={async () => {
                          const nextStatus = isExtraCompleted ? 'open' : 'completed'
                          const { data } = await supabase.from('slots').update({ status: nextStatus }).eq('slot_id', extraSlot.slot_id).select().single()
                          if (data && setSlots) {
                            setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                          }
                          setMsg(`✅ Custom Slot status set to ${nextStatus.toUpperCase()}`)
                          if (nextStatus === 'completed' && onSyncPayouts) onSyncPayouts()
                        }}
                      >
                        {isExtraCompleted ? '↩️ Revert Open' : '🏆 Complete'}
                      </button>
                    </div>

                    {/* Expandable Custom Slot drawer */}
                    {isCustomExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #222222', paddingTop: '0.85rem' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                            Slot Label:
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                            defaultValue={extraSlot.time_label}
                            onBlur={async (e) => {
                              const newLabel = e.target.value.trim()
                              if (!newLabel || newLabel === extraSlot.time_label) return
                              const { data, error } = await supabase.from('slots').update({ time_label: newLabel }).eq('slot_id', extraSlot.slot_id).select().single()
                              if (error) { setMsg('❌ ' + error.message); return }
                              if (data && setSlots) {
                                setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                              }
                              setMsg(`✅ Updated time label to ${newLabel}`)
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                            WhatsApp Group Link:
                          </label>
                          <input
                            type="url"
                            className="form-input"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                            defaultValue={extraSlot.whatsapp_link || ''}
                            placeholder="https://chat.whatsapp.com/..."
                            onBlur={async (e) => {
                              const newLink = e.target.value.trim()
                              const { data, error } = await supabase.from('slots').update({ whatsapp_link: newLink || null }).eq('slot_id', extraSlot.slot_id).select().single()
                              if (error) { setMsg('❌ ' + error.message); return }
                              if (data && setSlots) {
                                setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                              }
                              setMsg(`✅ Updated WhatsApp link`)
                            }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                              Entry Fee (₹):
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                              defaultValue={extraSlot.entry_fee || 40}
                              onBlur={async (e) => {
                                const newFee = parseInt(e.target.value) || 0
                                const { data } = await supabase.from('slots').update({ entry_fee: newFee }).eq('slot_id', extraSlot.slot_id).select().single()
                                if (data && setSlots) {
                                  setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: '#aaaaaa', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                              Capacity:
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                              defaultValue={extraSlot.capacity || 20}
                              onBlur={async (e) => {
                                const newCap = parseInt(e.target.value) || 20
                                const { data } = await supabase.from('slots').update({ capacity: newCap }).eq('slot_id', extraSlot.slot_id).select().single()
                                if (data && setSlots) {
                                  setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.1fr', gap: '0.45rem', background: '#18181b', padding: '0.5rem', borderRadius: '8px', border: '1px solid #27272a' }}>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: '#facc15', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                              🥇 1st Prize (₹):
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', borderColor: '#854d0e', background: '#09090b' }}
                              defaultValue={extraSlot.first_prize ?? defaultFirstPrize}
                              onBlur={async (e) => {
                                const newPrize = parseInt(e.target.value) || 0
                                const { data } = await supabase.from('slots').update({ first_prize: newPrize }).eq('slot_id', extraSlot.slot_id).select().single()
                                if (data && setSlots) {
                                  setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                              🥈 2nd Prize (₹):
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', borderColor: '#475569', background: '#09090b' }}
                              defaultValue={extraSlot.second_prize ?? defaultSecondPrize}
                              onBlur={async (e) => {
                                const newPrize = parseInt(e.target.value) || 0
                                const { data } = await supabase.from('slots').update({ second_prize: newPrize }).eq('slot_id', extraSlot.slot_id).select().single()
                                if (data && setSlots) {
                                  setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                              🥉 3rd Prize (₹):
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', borderColor: '#b45309', background: '#09090b' }}
                              defaultValue={extraSlot.third_prize ?? defaultThirdPrize}
                              onBlur={async (e) => {
                                const newPrize = parseInt(e.target.value) || 0
                                await persistSlotPrizeOverride(extraSlot.slot_id, extraSlot.first_prize ?? defaultFirstPrize, extraSlot.second_prize ?? defaultSecondPrize, newPrize)
                                if (setSlots) {
                                  setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === extraSlot.slot_id ? { ...s, third_prize: newPrize } : s))
                                }
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700, marginBottom: '2px', display: 'block' }}>
                              🎟️ 4th Prize:
                            </label>
                            <div
                              style={{
                                padding: '0.35rem 0.5rem',
                                fontSize: '0.74rem',
                                background: 'rgba(74, 222, 128, 0.1)',
                                color: '#4ade80',
                                border: '1px dashed #16a34a',
                                borderRadius: '6px',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                textAlign: 'center'
                              }}
                              title="4th Prize is an automated Free Slot Pass coupon"
                            >
                              🎟️ Free Slot
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            background: '#1a1a1a',
                            color: '#9ca3af',
                            borderColor: '#333333',
                            marginTop: '0.25rem',
                          }}
                          onClick={() => toggleCustomSlotExpand(extraSlot.slot_id)}
                        >
                          ▲ Collapse Details
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── OFFICIAL PAYOUT SLIP MODAL ───────────────────────────────────────
function PayoutSlipModal({
  slip,
  onClose,
  onEdit,
}: {
  slip: any;
  onClose: () => void;
  onEdit?: (slip: any) => void;
}) {
  const [copied, setCopied] = useState(false)
  if (!slip) return null

  const slipCode = `BGFS-PAY-${(slip.payout_id || '').slice(0, 8).toUpperCase()}`
  const dateFormatted = slip.paid_at ? formatNumericDate(slip.paid_at) : '—'
  const slotFormatted = slip.slots ? `${formatShortDate(slip.slots.date)} • ${slip.slots.time_label}` : '—'
  const displayPlace = slip.place || (slip.amount === 60 ? '3rd' : null)

  function copySlipText() {
    const text = `=== BGFS OFFICIAL PAYOUT SLIP ===\nSlip Reference: ${slipCode}\nTeam: ${slip.teams?.team_name || 'N/A'}\nSlot: ${slotFormatted}\nStanding: ${displayPlace || 'Participant'}\nAmount: ₹${slip.amount}\nUPI ID: ${slip.upi_id || 'N/A'}\nStatus: ${slip.status === 'paid' ? 'PAID OUT' : 'PENDING'}\nPaid On: ${dateFormatted}\n=================================`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#121212',
          border: '1px solid #333',
          borderRadius: '14px',
          padding: '1.75rem',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.9)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed #333', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#facc15', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Battlegrounds Faceoff Series
            </div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
              Official Payout Slip
            </h3>
            <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#888', marginTop: '2px' }}>
              {slipCode}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Amount Hero */}
        <div style={{
          background: slip.status === 'paid'
            ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(21,128,61,0.25))'
            : 'linear-gradient(135deg, rgba(250,204,21,0.15), rgba(161,98,7,0.25))',
          border: slip.status === 'paid' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(250,204,21,0.3)',
          borderRadius: '10px',
          padding: '1.2rem',
          textAlign: 'center',
          marginBottom: '1.25rem',
        }}>
          <div style={{ fontSize: '0.75rem', color: slip.status === 'paid' ? '#86efac' : '#fde047', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {slip.status === 'paid' ? 'TOTAL AMOUNT DISBURSED' : 'PENDING DISBURSEMENT'}
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: slip.status === 'paid' ? '#4ade80' : '#facc15', margin: '4px 0' }}>
            ₹{slip.amount}
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: slip.status === 'paid' ? 'rgba(34,197,94,0.25)' : 'rgba(250,204,21,0.25)',
            color: slip.status === 'paid' ? '#22c55e' : '#facc15',
            padding: '3px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 800
          }}>
            {slip.status === 'paid' ? '✓ STATUS: PAID OUT' : '⏳ STATUS: PENDING'}
          </div>
        </div>

        {/* Details Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '1rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
            <span style={{ color: '#888' }}>Recipient Team:</span>
            <strong style={{ color: '#fff' }}>{slip.teams?.team_name || '—'}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
            <span style={{ color: '#888' }}>Tournament Slot:</span>
            <span style={{ color: '#ddd' }}>{slotFormatted}</span>
          </div>

          {displayPlace && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
              <span style={{ color: '#888' }}>Final Standing:</span>
              <span className={`badge ${displayPlace === '1st' ? 'badge-gold' : displayPlace === '2nd' ? 'badge-silver' : 'badge-bronze'}`}>
                {displayPlace} Place
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
            <span style={{ color: '#888' }}>UPI ID (VPA):</span>
            <code style={{ color: slip.upi_id ? '#4ade80' : '#888', fontFamily: 'monospace' }}>
              {slip.upi_id || 'Not Recorded'}
            </code>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>{slip.status === 'paid' ? 'Paid On:' : 'Created On:'}</span>
            <span style={{ color: '#aaa' }}>{slip.status === 'paid' ? dateFormatted : (slip.created_at ? formatNumericDate(slip.created_at) : '—')}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={copySlipText}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              {copied ? 'Copied Details!' : 'Copy Slip Details'}
            </button>
            {onEdit && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onClose()
                  onEdit(slip)
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#facc15' }}
              >
                <Edit3 size={14} /> Edit Slip
              </button>
            )}
          </div>
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PAYOUTS TAB ──────────────────────────────────────────────────
function PayoutsTab({
  payouts,
  onPayoutSettled,
  onPayoutUpdated,
  onSyncPayouts,
}: {
  payouts: any[];
  onPayoutSettled: (payout: any) => void;
  onPayoutUpdated?: (payout: any) => void;
  onSyncPayouts?: () => Promise<void> | void;
}) {
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null)
  const [payoutTarget, setPayoutTarget] = useState<any | null>(null)
  const [payoutAmount, setPayoutAmount] = useState<string>('')
  const [payoutUpiId, setPayoutUpiId] = useState<string>('')
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false)
  const [payoutError, setPayoutError] = useState('')

  // Edit Slip State
  const [editingSlip, setEditingSlip] = useState<any | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editUpiId, setEditUpiId] = useState('')
  const [editPlace, setEditPlace] = useState('')
  const [editStatus, setEditStatus] = useState('pending')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  // Deduplicate by slot_id and team_id so duplicate records can never appear in UI
  const pendingMap = new Map<string, any>()
  payouts.filter(p => p.status === 'pending').forEach(p => {
    const key = `${p.slot_id}_${p.team_id}`
    if (!pendingMap.has(key)) {
      pendingMap.set(key, p)
    }
  })
  const pending = Array.from(pendingMap.values())

  const paidMap = new Map<string, any>()
  payouts.filter(p => p.status === 'paid').forEach(p => {
    const key = `${p.slot_id}_${p.team_id}`
    if (!paidMap.has(key)) {
      paidMap.set(key, p)
    }
  })
  const paid = Array.from(paidMap.values())

  function openPayoutPrompt(p: any) {
    setPayoutTarget({
      payout_id: p.payout_id,
      team_id: p.team_id,
      team_name: p.teams?.team_name || 'Team',
      rank: p.place === '1st' ? 1 : p.place === '2nd' ? 2 : 3,
      place: p.place,
      total_points: p.total_points,
      amount: p.amount,
      upi_id: p.upi_id,
      slot_id: p.slot_id,
      slots: p.slots,
    })
    setPayoutAmount(p.amount ? String(p.amount) : (p.place === '1st' ? '160' : p.place === '2nd' ? '80' : '60'))
    setPayoutUpiId(p.upi_id || '')
    setPayoutError('')
  }

  function openEditModal(p: any) {
    setEditingSlip(p)
    setEditAmount(String(p.amount ?? 0))
    setEditUpiId(p.upi_id || '')
    setEditPlace(p.place || (p.amount === 60 ? '3rd' : ''))
    setEditStatus(p.status || 'pending')
    setEditError('')
  }

  async function handleConfirmPayout() {
    if (!payoutTarget) return
    const amt = Number(payoutAmount)
    if (isNaN(amt) || amt <= 0) {
      setPayoutError('Please enter a valid payout amount greater than ₹0')
      return
    }

    setIsSubmittingPayout(true)
    setPayoutError('')

    try {
      const res = await fetch('/api/admin/payout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: payoutTarget.slot_id,
          team_id: payoutTarget.team_id,
          amount: amt,
          place: payoutTarget.place || (payoutTarget.rank === 1 ? '1st' : payoutTarget.rank === 2 ? '2nd' : '3rd'),
          upi_id: payoutUpiId.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record payout')
      }

      onPayoutSettled(data.payout)
      setPayoutTarget(null)
      setPayoutAmount('')
      setPayoutUpiId('')
      setSelectedSlip(data.payout)
    } catch (err: any) {
      setPayoutError(err.message || 'Error creating payout')
    } finally {
      setIsSubmittingPayout(false)
    }
  }

  async function handleSaveEdit() {
    if (!editingSlip) return
    const amt = Number(editAmount)
    if (isNaN(amt) || amt < 0) {
      setEditError('Please enter a valid amount (>= 0)')
      return
    }

    setEditLoading(true)
    setEditError('')
    try {
      const res = await fetch('/api/admin/payout/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payout_id: editingSlip.payout_id,
          amount: amt,
          upi_id: editUpiId.trim() || null,
          place: editPlace || null,
          status: editStatus,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update payout slip')
      }

      if (onPayoutUpdated) {
        onPayoutUpdated(data.payout)
      } else {
        onPayoutSettled(data.payout)
      }

      if (selectedSlip?.payout_id === data.payout.payout_id) {
        setSelectedSlip(data.payout)
      }
      setEditingSlip(null)
    } catch (err: any) {
      setEditError(err.message || 'Error updating payout')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleTriggerSync() {
    if (isSyncing) return
    setIsSyncing(true)
    setSyncMsg('')
    try {
      if (onSyncPayouts) {
        await onSyncPayouts()
      } else {
        await fetch('/api/admin/payout/sync-pending', { method: 'POST' })
      }
      setSyncMsg('✅ Payout slips synchronized successfully with latest standings & UPI details!')
      setTimeout(() => setSyncMsg(''), 4000)
    } catch (err: any) {
      setSyncMsg('❌ Failed to sync: ' + (err.message || 'Error'))
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <h2 className={styles.tabTitle} style={{ margin: 0 }}>Payouts</h2>
          <p className={styles.tabDesc} style={{ margin: '4px 0 0 0' }}>
            Track tournament prize disbursements, review settled payout slips, and disburse prizes to winners.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleTriggerSync}
          disabled={isSyncing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700 }}
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Syncing...' : '🔄 Re-sync Payouts'}
        </button>
      </div>

      {syncMsg && (
        <div style={{ padding: '0.65rem 1rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem', background: '#18181b', border: '1px solid #333', color: '#4ade80' }}>
          {syncMsg}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--surface-elevated, #18181b)',
          border: '1px solid var(--border-color, #27272a)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          flex: '1',
          minWidth: '160px',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>TOTAL DISBURSED</div>
          <div style={{ color: '#22c55e', fontSize: '1.3rem', fontWeight: 800 }}>
            ₹{paid.reduce((sum, p) => sum + (p.amount || 0), 0)}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{paid.length} payout slips settled</div>
        </div>

        <div style={{
          background: 'var(--surface-elevated, #18181b)',
          border: '1px solid var(--border-color, #27272a)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          flex: '1',
          minWidth: '160px',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>PENDING PAYOUTS</div>
          <div style={{ color: '#facc15', fontSize: '1.3rem', fontWeight: 800 }}>
            {pending.length}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Slot winners awaiting disbursement</div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className={styles.payoutSection}>
          <h3 className={styles.payoutSubhead}>⏳ Pending Payouts ({pending.length})</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Slot</th>
                  <th>Place</th>
                  <th>Amount</th>
                  <th>UPI ID</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(p => (
                  <tr key={p.payout_id}>
                    <td><strong>{p.teams?.team_name}</strong></td>
                    <td style={{ fontSize: '0.85rem', color: '#bbb' }}>
                      {p.slots ? `${formatShortDate(p.slots.date)} • ${p.slots.time_label}` : '—'}
                    </td>
                    <td>
                      {p.place || p.amount === 60 ? (
                        <span className={`badge ${p.place === '1st' ? 'badge-gold' : p.place === '2nd' ? 'badge-silver' : 'badge-bronze'}`}>
                          {p.place || '3rd'}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <strong style={{ color: '#facc15', fontSize: '0.9rem' }}>₹{p.amount}</strong>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.85rem', color: p.upi_id ? '#4ade80' : '#888' }}>
                        {p.upi_id || 'No UPI on file'}
                      </code>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <button
                          id={`mark-paid-${p.payout_id}`}
                          className="btn btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            padding: '6px 12px',
                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                            color: '#ffffff',
                            border: '1px solid rgba(74, 222, 128, 0.5)',
                            borderRadius: '6px',
                            boxShadow: '0 2px 10px rgba(34, 197, 94, 0.35)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => openPayoutPrompt(p)}
                        >
                          <CheckCircle size={14} color="#ffffff" strokeWidth={2.5} /> Mark Paid
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#facc15' }}
                          onClick={() => openEditModal(p)}
                          title="Edit Amount, UPI ID, or Place"
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <div className={styles.payoutSection} style={{ marginTop: '1.5rem' }}>
          <h3 className={styles.payoutSubhead}>✅ Settled Payout Slips ({paid.length})</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Slip ID</th>
                  <th>Team</th>
                  <th>Slot</th>
                  <th>Place</th>
                  <th>Amount</th>
                  <th>UPI ID</th>
                  <th>Paid On</th>
                  <th style={{ textAlign: 'center' }}>Receipt & Actions</th>
                </tr>
              </thead>
              <tbody>
                {paid.map(p => (
                  <tr key={p.payout_id}>
                    <td>
                      <code style={{ fontSize: '0.78rem', color: '#facc15', fontWeight: 700 }}>
                        #{(p.payout_id || '').slice(0, 8).toUpperCase()}
                      </code>
                    </td>
                    <td><strong>{p.teams?.team_name}</strong></td>
                    <td style={{ fontSize: '0.85rem', color: '#bbb' }}>
                      {p.slots ? `${formatShortDate(p.slots.date)} • ${p.slots.time_label}` : '—'}
                    </td>
                    <td>
                      {p.place || p.amount === 60 ? (
                        <span className={`badge ${p.place === '1st' ? 'badge-gold' : p.place === '2nd' ? 'badge-silver' : 'badge-bronze'}`}>
                          {p.place || '3rd'}
                        </span>
                      ) : '—'}
                    </td>
                    <td><strong style={{ color: '#22c55e', fontSize: '0.95rem' }}>₹{p.amount}</strong></td>
                    <td>
                      {p.upi_id ? (
                        <code style={{ fontSize: '0.8rem', color: '#ddd' }}>{p.upi_id}</code>
                      ) : (
                        <span style={{ color: '#777', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {p.paid_at ? formatNumericDate(p.paid_at) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => setSelectedSlip(p)}
                        >
                          🧾 View Slip
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#facc15' }}
                          onClick={() => openEditModal(p)}
                          title="Edit Amount, UPI, Place, or Status"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payouts.length === 0 && (
        <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
          No payouts yet. Complete a slot and mark teams as paid out from the UPI Info & Payouts tab.
        </p>
      )}

      {selectedSlip && (
        <PayoutSlipModal
          slip={selectedSlip}
          onClose={() => setSelectedSlip(null)}
          onEdit={(slip) => openEditModal(slip)}
        />
      )}

      {/* Payout Prompt Modal (Prompt for Amount & UPI ID) */}
      {payoutTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => !isSubmittingPayout && setPayoutTarget(null)}
        >
          <div
            style={{
              background: '#141414',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.85)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #252525', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                  Confirm & Settle Payout
                </h3>
              </div>
              <button
                onClick={() => !isSubmittingPayout && setPayoutTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Summary of recipient */}
              <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#888' }}>Team Name:</span>
                  <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>{payoutTarget.team_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#888' }}>Placement:</span>
                  <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem' }}>
                    {payoutTarget.place || `#${payoutTarget.rank}`} Place
                  </span>
                </div>
                {payoutTarget.slots && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', color: '#888' }}>Slot:</span>
                    <span style={{ color: '#ccc', fontSize: '0.82rem' }}>
                      {formatShortDate(payoutTarget.slots.date)} • {payoutTarget.slots.time_label}
                    </span>
                  </div>
                )}
              </div>

              {/* Amount Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#facc15', marginBottom: '6px' }}>
                  Payout Amount (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontWeight: 700, fontSize: '1rem' }}>₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Enter payout amount (e.g. 160)"
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      background: '#18181b',
                      border: '1px solid #3f3f46',
                      color: '#fff',
                      padding: '10px 12px 10px 30px',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* Editable UPI ID */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#4ade80', marginBottom: '6px' }}>
                  Recipient UPI ID (VPA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. captain@oksbi"
                  value={payoutUpiId}
                  onChange={e => setPayoutUpiId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    color: '#fff',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '4px', display: 'block' }}>
                  You can update or verify the UPI ID before completing disbursement.
                </span>
              </div>

              {payoutError && (
                <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '0.8rem' }}>
                  {payoutError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmittingPayout}
                  onClick={() => setPayoutTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={isSubmittingPayout || !payoutAmount || Number(payoutAmount) <= 0}
                  onClick={handleConfirmPayout}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: isSubmittingPayout || !payoutAmount || Number(payoutAmount) <= 0 ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingPayout || !payoutAmount || Number(payoutAmount) <= 0 ? 0.6 : 1,
                  }}
                >
                  {isSubmittingPayout ? 'Creating Slip...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payout Slip Modal */}
      {editingSlip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 100001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => !editLoading && setEditingSlip(null)}
        >
          <div
            style={{
              background: '#141414',
              border: '1px solid #333',
              borderRadius: '14px',
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.9)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #262626', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="#facc15" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                  Edit Payout Slip
                </h3>
              </div>
              <button
                onClick={() => !editLoading && setEditingSlip(null)}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 700 }}>
                  {editingSlip.teams?.team_name || 'Team'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '3px' }}>
                  {editingSlip.slots ? `${formatShortDate(editingSlip.slots.date)} • ${editingSlip.slots.time_label}` : '—'}
                </div>
                <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#666', marginTop: '2px' }}>
                  Ref: BGFS-PAY-{(editingSlip.payout_id || '').slice(0, 8).toUpperCase()}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#facc15', marginBottom: '4px' }}>
                  Payout Amount (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#4ade80', marginBottom: '4px' }}>
                  Recipient UPI ID (VPA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. captain@oksbi"
                  value={editUpiId}
                  onChange={e => setEditUpiId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    Standing / Place
                  </label>
                  <select
                    value={editPlace}
                    onChange={e => setEditPlace(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#18181b',
                      border: '1px solid #3f3f46',
                      color: '#fff',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="1st">1st Place</option>
                    <option value="2nd">2nd Place</option>
                    <option value="3rd">3rd Place</option>
                    <option value="">None / Custom</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    Payout Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#18181b',
                      border: '1px solid #3f3f46',
                      color: '#fff',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="paid">✅ Paid Out</option>
                  </select>
                </div>
              </div>

              {editError && (
                <div style={{ padding: '0.65rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '0.8rem' }}>
                  {editError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={editLoading}
                  onClick={() => setEditingSlip(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={editLoading || !editAmount || Number(editAmount) < 0}
                  onClick={handleSaveEdit}
                  style={{
                    background: '#22c55e',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: editLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── UPI INFO TAB ──────────────────────────────────────────────────
function UpiInfoTab({
  slots,
  payouts,
  onPayoutCreated
}: {
  slots: any[];
  payouts: any[];
  onPayoutCreated: (payout: any) => void
}) {
  const completedSlots = useMemo(() => {
    return sortSlotsDescending(slots.filter((s: any) => s.status === 'completed'))
  }, [slots])

  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => {
    const list = sortSlotsDescending(slots.filter((s: any) => s.status === 'completed'))
    return list.length > 0 ? list[0].slot_id : ''
  })

  // Automatically select the latest completed slot by default
  useEffect(() => {
    if (completedSlots.length > 0) {
      if (!selectedSlotId || !completedSlots.some((s: any) => s.slot_id === selectedSlotId)) {
        setSelectedSlotId(completedSlots[0].slot_id)
      }
    }
  }, [completedSlots, selectedSlotId])

  const [slotData, setSlotData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeUpiModal, setActiveUpiModal] = useState<any>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Payout prompt and slip states
  const [payoutTarget, setPayoutTarget] = useState<any | null>(null)
  const [payoutAmount, setPayoutAmount] = useState<string>('')
  const [payoutUpiId, setPayoutUpiId] = useState<string>('')
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false)
  const [payoutError, setPayoutError] = useState('')
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null)

  const currentSlot = useMemo(() => {
    return completedSlots.find((s: any) => s.slot_id === selectedSlotId) || null
  }, [completedSlots, selectedSlotId])

  useEffect(() => {
    if (!selectedSlotId) return
    setLoading(true)
    setError('')
    fetch(`/api/admin/upi-info?slot_id=${selectedSlotId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setSlotData(data)
        }
      })
      .catch(err => setError(err.message || 'Failed to load slot rankings'))
      .finally(() => setLoading(false))
  }, [selectedSlotId])

  function copyText(text: string, fieldKey: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 2000)
  }

  function openPayoutPrompt(team: any) {
    setPayoutTarget(team)
    const defaultAmt = team.rank === 1 ? 160 : team.rank === 2 ? 80 : team.rank === 3 ? 60 : 0
    setPayoutAmount(defaultAmt > 0 ? String(defaultAmt) : '')
    setPayoutUpiId(team.upi_id || '')
    setPayoutError('')
  }

  async function handleConfirmPayout() {
    if (!payoutTarget || !selectedSlotId) return
    const amt = Number(payoutAmount)
    if (isNaN(amt) || amt <= 0) {
      setPayoutError('Please enter a valid payout amount greater than ₹0')
      return
    }

    setIsSubmittingPayout(true)
    setPayoutError('')

    try {
      const res = await fetch('/api/admin/payout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlotId,
          team_id: payoutTarget.team_id,
          amount: amt,
          place: payoutTarget.rank === 1 ? '1st' : payoutTarget.rank === 2 ? '2nd' : payoutTarget.rank === 3 ? '3rd' : null,
          upi_id: payoutUpiId.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record payout')
      }

      const enrichedPayout = {
        ...data.payout,
        slots: data.payout.slots || (currentSlot ? { date: currentSlot.date, time_label: currentSlot.time_label } : null),
        teams: data.payout.teams || { team_name: payoutTarget.team_name },
      }

      onPayoutCreated(enrichedPayout)
      setPayoutTarget(null)
      setPayoutAmount('')
      setPayoutUpiId('')
      if (activeUpiModal?.team_id === payoutTarget.team_id) {
        setActiveUpiModal(null)
      }
      // Reveal the newly generated official payout slip
      setSelectedSlip(enrichedPayout)
    } catch (err: any) {
      setPayoutError(err.message || 'Error creating payout')
    } finally {
      setIsSubmittingPayout(false)
    }
  }

  const teams = slotData?.teams || []

  return (
    <div>
      <h2 className={styles.tabTitle}>UPI Info & Payouts</h2>
      <p className={styles.tabDesc}>
        Select a completed slot to inspect team standings, verify UPI holder details, and issue official payout slips.
      </p>

      {/* Completed Slot Selector */}
      <div style={{ background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '1.25rem', marginTop: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Select Completed Slot
        </label>
        <select
          value={selectedSlotId}
          onChange={e => setSelectedSlotId(e.target.value)}
          className="form-control"
          style={{
            maxWidth: '520px',
            background: '#1c1c1c',
            borderColor: '#383838',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '0.9rem',
          }}
        >
          {completedSlots.length === 0 ? (
            <option value="">No completed slots available</option>
          ) : (
            completedSlots.map((s: any) => (
              <option key={s.slot_id} value={s.slot_id}>
                📅 {formatShortDate(s.date)} • {s.time_label} {s.is_grand_finals ? '★ GRAND FINALS' : ''}
              </option>
            ))
          )}
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Loading slot match info & team UPI details...
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '8px', marginTop: '1.25rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && selectedSlotId && teams.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888', background: '#141414', borderRadius: '12px', border: '1px solid #222', marginTop: '1.5rem' }}>
          <p>No team match performances recorded for this slot yet.</p>
        </div>
      )}

      {!loading && !error && teams.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                  <th>Team</th>
                  <th>Match Scores</th>
                  <th style={{ textAlign: 'center' }}>Total Points</th>
                  <th>UPI Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t: any) => {
                  const hasUpi = Boolean(t.upi_id)
                  const isFirst = t.rank === 1
                  const isSecond = t.rank === 2
                  const isThird = t.rank === 3
                  const isTopTwo = isFirst || isSecond
                  const paidRecord = payouts.find((p: any) => p.slot_id === selectedSlotId && p.team_id === t.team_id && p.status === 'paid')

                  return (
                    <tr key={t.team_id} style={{ background: isFirst ? 'rgba(250, 204, 21, 0.05)' : undefined }}>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          background: isFirst ? '#fbbf24' : isSecond ? '#94a3b8' : isThird ? '#b45309' : '#222',
                          color: isFirst ? '#111' : isSecond ? '#111' : '#fff'
                        }}>
                          #{t.rank}
                        </span>
                      </td>
                      <td>
                        <strong>{t.team_name}</strong>
                        {t.room_slot_number && (
                          <div style={{ fontSize: '0.72rem', color: '#777' }}>Room Slot #{t.room_slot_number}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {t.matches.map((m: any) => (
                            <span
                              key={m.match_number}
                              style={{
                                fontSize: '0.72rem',
                                background: '#1c1c1c',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                color: '#ddd'
                              }}
                            >
                              M{m.match_number}: #{m.placement || '-'} ({m.total_points} pts)
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <strong style={{ fontSize: '1rem', color: isFirst ? '#fbbf24' : '#fff' }}>
                          {t.total_points}
                        </strong>
                      </td>
                      <td>
                        {hasUpi ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            color: '#4ade80',
                            background: 'rgba(74,222,128,0.1)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(74,222,128,0.25)',
                            fontWeight: 700
                          }}>
                            ✓ Available
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            color: '#f87171',
                            background: 'rgba(239,68,68,0.1)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(239,68,68,0.25)',
                            fontWeight: 700
                          }}>
                            ⚠️ Not Provided
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isTopTwo ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', padding: '4px 10px' }}
                              onClick={() => setActiveUpiModal(t)}
                              title="Reveal UPI ID & account details"
                            >
                              <Eye size={12} /> UPI Details
                            </button>

                            {paidRecord ? (
                              <button
                                className="btn btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.75rem',
                                  padding: '4px 10px',
                                  background: 'rgba(34,197,94,0.15)',
                                  color: '#4ade80',
                                  border: '1px solid rgba(74,222,128,0.35)',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                onClick={() => setSelectedSlip(paidRecord)}
                                title="Click to view official payout slip"
                              >
                                <CheckCircle size={12} /> Paid (₹{paidRecord.amount})
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  padding: '5px 12px',
                                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                  color: '#ffffff',
                                  border: '1px solid rgba(74, 222, 128, 0.5)',
                                  borderRadius: '6px',
                                  boxShadow: '0 2px 10px rgba(34, 197, 94, 0.35)',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                                onClick={() => openPayoutPrompt(t)}
                                title="Mark this team as paid out"
                              >
                                <CheckCircle size={13} color="#ffffff" strokeWidth={2.5} /> Mark as Paid Out
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#555', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UPI Details Modal (Reveals UPI ID only on click) */}
      {activeUpiModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setActiveUpiModal(null)}
        >
          <div
            style={{
              background: '#141414',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #252525', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#facc15" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                  UPI Details · {activeUpiModal.team_name}
                </h3>
              </div>
              <button
                onClick={() => setActiveUpiModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1c1c1c', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>Slot Placement:</span>
                <span style={{ fontWeight: 800, color: '#fbbf24' }}>#{activeUpiModal.rank} ({activeUpiModal.total_points} pts)</span>
              </div>

              {/* UPI ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>
                  UPI ID (VPA)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={activeUpiModal.upi_id || 'Not provided by team yet'}
                    style={{
                      flex: 1,
                      background: '#1c1c1c',
                      border: '1px solid #333',
                      color: activeUpiModal.upi_id ? '#fff' : '#888',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                    }}
                  />
                  {activeUpiModal.upi_id && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      onClick={() => copyText(activeUpiModal.upi_id, 'modal_upi')}
                    >
                      {copiedField === 'modal_upi' ? <Check size={14} /> : <Copy size={14} />}
                      {copiedField === 'modal_upi' ? 'Copied!' : 'Copy UPI'}
                    </button>
                  )}
                </div>
              </div>

              {/* Holder Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>
                  Account Holder Name
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={activeUpiModal.upi_holder_name || 'Not provided by team yet'}
                    style={{
                      flex: 1,
                      background: '#1c1c1c',
                      border: '1px solid #333',
                      color: activeUpiModal.upi_holder_name ? '#fff' : '#888',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                    }}
                  />
                  {activeUpiModal.upi_holder_name && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      onClick={() => copyText(activeUpiModal.upi_holder_name, 'modal_holder')}
                    >
                      {copiedField === 'modal_holder' ? <Check size={14} /> : <Copy size={14} />}
                      {copiedField === 'modal_holder' ? 'Copied!' : 'Copy Name'}
                    </button>
                  )}
                </div>
              </div>

              {!activeUpiModal.upi_id && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', fontSize: '0.78rem' }}>
                  ⚠️ This team has not entered their UPI details in their Profile page yet.
                </div>
              )}

              {/* Modal Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid #222', paddingTop: '1rem' }}>
                {(() => {
                  const modalPaid = payouts.find((p: any) => p.slot_id === selectedSlotId && p.team_id === activeUpiModal.team_id && p.status === 'paid')
                  if (modalPaid) {
                    return (
                      <button
                        className="btn btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.8rem',
                          background: 'rgba(34,197,94,0.15)',
                          color: '#4ade80',
                          border: '1px solid rgba(74,222,128,0.3)',
                          fontWeight: 700,
                        }}
                        onClick={() => {
                          setActiveUpiModal(null)
                          setSelectedSlip(modalPaid)
                        }}
                      >
                        <CheckCircle size={14} /> View Payout Slip (₹{modalPaid.amount})
                      </button>
                    )
                  }
                  return (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        padding: '7px 16px',
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        color: '#ffffff',
                        border: '1px solid rgba(74, 222, 128, 0.5)',
                        borderRadius: '6px',
                        boxShadow: '0 2px 10px rgba(34, 197, 94, 0.35)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const target = activeUpiModal
                        setActiveUpiModal(null)
                        openPayoutPrompt(target)
                      }}
                    >
                      <CheckCircle size={15} color="#ffffff" strokeWidth={2.5} /> Mark as Paid Out
                    </button>
                  )
                })()}

                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveUpiModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payout Prompt Modal (Prompt for Amount) */}
      {payoutTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => !isSubmittingPayout && setPayoutTarget(null)}
        >
          <div
            style={{
              background: '#141414',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.85)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #252525', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                  Mark as Paid Out
                </h3>
              </div>
              <button
                onClick={() => !isSubmittingPayout && setPayoutTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Summary of recipient */}
              <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#888' }}>Team Name:</span>
                  <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>{payoutTarget.team_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#888' }}>Placement:</span>
                  <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem' }}>
                    #{payoutTarget.rank} Place ({payoutTarget.total_points} pts)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#888' }}>UPI ID:</span>
                  <span style={{ fontFamily: 'monospace', color: payoutTarget.upi_id ? '#4ade80' : '#f87171', fontSize: '0.85rem', fontWeight: 700 }}>
                    {payoutTarget.upi_id || 'Not Provided'}
                  </span>
                </div>
                {payoutTarget.upi_holder_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', color: '#888' }}>Holder Name:</span>
                    <span style={{ color: '#ddd', fontSize: '0.85rem' }}>{payoutTarget.upi_holder_name}</span>
                  </div>
                )}
              </div>

              {/* Amount Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#facc15', marginBottom: '6px' }}>
                  Payout Amount (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontWeight: 700, fontSize: '1rem' }}>₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Enter payout amount (e.g. 500)"
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      background: '#18181b',
                      border: '1px solid #3f3f46',
                      color: '#fff',
                      padding: '10px 12px 10px 30px',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* Editable UPI ID */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#4ade80', marginBottom: '6px' }}>
                  Recipient UPI ID (VPA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. captain@oksbi"
                  value={payoutUpiId}
                  onChange={e => setPayoutUpiId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    color: '#fff',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '4px', display: 'block' }}>
                  You can update or verify the UPI ID before completing disbursement.
                </span>
              </div>

              {payoutError && (
                <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '0.8rem' }}>
                  {payoutError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmittingPayout}
                  onClick={() => setPayoutTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={isSubmittingPayout || !payoutAmount || Number(payoutAmount) <= 0}
                  onClick={handleConfirmPayout}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: isSubmittingPayout || !payoutAmount || Number(payoutAmount) <= 0 ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingPayout || !payoutAmount || Number(payoutAmount) <= 0 ? 0.6 : 1,
                  }}
                >
                  {isSubmittingPayout ? 'Creating Slip...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Payout Slip Modal */}
      {selectedSlip && (
        <PayoutSlipModal slip={selectedSlip} onClose={() => setSelectedSlip(null)} />
      )}
    </div>
  )
}

// ── MIGRATE SLOT MODAL ───────────────────────────────────────────
function MigrateSlotModal({
  booking,
  slots,
  onClose,
  onSuccess,
}: {
  booking: any
  slots: any[]
  onClose: () => void
  onSuccess: (data: any) => void
}) {
  const teamName = booking.teams?.team_name || 'Selected Team'
  const currentSlotDate = booking.slots?.date ? formatNumericDate(booking.slots.date) : '—'
  const currentSlotTime = booking.slots?.time_label || '—'
  const currentRoomSlot = booking.room_slot_number || 5

  // Filter valid upcoming target slots:
  // - Exclude current slot
  // - Exclude completed slots
  // - Sort chronologically by date and time
  const availableSlots = useMemo(() => {
    return [...slots]
      .filter(s => s.slot_id !== booking.slot_id && s.status !== 'completed')
      .sort((a, b) => {
        const comp = String(a.date).localeCompare(String(b.date))
        if (comp !== 0) return comp
        return getSlotStartMinutes(a.time_label) - getSlotStartMinutes(b.time_label)
      })
  }, [slots, booking.slot_id])

  // Pick first open slot by default
  const defaultTargetSlot = availableSlots.find(s => {
    const spots = (s.capacity || 20) - (s.teams_booked_count || 0)
    return s.status !== 'full' && spots > 0
  })

  const [selectedSlotId, setSelectedSlotId] = useState(defaultTargetSlot?.slot_id || (availableSlots[0]?.slot_id || ''))
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const selectedSlot = useMemo(() => {
    return availableSlots.find(s => s.slot_id === selectedSlotId)
  }, [availableSlots, selectedSlotId])

  const spotsLeft = selectedSlot ? Math.max(0, (selectedSlot.capacity || 20) - (selectedSlot.teams_booked_count || 0)) : 0
  const isFull = !selectedSlot || selectedSlot.status === 'full' || spotsLeft <= 0

  async function handleConfirm() {
    if (!selectedSlotId) {
      setErrorMsg('Please select a valid target slot')
      return
    }
    if (isFull) {
      setErrorMsg('Selected slot is full. Please select an open slot.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/bookings/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.booking_id,
          new_slot_id: selectedSlotId,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to migrate slot')
      }
      onSuccess(data)
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during slot migration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#121214',
          border: '1px solid #27272a',
          borderRadius: '14px',
          padding: '1.5rem',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #27272a', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
            }}>
              <Repeat size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                Migrate Team Slot
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Transfer registration safely with zero downtime
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Booking Info Card */}
        <div style={{
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Target Team
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.75rem' }}>
            {teamName}
            {booking.is_test_booking && (
              <span style={{
                background: '#a855f7',
                color: '#fff',
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '4px',
                marginLeft: '8px',
              }}>
                TEST
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#202024', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>CURRENT SLOT</span>
              <strong style={{ color: '#e4e4e7' }}>{currentSlotDate}</strong>
              <div style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>{currentSlotTime}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>ROOM SLOT NUMBER</span>
              <strong style={{ color: '#facc15' }}>Slot #{currentRoomSlot}</strong>
              <div style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>Status: {booking.payment_status}</div>
            </div>
          </div>
        </div>

        {/* Target Slot Selection */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.5rem' }}>
            Select New Slot
          </label>
          <select
            value={selectedSlotId}
            onChange={e => setSelectedSlotId(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.875rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {availableSlots.map(s => {
              const cap = s.capacity || 20
              const booked = s.teams_booked_count || 0
              const freeSpots = Math.max(0, cap - booked)
              const isSlotFull = s.status === 'full' || freeSpots <= 0
              return (
                <option key={s.slot_id} value={s.slot_id} disabled={isSlotFull}>
                  {formatNumericDate(s.date)} · {s.time_label} {isSlotFull ? '(FULL - 0 spots)' : `(${freeSpots} spots left)`}
                </option>
              )
            })}
          </select>
          {availableSlots.length === 0 && (
            <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
              No other active slots found.
            </div>
          )}
        </div>

        {/* Safeguard Assurance Box */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
          padding: '0.85rem',
          fontSize: '0.75rem',
          color: '#93c5fd',
          lineHeight: '1.4',
          marginBottom: '1.25rem',
        }}>
          <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={14} /> Safe Migration Active
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#bfdbfe' }}>
            <li>Frees 1 spot in old slot ({currentSlotDate})</li>
            <li>Reserves 1 spot in new slot and assigns new Room Slot #</li>
            <li>Team dashboard &amp; WhatsApp link update automatically</li>
            <li>Original payment details stay completely safe</li>
          </ul>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '0.75rem',
            color: '#fca5a5',
            fontSize: '0.8rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.65rem 1.25rem',
              background: '#27272a',
              border: 'none',
              borderRadius: '8px',
              color: '#a1a1aa',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !selectedSlotId || isFull}
            style={{
              padding: '0.65rem 1.4rem',
              background: loading || isFull ? '#3f3f46' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: loading || isFull ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="spin" /> Migrating...
              </>
            ) : (
              <>
                <Repeat size={14} /> Confirm Migration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── BOOKINGS TAB ─────────────────────────────────────────────────
function BookingsTab({
  bookings,
  setBookings,
  slots,
  setSlots,
}: {
  bookings: any[]
  setBookings: React.Dispatch<React.SetStateAction<any[]>>
  slots: any[]
  setSlots: React.Dispatch<React.SetStateAction<any[]>>
}) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDate, setFilterDate] = useState('all')
  const [migrationTarget, setMigrationTarget] = useState<any | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const realBookings = bookings.filter(b => !b.is_test_booking)
  const testBookings = bookings.filter(b => b.is_test_booking)
  const realRevenue = realBookings.reduce((sum, b) => sum + (b.coupon_used ? 0 : (b.amount_paid || 40)), 0)

  // Get unique slot dates present in bookings for filter dropdown
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>()
    bookings.forEach(b => {
      if (b.slots?.date) dates.add(b.slots.date)
    })
    return Array.from(dates).sort()
  }, [bookings])

  // Filter bookings by search and date
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (filterDate !== 'all' && b.slots?.date !== filterDate) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const teamName = (b.teams?.team_name || '').toLowerCase()
        const timeLabel = (b.slots?.time_label || '').toLowerCase()
        const dateStr = (b.slots?.date || '').toLowerCase()
        if (!teamName.includes(q) && !timeLabel.includes(q) && !dateStr.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [bookings, filterDate, searchQuery])

  function handleMigrationSuccess(data: any) {
    // 1. Update bookings in state
    setBookings(prev => prev.map(b => {
      if (b.booking_id === data.booking_id) {
        return {
          ...b,
          slot_id: data.new_slot_id,
          room_slot_number: data.new_room_slot_number,
          slots: {
            ...b.slots,
            date: data.new_slot.date,
            time_label: data.new_slot.time_label,
            whatsapp_link: data.new_slot.whatsapp_link,
          }
        }
      }
      return b
    }))

    // 2. Update slots in state (decrement old, increment new)
    setSlots(prev => prev.map(s => {
      if (s.slot_id === data.old_slot_id) {
        const newCount = Math.max(0, (s.teams_booked_count || 1) - 1)
        return {
          ...s,
          teams_booked_count: newCount,
          status: s.status === 'full' ? 'open' : s.status,
        }
      }
      if (s.slot_id === data.new_slot_id) {
        const newCount = (s.teams_booked_count || 0) + 1
        const isFull = newCount >= (s.capacity || 20)
        return {
          ...s,
          teams_booked_count: newCount,
          status: isFull ? 'full' : s.status,
        }
      }
      return s
    }))

    setFeedbackMsg({ text: data.message, type: 'success' })
    setMigrationTarget(null)
    router.refresh()

    setTimeout(() => {
      setFeedbackMsg(null)
    }, 5000)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className={styles.tabTitle}>Bookings</h2>
          <p className={styles.tabDesc}>All slot bookings with 1-click safe slot migration. Test account bookings are isolated.</p>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{
          marginTop: '1rem',
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          background: feedbackMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedbackMsg.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: feedbackMsg.type === 'success' ? '#86efac' : '#fca5a5',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <CheckCircle size={16} />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Financial & Count Summary */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginTop: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{
          background: 'var(--surface-elevated, #18181b)',
          border: '1px solid var(--border-color, #27272a)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          flex: '1',
          minWidth: '160px',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>REAL REVENUE</div>
          <div style={{ color: '#22c55e', fontSize: '1.25rem', fontWeight: 800 }}>₹{realRevenue}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Excludes test mode &amp; free rewards</div>
        </div>

        <div style={{
          background: 'var(--surface-elevated, #18181b)',
          border: '1px solid var(--border-color, #27272a)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          flex: '1',
          minWidth: '160px',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>PAID BOOKINGS</div>
          <div style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 800 }}>{realBookings.length}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Real player registrations</div>
        </div>

        <div style={{
          background: 'var(--surface-elevated, #18181b)',
          border: '1px solid #c084fc',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          flex: '1',
          minWidth: '160px',
        }}>
          <div style={{ color: '#d8b4fe', fontSize: '0.75rem', fontWeight: 600 }}>TEST MODE BOOKINGS</div>
          <div style={{ color: '#c084fc', fontSize: '1.25rem', fontWeight: 800 }}>{testBookings.length}</div>
          <div style={{ color: '#d8b4fe', fontSize: '0.7rem' }}>Bypassed payments (Isolated)</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '220px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by team name or slot..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.85rem',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={15} color="var(--text-muted)" />
          <select
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{
              background: '#202024',
              border: '1px solid #3f3f46',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.8rem',
              padding: '0.4rem 0.75rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Dates ({bookings.length})</option>
            {uniqueDates.map(d => (
              <option key={d} value={d}>{formatNumericDate(d)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrapper" style={{ marginTop: '0.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Slot Date</th>
              <th>Slot Time</th>
              <th>Room Slot</th>
              <th>Status / Mode</th>
              <th>Coupon Used</th>
              <th>Booked At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map(b => (
              <tr key={b.booking_id} style={b.is_test_booking ? { background: 'rgba(168, 85, 247, 0.05)' } : undefined}>
                <td>
                  <strong>{b.teams?.team_name}</strong>
                  {b.is_test_booking && (
                    <span style={{
                      background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginLeft: '8px',
                      letterSpacing: '0.05em',
                      display: 'inline-block',
                    }}>
                      TEST
                    </span>
                  )}
                </td>
                <td>{b.slots?.date ? formatNumericDate(b.slots.date) : '—'}</td>
                <td style={{ fontSize: '0.85rem' }}>{b.slots?.time_label || '—'}</td>
                <td>
                  <span style={{
                    background: '#27272a',
                    border: '1px solid #3f3f46',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#facc15',
                  }}>
                    Slot #{b.room_slot_number || 5}
                  </span>
                </td>
                <td>
                  <span className="badge badge-success">{b.payment_status}</span>
                  {b.is_test_booking && (
                    <span style={{ color: '#c084fc', fontSize: '0.75rem', marginLeft: '6px', fontWeight: 600 }}>
                      (Test Mode)
                    </span>
                  )}
                </td>
                <td>
                  {b.coupon_used
                    ? <span className="badge badge-info">Coupon Applied</span>
                    : <span className="badge badge-neutral">No</span>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }} title={b.created_at ? formatNumericDateTime(b.created_at, true) : undefined}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main, #f4f4f5)' }}>
                    {formatNumericDate(b.created_at) || '—'}
                  </div>
                  {b.created_at && formatTime(b.created_at, true) ? (
                    <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '1px' }}>
                      {formatTime(b.created_at, true)}
                    </div>
                  ) : null}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setMigrationTarget(b)}
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#fbbf24',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)'
                      e.currentTarget.style.borderColor = '#f59e0b'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'
                      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    <Repeat size={13} /> Migrate
                  </button>
                </td>
              </tr>
            ))}
            {filteredBookings.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  {searchQuery || filterDate !== 'all' ? 'No matching bookings found' : 'No bookings yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Migration Modal */}
      {migrationTarget && (
        <MigrateSlotModal
          booking={migrationTarget}
          slots={slots}
          onClose={() => setMigrationTarget(null)}
          onSuccess={handleMigrationSuccess}
        />
      )}
    </div>
  )
}

// ── PENDING BOOKINGS TAB ──────────────────────────────────────────
function PendingBookingsTab({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterReason, setFilterReason] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const fetchPending = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/bookings/pending')
      const data = await res.json()
      if (data.bookings) {
        setList(data.bookings)
        if (onCountChange) onCountChange(data.bookings.length)
      }
    } catch (e) {
      console.error('Failed to fetch pending bookings', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [onCountChange])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  // Unique dates for filter
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>()
    list.forEach(b => {
      if (b.slot_date && b.slot_date !== '—') dates.add(b.slot_date)
    })
    return Array.from(dates).sort().reverse()
  }, [list])

  // Filtered list
  const filteredList = useMemo(() => {
    return list.filter(b => {
      if (filterReason !== 'all' && b.reason_category !== filterReason) return false
      if (filterDate !== 'all' && b.slot_date !== filterDate) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const teamName = (b.team_name || '').toLowerCase()
        const email = (b.captain_email || '').toLowerCase()
        const id = (b.booking_id || '').toLowerCase()
        const time = (b.slot_time || '').toLowerCase()
        if (!teamName.includes(q) && !email.includes(q) && !id.includes(q) && !time.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [list, filterReason, filterDate, searchQuery])

  // Metric counts
  const totalCount = list.length
  const todayStr = getTodayStr()
  const todayCount = list.filter(b => b.slot_date === todayStr).length
  const recentCount = list.filter(b => b.reason_category === 'in_progress').length
  const supersededCount = list.filter(b => b.reason_category === 'superseded').length

  async function handleConfirmManual(bookingId: string, teamName: string) {
    if (!window.confirm(`Are you sure you want to manually mark the booking for "${teamName}" as PAID?\nThis will allocate a room slot number and add them to the official match roster.`)) {
      return
    }
    setActionLoadingId(bookingId)
    setFeedbackMsg(null)
    try {
      const res = await fetch('/api/admin/bookings/confirm-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedbackMsg({ text: data.error || 'Failed to confirm booking', type: 'error' })
        return
      }
      setList(prev => {
        const next = prev.filter(b => b.booking_id !== bookingId)
        if (onCountChange) onCountChange(next.length)
        return next
      })
      setFeedbackMsg({ text: data.message || `Booking for ${teamName} confirmed!`, type: 'success' })
    } catch (e: any) {
      setFeedbackMsg({ text: e.message || 'Error confirming booking', type: 'error' })
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleCancelBooking(bookingId: string, teamName: string) {
    if (!window.confirm(`Are you sure you want to discard this pending booking for "${teamName}"?`)) {
      return
    }
    setActionLoadingId(bookingId)
    setFeedbackMsg(null)
    try {
      const res = await fetch('/api/admin/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedbackMsg({ text: data.error || 'Failed to cancel booking', type: 'error' })
        return
      }
      setList(prev => {
        const next = prev.filter(b => b.booking_id !== bookingId)
        if (onCountChange) onCountChange(next.length)
        return next
      })
      setFeedbackMsg({ text: data.message || `Pending booking for ${teamName} discarded.`, type: 'success' })
    } catch (e: any) {
      setFeedbackMsg({ text: e.message || 'Error cancelling booking', type: 'error' })
    } finally {
      setActionLoadingId(null)
    }
  }

  function getReasonBadge(b: any) {
    if (b.reason_category === 'superseded') {
      return (
        <div>
          <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.35)', fontWeight: 800 }}>
            ✓ Superseded by Paid
          </span>
          <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '3px' }}>
            {b.reason_details}
          </div>
        </div>
      )
    }
    if (b.reason_category === 'in_progress') {
      return (
        <div>
          <span className="badge" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.35)', fontWeight: 800 }}>
            ⏳ Recent Attempt (&lt;15m)
          </span>
          <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: '3px' }}>
            {b.reason_details}
          </div>
        </div>
      )
    }
    if (b.reason_category === 'full') {
      return (
        <div>
          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', fontWeight: 800 }}>
            🚫 Slot Full
          </span>
          <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '3px' }}>
            {b.reason_details}
          </div>
        </div>
      )
    }
    if (b.reason_category === 'closed') {
      return (
        <div>
          <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.35)', fontWeight: 700 }}>
            🔒 Slot Closed
          </span>
          <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '3px' }}>
            {b.reason_details}
          </div>
        </div>
      )
    }
    return (
      <div>
        <span className="badge" style={{ background: 'rgba(113, 113, 122, 0.2)', color: '#d4d4d8', border: '1px solid rgba(113, 113, 122, 0.4)', fontWeight: 700 }}>
          ⚠️ Checkout Abandoned
        </span>
        <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '3px' }}>
          {b.reason_details}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <h2 className={styles.tabTitle} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Pending Match Registrations
            {totalCount > 0 && (
              <span style={{ fontSize: '0.8rem', background: '#eab308', color: '#000', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                {totalCount}
              </span>
            )}
          </h2>
          <p className={styles.tabDesc} style={{ margin: '4px 0 0 0' }}>
            Inspect abandoned or incomplete registrations. Cross-verify manual UPI payments directly with players via WhatsApp.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchPending}
          disabled={refreshing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh Pending'}
        </button>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          margin: '0.75rem 0',
          background: feedbackMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedbackMsg.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: feedbackMsg.type === 'success' ? '#4ade80' : '#f87171',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── METRIC STATS SUMMARY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', margin: '1rem 0 1.25rem 0' }}>
        <div style={{ background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Pending</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', marginTop: '3px' }}>{totalCount}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Today's Matches</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginTop: '3px' }}>{todayCount}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Recent (&lt; 15 mins)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#60a5fa', marginTop: '3px' }}>{recentCount}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Superseded (Paid Later)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4ade80', marginTop: '3px' }}>{supersededCount}</div>
        </div>
      </div>

      {/* ── SEARCH & FILTERS ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ flex: '1', minWidth: '220px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search team, email, slot time..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', width: '100%' }}
          />
        </div>

        <select
          className="form-input"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          style={{ minWidth: '150px' }}
        >
          <option value="all">📅 All Dates</option>
          {uniqueDates.map(d => (
            <option key={d} value={d}>{formatNumericDate(d)}</option>
          ))}
        </select>

        <select
          className="form-input"
          value={filterReason}
          onChange={e => setFilterReason(e.target.value)}
          style={{ minWidth: '180px' }}
        >
          <option value="all">🔍 All Diagnostics</option>
          <option value="in_progress">⏳ Recent (&lt; 15m)</option>
          <option value="abandoned">⚠️ Checkout Abandoned</option>
          <option value="superseded">✓ Superseded by Paid</option>
          <option value="full">🚫 Slot Full</option>
          <option value="closed">🔒 Slot Closed</option>
        </select>
      </div>

      {/* ── TABLE ── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Team &amp; Captain</th>
              <th>Target Slot</th>
              <th>Entry Fee</th>
              <th>Attempt Time</th>
              <th>Diagnostic Reason</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#888' }}>
                  Loading pending registrations...
                </td>
              </tr>
            ) : filteredList.length > 0 ? (
              filteredList.map(b => (
                <tr key={b.booking_id}>
                  <td>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: '#fff' }}>
                        {b.team_name}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: '#a1a1aa', marginTop: '2px' }}>
                        👤 {b.captain_name} • <span style={{ color: '#93c5fd' }}>{b.captain_email}</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24' }}>
                        📅 {formatNumericDate(b.slot_date)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#ccc', marginTop: '1px' }}>
                        ⏰ {b.slot_time}
                      </div>
                    </div>
                  </td>

                  <td>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#facc15' }}>
                      ₹{b.slot_entry_fee}
                    </span>
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }} title={b.created_at ? formatNumericDateTime(b.created_at, true) : undefined}>
                    <div style={{ fontSize: '0.82rem', color: '#f4f4f5', fontWeight: 600 }}>
                      {formatNumericDate(b.created_at) || '—'}
                    </div>
                    {b.created_at && formatTime(b.created_at, true) ? (
                      <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '1px' }}>
                        {formatTime(b.created_at, true)}
                      </div>
                    ) : null}
                    <div style={{ fontSize: '0.72rem', color: b.age_minutes <= 15 ? '#fbbf24' : '#888', marginTop: '2px' }}>
                      {b.age_minutes < 1 ? 'Just now' : `${b.age_minutes}m ago`}
                    </div>
                  </td>

                  <td style={{ maxWidth: '280px' }}>
                    {getReasonBadge(b)}
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {/* WhatsApp Cross-Verify */}
                      <a
                        href={b.whatsapp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-xs"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#25D366', color: '#000', fontWeight: 700, fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', textDecoration: 'none' }}
                        title="Chat with captain on WhatsApp to cross-verify payment"
                      >
                        <MessageCircle size={12} />
                        WhatsApp
                      </a>

                      {/* Manual Confirm to Paid */}
                      {!b.has_paid_booking && (
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => handleConfirmManual(b.booking_id, b.team_name)}
                          disabled={actionLoadingId === b.booking_id}
                          style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px' }}
                          title="Manually mark as Paid and allocate Room Slot"
                        >
                          {actionLoadingId === b.booking_id ? 'Confirming...' : '✅ Mark Paid'}
                        </button>
                      )}

                      {/* Discard / Cancel */}
                      <button
                        type="button"
                        className="btn btn-danger btn-xs"
                        onClick={() => handleCancelBooking(b.booking_id, b.team_name)}
                        disabled={actionLoadingId === b.booking_id}
                        style={{ fontSize: '0.72rem', padding: '3px 7px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                        title="Discard this abandoned pending attempt"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  {searchQuery || filterReason !== 'all' || filterDate !== 'all'
                    ? 'No pending registrations match the selected filters.'
                    : '🎉 No pending registrations! All bookings are verified and paid.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── COUPONS TAB ──────────────────────────────────────────────────
function CouponsTab({ coupons: initialCoupons, teams }: { coupons: any[]; teams: any[]; supabase: any }) {
  const [list, setList] = useState(initialCoupons || [])
  const [issueTeam, setIssueTeam] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function fetchCoupons() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/coupons')
      const data = await res.json()
      if (data.coupons) {
        setList(data.coupons)
      }
    } catch (e) {
      console.error('Failed to refresh coupons', e)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  async function cancelCoupon(couponId: string, code: string, teamName: string) {
    if (!window.confirm(`Are you sure you want to cancel and revoke coupon "${code}" for ${teamName}?\nThis action cannot be undone.`)) {
      return
    }
    setCancellingId(couponId)
    setMsg('')
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon_id: couponId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg('❌ ' + (data.error || 'Failed to cancel coupon'))
        return
      }
      setList(prev => prev.filter((c: any) => c.coupon_id !== couponId))
      setMsg(`✅ Coupon ${code} was successfully cancelled and revoked.`)
    } catch (e: any) {
      setMsg('❌ ' + (e.message || 'Error cancelling coupon'))
    } finally {
      setCancellingId(null)
    }
  }

  async function issueCoupon(e: React.FormEvent) {
    e.preventDefault()
    if (!issueTeam) return
    setIssuing(true); setMsg('')
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: issueTeam }),
      })
      const data = await res.json()
      setIssuing(false)
      if (!res.ok || !data.coupon) {
        setMsg('❌ ' + (data.error || 'Failed to issue coupon'))
        return
      }
      setList(prev => [data.coupon, ...prev])
      setMsg(`✅ Free slot coupon issued! Code: ${data.coupon.code} — team can redeem this for ₹0 on any open slot.`)
      setIssueTeam('')
    } catch (err: any) {
      setIssuing(false)
      setMsg('❌ ' + (err.message || 'Error issuing coupon'))
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const unusedCount = list.filter((c: any) => c.status === 'unused').length
  const usedCount = list.filter((c: any) => c.status === 'used').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <h2 className={styles.tabTitle} style={{ margin: 0 }}>Coupons Management</h2>
          <p className={styles.tabDesc} style={{ margin: '4px 0 0 0' }}>
            Free slot coupons are automatically generated for the <strong>4th place team</strong> when a slot is marked completed. You can also manually issue coupons.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchCoupons}
          disabled={refreshing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Coupons'}
        </button>
      </div>

      {/* ── METRIC STATS SUMMARY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', margin: '1rem 0 1.25rem 0' }}>
        <div style={{ background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Issued</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginTop: '3px' }}>{list.length}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Available (Unused)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4ade80', marginTop: '3px' }}>{unusedCount}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Redeemed (Used)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', marginTop: '3px' }}>{usedCount}</div>
        </div>
      </div>

      {/* Issue Form */}
      <form onSubmit={issueCoupon} className={styles.createSlotForm}>
        <div className={styles.formRow}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Issue Manual Free Coupon To Team</label>
            <select className="form-input" value={issueTeam} onChange={e => setIssueTeam(e.target.value)} required>
              <option value="">Select team...</option>
              {teams.map((t: any) => (
                <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={issuing}>
              {issuing ? 'Issuing...' : '+ Issue Free Coupon'}
            </button>
          </div>
        </div>
        {msg && <p className={`${styles.scoreMsg} ${msg.includes('✅') ? styles.scoreMsgOk : styles.scoreMsgErr}`}>{msg}</p>}
      </form>

      <div className="table-wrapper" style={{ marginTop: '1.25rem' }}>
        <table>
          <thead>
            <tr>
              <th>Given To (Team)</th>
              <th>Origin / Generated From</th>
              <th>Coupon Code</th>
              <th>Status</th>
              <th>Has Team Used It?</th>
              <th>Issued At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c: any) => {
              const isUnused = c.status === 'unused'
              const originSlot = c.slots
              const usedBooking = c.bookings && c.bookings.length > 0 ? c.bookings[0] : null
              const usedSlot = usedBooking?.slots

              return (
                <tr key={c.coupon_id}>
                  <td>
                    <strong style={{ fontSize: '0.9rem', color: '#fff' }}>
                      {c.teams?.team_name || 'Unknown Team'}
                    </strong>
                  </td>

                  <td>
                    {originSlot ? (
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', marginBottom: '3px' }}>
                          🏆 {c.code?.startsWith('FREE4TH') || (originSlot.date && originSlot.date >= '2026-09-22') ? '4th Place Reward' : '3rd Place Reward'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#ccc' }}>
                          📅 {originSlot.date ? formatNumericDate(originSlot.date) : ''} {originSlot.time_label ? `• ${originSlot.time_label}` : ''}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#888' }}>
                        👤 Manual Admin Issue
                      </span>
                    )}
                  </td>

                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <code style={{ background: '#1a1a1a', border: '1px solid #333', padding: '0.2rem 0.55rem', borderRadius: '5px', letterSpacing: '0.08em', color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem' }}>
                        {c.code || '—'}
                      </code>
                      {c.code && (
                        <button
                          type="button"
                          onClick={() => handleCopy(c.code)}
                          title="Copy coupon code"
                          style={{ background: 'transparent', border: 'none', color: copiedCode === c.code ? '#4ade80' : '#888', cursor: 'pointer', fontSize: '0.75rem', padding: '2px' }}
                        >
                          {copiedCode === c.code ? '✓ Copied' : '📋'}
                        </button>
                      )}
                    </div>
                  </td>

                  <td>
                    {isUnused ? (
                      <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.16)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)', fontWeight: 800 }}>
                        🟢 Unused / Available
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(156, 163, 175, 0.16)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.35)', fontWeight: 700 }}>
                        ⚪ Redeemed / Used
                      </span>
                    )}
                  </td>

                  <td>
                    {isUnused ? (
                      <div style={{ fontSize: '0.78rem', color: '#4ade80', fontWeight: 600 }}>
                        ⏳ Not used yet (Can be used 1 time)
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 700 }}>
                          ✅ Used on {c.used_at ? formatNumericDate(c.used_at) : '—'}
                        </div>
                        {usedSlot && (
                          <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '2px' }}>
                            Redeemed for: 📅 {formatNumericDate(usedSlot.date)} • {usedSlot.time_label}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {formatNumericDate(c.issued_at)}
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    {isUnused ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-xs"
                        onClick={() => cancelCoupon(c.coupon_id, c.code, c.teams?.team_name || 'Team')}
                        disabled={cancellingId === c.coupon_id}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Safely cancel and revoke this unused coupon"
                      >
                        <Trash2 size={12} />
                        {cancellingId === c.coupon_id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    ) : (
                      <span style={{ color: '#666', fontSize: '0.72rem', fontStyle: 'italic' }}>
                        🔒 Redeemed
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}

            {list.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                  No coupons issued yet. Once a slot is marked completed, a free coupon will automatically be generated for the 4th place team.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── FINANCES TAB ─────────────────────────────────────────────────
interface DaySlotItem {
  slot_label: string
  teams_played: number
  slot_price: number
  prize_money: number
}

interface DayFinanceRecord {
  id: string
  date: string
  slots: DaySlotItem[]
  expenses: {
    caster_fee: number
    caster_note?: string
    room_maker_fee: number
    room_maker_note?: string
    observer_fee: number
    observer_note?: string
    global_expense?: number
    global_note?: string
    misc_fee: number
    misc_note?: string
  }
  notes?: string
  created_at?: string
}

function FinancesTab() {
  const [records, setRecords] = useState<DayFinanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  // Modal Form State
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])
  const [formSlots, setFormSlots] = useState<DaySlotItem[]>([
    { slot_label: '7:00 PM – 9:00 PM', teams_played: 0, slot_price: 40, prize_money: 340 },
    { slot_label: '9:00 PM – 11:00 PM', teams_played: 0, slot_price: 40, prize_money: 340 },
    { slot_label: '11:00 PM – 1:00 AM', teams_played: 0, slot_price: 40, prize_money: 340 },
  ])
  const [formExpenses, setFormExpenses] = useState({
    caster_fee: 120,
    caster_note: '',
    room_maker_fee: 540,
    room_maker_note: '',
    observer_fee: 20,
    observer_note: '',
    global_expense: 0,
    global_note: '',
    misc_fee: 40,
    misc_note: 'Team gilli',
  })
  const [formNotes, setFormNotes] = useState('')

  // Load finance records
  const fetchFinances = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/finances')
      const data = await res.json()
      if (data.records && Array.isArray(data.records)) {
        setRecords(data.records)
      }
    } catch (err) {
      console.error('Failed to load finances:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFinances()
  }, [fetchFinances])

  // Reset form to defaults
  function openNewDayModal() {
    setEditingRecordId(null)
    setFormDate(new Date().toISOString().split('T')[0])
    setFormSlots([
      { slot_label: '7:00 PM – 9:00 PM', teams_played: 0, slot_price: 40, prize_money: 340 },
      { slot_label: '9:00 PM – 11:00 PM', teams_played: 0, slot_price: 40, prize_money: 340 },
      { slot_label: '11:00 PM – 1:00 AM', teams_played: 0, slot_price: 40, prize_money: 340 },
    ])
    setFormExpenses({
      caster_fee: 120,
      caster_note: '',
      room_maker_fee: 540,
      room_maker_note: '',
      observer_fee: 20,
      observer_note: '',
      global_expense: 0,
      global_note: '',
      misc_fee: 40,
      misc_note: 'Team gilli',
    })
    setFormNotes('')
    setStatusMsg('')
    setModalOpen(true)
  }

  // Pre-fill form for editing
  function openEditModal(r: DayFinanceRecord) {
    setEditingRecordId(r.id)
    setFormDate(r.date)
    setFormSlots(r.slots?.length ? r.slots : [
      { slot_label: 'Slot 1', teams_played: 0, slot_price: 40, prize_money: 340 }
    ])
    setFormExpenses({
      caster_fee: r.expenses?.caster_fee || 0,
      caster_note: r.expenses?.caster_note || '',
      room_maker_fee: r.expenses?.room_maker_fee || 0,
      room_maker_note: r.expenses?.room_maker_note || '',
      observer_fee: r.expenses?.observer_fee || 0,
      observer_note: r.expenses?.observer_note || '',
      global_expense: r.expenses?.global_expense || 0,
      global_note: r.expenses?.global_note || '',
      misc_fee: r.expenses?.misc_fee || 0,
      misc_note: r.expenses?.misc_note || '',
    })
    setFormNotes(r.notes || '')
    setStatusMsg('')
    setModalOpen(true)
  }

  // Save day record
  async function handleSaveDay(e: React.FormEvent) {
    e.preventDefault()
    if (!formDate) return
    setSaving(true)
    setStatusMsg('')

    const payload = {
      id: editingRecordId || undefined,
      date: formDate,
      slots: formSlots.map(s => ({
        slot_label: s.slot_label || 'Slot',
        teams_played: Number(s.teams_played) || 0,
        slot_price: Number(s.slot_price) || 0,
        prize_money: Number(s.prize_money) || 0,
      })),
      expenses: {
        caster_fee: Number(formExpenses.caster_fee) || 0,
        caster_note: formExpenses.caster_note?.trim() || '',
        room_maker_fee: Number(formExpenses.room_maker_fee) || 0,
        room_maker_note: formExpenses.room_maker_note?.trim() || '',
        observer_fee: Number(formExpenses.observer_fee) || 0,
        observer_note: formExpenses.observer_note?.trim() || '',
        global_expense: Number(formExpenses.global_expense) || 0,
        global_note: formExpenses.global_note?.trim() || '',
        misc_fee: Number(formExpenses.misc_fee) || 0,
        misc_note: formExpenses.misc_note?.trim() || '',
      },
      notes: formNotes?.trim() || '',
    }

    try {
      const res = await fetch('/api/admin/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg('❌ ' + (data.error || 'Failed to save record'))
        return
      }

      setRecords(data.records || [])
      setModalOpen(false)
    } catch (err: any) {
      setStatusMsg('❌ ' + (err.message || 'Error saving record'))
    } finally {
      setSaving(false)
    }
  }

  // Delete day record
  async function handleDeleteRecord(id: string, date: string) {
    if (!confirm(`Are you sure you want to delete the financial record for ${formatNumericDate(date)}?`)) {
      return
    }

    try {
      const res = await fetch('/api/admin/finances', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, date }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to delete record')
        return
      }
      setRecords(data.records || [])
    } catch (err: any) {
      alert(err.message || 'Error deleting record')
    }
  }

  // Live modal totals calculation
  const modalRevenue = formSlots.reduce((sum, s) => sum + (Number(s.teams_played) || 0) * (Number(s.slot_price) || 0), 0)
  const modalPrizes = formSlots.reduce((sum, s) => sum + (Number(s.prize_money) || 0), 0)
  const modalStaff = (Number(formExpenses.caster_fee) || 0) + (Number(formExpenses.room_maker_fee) || 0) + (Number(formExpenses.observer_fee) || 0) + (Number(formExpenses.misc_fee) || 0)
  const modalGlobal = Number(formExpenses.global_expense) || 0
  const modalTotalOutflows = modalPrizes + modalStaff + modalGlobal
  const modalNetProfit = modalRevenue - modalTotalOutflows

  // Cumulative chronological calculation of running balance
  const { enrichedRecords, totals } = useMemo(() => {
    // Sort chronological (oldest to newest) to accumulate balance
    const sortedChronological = [...records].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))

    let runningBal = 0
    let totalRev = 0
    let totalPrizes = 0
    let totalStaff = 0
    let totalGlobal = 0

    const balanceMap = new Map<string, number>()

    sortedChronological.forEach(r => {
      const rev = (r.slots || []).reduce((s, sl) => s + (Number(sl.teams_played) || 0) * (Number(sl.slot_price) || 0), 0)
      const pz = (r.slots || []).reduce((s, sl) => s + (Number(sl.prize_money) || 0), 0)
      const st = (Number(r.expenses?.caster_fee) || 0) + (Number(r.expenses?.room_maker_fee) || 0) + (Number(r.expenses?.observer_fee) || 0) + (Number(r.expenses?.misc_fee) || 0)
      const gl = Number(r.expenses?.global_expense) || 0
      const net = rev - (pz + st + gl)

      runningBal += net
      totalRev += rev
      totalPrizes += pz
      totalStaff += st
      totalGlobal += gl

      balanceMap.set(r.id, runningBal)
    })

    // Display list sorted newest first
    const displayList = [...records].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)).map(r => {
      const rev = (r.slots || []).reduce((s, sl) => s + (Number(sl.teams_played) || 0) * (Number(sl.slot_price) || 0), 0)
      const pz = (r.slots || []).reduce((s, sl) => s + (Number(sl.prize_money) || 0), 0)
      const st = (Number(r.expenses?.caster_fee) || 0) + (Number(r.expenses?.room_maker_fee) || 0) + (Number(r.expenses?.observer_fee) || 0) + (Number(r.expenses?.misc_fee) || 0)
      const gl = Number(r.expenses?.global_expense) || 0
      const totalOut = pz + st + gl
      const net = rev - totalOut

      return {
        ...r,
        revenue: rev,
        prizePool: pz,
        staffExpenses: st,
        globalExpense: gl,
        totalOutflow: totalOut,
        netProfit: net,
        runningBalance: balanceMap.get(r.id) || 0,
      }
    })

    const totalOutflowAll = totalPrizes + totalStaff + totalGlobal
    const overallNetBalance = totalRev - totalOutflowAll

    return {
      enrichedRecords: displayList,
      totals: {
        totalRevenue: totalRev,
        totalPrizes,
        totalStaff,
        totalGlobal,
        totalOutflow: totalOutflowAll,
        overallNetBalance,
      }
    }
  }, [records])

  // Export to CSV
  function exportCSV() {
    if (enrichedRecords.length === 0) {
      alert('No financial records to export.')
      return
    }

    const headers = [
      'Date',
      'Total Slots',
      'Total Teams Played',
      'Gross Slot Revenue (INR)',
      'Prize Money Outflow (INR)',
      'Staff Expenses (INR)',
      'Global Expense (INR)',
      'Global Expense Note',
      'Total Outflows (INR)',
      'Day Net Profit (INR)',
      'Cumulative Balance (INR)',
      'Notes'
    ]

    const rows = enrichedRecords.map(r => {
      const totalTeams = (r.slots || []).reduce((sum, s) => sum + (Number(s.teams_played) || 0), 0)
      return [
        r.date,
        (r.slots || []).length,
        totalTeams,
        r.revenue,
        r.prizePool,
        r.staffExpenses,
        r.globalExpense,
        `"${(r.expenses?.global_note || '').replace(/"/g, '""')}"`,
        r.totalOutflow,
        r.netProfit,
        r.runningBalance,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `BGFS_Finances_Ledger_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div>
      {/* ── HEADER & ACTIONS ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <h2 className={styles.tabTitle} style={{ margin: 0 }}>Financial Management &amp; P&amp;L Ledger</h2>
          <p className={styles.tabDesc} style={{ margin: '4px 0 0 0' }}>
            Daily 3-slot revenue tracking, staff &amp; global expenses, automated daily net profit, and cumulative balance.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={exportCSV}
            disabled={enrichedRecords.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            📥 Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={openNewDayModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fbbf24', borderColor: '#fbbf24', color: '#000', fontWeight: 800 }}
          >
            + Log Day Finances
          </button>
        </div>
      </div>

      {/* ── METRIC STATS SUMMARY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', margin: '1rem 0 1.25rem 0' }}>
        <div style={{ background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Revenue</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginTop: '3px' }}>₹{totals.totalRevenue.toLocaleString('en-IN')}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Total Prize Pools</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', marginTop: '3px' }}>₹{totals.totalPrizes.toLocaleString('en-IN')}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Staff Expenses</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f87171', marginTop: '3px' }}>₹{totals.totalStaff.toLocaleString('en-IN')}</div>
        </div>
        <div style={{ background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>🌐 Global Expenses</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8', marginTop: '3px' }}>₹{totals.totalGlobal.toLocaleString('en-IN')}</div>
        </div>
        <div style={{
          background: totals.overallNetBalance >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${totals.overallNetBalance >= 0 ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
          borderRadius: '10px',
          padding: '0.85rem 1rem'
        }}>
          <div style={{ fontSize: '0.72rem', color: totals.overallNetBalance >= 0 ? '#4ade80' : '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Overall Net Balance</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: totals.overallNetBalance >= 0 ? '#4ade80' : '#f87171', marginTop: '3px' }}>
            {totals.overallNetBalance >= 0 ? '+' : ''}₹{totals.overallNetBalance.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* ── LEDGER TABLE ── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Slots Summary</th>
              <th>Gross Revenue</th>
              <th>Prize Pool</th>
              <th>Staff Costs</th>
              <th>Global Expense</th>
              <th>Day Net Profit</th>
              <th>Running Balance</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {enrichedRecords.map(r => {
              const isPositive = r.netProfit >= 0
              const isExpanded = expandedRowId === r.id
              const totalTeams = (r.slots || []).reduce((sum, s) => sum + (Number(s.teams_played) || 0), 0)

              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                    style={{ cursor: 'pointer', background: isExpanded ? 'rgba(255, 255, 255, 0.03)' : undefined }}
                  >
                    <td>
                      <strong style={{ color: '#fff', fontSize: '0.9rem' }}>
                        📅 {formatNumericDate(r.date)}
                      </strong>
                      {r.notes && (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: '#fbbf24',
                            marginTop: '3px',
                            maxWidth: '160px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`Remark: ${r.notes}`}
                        >
                          📝 {r.notes}
                        </div>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
                        {(r.slots || []).length} Slots • <strong style={{ color: '#fbbf24' }}>{totalTeams} Teams</strong>
                      </div>
                    </td>

                    <td>
                      <strong style={{ color: '#fff', fontSize: '0.9rem' }}>
                        ₹{r.revenue.toLocaleString('en-IN')}
                      </strong>
                    </td>

                    <td>
                      <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700 }}>
                        ₹{r.prizePool.toLocaleString('en-IN')}
                      </span>
                    </td>

                    <td>
                      <span style={{ color: '#f87171', fontSize: '0.85rem' }}>
                        ₹{r.staffExpenses.toLocaleString('en-IN')}
                      </span>
                    </td>

                    <td>
                      {r.globalExpense > 0 ? (
                        <div style={{ fontSize: '0.82rem' }}>
                          <span style={{ color: '#38bdf8', fontWeight: 700 }}>₹{r.globalExpense.toLocaleString('en-IN')}</span>
                          {r.expenses?.global_note && (
                            <div style={{ fontSize: '0.7rem', color: '#888' }}>{r.expenses.global_note}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#666', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>

                    <td>
                      <span
                        className="badge"
                        style={{
                          background: isPositive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isPositive ? '#4ade80' : '#f87171',
                          border: `1px solid ${isPositive ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                          fontWeight: 800,
                        }}
                      >
                        {isPositive ? '+' : ''}₹{r.netProfit.toLocaleString('en-IN')}
                      </span>
                    </td>

                    <td>
                      <strong style={{ color: r.runningBalance >= 0 ? '#4ade80' : '#f87171', fontSize: '0.9rem' }}>
                        {r.runningBalance >= 0 ? '+' : ''}₹{r.runningBalance.toLocaleString('en-IN')}
                      </strong>
                    </td>

                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          style={{
                            background: '#222',
                            border: '1px solid #444',
                            color: '#ccc',
                            borderRadius: '5px',
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          title="Edit this record"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(r.id, r.date)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171',
                            borderRadius: '5px',
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          title="Delete this record"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row Details */}
                  {isExpanded && (
                    <tr style={{ background: '#121212' }}>
                      <td colSpan={9} style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                          {/* Slots Details */}
                          <div style={{ background: '#181818', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                              Slots Details ({r.slots?.length || 0})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(r.slots || []).map((sl, sIdx) => {
                                const subRev = (Number(sl.teams_played) || 0) * (Number(sl.slot_price) || 0)
                                return (
                                  <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', borderBottom: '1px solid #222', paddingBottom: '4px' }}>
                                    <div>
                                      <span style={{ color: '#fff', fontWeight: 700 }}>{sl.slot_label}</span>
                                      <div style={{ color: '#888', fontSize: '0.72rem' }}>
                                        {sl.teams_played} teams × ₹{sl.slot_price} • Prize: ₹{sl.prize_money}
                                      </div>
                                    </div>
                                    <strong style={{ color: '#4ade80' }}>₹{subRev}</strong>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Expenses Details */}
                          <div style={{ background: '#181818', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                              Expenses Breakdown
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#aaa' }}>Caster: {r.expenses?.caster_note ? `(${r.expenses.caster_note})` : ''}</span>
                                <span style={{ color: '#fff' }}>₹{r.expenses?.caster_fee || 0}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#aaa' }}>Room Maker: {r.expenses?.room_maker_note ? `(${r.expenses.room_maker_note})` : ''}</span>
                                <span style={{ color: '#fff' }}>₹{r.expenses?.room_maker_fee || 0}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#aaa' }}>Observer: {r.expenses?.observer_note ? `(${r.expenses.observer_note})` : ''}</span>
                                <span style={{ color: '#fff' }}>₹{r.expenses?.observer_fee || 0}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#38bdf8' }}>🌐 Global Expense: {r.expenses?.global_note ? `(${r.expenses.global_note})` : ''}</span>
                                <span style={{ color: '#38bdf8', fontWeight: 700 }}>₹{r.expenses?.global_expense || 0}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#aaa' }}>Misc: {r.expenses?.misc_note ? `(${r.expenses.misc_note})` : ''}</span>
                                <span style={{ color: '#fff' }}>₹{r.expenses?.misc_fee || 0}</span>
                              </div>
                              {r.notes && (
                                <div style={{ borderTop: '1px solid #222', paddingTop: '4px', marginTop: '4px', color: '#888', fontStyle: 'italic', fontSize: '0.72rem' }}>
                                  Note: {r.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}

            {enrichedRecords.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: '3rem 1rem' }}>
                  {loading ? 'Loading financial records...' : 'No daily financial records logged yet. Click "+ Log Day Finances" to record your first day!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL FORM: LOG / EDIT DAY FINANCES ── */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => {
            if (!saving) setModalOpen(false)
          }}
        >
          <div
            style={{
              background: '#121212',
              border: '1px solid #282828',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fbbf24' }}>
                  {editingRecordId ? '✏️ Edit Day Finances' : '➕ Log Day Finances'}
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                  Enter slot counts, prices, and daily expenses. Calculations update in real-time.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {statusMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {statusMsg}
              </div>
            )}

            <form onSubmit={handleSaveDay}>
              {/* Date Input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'block' }}>
                  Date of Record <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  required
                />
              </div>

              {/* ── DAILY SLOTS SECTION ── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', margin: 0, fontWeight: 700, color: '#fbbf24' }}>
                    🎮 Day&apos;s Slots (Default 3 Slots)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setFormSlots(prev => [
                        ...prev,
                        { slot_label: `Slot ${prev.length + 1}`, teams_played: 0, slot_price: 40, prize_money: 340 }
                      ])
                    }}
                    style={{ background: '#222', border: '1px solid #444', color: '#ccc', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 8px', cursor: 'pointer' }}
                  >
                    + Add Slot
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formSlots.map((slot, idx) => {
                    const subRevenue = (Number(slot.teams_played) || 0) * (Number(slot.slot_price) || 0)
                    return (
                      <div
                        key={idx}
                        style={{
                          background: '#181818',
                          border: '1px solid #282828',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          display: 'grid',
                          gridTemplateColumns: '1.8fr 1fr 1fr 1fr auto',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#888', display: 'block' }}>Slot Timing</span>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '100%' }}
                            value={slot.slot_label}
                            onChange={e => {
                              const val = e.target.value
                              setFormSlots(prev => prev.map((s, i) => i === idx ? { ...s, slot_label: val } : s))
                            }}
                            placeholder="e.g. 7:00 PM – 9:00 PM"
                            required
                          />
                        </div>

                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#888', display: 'block' }}>Teams Played</span>
                          <input
                            type="number"
                            className="form-input"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '100%' }}
                            min={0}
                            max={30}
                            placeholder="0"
                            value={slot.teams_played}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0
                              setFormSlots(prev => prev.map((s, i) => i === idx ? { ...s, teams_played: val } : s))
                            }}
                            required
                          />
                        </div>

                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#888', display: 'block' }}>Price/Team (₹)</span>
                          <input
                            type="number"
                            className="form-input"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '100%' }}
                            min={0}
                            placeholder="40"
                            value={slot.slot_price}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0
                              setFormSlots(prev => prev.map((s, i) => i === idx ? { ...s, slot_price: val } : s))
                            }}
                            required
                          />
                        </div>

                        <div>
                          <span style={{ fontSize: '0.7rem', color: '#888', display: 'block' }}>Prize Pool (₹)</span>
                          <input
                            type="number"
                            className="form-input"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '100%' }}
                            min={0}
                            placeholder="340"
                            value={slot.prize_money}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0
                              setFormSlots(prev => prev.map((s, i) => i === idx ? { ...s, prize_money: val } : s))
                            }}
                            required
                          />
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4ade80' }}>₹{subRevenue}</span>
                          {formSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormSlots(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.7rem', cursor: 'pointer', marginTop: '2px', padding: 0 }}
                              title="Remove slot"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── EXPENSES SECTION ── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '8px', display: 'block', fontWeight: 700, color: '#f87171' }}>
                  👥 Staff &amp; Operational Expenses
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {/* Caster */}
                  <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '8px', padding: '0.65rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', fontWeight: 700 }}>🎙️ Caster Payment (₹)</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: '4px 0' }}
                      min={0}
                      placeholder="120"
                      value={formExpenses.caster_fee}
                      onChange={e => setFormExpenses(prev => ({ ...prev, caster_fee: parseInt(e.target.value) || 0 }))}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', width: '100%', color: '#aaa' }}
                      placeholder="Caster name / note"
                      value={formExpenses.caster_note}
                      onChange={e => setFormExpenses(prev => ({ ...prev, caster_note: e.target.value }))}
                    />
                  </div>

                  {/* Room Maker */}
                  <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '8px', padding: '0.65rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', fontWeight: 700 }}>🏠 Room Maker / Host (₹)</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: '4px 0' }}
                      min={0}
                      placeholder="540"
                      value={formExpenses.room_maker_fee}
                      onChange={e => setFormExpenses(prev => ({ ...prev, room_maker_fee: parseInt(e.target.value) || 0 }))}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', width: '100%', color: '#aaa' }}
                      placeholder="Host name / note"
                      value={formExpenses.room_maker_note}
                      onChange={e => setFormExpenses(prev => ({ ...prev, room_maker_note: e.target.value }))}
                    />
                  </div>

                  {/* Observer */}
                  <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '8px', padding: '0.65rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', fontWeight: 700 }}>🎥 Observer / Production (₹)</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: '4px 0' }}
                      min={0}
                      placeholder="20"
                      value={formExpenses.observer_fee}
                      onChange={e => setFormExpenses(prev => ({ ...prev, observer_fee: parseInt(e.target.value) || 0 }))}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', width: '100%', color: '#aaa' }}
                      placeholder="Observer note"
                      value={formExpenses.observer_note}
                      onChange={e => setFormExpenses(prev => ({ ...prev, observer_note: e.target.value }))}
                    />
                  </div>

                  {/* Global Expense */}
                  <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '0.65rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>🌐 Global / Business Expense (₹)</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: '4px 0', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                      min={0}
                      placeholder="0"
                      value={formExpenses.global_expense}
                      onChange={e => setFormExpenses(prev => ({ ...prev, global_expense: parseInt(e.target.value) || 0 }))}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', width: '100%', color: '#38bdf8' }}
                      placeholder="e.g. Hosting, Domain, Dev, Ads"
                      value={formExpenses.global_note}
                      onChange={e => setFormExpenses(prev => ({ ...prev, global_note: e.target.value }))}
                    />
                  </div>

                  {/* Misc */}
                  <div style={{ background: '#181818', border: '1px solid #282828', borderRadius: '8px', padding: '0.65rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', fontWeight: 700 }}>⚙️ Other / Misc (₹)</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: '4px 0' }}
                      min={0}
                      placeholder="40"
                      value={formExpenses.misc_fee}
                      onChange={e => setFormExpenses(prev => ({ ...prev, misc_fee: parseInt(e.target.value) || 0 }))}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', width: '100%', color: '#aaa' }}
                      placeholder="Team gilli"
                      value={formExpenses.misc_note}
                      onChange={e => setFormExpenses(prev => ({ ...prev, misc_note: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* ── DAY REMARK / NOTES SECTION ── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px', display: 'block', fontWeight: 700, color: '#e2e8f0' }}>
                  📝 Day Remark / Note
                </label>
                <textarea
                  className="form-input"
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem',
                    width: '100%',
                    minHeight: '65px',
                    resize: 'vertical',
                    background: '#181818',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: '#fff',
                    lineHeight: 1.4,
                  }}
                  placeholder="e.g. Any special notes, sponsor mentions, issues faced, bonus payments, etc."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                />
              </div>

              {/* ── REAL-TIME SUMMARY BOX ── */}
              <div
                style={{
                  background: modalNetProfit >= 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${modalNetProfit >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    Revenue: <strong style={{ color: '#fff' }}>₹{modalRevenue}</strong> • Outflow: <strong style={{ color: '#f87171' }}>₹{modalTotalOutflows}</strong> (Prizes: ₹{modalPrizes} + Staff: ₹{modalStaff} + Global: ₹{modalGlobal})
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: modalNetProfit >= 0 ? '#4ade80' : '#f87171', marginTop: '2px' }}>
                    Day Net Profit: {modalNetProfit >= 0 ? '+' : ''}₹{modalNetProfit.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving || !formDate}
                  style={{ background: '#fbbf24', borderColor: '#fbbf24', color: '#000', fontWeight: 800 }}
                >
                  {saving ? 'Saving Record...' : '✓ Save Day Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
function ConfigTab({ config, setConfig, supabase }: { config: Record<string, string>; setConfig?: (cfg: any) => void; supabase: any }) {
  const [values, setValues] = useState(config)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setValues(config)
  }, [config])

  const fields = [
    { key: 'grand_finals_date', label: 'Grand Finals Date (ISO)', placeholder: '2026-10-17T18:00:00+05:30', type: 'text' },
    { key: 'whatsapp_invite_link', label: 'WhatsApp Community Link', placeholder: 'https://chat.whatsapp.com/...', type: 'text' },
    { key: 'cycle_start_date', label: 'Cycle Start Date', placeholder: '2026-09-21', type: 'date' },
    { key: 'cycle_end_date', label: 'Cycle End Date', placeholder: '2026-10-16', type: 'date' },
    { key: 'slot_entry_fee', label: 'Default Slot Entry Fee (₹)', placeholder: '40', type: 'number' },
    { key: 'slot_first_prize', label: 'Default 1st Place Cash Prize (₹)', placeholder: '160', type: 'number' },
    { key: 'slot_second_prize', label: 'Default 2nd Place Cash Prize (₹)', placeholder: '80', type: 'number' },
    { key: 'slot_third_prize', label: 'Default 3rd Place Cash Prize (₹)', placeholder: '60', type: 'number' },
  ]

  const isMaintenanceOn = values['maintenance_mode'] === 'true'

  async function toggleMaintenanceMode() {
    const nextVal = isMaintenanceOn ? 'false' : 'true'
    setSaving(true)
    setMsg('')
    const { error } = await supabase.from('config').upsert([{ key: 'maintenance_mode', value: nextVal }], { onConflict: 'key' })
    setSaving(false)
    if (error) {
      setMsg('❌ Failed to update maintenance mode: ' + error.message)
    } else {
      const updated = { ...values, maintenance_mode: nextVal }
      setValues(updated)
      if (setConfig) setConfig(updated)
      setMsg(nextVal === 'true' ? '🔴 SITE IS NOW UNDER MAINTENANCE! Non-admin users are redirected to the maintenance page.' : '🟢 SITE IS NOW LIVE! Public access restored.')
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')

    const updates = Object.entries(values).map(([key, value]) => ({ key, value }))
    const { error } = await supabase.from('config').upsert(updates, { onConflict: 'key' })

    setSaving(false)
    if (error) { setMsg('❌ ' + error.message) }
    else { 
      setMsg('✅ Configuration saved!')
      if (setConfig) setConfig(values)
    }
  }

  return (
    <div>
      <h2 className={styles.tabTitle}>Configuration</h2>
      <p className={styles.tabDesc}>Platform-wide settings. Changes take effect immediately.</p>

      {/* Maintenance Mode Control Card */}
      <div style={{
        background: isMaintenanceOn ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.08)',
        border: `1.5px solid ${isMaintenanceOn ? '#ef4444' : '#22c55e'}`,
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.1rem' }}>{isMaintenanceOn ? '🔴' : '🟢'}</span>
            <strong style={{ color: '#ffffff', fontSize: '1rem', letterSpacing: '0.03em' }}>
              SITE STATUS: {isMaintenanceOn ? 'UNDER MAINTENANCE' : 'ONLINE & LIVE'}
            </strong>
          </div>
          <p style={{ margin: 0, color: '#aaaaaa', fontSize: '0.82rem' }}>
            {isMaintenanceOn
              ? 'Public visitors are currently redirected to the Maintenance Page. Admins have full access.'
              : 'The site is accessible to all public users & players.'}
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={toggleMaintenanceMode}
          style={{
            background: isMaintenanceOn ? '#22c55e' : '#ef4444',
            color: '#ffffff',
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.84rem',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'opacity 0.18s ease'
          }}
        >
          {isMaintenanceOn ? '✓ TURN SITE LIVE (OFF)' : '🛠️ ACTIVATE MAINTENANCE MODE (ON)'}
        </button>
      </div>

      <form onSubmit={handleSave} className={styles.configForm}>
        {fields.map(field => (
          <div className="form-group" key={field.key}>
            <label className="form-label">{field.label}</label>
            <input
              type={field.type}
              className="form-input"
              placeholder={field.placeholder}
              value={values[field.key] || ''}
              onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
            />
          </div>
        ))}

        {/* 4th Place Prize Policy Box */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.4rem' }}>🎟️</span>
          <div>
            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.85rem' }}>
              4th Place Prize Policy: 100% Free Slot Pass
            </div>
            <div style={{ color: '#aaa', fontSize: '0.76rem', marginTop: '2px' }}>
              4th place winners automatically receive a single-use free slot coupon code (<code style={{ color: '#fbbf24' }}>FREE4TH-...</code>) upon slot completion.
            </div>
          </div>
        </div>

        {msg && <p className={styles.scoreMsg}>{msg}</p>}
        <button id="save-config-btn" type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  )
}

// ── USERS & ROLES TAB ─────────────────────────────────────────────
function UsersTab({
  users,
  onUpdateRole,
  onDeleteUser,
  onToggleTestMode,
}: {
  users: any[]
  onUpdateRole: (id: string, role: string) => void
  onDeleteUser?: (id: string) => void
  onToggleTestMode?: (id: string, currentStatus: boolean) => void
}) {
  const [lookupQuery, setLookupQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [lookupResults, setLookupResults] = useState<any[] | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [selectedUserForReset, setSelectedUserForReset] = useState<any | null>(null)
  const [tempPassword, setTempPassword] = useState('user12345')
  const [resetting, setResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState<any | null>(null)
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false)

  const [tableSearch, setTableSearch] = useState('')
  const filteredUsers = useMemo(() => {
    if (!tableSearch.trim()) return users
    const q = tableSearch.toLowerCase().trim()
    return users.filter(u =>
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.display_name && u.display_name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    )
  }, [users, tableSearch])

  // Handle Team Lookup
  async function handleLookup(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!lookupQuery.trim()) return
    setSearching(true)
    setLookupError('')
    setLookupResults(null)
    setResetSuccess(null)
    setSelectedUserForReset(null)

    try {
      const res = await fetch('/api/admin/users/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: lookupQuery.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to find user')
      }
      if (!data.users || data.users.length === 0) {
        setLookupError('No account found matching that email or team name. Please check spelling.')
      } else {
        setLookupResults(data.users)
        if (data.users.length === 1) {
          setSelectedUserForReset(data.users[0])
        }
      }
    } catch (err: any) {
      setLookupError(err.message || 'Lookup failed')
    } finally {
      setSearching(false)
    }
  }

  // Pre-fill lookup from table row click
  function selectUserFromTable(u: any) {
    setLookupQuery(u.email || '')
    setLookupResults(null)
    setResetSuccess(null)
    setLookupError('')

    fetch('/api/admin/users/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: u.email }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.users && data.users.length > 0) {
          setSelectedUserForReset(data.users[0])
        } else {
          setSelectedUserForReset({
            user_id: u.user_id,
            email: u.email,
            display_name: u.display_name,
            role: u.role,
            team_name: u.display_name || 'Team',
            bookings: [],
          })
        }
      })
      .catch(() => {
        setSelectedUserForReset({
          user_id: u.user_id,
          email: u.email,
          display_name: u.display_name,
          role: u.role,
          team_name: u.display_name || 'Team',
          bookings: [],
        })
      })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle Password Reset
  async function handleResetPassword() {
    if (!selectedUserForReset) return
    const teamLabel = selectedUserForReset.team_name || selectedUserForReset.email
    const pass = tempPassword.trim() || 'user12345'

    if (!confirm(`CONFIRM PASSWORD RESET:\n\nAre you 100% sure you want to reset password for:\n"${teamLabel}" (${selectedUserForReset.email})\n\nNew Temporary Password: ${pass}\n\nOnly the login password will change. Team bookings, points, and all other data will remain untouched.`)) {
      return
    }

    setResetting(true)
    setLookupError('')
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: selectedUserForReset.user_id,
          target_email: selectedUserForReset.email,
          new_password: pass,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password')
      }
      setResetSuccess(data)
    } catch (err: any) {
      setLookupError(err.message || 'Password reset failed')
    } finally {
      setResetting(false)
    }
  }

  function copyWhatsAppMessage(data: any) {
    const text = `Hey captain! Your account password for ${data.team_name} has been reset to:\n👉 ${data.temp_password}\n\nYou can now sign in at:\nhttps://battlegroundsfaceoffseries.com/login\n\nOnce logged in, please head to your Profile & Settings to set your own permanent password.`
    navigator.clipboard.writeText(text)
    setCopiedWhatsapp(true)
    setTimeout(() => setCopiedWhatsapp(false), 3500)
  }

  return (
    <div>
      <h2 className={styles.tabTitle}>User &amp; Role Management</h2>
      <p className={styles.tabDesc}>Assign admin roles, toggle test accounts, or securely verify teams and reset passwords.</p>

      {/* ── MANUAL PASSWORD RESET & TEAM LOOKUP TOOL ── */}
      <div style={{
        background: 'linear-gradient(180deg, #18181b 0%, #121214 100%)',
        border: '1px solid #3f3f46',
        borderRadius: '12px',
        padding: '1.5rem',
        marginTop: '1.25rem',
        marginBottom: '2rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <KeyRound size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
              Manual Team Password Reset &amp; Identity Verification
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Search by player email or team name $\rightarrow$ verify booked matches $\rightarrow$ safely reset password without email delivery delays.
            </p>
          </div>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px', background: '#202024', border: '1px solid #3f3f46', borderRadius: '8px', padding: '0.65rem 1rem' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Enter team email (e.g. captain@gmail.com) or team name..."
              value={lookupQuery}
              onChange={e => setLookupQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '0.85rem',
                width: '100%',
              }}
            />
            {lookupQuery && (
              <button
                type="button"
                onClick={() => { setLookupQuery(''); setLookupResults(null); setSelectedUserForReset(null); setResetSuccess(null) }}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || !lookupQuery.trim()}
            style={{
              padding: '0.65rem 1.5rem',
              background: searching ? '#3f3f46' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: searching ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {searching ? <><RefreshCw size={14} className="spin" /> Searching...</> : <><Search size={14} /> Find Team</>}
          </button>
        </form>

        {lookupError && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{lookupError}</span>
          </div>
        )}

        {/* Multi-result selector */}
        {lookupResults && lookupResults.length > 1 && !selectedUserForReset && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Multiple matching accounts found ({lookupResults.length}). Select the exact team:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {lookupResults.map(r => (
                <div
                  key={r.user_id}
                  onClick={() => setSelectedUserForReset(r)}
                  style={{
                    background: '#202024',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = '#27272a' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.background = '#202024' }}
                >
                  <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '0.95rem' }}>{r.team_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#e4e4e7' }}>{r.email}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Role: {r.role} · Bookings: {r.bookings?.length || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Identity Verification Card & Reset Action */}
        {selectedUserForReset && (
          <div style={{
            marginTop: '1.25rem',
            background: '#202024',
            border: '1px solid #f59e0b',
            borderRadius: '10px',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #2e2e34', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.05em' }}>
                🛡️ IDENTITY VERIFICATION CARD
              </span>
              <button
                type="button"
                onClick={() => setSelectedUserForReset(null)}
                style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Clear Selection
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>TEAM NAME</span>
                <strong style={{ color: '#fbbf24', fontSize: '1.1rem' }}>{selectedUserForReset.team_name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>REGISTERED EMAIL</span>
                <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{selectedUserForReset.email}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>ACCOUNT ROLE</span>
                <span className={`badge ${selectedUserForReset.role === 'admin' ? 'badge-gold' : 'badge-neutral'}`}>
                  {selectedUserForReset.role || 'player'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>REGISTERED ON</span>
                <span style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>
                  {selectedUserForReset.created_at ? formatNumericDate(selectedUserForReset.created_at) : '—'}
                </span>
              </div>
            </div>

            {/* Bookings cross-verification box */}
            <div style={{
              background: '#18181b',
              border: '1px solid #2e2e34',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
            }}>
              <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: '0.75rem', marginBottom: '4px' }}>
                MATCH BOOKINGS CHECK (Cross-verify with player on WhatsApp):
              </div>
              {selectedUserForReset.bookings && selectedUserForReset.bookings.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#e4e4e7' }}>
                  {selectedUserForReset.bookings.map((b: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: '2px' }}>
                      <strong>{formatNumericDate(b.slot_date)} ({b.slot_time})</strong> — Room Slot #{b.room_slot_number || 5} ({b.payment_status})
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No tournament match slots booked yet by this team.
                </div>
              )}
            </div>

            {/* Password Reset Action Area */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              borderTop: '1px solid #2e2e34',
              paddingTop: '1rem',
            }}>
              <div style={{ flex: '1', minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#e4e4e7', marginBottom: '4px' }}>
                  NEW TEMPORARY PASSWORD
                </label>
                <input
                  type="text"
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  disabled={resetting}
                  placeholder="user12345"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#facc15',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting || selectedUserForReset.email?.toLowerCase() === 'admin@gmail.com'}
                style={{
                  padding: '0.65rem 1.5rem',
                  background: resetting || selectedUserForReset.email?.toLowerCase() === 'admin@gmail.com' ? '#3f3f46' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: resetting || selectedUserForReset.email?.toLowerCase() === 'admin@gmail.com' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {resetting ? (
                  <><RefreshCw size={14} className="spin" /> Resetting Password...</>
                ) : (
                  <><KeyRound size={14} /> Reset Password for {selectedUserForReset.team_name}</>
                )}
              </button>
            </div>

            {selectedUserForReset.email?.toLowerCase() === 'admin@gmail.com' && (
              <div style={{ color: '#fbbf24', fontSize: '0.75rem', marginTop: '6px', fontWeight: 600 }}>
                🔒 Super Admin account is protected from manual password resets.
              </div>
            )}
          </div>
        )}

        {/* Success Confirmation & Copy WhatsApp Reply Card */}
        {resetSuccess && (
          <div style={{
            marginTop: '1.25rem',
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid #22c55e',
            borderRadius: '10px',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontWeight: 800, fontSize: '1rem', marginBottom: '0.5rem' }}>
              <CheckCircle size={20} />
              Password Successfully Reset!
            </div>
            <p style={{ margin: '0 0 1rem', color: '#bbf7d0', fontSize: '0.85rem' }}>
              The account for <strong>{resetSuccess.team_name}</strong> ({resetSuccess.email}) was updated. Temporary login password is:
              <span style={{ background: '#000', color: '#facc15', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, marginLeft: '6px', fontSize: '0.95rem' }}>
                {resetSuccess.temp_password}
              </span>
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => copyWhatsAppMessage(resetSuccess)}
                style={{
                  padding: '0.65rem 1.25rem',
                  background: copiedWhatsapp ? '#16a34a' : '#22c55e',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                }}
              >
                {copiedWhatsapp ? <><Check size={16} /> Copied to Clipboard!</> : <><Copy size={16} /> Copy WhatsApp Reply Message</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ALL USERS TABLE ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.75rem', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
            All Registered Accounts ({filteredUsers.length}{tableSearch ? ` of ${users.length}` : ''})
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Quick lookup &amp; account controls
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: '6px', padding: '0.3rem 0.65rem' }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Filter table rows..."
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.75rem',
              width: '180px',
            }}
          />
          {tableSearch && (
            <button
              type="button"
              onClick={() => setTableSearch('')}
              style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="table-wrapper">
        <table style={{ width: '100%', minWidth: '820px', tableLayout: 'fixed', fontSize: '0.8rem' }}>
          <colgroup>
            <col style={{ width: '26%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '23%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '0.45rem 0.65rem', fontSize: '0.72rem' }}>Email</th>
              <th style={{ padding: '0.45rem 0.65rem', fontSize: '0.72rem' }}>Display Name</th>
              <th style={{ padding: '0.45rem 0.65rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Current Role</th>
              <th style={{ padding: '0.45rem 0.65rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Test Account</th>
              <th style={{ padding: '0.45rem 0.65rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Change Role</th>
              <th style={{ padding: '0.45rem 0.65rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={u.user_id}>
                <td style={{ padding: '0.4rem 0.65rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.email}>
                  <strong style={{ fontSize: '0.82rem', color: '#fff' }}>{u.email}</strong>
                </td>
                <td style={{ padding: '0.4rem 0.65rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem', color: '#e4e4e7' }} title={u.display_name || ''}>
                  {u.display_name || '—'}
                </td>
                <td style={{ padding: '0.4rem 0.65rem', whiteSpace: 'nowrap' }}>
                  <span className={`badge ${u.role === 'admin' ? 'badge-gold' : u.role === 'admin_scores' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                    {u.role || 'player'}
                  </span>
                </td>
                <td style={{ padding: '0.4rem 0.65rem', whiteSpace: 'nowrap' }}>
                  {u.is_test_account ? (
                    <span className="badge badge-warning" style={{ background: '#f59e0b', color: '#000', fontWeight: 800, fontSize: '0.7rem', padding: '2px 6px' }}>
                      🧪 Test ON
                    </span>
                  ) : (
                    <span className="badge badge-neutral" style={{ color: '#888', fontSize: '0.7rem', padding: '2px 6px' }}>
                      Real
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.4rem 0.65rem', whiteSpace: 'nowrap' }}>
                  <select
                    className="form-input"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: 'auto', minWidth: '95px', height: '26px', opacity: u.email?.toLowerCase() === 'admin@gmail.com' ? 0.6 : 1 }}
                    value={u.role || 'player'}
                    disabled={u.email?.toLowerCase() === 'admin@gmail.com'}
                    onChange={e => onUpdateRole(u.user_id, e.target.value)}
                  >
                    <option value="player">Player</option>
                    <option value="captain">Captain</option>
                    <option value="admin_scores">Score Admin</option>
                    <option value="admin">Super Admin</option>
                  </select>
                </td>
                <td style={{ padding: '0.4rem 0.65rem', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                    {/* Reset Password Action Button */}
                    {u.email?.toLowerCase() !== 'admin@gmail.com' && (
                      <button
                        className="btn"
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#fbbf24',
                          padding: '0.2rem 0.45rem',
                          fontSize: '0.7rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontWeight: 700,
                          height: '26px',
                          whiteSpace: 'nowrap',
                        }}
                        onClick={() => selectUserFromTable(u)}
                        title="Reset this user's password"
                      >
                        <KeyRound size={11} /> Reset Pass
                      </button>
                    )}

                    {onToggleTestMode && (
                      <button
                        className="btn"
                        style={{
                          background: u.is_test_account ? '#374151' : '#d97706',
                          color: '#fff',
                          padding: '0.2rem 0.45rem',
                          fontSize: '0.7rem',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          height: '26px',
                          whiteSpace: 'nowrap',
                        }}
                        onClick={() => onToggleTestMode(u.user_id, u.is_test_account)}
                      >
                        {u.is_test_account ? 'Test OFF' : 'Test ON'}
                      </button>
                    )}
                    {onDeleteUser && u.email?.toLowerCase() !== 'admin@gmail.com' && (
                      <button
                        className="btn"
                        style={{ background: '#ef4444', color: '#fff', padding: '0.2rem 0.45rem', fontSize: '0.7rem', borderRadius: '4px', border: 'none', cursor: 'pointer', height: '26px', whiteSpace: 'nowrap' }}
                        onClick={() => onDeleteUser(u.user_id)}
                      >
                        Delete
                      </button>
                    )}
                    {u.email?.toLowerCase() === 'admin@gmail.com' && (
                      <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700 }}>
                        🔒 Protected
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No matching accounts found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
