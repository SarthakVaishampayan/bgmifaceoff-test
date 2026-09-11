'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Calendar, TrendingUp, Edit3, Lock, Check, X, FlaskConical, AlertCircle, KeyRound, Trophy, MessageCircle, Settings, ChevronRight, Award } from 'lucide-react'
import { formatShortDate } from '@/lib/utils/formatDate'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

interface SlotInfo {
  slot_id: string
  date: string
  time_label: string
  status: string
  entry_fee: number
  is_grand_finals: boolean
  whatsapp_link?: string
}

interface Booking {
  booking_id: string
  slot_id?: string
  payment_status: string
  amount_paid: number
  coupon_used: boolean
  created_at: string
  room_slot_number?: number | null
  slots: any
}

interface LeaderboardEntry {
  team_id: string
  best_16_total: number
  matches_played: number
  total_kills: number
}

interface Payout {
  amount: number
  status: 'paid' | 'pending' | string
}

interface Coupon {
  coupon_id: string
  code: string
  type: string
  status: 'unused' | 'used' | string
  issued_at: string
}

interface Props {
  team: { team_id: string; team_name: string; captain_user_id: string; name_changed?: boolean }
  userEmail: string
  bookings: Booking[]
  slotBookingsMap?: Record<string, any[]>
  teamMatches?: any[]
  globalWhatsappLink?: string
  leaderboardEntry: LeaderboardEntry | null
  rank: number
  payouts: Payout[]
  coupons?: Coupon[]
  isCaptain: boolean
  isTestAccount?: boolean
}

function getSlotInfo(slots: any): SlotInfo {
  if (!slots) return { slot_id: '', date: new Date().toISOString().split('T')[0], time_label: 'Tournament Slot', status: 'open', entry_fee: 50, is_grand_finals: false }
  if (Array.isArray(slots)) return slots[0] || { slot_id: '', date: new Date().toISOString().split('T')[0], time_label: 'Tournament Slot', status: 'open', entry_fee: 50, is_grand_finals: false }
  return slots as SlotInfo
}

export default function DashboardClient({
  team, userEmail, bookings, slotBookingsMap = {}, teamMatches = [],
  globalWhatsappLink = 'https://chat.whatsapp.com/BGFS', leaderboardEntry, rank,
  payouts, coupons = [], isCaptain, isTestAccount = false,
}: Props) {
  const supabase = createClient()
  const unusedCoupons = coupons.filter(c => c.status === 'unused')
  const [showSettings, setShowSettings] = useState(false)
  const [currentTeamName, setCurrentTeamName] = useState(team.team_name)
  const [hasChangedName, setHasChangedName] = useState(!!team.name_changed)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newTeamNameInput, setNewTeamNameInput] = useState(team.team_name)
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState('')
  const [renameSuccessMsg, setRenameSuccessMsg] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passErr, setPassErr] = useState('')
  const [passMsg, setPassMsg] = useState('')
  const [slotTab, setSlotTab] = useState<'active' | 'past'>('active')

  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPassErr(''); setPassMsg('')
    if (newPass.length < 6) { setPassErr('Password must be at least 6 characters.'); return }
    if (newPass !== confirmPass) { setPassErr('Passwords do not match.'); return }
    setPassLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setPassLoading(false)
    if (error) { setPassErr(error.message); return }
    setPassMsg('Password updated successfully!')
    setNewPass(''); setConfirmPass('')
    setTimeout(() => { setIsChangingPassword(false); setPassMsg('') }, 2000)
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamNameInput.trim()) return
    setRenameError(''); setRenameSuccessMsg(''); setRenameLoading(true)
    try {
      const res = await fetch('/api/team/rename', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_team_name: newTeamNameInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setRenameError(data.error || 'Failed to update.'); setRenameLoading(false); return }
      setCurrentTeamName(data.new_team_name); setHasChangedName(true); setIsEditingName(false)
      setRenameSuccessMsg('Team name updated! (Locked)'); setRenameLoading(false)
    } catch (err: any) { setRenameError(err.message || 'Network error'); setRenameLoading(false) }
  }

  const normalizedBookings = bookings.map(b => ({ ...b, slotData: getSlotInfo(b.slots) }))
  const upcomingBookings = normalizedBookings.filter(b => b.slotData?.status !== 'completed')
  const pastBookings = normalizedBookings.filter(b => b.slotData?.status === 'completed')
  const chickenDinners = teamMatches.filter(m => (m.placement === 1 || m.position === 1)).length
  const totalPoints = leaderboardEntry?.best_16_total ?? teamMatches.reduce((acc: number, m: any) => acc + (Number(m.total_points) || 0), 0)
  const isQualifying = rank > 0 && rank <= 16

  // Aggregate all played slots for "MY PERFORMANCE" in descending order of points
  const performanceSlots = useMemo(() => {
    const slotMap = new Map<string, {
      slotId: string
      date: string
      timeLabel: string
      roomSlotNumber?: number | null
      matches: Array<{
        match_id?: string
        match_number: number
        placement: number
        kills: number
        total_points: number
      }>
      totalPoints: number
      totalKills: number
    }>()

    // 1. Seed from all bookings to obtain roomSlotNumber, date, and time_label
    normalizedBookings.forEach(b => {
      const sId = b.slot_id || b.slotData?.slot_id
      if (!sId) return
      if (!slotMap.has(sId)) {
        slotMap.set(sId, {
          slotId: sId,
          date: b.slotData?.date || '',
          timeLabel: b.slotData?.time_label || '',
          roomSlotNumber: b.room_slot_number,
          matches: [],
          totalPoints: 0,
          totalKills: 0,
        })
      }
    })

    // 2. Attach all match performances
    teamMatches.forEach(m => {
      const sId = m.slot_id
      if (!sId) return
      let entry = slotMap.get(sId)
      if (!entry) {
        const slotData = m.slots || {}
        entry = {
          slotId: sId,
          date: slotData.date || '',
          timeLabel: slotData.time_label || '',
          roomSlotNumber: null,
          matches: [],
          totalPoints: 0,
          totalKills: 0,
        }
        slotMap.set(sId, entry)
      }

      entry.matches.push({
        match_id: m.match_id,
        match_number: m.match_number || 1,
        placement: m.placement ?? m.position ?? 0,
        kills: Number(m.kills) || 0,
        total_points: Number(m.total_points) || 0,
      })
    })

    // 3. Compute totals and sort matches
    const list = Array.from(slotMap.values())
      .filter(s => s.matches.length > 0)
      .map(s => {
        s.matches.sort((a, b) => a.match_number - b.match_number)
        const slotTotalPts = s.matches.reduce((sum, match) => sum + match.total_points, 0)
        const slotTotalKills = s.matches.reduce((sum, match) => sum + match.kills, 0)
        return {
          ...s,
          totalPoints: slotTotalPts,
          totalKills: slotTotalKills,
        }
      })

    // 4. Sort descending by points (tie-breaker: kills)
    list.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }
      return b.totalKills - a.totalKills
    })

    return list
  }, [normalizedBookings, teamMatches])

  // Rank color: green (rank 1) → yellow (rank 16) → red (rank 17+)
  function getRankColor(r: number) {
    if (r <= 0) return '#666'
    if (r <= 16) {
      const t = (r - 1) / 15
      const g = Math.round(222 - t * 31)
      const b = Math.round(128 + t * 92)
      return `rgb(74, ${g}, ${b})`
    }
    return '#ef4444'
  }
  function getRankBg(r: number) {
    if (r <= 0) return 'rgba(255,255,255,0.04)'
    if (r <= 16) {
      const t = (r - 1) / 15
      const g = Math.round(222 - t * 31)
      const b = Math.round(128 + t * 92)
      return `rgba(74, ${g}, ${b}, 0.1)`
    }
    return 'rgba(239, 68, 68, 0.1)'
  }
  function getRankBorder(r: number) {
    if (r <= 0) return '#2a2a2a'
    if (r <= 16) {
      const t = (r - 1) / 15
      const g = Math.round(222 - t * 31)
      const b = Math.round(128 + t * 92)
      return `rgba(74, ${g}, ${b}, 0.25)`
    }
    return 'rgba(239, 68, 68, 0.25)'
  }
  const formatDate = (d: string) => formatShortDate(d)

  return (
    <main className={styles.page}>
      <div className="container">
        {/* ── HEADER ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{currentTeamName}</h1>
            <div className={styles.headerBadges}>
              {userEmail && <span className={styles.emailBadge}>{userEmail}</span>}
              {isCaptain && <span className={styles.captainBadge}>CAPTAIN</span>}
              {isTestAccount && <span className={styles.testBadge}><FlaskConical size={11} /> TEST</span>}
            </div>
          </div>
          <button className={styles.settingsBtn} onClick={() => setShowSettings(!showSettings)}>
            <Settings size={18} />
          </button>
        </div>

        {/* ── FREE SLOT REWARD BANNER ── */}
        {unusedCoupons.length > 0 && (
          <div className={styles.rewardBanner}>
            <div>
              <span className={styles.rewardTitle}>🎁 {unusedCoupons.length} Free Slot Reward{unusedCoupons.length > 1 ? 's' : ''}</span>
              <span className={styles.rewardSub}>Earned from placing 3rd. Redeem on any open slot.</span>
            </div>
            <Link href="/slots" className={styles.rewardBtn}>Redeem →</Link>
          </div>
        )}

        {/* ── TWO COLUMN LAYOUT ── */}
        <div className={styles.twoCol}>
          <div className={styles.leftCol}>
            {/* LEFT: SLOTS */}
            <div className={styles.slotsCard}>
            <div className={styles.cardHeader}>
              <Calendar size={16} color="#facc15" />
              <h2 className={styles.cardTitle}>MY SLOTS</h2>
              <div className={styles.tabSwitcher}>
                <button className={`${styles.tabBtn} ${slotTab === 'active' ? styles.tabActive : ''}`} onClick={() => setSlotTab('active')}>
                  Active ({upcomingBookings.length})
                </button>
                <button className={`${styles.tabBtn} ${slotTab === 'past' ? styles.tabActive : ''}`} onClick={() => setSlotTab('past')}>
                  Past ({pastBookings.length})
                </button>
              </div>
            </div>

            <div className={styles.cardBody}>
              {slotTab === 'active' && (
                upcomingBookings.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No active slots</p>
                    <Link href="/slots" className={styles.primaryBtn}>Register for a slot →</Link>
                  </div>
                ) : (
                  <div className={styles.slotList}>
                    {upcomingBookings.map(b => {
                      const waLink = b.slotData?.whatsapp_link || globalWhatsappLink
                      const slotTargetId = b.slot_id || b.slotData?.slot_id
                      return (
                        <div key={b.booking_id} className={styles.slotItem}>
                          <div className={styles.slotTop}>
                            <div>
                              <span className={styles.slotDate}>📅 {formatDate(b.slotData?.date || '')} • {b.slotData?.time_label}</span>
                              <span className={styles.slotRoom}>Room Slot #{b.room_slot_number || 5}</span>
                            </div>
                            <span className={b.payment_status === 'paid' ? styles.badgePaid : styles.badgePending}>
                              {b.payment_status === 'paid' ? 'CONFIRMED' : 'PENDING'}
                            </span>
                          </div>
                          <div className={styles.slotActions}>
                            <Link href={`/leaderboard?slot_id=${slotTargetId}&tab=slot`} className={styles.slotActionBtn}>
                              <Trophy size={13} /> Points
                            </Link>
                            <a href={waLink} target="_blank" rel="noreferrer" className={styles.whatsappBtn}>
                              <MessageCircle size={13} /> WhatsApp
                            </a>
                          </div>
                        </div>
                      )
                    })}
                    <Link href="/slots" className={styles.registerLink}>+ Register another slot</Link>
                  </div>
                )
              )}

              {slotTab === 'past' && (
                pastBookings.length === 0 ? (
                  <div className={styles.emptyState}><p>No past slots yet</p></div>
                ) : (
                  <div className={styles.slotList}>
                    {pastBookings.map(b => {
                      const targetSlotId = b.slot_id || b.slotData?.slot_id
                      const matchesForSlot = teamMatches.filter(m => m.slot_id === targetSlotId)
                      const totalSlotPts = matchesForSlot.reduce((sum, m) => sum + (m.total_points || 0), 0)
                      return (
                        <div key={b.booking_id} className={styles.slotItem}>
                          <div className={styles.slotTop}>
                            <div>
                              <span className={styles.slotDate}>{formatDate(b.slotData?.date || '')} • {b.slotData?.time_label}</span>
                              <span className={styles.slotRoom}>Room Slot #{b.room_slot_number || 5}</span>
                            </div>
                            <span className={styles.badgeCompleted}>COMPLETED</span>
                          </div>
                          {matchesForSlot.length > 0 && (
                            <div className={styles.scoreSummary}>
                              {matchesForSlot.map((m, idx) => (
                                <div key={m.match_id || idx} className={styles.scoreRow}>
                                  <span>M{m.match_number || idx + 1}</span>
                                  <span>#{m.position || '-'} · {m.kills || 0} kills · {m.total_points || 0} pts</span>
                                </div>
                              ))}
                              <div className={styles.scoreTotal}>
                                <span>Total</span><span>{totalSlotPts} pts</span>
                              </div>
                            </div>
                          )}
                          <Link href={`/leaderboard?slot_id=${targetSlotId}&tab=slot`} className={styles.slotActionBtn}>
                            <Trophy size={13} /> View Points
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── MY PERFORMANCE (BEST 5 SLOTS RANKING) ── */}
          <div className={styles.performanceCard}>
            <div className={styles.cardHeader}>
              <Award size={16} color="#facc15" />
              <h2 className={styles.cardTitle}>MY PERFORMANCE</h2>
              <span className={styles.perfHeaderTag}>
                {performanceSlots.length > 5 ? `Top 5 of ${performanceSlots.length} Slots Counted` : 'Top 5 Slots System'}
              </span>
            </div>

            <div className={styles.cardBody}>
              {performanceSlots.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No slot match results recorded yet</p>
                  <span style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginTop: '4px' }}>
                    The data will be updated after you play your first slot.
                  </span>
                </div>
              ) : (
                <div className={styles.perfSlotList}>
                  {performanceSlots.map((slot, index) => {
                    const isTop5 = index < 5
                    return (
                      <div
                        key={slot.slotId}
                        className={`${styles.perfSlotCard} ${isTop5 ? styles.perfTop5Card : styles.perfOtherCard}`}
                      >
                        <div className={styles.perfSlotHeader}>
                          <div className={styles.perfSlotLeft}>
                            <div className={styles.perfRankBadge}>
                              #{index + 1}
                            </div>
                            <div>
                              <div className={styles.perfSlotDate}>
                                📅 {formatDate(slot.date)} {slot.timeLabel && `• ${slot.timeLabel}`}
                              </div>
                              {slot.roomSlotNumber && (
                                <div className={styles.perfSlotRoom}>
                                  Room Slot #{slot.roomSlotNumber}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={styles.perfSlotRight}>
                            {isTop5 ? (
                              <span className={styles.badgeTop5Counting}>
                                ⭐ TOP 5 · COUNTING
                              </span>
                            ) : (
                              <span className={styles.badgeDropped}>
                                NOT COUNTED
                              </span>
                            )}
                            <div className={styles.perfPointsVal}>
                              {slot.totalPoints} <span className={styles.perfPointsLabel}>PTS</span>
                            </div>
                          </div>
                        </div>

                        {slot.matches.length > 0 && (
                          <div className={styles.perfMatchesGrid}>
                            {slot.matches.map((m) => (
                              <div key={m.match_id || m.match_number} className={styles.perfMatchChip}>
                                <span className={styles.perfMatchNum}>M{m.match_number}</span>
                                <span className={styles.perfMatchPlace}>
                                  #{m.placement > 0 ? m.placement : '—'}
                                </span>
                                <span className={styles.perfMatchKills}>
                                  {m.kills} {m.kills === 1 ? 'kill' : 'kills'}
                                </span>
                                <span className={styles.perfMatchPts}>
                                  {m.total_points} pts
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={styles.perfSlotFooter}>
                          <span className={styles.perfTotalKills}>
                            🎯 Total Eliminations: <strong>{slot.totalKills}</strong>
                          </span>
                          <Link
                            href={`/leaderboard?slot_id=${slot.slotId}&tab=slot`}
                            className={styles.perfViewSlotBtn}
                          >
                            View Slot Points <ChevronRight size={12} />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: RANK */}
        <div className={styles.rankCard}>
            <div className={styles.rankHeader}>
              <TrendingUp size={16} color="#facc15" />
              <h2 className={styles.cardTitle}>STANDING</h2>
            </div>
            <div className={styles.rankBody}>
              <div className={styles.rankBig}>{rank > 0 ? `#${rank}` : '—'}</div>
              <div className={styles.rankSub}>Overall Rank</div>
              <div className={styles.rankStats}>
                <div><span className={styles.rankStatVal}>{totalPoints}</span><span className={styles.rankStatLabel}>Total Points</span></div>
                <div><span className={styles.rankStatVal}>{leaderboardEntry?.matches_played ?? teamMatches.length ?? 0}</span><span className={styles.rankStatLabel}>Matches</span></div>
              </div>
              <div style={{
                background: rank > 0 ? getRankBg(rank) : 'rgba(255,255,255,0.04)',
                border: `1px solid ${rank > 0 ? getRankBorder(rank) : '#2a2a2a'}`,
                color: rank > 0 ? getRankColor(rank) : '#666',
                fontSize: '0.7rem', fontWeight: 800,
                padding: '0.5rem', borderRadius: '6px',
                textAlign: 'center', marginBottom: '1rem',
                width: '100%', boxSizing: 'border-box',
              }}>
                {rank > 0 && rank <= 16 ? `#${rank} · CURRENTLY QUALIFYING` : rank > 16 ? `#${rank} · NOT QUALIFYING` : 'PLAY YOUR FIRST SLOT TO ENTER RACE'}
              </div>
              <Link href="/leaderboard" className={styles.leaderboardLink}>View Full Leaderboard →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── SETTINGS PANEL ── */}
      {showSettings && (
        <div className={styles.settingsOverlay} onClick={() => setShowSettings(false)}>
          <div className={styles.settingsPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.settingsHeader}>
              <h3>Settings</h3>
              <button onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>

            {/* Team Name */}
            <div className={styles.settingsSection}>
              <label>Team Name</label>
              {!isEditingName ? (
                <div className={styles.settingsRow}>
                  <span>{currentTeamName}</span>
                  {!hasChangedName ? (
                    <button onClick={() => { setIsEditingName(true); setRenameError(''); setRenameSuccessMsg('') }}>
                      <Edit3 size={13} /> Edit
                    </button>
                  ) : (
                    <span className={styles.lockedBadge}><Lock size={11} /> Locked</span>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRenameSubmit} className={styles.settingsForm}>
                  <input type="text" value={newTeamNameInput} onChange={e => setNewTeamNameInput(e.target.value)} placeholder="New team name" autoFocus required />
                  <div className={styles.formActions}>
                    <button type="submit" disabled={renameLoading}>{renameLoading ? 'Saving...' : 'Save'}</button>
                    <button type="button" onClick={() => setIsEditingName(false)} className={styles.cancelBtn}>Cancel</button>
                  </div>
                  {renameError && <span className={styles.errorText}>{renameError}</span>}
                  {renameSuccessMsg && <span className={styles.successText}>{renameSuccessMsg}</span>}
                  <span className={styles.formNote}><AlertCircle size={11} /> 1-time change only</span>
                </form>
              )}
            </div>

            {/* Password */}
            <div className={styles.settingsSection}>
              <label>Password</label>
              {!isChangingPassword ? (
                <button className={styles.settingsActionBtn} onClick={() => { setIsChangingPassword(true); setPassErr(''); setPassMsg('') }}>
                  <KeyRound size={13} /> Change Password
                </button>
              ) : (
                <form onSubmit={handleChangePasswordSubmit} className={styles.settingsForm}>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="New password (min 6 chars)" minLength={6} required />
                  <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Confirm password" minLength={6} required />
                  <div className={styles.formActions}>
                    <button type="submit" disabled={passLoading}>{passLoading ? 'Updating...' : 'Update'}</button>
                    <button type="button" onClick={() => setIsChangingPassword(false)} className={styles.cancelBtn}>Cancel</button>
                  </div>
                  {passErr && <span className={styles.errorText}>{passErr}</span>}
                  {passMsg && <span className={styles.successText}>{passMsg}</span>}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
