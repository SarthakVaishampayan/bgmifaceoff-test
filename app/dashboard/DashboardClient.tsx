'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, TrendingUp, Edit3, Lock, Check, X, FlaskConical, AlertCircle, KeyRound, Trophy, MessageCircle } from 'lucide-react'
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
  team: {
    team_id: string
    team_name: string
    captain_user_id: string
    name_changed?: boolean
  }
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
  if (!slots) {
    return {
      slot_id: '',
      date: new Date().toISOString().split('T')[0],
      time_label: 'Tournament Slot',
      status: 'open',
      entry_fee: 50,
      is_grand_finals: false,
    }
  }
  if (Array.isArray(slots)) {
    return slots[0] || {
      slot_id: '',
      date: new Date().toISOString().split('T')[0],
      time_label: 'Tournament Slot',
      status: 'open',
      entry_fee: 50,
      is_grand_finals: false,
    }
  }
  return slots as SlotInfo
}

export default function DashboardClient({
  team,
  userEmail,
  bookings,
  slotBookingsMap = {},
  teamMatches = [],
  globalWhatsappLink = 'https://chat.whatsapp.com/BGFS',
  leaderboardEntry,
  rank,
  payouts,
  coupons = [],
  isCaptain,
  isTestAccount = false,
}: Props) {
  const unusedCoupons = coupons.filter(c => c.status === 'unused')
  // Team name edit state
  const [currentTeamName, setCurrentTeamName] = useState(team.team_name)
  const [hasChangedName, setHasChangedName] = useState(!!team.name_changed)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newTeamNameInput, setNewTeamNameInput] = useState(team.team_name)
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState('')
  const [renameSuccessMsg, setRenameSuccessMsg] = useState('')

  // Password Change state
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passErr, setPassErr] = useState('')
  const [passMsg, setPassMsg] = useState('')

  // Slot tab & Pre-Match Room Slot Layout Modal
  const [slotTab, setSlotTab] = useState<'active' | 'past'>('active')
  const [activeSlotModal, setActiveSlotModal] = useState<any | null>(null)

  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPassErr('')
    setPassMsg('')

    if (newPass.length < 6) {
      setPassErr('Password must be at least 6 characters.')
      return
    }
    if (newPass !== confirmPass) {
      setPassErr('Passwords do not match.')
      return
    }

    setPassLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setPassLoading(false)

    if (error) {
      setPassErr(error.message)
      return
    }

    setPassMsg('Password updated successfully!')
    setNewPass('')
    setConfirmPass('')
    setTimeout(() => {
      setIsChangingPassword(false)
      setPassMsg('')
    }, 2000)
  }

  // Handle Team Rename submit
  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamNameInput.trim()) return

    setRenameError('')
    setRenameSuccessMsg('')
    setRenameLoading(true)

    try {
      const res = await fetch('/api/team/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_team_name: newTeamNameInput.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setRenameError(data.error || 'Failed to update team name.')
        setRenameLoading(false)
        return
      }

      setCurrentTeamName(data.new_team_name)
      setHasChangedName(true)
      setIsEditingName(false)
      setRenameSuccessMsg('Team name updated successfully! (Locked)')
      setRenameLoading(false)
    } catch (err: any) {
      setRenameError(err.message || 'Network error')
      setRenameLoading(false)
    }
  }

  // Normalize slot info for each booking
  const normalizedBookings = bookings.map(b => ({
    ...b,
    slotData: getSlotInfo(b.slots),
  }))

  // Active / Upcoming slots (not completed)
  const upcomingBookings = normalizedBookings.filter(
    b => b.slotData && b.slotData.status !== 'completed'
  )

  // Past / Completed slots
  const pastBookings = normalizedBookings.filter(
    b => b.slotData && b.slotData.status === 'completed'
  )

  // Calculate total entry fees paid
  const totalEntryFees = normalizedBookings
    .filter(b => b.payment_status === 'paid')
    .reduce((sum, b) => {
      if (b.coupon_used) return sum
      return sum + (b.amount_paid || b.slotData?.entry_fee || 50)
    }, 0)

  // Calculate prize money earned
  const paidPrize = payouts
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const pendingPrize = payouts
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const totalPrizeEarned = paidPrize + pendingPrize
  const isQualified = rank > 0 && rank <= 16

  function formatDate(dateStr: string) {
    return formatShortDate(dateStr)
  }

  return (
    <main className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>PLAYER DASHBOARD</h1>

            {/* Team Name display & 1-time Edit */}
            <div className={styles.teamNameRow}>
              {!isEditingName ? (
                <div className={styles.teamNameBadgeWrap}>
                  <span className={styles.teamNameDisplay}>{currentTeamName}</span>

                  {userEmail && <span className={styles.emailText}>({userEmail})</span>}
                  {isCaptain && <span className={styles.captainBadge}>CAPTAIN</span>}
                  {isTestAccount && (
                    <span style={{
                      background: '#1f1f1f',
                      border: '1px solid #333333',
                      color: '#aaaaaa',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      letterSpacing: '0.05em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <FlaskConical size={11} /> TEST ACCOUNT
                    </span>
                  )}

                  {!hasChangedName ? (
                    <button
                      className={styles.renameTriggerBtn}
                      onClick={() => { setIsEditingName(true); setRenameError(''); setRenameSuccessMsg('') }}
                      title="Change Team Name (1-time only)"
                    >
                      <Edit3 size={13} /> Edit Name
                    </button>
                  ) : (
                    <span className={styles.nameLockedBadge} title="Team name cannot be changed again">
                      <Lock size={11} /> Name Locked
                    </span>
                  )}

                  <button
                    className={styles.renameTriggerBtn}
                    style={{ borderColor: 'rgba(250, 204, 21, 0.4)', color: '#facc15' }}
                    onClick={() => { setIsChangingPassword(!isChangingPassword); setPassErr(''); setPassMsg('') }}
                  >
                    <KeyRound size={13} /> {isChangingPassword ? 'Cancel Password' : 'Change Password'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRenameSubmit} className={styles.renameForm}>
                  <input
                    type="text"
                    className={styles.renameInput}
                    value={newTeamNameInput}
                    onChange={e => setNewTeamNameInput(e.target.value)}
                    placeholder="Enter new team name"
                    autoFocus
                    required
                  />
                  <button type="submit" className={styles.renameSaveBtn} disabled={renameLoading}>
                    {renameLoading ? 'Saving...' : <><Check size={14} /> Save</>}
                  </button>
                  <button
                    type="button"
                    className={styles.renameCancelBtn}
                    onClick={() => setIsEditingName(false)}
                    disabled={renameLoading}
                  >
                    <X size={14} />
                  </button>
                  <span className={styles.renameNotice}><AlertCircle size={11} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '3px' }} /> 1-time change only</span>
                </form>
              )}

              {/* Password Change Inline Form */}
              {isChangingPassword && (
                <form onSubmit={handleChangePasswordSubmit} className={styles.renameForm} style={{ marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <input
                    type="password"
                    className={styles.renameInput}
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    placeholder="New Password (min 6 chars)"
                    minLength={6}
                    required
                    style={{ minWidth: '180px' }}
                  />
                  <input
                    type="password"
                    className={styles.renameInput}
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    placeholder="Confirm New Password"
                    minLength={6}
                    required
                    style={{ minWidth: '180px' }}
                  />
                  <button type="submit" className={styles.renameSaveBtn} disabled={passLoading}>
                    {passLoading ? 'Updating...' : <><Check size={14} /> Update Password</>}
                  </button>
                  {passErr && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0, width: '100%' }}>{passErr}</p>}
                  {passMsg && <p style={{ color: '#4ade80', fontSize: '0.8rem', margin: 0, width: '100%' }}>{passMsg}</p>}
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Free Slot Reward Banner */}
        {unusedCoupons.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.15) 0%, rgba(202, 138, 4, 0.08) 100%)',
            border: '1px solid #facc15',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            boxShadow: '0 4px 20px rgba(250, 204, 21, 0.1)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.25rem' }}>🎁</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#facc15', fontFamily: 'Inter, sans-serif' }}>
                  {unusedCoupons.length === 1
                    ? '1 Free Slot Reward Available!'
                    : `${unusedCoupons.length} Free Slot Rewards Available!`}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#d4d4d4', fontFamily: 'Inter, sans-serif' }}>
                Earned from placing 3rd in slot matches. Redeem on any open tournament slot with zero entry fee!
              </p>
            </div>
            <Link
              href="/slots"
              className="btn btn-primary"
              style={{
                background: '#facc15',
                color: '#000000',
                fontWeight: 800,
                fontSize: '0.875rem',
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Redeem on Open Slots →
            </Link>
          </div>
        )}

        {/* 2-Card Grid */}
        <div className={styles.cardGrid}>
          {/* ── CARD 1: MY SLOTS (ACTIVE & PAST) ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader} style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div className={styles.iconWrapper}>
                  <Calendar size={18} color="#facc15" />
                </div>
                <h2 className={styles.cardTitle}>MY TOURNAMENT SLOTS</h2>
              </div>

              {/* Active vs Past Tab Switcher */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSlotTab('active')}
                  style={{
                    background: slotTab === 'active' ? '#fbbf24' : '#1f1f1f',
                    color: slotTab === 'active' ? '#111111' : '#888888',
                    border: '1px solid #333333',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ACTIVE ({upcomingBookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSlotTab('past')}
                  style={{
                    background: slotTab === 'past' ? '#fbbf24' : '#1f1f1f',
                    color: slotTab === 'past' ? '#111111' : '#888888',
                    border: '1px solid #333333',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  PAST ({pastBookings.length})
                </button>
              </div>
            </div>

            <div className={styles.cardBody}>
              {/* TAB 1: ACTIVE / UPCOMING SLOTS */}
              {slotTab === 'active' && (
                <>
                  {upcomingBookings.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p className={styles.emptyText}>No active slots registered yet</p>
                      <Link href="/slots" className={styles.primaryBtn}>
                        REGISTER FOR A SLOT →
                      </Link>
                    </div>
                  ) : (
                    <div className={styles.slotsWrapper}>
                      <div className={styles.slotList}>
                        {upcomingBookings.map(b => {
                          const waLink = b.slotData?.whatsapp_link || globalWhatsappLink
                          const slotTargetId = b.slot_id || b.slotData?.slot_id
                          return (
                            <div key={b.booking_id} className={styles.slotItem} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.85rem' }}>
                              {/* 1. Booked Slot Details Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div className={styles.slotDetails}>
                                  <span className={styles.slotDate}>
                                    📅 {formatDate(b.slotData?.date || '')} • {b.slotData?.time_label}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: '#aaaaaa', marginTop: '2px', display: 'block' }}>
                                    Match Series: 3 Matches (Erangel, Rondo, Miramar)
                                  </span>
                                </div>
                                <span className={b.payment_status === 'paid' ? styles.badgePaid : styles.badgePending}>
                                  {b.payment_status === 'paid' ? 'CONFIRMED' : 'PENDING'}
                                </span>
                              </div>

                              {/* 2 & 3. Room Slot Number & Points Table Action Grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                                {/* 2. Room Slot Number */}
                                <div style={{
                                  background: 'rgba(251, 191, 36, 0.08)',
                                  border: '1px solid rgba(251, 191, 36, 0.3)',
                                  borderRadius: '8px',
                                  padding: '0.6rem 0.8rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                }}>
                                  <span style={{ fontSize: '0.64rem', color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>
                                    YOUR ROOM SLOT
                                  </span>
                                  <strong style={{ fontSize: '1rem', color: '#fbbf24', fontWeight: 900, marginTop: '1px' }}>
                                    SLOT #{b.room_slot_number || 5}
                                  </strong>
                                </div>

                                {/* 3. Points Table Direct Link */}
                                <Link
                                  href={`/leaderboard?slot_id=${slotTargetId}&tab=slot`}
                                  style={{
                                    background: '#1c1c1c',
                                    border: '1px solid #fbbf24',
                                    color: '#fbbf24',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    letterSpacing: '0.02em',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <Trophy size={14} color="#fbbf24" />
                                  <span>POINTS TABLE →</span>
                                </Link>
                              </div>

                              {/* 4. Official WhatsApp Group Link Button */}
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: '#25D366',
                                  color: '#080c10',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  padding: '0.65rem 1rem',
                                  borderRadius: '8px',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  letterSpacing: '0.02em',
                                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.15)',
                                }}
                              >
                                <MessageCircle size={16} color="#080c10" />
                                <span>JOIN WHATSAPP FOR ROOM ID &amp; PASS</span>
                              </a>
                            </div>
                          )
                        })}
                      </div>

                      <Link href="/slots" className={styles.secondaryBtn} style={{ marginTop: '0.5rem' }}>
                        REGISTER ANOTHER SLOT →
                      </Link>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: PAST / COMPLETED SLOTS */}
              {slotTab === 'past' && (
                <>
                  {pastBookings.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p className={styles.emptyText}>No past completed slots yet</p>
                    </div>
                  ) : (
                    <div className={styles.slotList}>
                      {pastBookings.map(b => {
                        const targetSlotId = b.slot_id || b.slotData?.slot_id
                        const matchesForSlot = teamMatches.filter(m => m.slot_id === targetSlotId)
                        const totalSlotPts = matchesForSlot.reduce((sum, m) => sum + (m.total_points || 0), 0)
                        return (
                          <div key={b.booking_id} className={styles.slotItem} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.65rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span className={styles.slotDate}>{formatDate(b.slotData?.date || '')} • {b.slotData?.time_label}</span>
                                <span style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'block', fontWeight: 800 }}>
                                  ROOM SLOT: SLOT #{b.room_slot_number || 5}
                                </span>
                              </div>
                              <span style={{ background: 'rgba(255,255,255,0.08)', color: '#aaaaaa', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px' }}>
                                COMPLETED
                              </span>
                            </div>

                             {/* Score Summary for Past Slot */}
                            <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '6px', padding: '0.65rem', fontSize: '0.78rem' }}>
                              {matchesForSlot.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {matchesForSlot.map((m, idx) => (
                                    <div key={m.match_id || idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#cccccc' }}>
                                      <span>Match {m.match_number || idx + 1} ({m.map_name || 'Erangel'}):</span>
                                      <strong style={{ color: '#ffffff' }}>
                                        Pos #{m.position || '-'} • {m.kills || 0} Kills ({m.total_points || 0} Pts)
                                      </strong>
                                    </div>
                                  ))}
                                  <div style={{ borderTop: '1px dashed #333', paddingTop: '4px', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                    <strong style={{ color: '#fbbf24' }}>TOTAL SLOT SCORE:</strong>
                                    <strong style={{ color: '#fbbf24', fontSize: '0.88rem' }}>{totalSlotPts} PTS</strong>
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: '#777777', fontStyle: 'italic' }}>Scores recorded on global leaderboard</span>
                              )}
                            </div>

                            <Link
                              href={`/leaderboard?slot_id=${targetSlotId}&tab=slot`}
                              style={{
                                background: '#1c1c1c',
                                border: '1px solid #fbbf24',
                                color: '#fbbf24',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                padding: '0.55rem 0.8rem',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                letterSpacing: '0.02em',
                                marginTop: '0.2rem',
                              }}
                            >
                              <Trophy size={13} color="#fbbf24" />
                              <span>VIEW SLOT POINTS TABLE →</span>
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── CARD 2: MY STANDING ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}>
                <TrendingUp size={18} color="#facc15" />
              </div>
              <h2 className={styles.cardTitle}>MY STANDING</h2>
            </div>

            <div className={styles.cardBody}>
              <div className={styles.standingSummary}>
                <div className={styles.rankContainer}>
                  <span className={styles.rankValue}>
                    {rank > 0 ? `#${rank}` : '—'}
                  </span>
                  <span className={styles.rankLabel}>OVERALL RANK</span>
                </div>

                <div className={styles.metricsGrid}>
                  <div className={styles.metricBox}>
                    <span className={styles.metricValue}>
                      {leaderboardEntry?.best_16_total ?? 0}
                    </span>
                    <span className={styles.metricLabel}>BEST-16 SCORE</span>
                  </div>

                  <div className={styles.metricDivider} />

                  <div className={styles.metricBox}>
                    <span className={styles.metricValue}>
                      {leaderboardEntry?.matches_played ?? 0}
                    </span>
                    <span className={styles.metricLabel}>MATCHES PLAYED</span>
                  </div>
                </div>

                <div
                  className={
                    isQualified ? styles.badgeQualified : styles.badgeNotQualified
                  }
                >
                  {isQualified ? 'QUALIFIED ✓' : 'NOT YET QUALIFIED'}
                </div>
              </div>
            </div>

            <div className={styles.cardFooter}>
              <Link href="/leaderboard" className={styles.footerLink}>
                VIEW FULL LEADERBOARD →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRE-MATCH ROOM SLOT LAYOUT MODAL ── */}
      {activeSlotModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div style={{
            background: '#141414',
            border: '1px solid #2e2e2e',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #222222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase' }}>
                  🎯 ROOM SLOT LAYOUT TABLE
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#aaaaaa' }}>
                  {formatDate(activeSlotModal.slotData?.date || '')} • {activeSlotModal.slotData?.time_label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlotModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#aaaaaa', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Room Slot List (Slots 1 to 24) */}
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Array.from({ length: 24 }).map((_, idx) => {
                const slotNum = idx + 1
                const bookedTeamsInSlot = slotBookingsMap[activeSlotModal.slot_id] || []
                const foundBooking = bookedTeamsInSlot.find(b => b.room_slot_number === slotNum)

                const isReservedAdmin = slotNum <= 4
                const isUserSquad = foundBooking && foundBooking.team_id === team.team_id

                return (
                  <div
                    key={slotNum}
                    style={{
                      background: isUserSquad
                        ? 'rgba(251, 191, 36, 0.15)'
                        : isReservedAdmin
                        ? 'rgba(239, 68, 68, 0.08)'
                        : foundBooking
                        ? '#1c1c1c'
                        : '#111111',
                      border: isUserSquad
                        ? '1.5px solid #fbbf24'
                        : isReservedAdmin
                        ? '1px solid rgba(239, 68, 68, 0.3)'
                        : '1px solid #222222',
                      borderRadius: '8px',
                      padding: '0.55rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: isUserSquad ? '#fbbf24' : '#262626',
                        color: isUserSquad ? '#000000' : '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {slotNum}
                      </span>

                      <strong style={{ color: isUserSquad ? '#fbbf24' : '#ffffff' }}>
                        {isReservedAdmin
                          ? 'BGFS Host / Caster / Referees'
                          : foundBooking
                          ? foundBooking.team_name
                          : 'Slot Open / Unbooked'}
                      </strong>
                    </div>

                    {isUserSquad && (
                      <span style={{ background: '#fbbf24', color: '#000000', fontSize: '0.65rem', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>
                        ★ YOUR SQUAD
                      </span>
                    )}

                    {isReservedAdmin && (
                      <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                        ADMIN
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #222222', textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveSlotModal(null)}
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', fontWeight: 800 }}
              >
                Close Table
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
