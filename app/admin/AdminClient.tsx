'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPlacementPoints, getPositionPoints, getKillPoints } from '@/lib/scoring'
import { formatShortDate, formatMonthDay, formatFullLongDate, formatNumericDate } from '@/lib/utils/formatDate'
import styles from './page.module.css'

type AdminTab = 'scores' | 'slots' | 'payouts' | 'bookings' | 'coupons' | 'config' | 'users'

interface Props {
  userRole?: string
  slots: any[]
  teams: any[]
  payouts: any[]
  bookings: any[]
  coupons: any[]
  config: Record<string, string>
  usersList?: any[]
}

export default function AdminClient({ userRole = 'admin', slots, teams, payouts: initialPayouts, bookings, coupons, config, usersList = [] }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<AdminTab>('scores')
  const [payouts, setPayouts] = useState(initialPayouts)
  const [users, setUsers] = useState(usersList)

  const isSuperAdmin = userRole === 'admin'

  const allTabs: { id: AdminTab; label: string; superOnly?: boolean }[] = [
    { id: 'scores', label: 'Score Entry' },
    { id: 'slots', label: 'Slots', superOnly: true },
    { id: 'payouts', label: `Payouts (${payouts.filter(p => p.status === 'pending').length})`, superOnly: true },
    { id: 'bookings', label: 'Bookings', superOnly: true },
    { id: 'coupons', label: 'Coupons', superOnly: true },
    { id: 'config', label: 'Config', superOnly: true },
    { id: 'users', label: 'Admin Roles', superOnly: true },
  ]

  const visibleTabs = isSuperAdmin ? allTabs : allTabs.filter(t => !t.superOnly)

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

  return (
    <div className={styles.adminPage}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoText}>BGFS</span>
          <span className={styles.logoLabel}>
            {isSuperAdmin ? 'Super Admin' : 'Score Admin'}
          </span>
        </div>
        <nav className={styles.sidebarNav}>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              className={`${styles.sidebarBtn} ${tab === t.id ? styles.sidebarActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className={styles.adminMain}>
        <div className={styles.adminContent}>
          {tab === 'scores' && <ScoreEntryTab slots={slots} teams={teams} supabase={supabase} />}
          {isSuperAdmin && tab === 'slots' && <SlotsTab slots={slots} supabase={supabase} teams={teams} />}
          {isSuperAdmin && tab === 'payouts' && <PayoutsTab payouts={payouts} onMarkPaid={markPayoutPaid} />}
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
function ScoreEntryTab({ slots, teams, supabase }: any) {
  const [selectedSlot, setSelectedSlot] = useState('')
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

  async function checkAndIssue3rdPlaceReward(slotId: string) {
    if (!slotId) return null

    const { data: mData } = await supabase
      .from('matches')
      .select('team_id, total_points, kills, teams(team_name)')
      .eq('slot_id', slotId)

    if (!mData || mData.length === 0) return null

    const teamTotals: Record<string, { team_id: string; team_name: string; total_points: number; total_kills: number }> = {}
    mData.forEach((m: any) => {
      if (!teamTotals[m.team_id]) {
        teamTotals[m.team_id] = {
          team_id: m.team_id,
          team_name: m.teams?.team_name || 'Team',
          total_points: 0,
          total_kills: 0,
        }
      }
      teamTotals[m.team_id].total_points += (m.total_points || 0)
      teamTotals[m.team_id].total_kills += (m.kills || 0)
    })

    const sorted = Object.values(teamTotals).sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      return b.total_kills - a.total_kills
    })

    const thirdTeam = sorted[2]
    if (!thirdTeam) return null

    const { data: existingCoupon } = await supabase
      .from('coupons')
      .select('coupon_id')
      .eq('team_id', thirdTeam.team_id)
      .eq('issued_from_slot', slotId)
      .maybeSingle()

    if (existingCoupon) return null

    const code = `FREE3RD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    const { error: couponErr } = await supabase.from('coupons').insert({
      team_id: thirdTeam.team_id,
      type: 'free_slot',
      status: 'unused',
      issued_from_slot: slotId,
      code,
    })

    if (!couponErr) {
      return thirdTeam.team_name
    }
    return null
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
      let message = editingMatchId ? `✅ Score updated for ${name} (Match ${matchNum})!` : `✅ Saved! Match ${matchNum}: #${pos} (${posPts} Pos Pts) + ${k} Elims (${elimPts} Elim Pts) = ${total} Total`
      
      const thirdPlaceWinner = await checkAndIssue3rdPlaceReward(selectedSlot)
      if (thirdPlaceWinner) {
        message += ` | 🎁 Free Slot Pass automatically issued to 3rd Place (${thirdPlaceWinner})!`
      }

      setMsg(message)
      setEditingMatchId(null)
      setPosition('')
      setKills('')
      setSelectedTeam('')
      loadSlotData(selectedSlot)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.78rem', background: '#1e1e1e', borderColor: '#333333', color: '#fbbf24', fontWeight: 700 }}
            onClick={handleExportBackup}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : '📥 Export Leaderboard Backup (JSON)'}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1rem' }}>
        {/* Main Entry Form */}
        <div style={{ background: '#121212', border: '1px solid #222222', borderRadius: '10px', padding: '1rem' }}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Top Row: Slot & Team Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Select Slot</label>
                <select
                  className="form-input"
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                  value={selectedSlot}
                  onChange={e => {
                    setSelectedSlot(e.target.value)
                    setSelectedTeam('')
                    loadSlotData(e.target.value)
                  }}
                  required
                >
                  <option value="">Select slot...</option>
                  {slots.map((s: any) => (
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
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
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
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
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
                  style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                  min={0}
                  max={99}
                  value={kills}
                  onChange={e => setKills(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            {/* Compact Live Mathematical Calculation Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#181818',
                border: '1px solid #282828',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.78rem',
                color: '#cccccc',
                marginTop: '0.25rem',
              }}
            >
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderLeft: '1px solid #333', paddingLeft: '0.6rem' }}>
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
        <div
          style={{
            background: '#121212',
            border: '1px solid #222222',
            borderRadius: '10px',
            padding: '0.85rem',
            height: 'fit-content',
          }}
        >
          <h3 style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            BGIS Position Points Table
          </h3>
          <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a', textAlign: 'left', color: '#777777' }}>
                <th style={{ padding: '3px 4px' }}>Position</th>
                <th style={{ padding: '3px 4px', textAlign: 'right' }}>Points</th>
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
                  <td style={{ padding: '4px 4px', color: '#cccccc', fontWeight: 500 }}>{posStr}</td>
                  <td style={{ padding: '4px 4px', textAlign: 'right', color: '#fbbf24', fontWeight: 700 }}>{ptStr}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid #2a2a2a' }}>
                <td style={{ padding: '5px 4px', color: '#4ade80', fontWeight: 600 }}>Each Elimination</td>
                <td style={{ padding: '5px 4px', textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>1 Pt</td>
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

// ── SLOTS MANAGEMENT TAB ──────────────────────────────────────────
function SlotsTab({ slots, supabase }: any) {
  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  const dayAfterStr = getDayAfterStr()

  const [selectedDate, setSelectedDate] = useState(tomorrowStr)
  const [msg, setMsg] = useState('')
  const [loadingPresetId, setLoadingPresetId] = useState<number | null>(null)

  // Local state for editable fields per preset ID for selected date
  const [presetForms, setPresetForms] = useState<Record<number, {
    time_label?: string
    m1_time?: string
    m2_time?: string
    m3_time?: string
    whatsapp_link?: string
    entry_fee?: number
    capacity?: number
  }>>({})

  // Helper to find matching DB slot for a preset slot on selectedDate
  function getExistingSlot(preset: typeof FIXED_DAILY_SLOTS[0]) {
    return slots.find((s: any) => {
      if (s.date !== selectedDate) return false
      const label = s.time_label || ''
      return label.includes(preset.shortTime) || label.includes(preset.defaultLabel) || label.includes(preset.name)
    })
  }

  // 1-Click Open or Re-open Slot
  async function handleOpenSlot(preset: typeof FIXED_DAILY_SLOTS[0]) {
    setLoadingPresetId(preset.id)
    setMsg('')
    const existing = getExistingSlot(preset)
    const form = presetForms[preset.id] || {}

    const baseLabel = form.time_label ?? (existing?.time_label ? existing.time_label.split('(')[0].trim() : preset.defaultLabel)
    const m1 = form.m1_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 1)
    const m2 = form.m2_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 2)
    const m3 = form.m3_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 3)

    const timeLabel = buildTimeLabel(baseLabel, m1, m2, m3)
    const whatsappLink = form.whatsapp_link !== undefined ? form.whatsapp_link.trim() : (existing?.whatsapp_link || null)
    const entryFee = form.entry_fee || existing?.entry_fee || 50
    const capacity = form.capacity || existing?.capacity || 20

    if (existing) {
      const { error } = await supabase
        .from('slots')
        .update({
          status: 'open',
          time_label: timeLabel,
          whatsapp_link: whatsappLink,
          entry_fee: entryFee,
          capacity: capacity,
        })
        .eq('slot_id', existing.slot_id)

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      setMsg(`✅ ${preset.name} (${selectedDate}) OPENED for registrations!`)
    } else {
      const { error } = await supabase.from('slots').insert({
        date: selectedDate,
        time_label: timeLabel,
        capacity: capacity,
        entry_fee: entryFee,
        status: 'open',
        whatsapp_link: whatsappLink,
      })

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      setMsg(`✅ ${preset.name} (${selectedDate}) OPENED for registrations!`)
    }

    setLoadingPresetId(null)
    window.location.reload()
  }

  // 1-Click Close / Cancel Slot
  async function handleCloseSlot(preset: typeof FIXED_DAILY_SLOTS[0]) {
    setLoadingPresetId(preset.id)
    setMsg('')
    const existing = getExistingSlot(preset)
    if (!existing) {
      setLoadingPresetId(null)
      return
    }

    if (existing.teams_booked_count === 0) {
      const { error } = await supabase.from('slots').delete().eq('slot_id', existing.slot_id)
      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      setMsg(`✅ ${preset.name} (${selectedDate}) CLOSED / CANCELLED`)
    } else {
      const { error } = await supabase.from('slots').update({ status: 'closed' }).eq('slot_id', existing.slot_id)
      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      setMsg(`✅ ${preset.name} (${selectedDate}) CLOSED to new bookings`)
    }

    setLoadingPresetId(null)
    window.location.reload()
  }

  // Save changes to time, whatsapp link, entry fee, capacity
  async function handleSaveSlotDetails(preset: typeof FIXED_DAILY_SLOTS[0]) {
    setLoadingPresetId(preset.id)
    setMsg('')
    const existing = getExistingSlot(preset)
    const form = presetForms[preset.id] || {}

    const baseLabel = form.time_label ?? (existing?.time_label ? existing.time_label.split('(')[0].trim() : preset.defaultLabel)
    const m1 = form.m1_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 1)
    const m2 = form.m2_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 2)
    const m3 = form.m3_time ?? parseMatchTimeFromLabel(existing?.time_label || '', 3)

    const timeLabel = buildTimeLabel(baseLabel, m1, m2, m3)
    const whatsappLink = form.whatsapp_link !== undefined ? form.whatsapp_link.trim() : (existing?.whatsapp_link || null)
    const entryFee = form.entry_fee || existing?.entry_fee || 50
    const capacity = form.capacity || existing?.capacity || 20

    if (existing) {
      const { error } = await supabase
        .from('slots')
        .update({
          time_label: timeLabel,
          whatsapp_link: whatsappLink,
          entry_fee: entryFee,
          capacity: capacity,
        })
        .eq('slot_id', existing.slot_id)

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      setMsg(`✅ Details saved for ${preset.name}!`)
    } else {
      const { error } = await supabase.from('slots').insert({
        date: selectedDate,
        time_label: timeLabel,
        capacity: capacity,
        entry_fee: entryFee,
        status: 'open',
        whatsapp_link: whatsappLink,
      })

      if (error) { setMsg('❌ ' + error.message); setLoadingPresetId(null); return }
      setMsg(`✅ Created and saved details for ${preset.name}!`)
    }

    setLoadingPresetId(null)
    window.location.reload()
  }

  // Update form field state
  function updatePresetFormField(presetId: number, field: string, value: any) {
    setPresetForms(prev => ({
      ...prev,
      [presetId]: {
        ...(prev[presetId] || {}),
        [field]: value,
      },
    }))
  }

  return (
    <div>
      <div className={styles.tabHeader} style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 className={styles.tabTitle}>Daily Slots Management (6 Fixed Slots)</h2>
          <p className={styles.tabDesc}>
            Select a date below to easily open or cancel any of the 6 daily match slots with 1 click. Customize slot timings, individual match schedule (Erangel, Rondo, Miramar), and daily WhatsApp links.
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
      </div>

      {msg && (
        <div
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
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
      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        ⚡ 6 Fixed Slots for {formatFullLongDate(selectedDate)}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {FIXED_DAILY_SLOTS.map(preset => {
          const existingSlot = getExistingSlot(preset)
          const form = presetForms[preset.id] || {}
          const isOpen = existingSlot && (existingSlot.status === 'open' || existingSlot.status === 'full')
          const isCompleted = existingSlot && existingSlot.status === 'completed'
          const isLoading = loadingPresetId === preset.id

          const currentLabel = form.time_label ?? (existingSlot?.time_label ? existingSlot.time_label.split('(')[0].trim() : preset.defaultLabel)
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
                border: isOpen ? '1px solid #22c55e' : isCompleted ? '1px solid #555555' : '1px solid #262626',
                borderRadius: '14px',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                boxShadow: isOpen ? '0 4px 20px rgba(34, 197, 94, 0.1)' : 'none',
                position: 'relative',
              }}
            >
              {/* Slot Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {preset.name}
                  </span>
                  <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 900, color: '#ffffff' }}>
                    {currentLabel}
                  </h4>
                </div>

                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    padding: '3px 9px',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    background: isOpen
                      ? existingSlot?.status === 'full'
                        ? 'rgba(234, 179, 8, 0.2)'
                        : 'rgba(34, 197, 94, 0.2)'
                      : isCompleted
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(239, 68, 68, 0.15)',
                    color: isOpen
                      ? existingSlot?.status === 'full'
                        ? '#eab308'
                        : '#4ade80'
                      : isCompleted
                      ? '#aaaaaa'
                      : '#ef4444',
                    border: isOpen
                      ? existingSlot?.status === 'full'
                        ? '1px solid #eab308'
                        : '1px solid #22c55e'
                      : isCompleted
                      ? '1px solid #555'
                      : '1px solid #ef4444',
                  }}
                >
                  {isOpen
                    ? existingSlot?.status === 'full'
                      ? 'FULL'
                      : `OPEN (${existingSlot?.teams_booked_count || 0}/${existingSlot?.capacity || 20})`
                    : isCompleted
                    ? 'FINISHED'
                    : 'CLOSED / NOT OPEN'}
                </span>
              </div>

              {/* 1-Click Toggle Button */}
              <div>
                {isOpen ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      width: '100%',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#f87171',
                      borderColor: '#ef4444',
                      fontWeight: 900,
                      fontSize: '0.82rem',
                      padding: '0.5rem',
                    }}
                    disabled={isLoading}
                    onClick={() => handleCloseSlot(preset)}
                  >
                    {isLoading ? 'Updating...' : '🔒 CLOSE / CANCEL SLOT'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{
                      width: '100%',
                      background: '#22c55e',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: '0.85rem',
                      padding: '0.55rem',
                      border: 'none',
                    }}
                    disabled={isLoading}
                    onClick={() => handleOpenSlot(preset)}
                  >
                    {isLoading ? 'Opening...' : '🔓 OPEN SLOT FOR BOOKINGS'}
                  </button>
                )}
              </div>

              {/* Editable Fields */}
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
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

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.25rem', padding: '0.4rem', fontSize: '0.78rem', fontWeight: 800 }}
                  disabled={isLoading}
                  onClick={() => handleSaveSlotDetails(preset)}
                >
                  💾 Save Slot Details
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── ALL SLOTS OVERVIEW TABLE ─────────────────────────────── */}
      <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#aaaaaa', marginTop: '2rem', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
        📁 All Active & Historical Slots Records ({slots.length})
      </h3>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Teams Booked</th>
              <th>Status</th>
              <th>WhatsApp Link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot: any) => (
              <tr key={slot.slot_id}>
                <td>
                  <div>
                    <strong>
                      {formatShortDate(slot.date)}
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{slot.time_label}</div>
                </td>
                <td>{slot.teams_booked_count}/{slot.capacity}</td>
                <td>
                  <span className={`badge ${slot.status === 'open' ? 'badge-success' : slot.status === 'full' ? 'badge-warning' : 'badge-neutral'}`}>
                    {slot.status}
                  </span>
                </td>
                <td>
                  {slot.whatsapp_link ? (
                    <a href={slot.whatsapp_link} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#22c55e', textDecoration: 'underline' }}>
                      Group Link ↗
                    </a>
                  ) : (
                    <em style={{ fontSize: '0.75rem', color: '#666' }}>Default link used</em>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {slot.status === 'completed' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ background: '#fbbf24', color: '#111', fontWeight: 'bold', fontSize: '0.72rem' }}
                        onClick={async () => {
                          await supabase.from('slots').update({ status: 'open' }).eq('slot_id', slot.slot_id)
                          window.location.reload()
                        }}
                      >
                        REVERT TO OPEN
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem' }}
                        onClick={async () => {
                          await supabase.from('slots').update({ status: 'completed' }).eq('slot_id', slot.slot_id)
                          window.location.reload()
                        }}
                      >
                        Mark Done
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444', borderColor: '#ef4444', fontSize: '0.72rem' }}
                      onClick={async () => {
                        if (!confirm('Delete this slot?')) return
                        await supabase.from('slots').delete().eq('slot_id', slot.slot_id)
                        window.location.reload()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {slots.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: '#666' }}>
                  No slots currently registered in the database. Select a date above and click "OPEN SLOT FOR BOOKINGS".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── PAYOUTS TAB ──────────────────────────────────────────────────
function PayoutsTab({ payouts, onMarkPaid }: { payouts: any[]; onMarkPaid: (id: string) => void }) {
  const pending = payouts.filter(p => p.status === 'pending')
  const paid = payouts.filter(p => p.status === 'paid')

  return (
    <div>
      <h2 className={styles.tabTitle}>Payouts</h2>
      <p className={styles.tabDesc}>Manual UPI payouts. Mark as paid after sending.</p>

      {pending.length > 0 && (
        <div className={styles.payoutSection}>
          <h3 className={styles.payoutSubhead}>⏳ Pending ({pending.length})</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Place</th>
                  <th>Amount</th>
                  <th>UPI ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(p => (
                  <tr key={p.payout_id}>
                    <td><strong>{p.teams?.team_name}</strong></td>
                    <td>
                      <span className={`badge ${p.place === '1st' ? 'badge-gold' : 'badge-silver'}`}>
                        {p.place}
                      </span>
                    </td>
                    <td><strong style={{ color: 'var(--brand-primary)' }}>₹{p.amount}</strong></td>
                    <td>
                      <code style={{ fontSize: '0.85rem' }}>{p.upi_id || 'No UPI on file'}</code>
                    </td>
                    <td>
                      <button
                        id={`mark-paid-${p.payout_id}`}
                        className="btn btn-success btn-sm"
                        onClick={() => onMarkPaid(p.payout_id)}
                      >
                        ✓ Mark Paid
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
          <h3 className={styles.payoutSubhead}>✅ Paid ({paid.length})</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Place</th>
                  <th>Amount</th>
                  <th>Paid At</th>
                </tr>
              </thead>
              <tbody>
                {paid.map(p => (
                  <tr key={p.payout_id}>
                    <td>{p.teams?.team_name}</td>
                    <td><span className={`badge ${p.place === '1st' ? 'badge-gold' : 'badge-silver'}`}>{p.place}</span></td>
                    <td>₹{p.amount}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {p.paid_at ? formatNumericDate(p.paid_at) : '—'}
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
          No payouts yet. Enter slot scores to generate payout records.
        </p>
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
function CouponsTab({ coupons, teams, supabase }: { coupons: any[]; teams: any[]; supabase: any }) {
  const [list, setList] = useState(coupons)
  const [issueTeam, setIssueTeam] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [msg, setMsg] = useState('')

  async function issueCoupon(e: React.FormEvent) {
    e.preventDefault()
    if (!issueTeam) return
    setIssuing(true); setMsg('')
    // Generate code client-side (server will also auto-generate if blank, but we want to show it)
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    const { data, error } = await supabase
      .from('coupons')
      .insert({ team_id: issueTeam, type: 'free_slot', status: 'unused', code })
      .select('*, teams(team_name)')
      .single()
    setIssuing(false)
    if (error) { setMsg('❌ ' + error.message); return }
    setList(prev => [data, ...prev])
    setMsg(`✅ Coupon issued! Code: ${data.code} — share this with the team via WhatsApp.`)
    setIssueTeam('')
  }

  return (
    <div>
      <h2 className={styles.tabTitle}>Coupons</h2>
      <p className={styles.tabDesc}>Issue free slot coupons to 3rd-place teams. Share the code with them via WhatsApp.</p>

      {/* Issue Form */}
      <form onSubmit={issueCoupon} className={styles.createSlotForm}>
        <div className={styles.formRow}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Issue Coupon To Team</label>
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
              <th>Team</th>
              <th>Code</th>
              <th>Status</th>
              <th>Issued</th>
              <th>Used</th>
            </tr>
          </thead>
          <tbody>
            {list.map(c => (
              <tr key={c.coupon_id}>
                <td><strong>{c.teams?.team_name}</strong></td>
                <td><code style={{ background: '#1a1a1a', padding: '0.2rem 0.5rem', borderRadius: '4px', letterSpacing: '0.08em', color: '#fbbf24' }}>{c.code || '—'}</code></td>
                <td>
                  <span className={`badge ${c.status === 'unused' ? 'badge-success' : 'badge-neutral'}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {formatNumericDate(c.issued_at)}
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {c.used_at ? formatNumericDate(c.used_at) : '—'}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No coupons issued yet</td></tr>
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
