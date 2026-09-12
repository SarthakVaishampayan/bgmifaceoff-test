'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPlacementPoints, getPositionPoints, getKillPoints } from '@/lib/scoring'
import { formatShortDate, formatMonthDay, formatFullLongDate, formatNumericDate } from '@/lib/utils/formatDate'
import { isSlotPastOrEnded, getSlotStartMinutes } from '@/lib/utils/slotTime'
import { Copy, Check, Eye, CreditCard, AlertCircle, X, CheckCircle, ChevronDown } from 'lucide-react'
import styles from './page.module.css'

type AdminTab = 'scores' | 'slots' | 'payouts' | 'upi_info' | 'bookings' | 'coupons' | 'config' | 'users'

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
  const [users, setUsers] = useState(usersList)
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
  const uniquePendingKeys = new Set(payouts.filter(p => p.status === 'pending').map(p => `${p.slot_id}_${p.team_id}`))
  const pendingPayoutsCount = uniquePendingKeys.size

  const allTabs: { id: AdminTab; label: string; superOnly?: boolean }[] = [
    { id: 'scores', label: 'Score Entry' },
    { id: 'slots', label: 'Slots', superOnly: true },
    { id: 'upi_info', label: 'UPI Info', superOnly: false },
    { id: 'payouts', label: pendingPayoutsCount > 0 ? `Payouts (${pendingPayoutsCount})` : 'Payouts', superOnly: true },
    { id: 'bookings', label: 'Bookings', superOnly: true },
    { id: 'coupons', label: 'Coupons', superOnly: true },
    { id: 'config', label: 'Config', superOnly: true },
    { id: 'users', label: 'Admin Roles', superOnly: true },
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
    await supabase
      .from('users')
      .update({ role: newRole })
      .eq('user_id', userId)

    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u))
  }

  async function deleteUser(userId: string) {
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
          {tab === 'scores' && <ScoreEntryTab slots={slots} teams={teams} supabase={supabase} onSyncPayouts={refreshPayouts} />}
          {isSuperAdmin && tab === 'slots' && <SlotsTab slots={slots} setSlots={setSlots} supabase={supabase} teams={teams} onSyncPayouts={refreshPayouts} />}
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
            />
          )}
          {isSuperAdmin && tab === 'bookings' && <BookingsTab bookings={bookings} />}
          {isSuperAdmin && tab === 'coupons' && <CouponsTab coupons={coupons} teams={teams} supabase={supabase} />}
          {isSuperAdmin && tab === 'config' && <ConfigTab config={config} supabase={supabase} />}
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
function ScoreEntryTab({ slots, teams, supabase, onSyncPayouts }: any) {
  const sortedSlots = useMemo(() => {
    return sortSlotsDescending(slots)
  }, [slots])

  const [selectedSlot, setSelectedSlot] = useState(() => {
    const list = sortSlotsDescending(slots)
    return list.length > 0 ? list[0].slot_id : ''
  })
  const [selectedTeam, setSelectedTeam] = useState('')
  const [matchNum, setMatchNum] = useState(1)
  const [position, setPosition] = useState('')
  const [kills, setKills] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [bookedTeams, setBookedTeams] = useState<any[]>([])
  const [recordedMatches, setRecordedMatches] = useState<any[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)

  // Automatically load data for the latest slot on initial render
  useEffect(() => {
    if (selectedSlot) {
      loadSlotData(selectedSlot)
    }
  }, [])

  // Live Mathematical Auto-Calculations
  const posNum = parseInt(position)
  const killsNum = parseInt(kills) || 0
  const positionPoints = position && posNum >= 1 && posNum <= 24 ? getPositionPoints(posNum) : 0
  const eliminationPoints = killsNum * 1
  const totalPoints = positionPoints + eliminationPoints

  // Cumulative Total Points per team for the selected slot
  const teamSlotTotals = useMemo(() => {
    const map: Record<string, {
      team_id: string
      team_name: string
      room_slot_number: number
      total_points: number
      total_kills: number
      total_pos_points: number
      matches_count: number
    }> = {}

    bookedTeams.forEach(t => {
      map[t.team_id] = {
        team_id: t.team_id,
        team_name: t.team_name,
        room_slot_number: t.room_slot_number || 5,
        total_points: 0,
        total_kills: 0,
        total_pos_points: 0,
        matches_count: 0,
      }
    })

    recordedMatches.forEach((m: any) => {
      if (!map[m.team_id]) {
        map[m.team_id] = {
          team_id: m.team_id,
          team_name: m.teams?.team_name || 'Team #' + String(m.team_id).slice(0, 5),
          room_slot_number: 5,
          total_points: 0,
          total_kills: 0,
          total_pos_points: 0,
          matches_count: 0,
        }
      }
      const entry = map[m.team_id]
      entry.total_points += (m.total_points || 0)
      entry.total_kills += (m.kills || 0)
      const posPts = m.placement_points !== undefined ? m.placement_points : Math.max(0, (m.total_points || 0) - (m.kills || 0))
      entry.total_pos_points += posPts
      entry.matches_count += 1
    })

    return map
  }, [bookedTeams, recordedMatches])

  const slotStandingsList = useMemo(() => {
    return Object.values(teamSlotTotals).sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      if (b.total_kills !== a.total_kills) return b.total_kills - a.total_kills
      return a.room_slot_number - b.room_slot_number
    }).map((item, idx) => ({ ...item, rank: idx + 1 }))
  }, [teamSlotTotals])

  // Filter booked teams: only show teams booked in selected slot that do NOT have a score for current matchNum yet (excluding the record currently being edited)
  const availableTeams = bookedTeams.filter(t => {
    const alreadyScored = recordedMatches.some(
      m => m.match_number === matchNum &&
           String(m.team_id) === String(t.team_id) &&
           String(m.match_id) !== String(editingMatchId)
    )
    return !alreadyScored
  })

  async function loadSlotData(slotId: string) {
    if (!slotId) {
      setBookedTeams([])
      setRecordedMatches([])
      return
    }

    // Load booked teams for slot
    const { data: bData } = await supabase
      .from('bookings')
      .select('team_id, room_slot_number, teams(team_id, team_name)')
      .eq('slot_id', slotId)
      .eq('payment_status', 'paid')
    setBookedTeams(bData?.map((b: any) => ({
      ...(b.teams || {}),
      room_slot_number: b.room_slot_number || 5,
    })).filter(Boolean) || [])

    // Load recorded matches for slot
    setLoadingMatches(true)
    const { data: mData } = await supabase
      .from('matches')
      .select('*, teams(team_name)')
      .eq('slot_id', slotId)
      .order('match_number', { ascending: true })
    setRecordedMatches(mData || [])
    setLoadingMatches(false)
  }

  function handleEditMatch(m: any) {
    setEditingMatchId(m.match_id)
    setMatchNum(m.match_number)
    setSelectedTeam(m.team_id)
    setPosition(String(m.placement))
    setKills(String(m.kills))
    setMsg(`✏️ Editing Match ${m.match_number} score for ${m.teams?.team_name || 'selected team'}`)
  }

  function handleCancelEdit() {
    setEditingMatchId(null)
    setPosition('')
    setKills('')
    setSelectedTeam('')
    setMsg('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setSaving(true)

    const pos = parseInt(position)
    const k = parseInt(kills) || 0
    const posPts = getPositionPoints(pos)
    const elimPts = k * 1
    const total = posPts + elimPts

    const { error } = await supabase
      .from('matches')
      .upsert({
        slot_id: selectedSlot,
        match_number: matchNum,
        team_id: selectedTeam,
        placement: pos,
        kills: k,
        placement_points: posPts,
        kill_points: elimPts,
        total_points: total,
      }, { onConflict: 'slot_id,match_number,team_id' })

    setSaving(false)
    if (error) {
      setMsg('❌ Error: ' + error.message)
    } else {
      const teamObj = bookedTeams.find(t => String(t.team_id) === String(selectedTeam))
      const name = teamObj?.team_name || 'Team'
      const message = editingMatchId ? `✅ Score updated for ${name} (Match ${matchNum})!` : `✅ Saved! Match ${matchNum}: #${pos} (${posPts} Pos Pts) + ${k} Elims (${elimPts} Elim Pts) = ${total} Total`

      setMsg(message)
      setEditingMatchId(null)
      setPosition('')
      setKills('')
      setSelectedTeam('')
      loadSlotData(selectedSlot)
      if (onSyncPayouts) onSyncPayouts()
    }
  }

  async function handleDeleteMatch(matchId: string, teamName?: string) {
    if (!confirm(`Delete match score entry for ${teamName || 'this team'}?`)) return
    
    if (editingMatchId === matchId) handleCancelEdit()
    setMsg('')
    // Optimistically update UI so team immediately reappears in dropdown for this match
    setRecordedMatches(prev => prev.filter(m => String(m.match_id) !== String(matchId)))

    const { error } = await supabase.from('matches').delete().eq('match_id', matchId)
    if (error) {
      setMsg('❌ Failed to delete match score: ' + error.message)
      await loadSlotData(selectedSlot)
    } else {
      setMsg(`✅ Score deleted for ${teamName || 'team'}. Team is now available in dropdown again!`)
      await loadSlotData(selectedSlot)
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
      setBackupMsg(`✅ Backup downloaded! (${allMatches?.length || 0} match score records)`)
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
      if (!confirm(`Are you sure you want to restore ${json.matches.length} match score records from this backup?`)) return

      let restoredCount = 0
      for (const m of json.matches) {
        const { error } = await supabase.from('matches').upsert({
          slot_id: m.slot_id,
          match_number: m.match_number,
          team_id: m.team_id,
          placement: m.placement,
          kills: m.kills,
          placement_points: m.placement_points,
          kill_points: m.kill_points,
          total_points: m.total_points,
        }, { onConflict: 'slot_id,match_number,team_id' })
        if (!error) restoredCount++
      }

      setBackupMsg(`✅ Successfully restored ${restoredCount} match score records!`)
      if (selectedSlot) await loadSlotData(selectedSlot)
    } catch (err: any) {
      setBackupMsg(`❌ Restore failed: ${err.message}`)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 className={styles.tabTitle}>Points Table Score Entry</h2>
        </div>

        {/* 💾 Instant Backup & Restore Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.78rem', background: '#1e1e1e', borderColor: '#333333', color: '#fbbf24', fontWeight: 700 }}
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

      <div className={styles.scoreEntryLayout}>
        {/* Main Entry Form */}
        <div className={styles.scoreFormCard}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Top Row: Slot & Team Selection */}
            <div className={styles.scoreFormTopRow}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Select Slot</label>
                <select
                  className="form-input"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%' }}
                  value={selectedSlot}
                  onChange={e => {
                    setSelectedSlot(e.target.value)
                    setSelectedTeam('')
                    loadSlotData(e.target.value)
                  }}
                  required
                >
                  <option value="">Select slot...</option>
                  {sortedSlots.map((s: any) => (
                    <option key={s.slot_id} value={s.slot_id}>
                      {formatShortDate(s.date)} • {s.time_label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                  Select Team {availableTeams.length > 0 && <span style={{ color: '#22c55e', fontWeight: 600 }}>({availableTeams.length} available)</span>}
                </label>
                <select
                  className="form-input"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%' }}
                  value={selectedTeam}
                  onChange={e => setSelectedTeam(e.target.value)}
                  required
                >
                  <option value="">
                    {!selectedSlot
                      ? 'Select a slot first'
                      : bookedTeams.length === 0
                      ? 'No registered teams in slot'
                      : availableTeams.length === 0
                      ? `All teams scored for Match ${matchNum}`
                      : 'Select registered team...'}
                  </option>
                  {availableTeams.map((t: any) => {
                    const tot = teamSlotTotals[t.team_id]?.total_points || 0
                    return (
                      <option key={t.team_id} value={t.team_id}>
                        {t.team_name} [Slot {t.room_slot_number || 5}] {tot > 0 ? `• Current Total: ${tot} pts` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* Second Row: Match #, Position, Eliminations */}
            <div className={styles.scoreFormMidRow}>
              <div className={styles.matchNumCol}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Match Number</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      type="button"
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.3rem',
                        fontSize: '0.78rem',
                        fontWeight: matchNum === n ? 800 : 500,
                        background: matchNum === n ? '#fbbf24' : '#1e1e1e',
                        color: matchNum === n ? '#111111' : '#aaaaaa',
                        border: matchNum === n ? '1px solid #fbbf24' : '1px solid #333333',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => {
                        setMatchNum(n)
                        setSelectedTeam('')
                      }}
                    >
                      Match {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Position (1–24)</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%' }}
                  min={1}
                  max={24}
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  placeholder="e.g. 1"
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Eliminations</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%' }}
                  min={0}
                  max={99}
                  value={kills}
                  onChange={e => setKills(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            {/* Compact Live Mathematical Calculation Strip */}
            <div className={styles.calcStrip}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#888888', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700 }}>Pos Pts:</span>
                <strong style={{ color: '#fbbf24', fontSize: '0.9rem' }}>{position ? positionPoints : '—'}</strong>
              </div>

              <span style={{ color: '#444444' }}>+</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#888888', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700 }}>Elim Pts:</span>
                <strong style={{ color: '#4ade80', fontSize: '0.9rem' }}>{eliminationPoints}</strong>
              </div>

              <span style={{ color: '#444444' }}>=</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#888888', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700 }}>Match Total:</span>
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
                  {position ? `${totalPoints} PTS` : '—'}
                </strong>
              </div>

              {selectedTeam && (
                <div className={styles.calcCumulative}>
                  <span style={{ color: '#888888', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700 }}>Cumul. Slot Total:</span>
                  <strong style={{ color: '#60a5fa', fontSize: '0.95rem', fontWeight: 900 }}>
                    {(teamSlotTotals[selectedTeam]?.total_points || 0) + (editingMatchId ? 0 : (position ? totalPoints : 0))} PTS
                  </strong>
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
                disabled={saving}
              >
                {saving ? 'Saving Score...' : editingMatchId ? 'Update Match Score →' : 'Save Match Score →'}
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

        {/* Reference Cheat Sheet Box */}
        <div className={styles.cheatSheetCard}>
          <h3 style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            BGIS Position Points Table
          </h3>
          <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a', textAlign: 'left', color: '#777777' }}>
                <th style={{ padding: '4px 6px' }}>Position</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1st Place', '10 Pts'],
                ['2nd Place', '6 Pts'],
                ['3rd Place', '5 Pts'],
                ['4th Place', '4 Pts'],
                ['5th Place', '3 Pts'],
                ['6th–10th Place', '2 Pts'],
                ['11th–15th Place', '1 Pt'],
                ['16th–24th Place', '0 Pts'],
              ].map(([posStr, ptStr]) => (
                <tr key={posStr} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '4px 6px', color: '#cccccc', fontWeight: 500 }}>{posStr}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', color: '#fbbf24', fontWeight: 700 }}>{ptStr}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid #2a2a2a' }}>
                <td style={{ padding: '5px 6px', color: '#4ade80', fontWeight: 600 }}>Each Elimination</td>
                <td style={{ padding: '5px 6px', textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>1 Pt</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recorded Scores List for Selected Slot */}
      {selectedSlot && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Recorded Match Scores ({recordedMatches.length})
            </h3>
          </div>
          <div className="table-wrapper">
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Match #</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Team</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Position</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Pos Pts</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Elim Pts</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Match Pts</th>
                  <th style={{ padding: '0.4rem 0.6rem', color: '#60a5fa' }}>Team Slot Total</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recordedMatches.map((m: any) => (
                  <tr key={m.match_id} style={editingMatchId === m.match_id ? { background: 'rgba(251, 191, 36, 0.1)' } : {}}>
                    <td style={{ padding: '0.4rem 0.6rem' }}><strong style={{ color: '#fbbf24' }}>Match {m.match_number}</strong></td>
                    <td style={{ padding: '0.4rem 0.6rem' }}><strong>{m.teams?.team_name || m.team_id}</strong></td>
                    <td style={{ padding: '0.4rem 0.6rem' }}>#{m.placement}</td>
                    <td style={{ padding: '0.4rem 0.6rem', color: '#fbbf24', fontWeight: 600 }}>{m.placement_points} pts</td>
                    <td style={{ padding: '0.4rem 0.6rem', color: '#4ade80', fontWeight: 600 }}>{m.kills} elims ({m.kill_points} pts)</td>
                    <td style={{ padding: '0.4rem 0.6rem' }}><strong style={{ color: '#ffffff', fontSize: '0.88rem' }}>{m.total_points} PTS</strong></td>
                    <td style={{ padding: '0.4rem 0.6rem' }}><strong style={{ color: '#60a5fa', fontSize: '0.88rem' }}>{teamSlotTotals[m.team_id]?.total_points || m.total_points} PTS</strong></td>
                    <td style={{ padding: '0.4rem 0.6rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#fbbf24', borderColor: '#fbbf24', padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                          onClick={() => handleEditMatch(m)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                          onClick={() => handleDeleteMatch(m.match_id, m.teams?.team_name)}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {recordedMatches.length === 0 && !loadingMatches && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#777777', padding: '1rem' }}>
                      No score entries recorded for this slot yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Slot Overall Cumulative Standings Summary */}
          {slotStandingsList.length > 0 && (
            <div style={{ marginTop: '1.5rem', background: '#121212', border: '1px solid #252525', borderRadius: '10px', padding: '1rem' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fbbf24', margin: '0 0 0.75rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🏆 Slot Cumulative Team Standings ({slotStandingsList.length} Teams)
              </h3>
              <div className="table-wrapper">
                <table style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#181818' }}>
                      <th style={{ padding: '0.4rem 0.6rem', width: '50px' }}>Rank</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Team Name</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Room Slot</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Matches Played</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: '#fbbf24' }}>Pos Pts</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: '#4ade80' }}>Elims</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: '#60a5fa' }}>Grand Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slotStandingsList.map((t: any) => (
                      <tr key={t.team_id}>
                        <td style={{ padding: '0.4rem 0.6rem' }}><strong style={{ color: t.rank === 1 ? '#fbbf24' : t.rank === 2 ? '#94a3b8' : t.rank === 3 ? '#cd7f32' : '#aaaaaa' }}>#{t.rank}</strong></td>
                        <td style={{ padding: '0.4rem 0.6rem' }}><strong>{t.team_name}</strong></td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: '#888' }}>Slot {t.room_slot_number}</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>{t.matches_count} / 3</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: '#fbbf24', fontWeight: 600 }}>{t.total_pos_points} pts</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: '#4ade80', fontWeight: 600 }}>{t.total_kills} elims</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                          <strong style={{ color: '#60a5fa', fontSize: '0.95rem', fontWeight: 800 }}>{t.total_points} PTS</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
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

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getTomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDayAfterStr() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

// ── SLOTS MANAGEMENT TAB ──────────────────────────────────────────
function SlotsTab({ slots, setSlots, supabase, teams, onSyncPayouts }: any) {
  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  const dayAfterStr = getDayAfterStr()

  const [selectedDate, setSelectedDate] = useState(tomorrowStr)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'not_open' | 'completed'>('all')
  const [msg, setMsg] = useState('')
  const [loadingPresetId, setLoadingPresetId] = useState<number | null>(null)

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

      // 2. Base window before any parentheses (e.g. "9:00 PM – 11:00 PM (Match 1:...)")
      const windowPart = rawLabel.split('(')[0].trim()
      const windowNorm = windowPart.toLowerCase().replace(/\s+/g, ' ').trim()

      if (windowNorm === presetLabelNorm || windowNorm.startsWith(presetLabelNorm)) {
        return true
      }

      // 3. Strict START time match before the dash (e.g. "1:00 PM" from "1:00 PM – 3:00 PM")
      const splitDash = windowPart.split(/\s*(?:–|-|to)\s*/i)
      if (splitDash.length > 0) {
        const rawStart = splitDash[0].replace(/^.*[•·|]\s*/, '').trim()
        if (normalizeStartTime(rawStart) === presetStartTime) {
          return true
        }
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
    const entryFee = form.entry_fee || existing?.entry_fee || 50
    const capacity = form.capacity || existing?.capacity || 20

    if (existing) {
      const { data, error } = await supabase
        .from('slots')
        .update({
          status: 'open',
          time_label: timeLabel,
          whatsapp_link: whatsappLink,
          entry_fee: entryFee,
          capacity: capacity,
        })
        .eq('slot_id', existing.slot_id)
        .select()
        .single()

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
      }
      setMsg(`✅ ${preset.name} (${selectedDate}) OPENED for registrations!`)
    } else {
      const { data, error } = await supabase.from('slots').insert({
        date: selectedDate,
        time_label: timeLabel,
        capacity: capacity,
        entry_fee: entryFee,
        status: 'open',
        whatsapp_link: whatsappLink,
      }).select().single()

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        setSlots((prev: any[]) => [...prev, data])
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
      const entryFee = form.entry_fee || 50
      const capacity = form.capacity || 20

      const { data, error } = await supabase.from('slots').insert({
        date: selectedDate,
        time_label: timeLabel,
        capacity: capacity,
        entry_fee: entryFee,
        status: 'full',
        whatsapp_link: whatsappLink,
      }).select().single()

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        setSlots((prev: any[]) => [...prev, data])
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

  // Save changes to time, whatsapp link, entry fee, capacity
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
    const entryFee = form.entry_fee || existing?.entry_fee || 50
    const capacity = form.capacity || existing?.capacity || 20

    if (existing) {
      const { data, error } = await supabase
        .from('slots')
        .update({
          time_label: timeLabel,
          whatsapp_link: whatsappLink,
          entry_fee: entryFee,
          capacity: capacity,
        })
        .eq('slot_id', existing.slot_id)
        .select()
        .single()

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        setSlots((prev: any[]) => prev.map((s: any) => s.slot_id === data.slot_id ? data : s))
      }
      setMsg(`✅ Details saved for ${preset.name}!`)
    } else {
      const { data, error } = await supabase.from('slots').insert({
        date: selectedDate,
        time_label: timeLabel,
        capacity: capacity,
        entry_fee: entryFee,
        status: 'open',
        whatsapp_link: whatsappLink,
      }).select().single()

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        setSlots((prev: any[]) => [...prev, data])
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

    if (!existing) {
      const form = getForm(preset.id)
      const baseLabel = form.time_label ?? preset.defaultLabel
      const m1 = form.m1_time
      const m2 = form.m2_time
      const m3 = form.m3_time
      const timeLabel = buildTimeLabel(baseLabel, m1, m2, m3)
      const whatsappLink = form.whatsapp_link !== undefined ? form.whatsapp_link.trim() : null
      const entryFee = form.entry_fee || 50
      const capacity = form.capacity || 20

      const { data, error } = await supabase.from('slots').insert({
        date: selectedDate,
        time_label: timeLabel,
        capacity,
        entry_fee: entryFee,
        status: 'completed',
        whatsapp_link: whatsappLink,
      }).select().single()

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      if (data && setSlots) {
        setSlots((prev: any[]) => [...prev, data])
      }
      setMsg(`✅ ${preset.name} (${selectedDate}) marked as COMPLETED! Results published to leaderboards & UPI info.`)
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
        setMsg(`✅ ${preset.name} (${selectedDate}) marked as COMPLETED! Standings officially published on leaderboards & UPI info.`)
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
            Select a date below to configure match schedules, open/close bookings, and finalize completed slots. When a slot is marked completed, its scores are officially published to the live leaderboards and UPI payout queue.
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
                  const currentFee = form.entry_fee ?? existingSlot?.entry_fee ?? 50
                  const currentCap = form.capacity ?? existingSlot?.capacity ?? 20

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
                          <span>Auto-closed: bookings locked 10 mins before slot start</span>
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
                          {isLoading ? '...' : isCompleted ? '↩️ Revert Open' : '🏆 Complete'}
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
                                  placeholder="1:54 PM"
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
                                  placeholder="2:30 PM"
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
                        <span>Auto-closed: bookings locked 10 mins before slot start</span>
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
                              defaultValue={extraSlot.entry_fee || 50}
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
function PayoutSlipModal({ slip, onClose }: { slip: any; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!slip) return null

  const slipCode = `BGFS-PAY-${(slip.payout_id || '').slice(0, 8).toUpperCase()}`
  const dateFormatted = slip.paid_at ? formatNumericDate(slip.paid_at) : '—'
  const slotFormatted = slip.slots ? `${formatShortDate(slip.slots.date)} • ${slip.slots.time_label}` : '—'

  function copySlipText() {
    const text = `=== BGFS OFFICIAL PAYOUT SLIP ===\nSlip Reference: ${slipCode}\nTeam: ${slip.teams?.team_name || 'N/A'}\nSlot: ${slotFormatted}\nStanding: ${slip.place || 'Participant'}\nAmount: ₹${slip.amount}\nUPI ID: ${slip.upi_id || 'N/A'}\nStatus: PAID OUT\nPaid On: ${dateFormatted}\n=================================`
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
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(21,128,61,0.25))',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '10px',
          padding: '1.2rem',
          textAlign: 'center',
          marginBottom: '1.25rem',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            TOTAL AMOUNT DISBURSED
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#4ade80', margin: '4px 0' }}>
            ₹{slip.amount}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(34,197,94,0.25)', color: '#22c55e', padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
            ✓ STATUS: PAID OUT
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

          {slip.place && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
              <span style={{ color: '#888' }}>Final Standing:</span>
              <span className={`badge ${slip.place === '1st' ? 'badge-gold' : 'badge-silver'}`}>
                {slip.place} Place
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
            <span style={{ color: '#888' }}>Paid On:</span>
            <span style={{ color: '#aaa' }}>{dateFormatted}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={copySlipText}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
            {copied ? 'Copied Details!' : 'Copy Slip Details'}
          </button>
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
  onPayoutSettled
}: {
  payouts: any[];
  onPayoutSettled: (payout: any) => void
}) {
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null)
  const [payoutTarget, setPayoutTarget] = useState<any | null>(null)
  const [payoutAmount, setPayoutAmount] = useState<string>('')
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false)
  const [payoutError, setPayoutError] = useState('')

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
      rank: p.place === '1st' ? 1 : p.place === '2nd' ? 2 : 1,
      place: p.place,
      total_points: p.total_points,
      upi_id: p.upi_id,
      slot_id: p.slot_id,
      slots: p.slots,
    })
    setPayoutAmount('')
    setPayoutError('')
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
          place: payoutTarget.place || (payoutTarget.rank === 1 ? '1st' : '2nd'),
          upi_id: payoutTarget.upi_id || null,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record payout')
      }

      onPayoutSettled(data.payout)
      setPayoutTarget(null)
      setPayoutAmount('')
      setSelectedSlip(data.payout)
    } catch (err: any) {
      setPayoutError(err.message || 'Error creating payout')
    } finally {
      setIsSubmittingPayout(false)
    }
  }

  return (
    <div>
      <h2 className={styles.tabTitle}>Payouts</h2>
      <p className={styles.tabDesc}>
        Track tournament prize disbursements, review settled payout slips, and disburse prizes to top 2 winners.
      </p>

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
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Top 2 slot winners awaiting disbursement</div>
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
                      {p.place ? (
                        <span className={`badge ${p.place === '1st' ? 'badge-gold' : 'badge-silver'}`}>
                          {p.place}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.85rem', color: p.upi_id ? '#4ade80' : '#888' }}>
                        {p.upi_id || 'No UPI on file'}
                      </code>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        id={`mark-paid-${p.payout_id}`}
                        className="btn btn-success btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', background: '#16a34a' }}
                        onClick={() => openPayoutPrompt(p)}
                      >
                        <CheckCircle size={12} /> Mark as Paid Out
                      </button>
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
                  <th style={{ textAlign: 'center' }}>Receipt</th>
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
                      {p.place ? (
                        <span className={`badge ${p.place === '1st' ? 'badge-gold' : 'badge-silver'}`}>
                          {p.place}
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
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                        onClick={() => setSelectedSlip(p)}
                      >
                        🧾 View Slip
                      </button>
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
        <PayoutSlipModal slip={selectedSlip} onClose={() => setSelectedSlip(null)} />
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#888' }}>Slot:</span>
                    <span style={{ color: '#ccc', fontSize: '0.82rem' }}>
                      {formatShortDate(payoutTarget.slots.date)} • {payoutTarget.slots.time_label}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#888' }}>UPI ID:</span>
                  <span style={{ fontFamily: 'monospace', color: payoutTarget.upi_id ? '#4ade80' : '#f87171', fontSize: '0.85rem', fontWeight: 700 }}>
                    {payoutTarget.upi_id || 'Not Provided'}
                  </span>
                </div>
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
    setPayoutAmount('')
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
          place: payoutTarget.rank === 1 ? '1st' : payoutTarget.rank === 2 ? '2nd' : null,
          upi_id: payoutTarget.upi_id || null,
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
                                className="btn btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.75rem',
                                  padding: '4px 10px',
                                  background: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                onClick={() => openPayoutPrompt(t)}
                                title="Mark this team as paid out"
                              >
                                <CheckCircle size={12} /> Mark as Paid Out
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
                      className="btn btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.8rem',
                        background: '#16a34a',
                        color: '#fff',
                        fontWeight: 700,
                        border: 'none',
                      }}
                      onClick={() => {
                        const target = activeUpiModal
                        setActiveUpiModal(null)
                        openPayoutPrompt(target)
                      }}
                    >
                      <CheckCircle size={14} /> Mark as Paid Out
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

// ── BOOKINGS TAB ─────────────────────────────────────────────────
function BookingsTab({ bookings }: { bookings: any[] }) {
  const realBookings = bookings.filter(b => !b.is_test_booking)
  const testBookings = bookings.filter(b => b.is_test_booking)
  const realRevenue = realBookings.reduce((sum, b) => sum + (b.coupon_used ? 0 : (b.amount_paid || 50)), 0)

  return (
    <div>
      <h2 className={styles.tabTitle}>Bookings</h2>
      <p className={styles.tabDesc}>All slot bookings. Test account bookings are isolated and excluded from revenue metrics.</p>

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

      <div className="table-wrapper" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Slot Date</th>
              <th>Slot Time</th>
              <th>Status / Mode</th>
              <th>Coupon Used</th>
              <th>Booked At</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
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
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {formatNumericDate(b.created_at)}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No bookings yet</td></tr>
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
            Free slot coupons are automatically generated for the <strong>3rd place team</strong> when a slot is marked completed. You can also manually issue coupons.
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
                          🏆 3rd Place Reward
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
                </tr>
              )
            })}

            {list.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                  No coupons issued yet. Once a slot is marked completed, a free coupon will automatically be generated for the 3rd place team.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── CONFIG TAB ───────────────────────────────────────────────────
function ConfigTab({ config, supabase }: { config: Record<string, string>; supabase: any }) {
  const [values, setValues] = useState(config)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const fields = [
    { key: 'grand_finals_date', label: 'Grand Finals Date (ISO)', placeholder: '2025-09-14T18:00:00+05:30', type: 'text' },
    { key: 'whatsapp_invite_link', label: 'WhatsApp Community Link', placeholder: 'https://chat.whatsapp.com/...', type: 'text' },
    { key: 'cycle_start_date', label: 'Cycle Start Date', placeholder: '2025-09-01', type: 'date' },
    { key: 'cycle_end_date', label: 'Cycle End Date', placeholder: '2025-09-14', type: 'date' },
    { key: 'slot_entry_fee', label: 'Slot Entry Fee (₹)', placeholder: '50', type: 'number' },
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
      setValues(prev => ({ ...prev, maintenance_mode: nextVal }))
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
    else { setMsg('✅ Configuration saved!') }
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
  return (
    <div>
      <h2 className={styles.tabTitle}>User &amp; Role Management</h2>
      <p className={styles.tabDesc}>Assign admin roles, toggle test account mode, or delete unwanted accounts from database.</p>
      <div className="table-wrapper" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Display Name</th>
              <th>Current Role</th>
              <th>Test Account</th>
              <th>Change Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.user_id}>
                <td><strong>{u.email}</strong></td>
                <td>{u.display_name || '—'}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge-gold' : u.role === 'admin_scores' ? 'badge-info' : 'badge-neutral'}`}>
                    {u.role || 'player'}
                  </span>
                </td>
                <td>
                  {u.is_test_account ? (
                    <span className="badge badge-warning" style={{ background: '#f59e0b', color: '#000', fontWeight: 800 }}>
                      🧪 Test Mode ON
                    </span>
                  ) : (
                    <span className="badge badge-neutral" style={{ color: '#888' }}>
                      Real Account
                    </span>
                  )}
                </td>
                <td>
                  <select
                    className="form-input"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                    value={u.role || 'player'}
                    onChange={e => onUpdateRole(u.user_id, e.target.value)}
                  >
                    <option value="player">Player</option>
                    <option value="captain">Captain</option>
                    <option value="admin_scores">Score Admin (Leaderboard only)</option>
                    <option value="admin">Super Admin (Full Access)</option>
                  </select>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {onToggleTestMode && (
                      <button
                        className="btn"
                        style={{
                          background: u.is_test_account ? '#374151' : '#d97706',
                          color: '#fff',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => onToggleTestMode(u.user_id, u.is_test_account)}
                      >
                        {u.is_test_account ? 'Turn Test Mode OFF' : 'Turn Test Mode ON'}
                      </button>
                    )}
                    {onDeleteUser && (
                      <button
                        className="btn"
                        style={{ background: '#ef4444', color: '#fff', padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                        onClick={() => onDeleteUser(u.user_id)}
                      >
                        Delete Account
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
