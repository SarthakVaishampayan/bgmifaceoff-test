'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import { useSearchParams } from 'next/navigation'
import { Trophy, Medal, Award, Layers, ChevronDown, Check } from 'lucide-react'
import { formatMonthDay, formatFullDate } from '@/lib/utils/formatDate'
import styles from './page.module.css'

interface LeaderboardRow {
  team_id: string
  team_name: string
  matches_played: number
  best_16_total: number
  total_kills: number
  rank: number
}

interface MatchEntry {
  match_id?: string
  team_id: string
  slot_id: string
  match_number: number
  total_points: number
  placement: number
  kills: number
  placement_points?: number
  kill_points?: number
  teams?: { team_name: string } | null
  slots?: { date: string; time_label: string } | null
}

interface SlotItem {
  slot_id: string
  date: string
  time_label: string
  status: string
  teams_booked_count: number
}

interface BookingEntry {
  booking_id: string
  team_id: string
  slot_id: string
  room_slot_number?: number | null
  teams?: { team_name: string } | null
}

interface Props {
  rows: LeaderboardRow[]
  allMatches: MatchEntry[]
  slots: SlotItem[]
  bookings?: BookingEntry[]
}

export default function LeaderboardClient({ rows, allMatches, slots, bookings = [] }: Props) {
  const searchParams = useSearchParams()
  const urlSlotId = searchParams ? searchParams.get('slot_id') : null
  const urlTab = searchParams ? searchParams.get('tab') : null

  const [viewMode, setViewMode] = useState<'overall' | 'slot'>(
    urlSlotId || urlTab === 'slot' ? 'slot' : 'overall'
  )
  const [search, setSearch] = useState('')
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  // Default selected slot to the URL slot_id or most recent one
  const [selectedSlotId, setSelectedSlotId] = useState<string>(
    urlSlotId || (slots.length > 0 ? slots[0].slot_id : '')
  )

  useEffect(() => {
    if (urlSlotId) {
      setSelectedSlotId(urlSlotId)
      setViewMode('slot')
    } else if (urlTab === 'slot') {
      setViewMode('slot')
    }
  }, [urlSlotId, urlTab])

  // Filter overall standings
  const filteredOverall = useMemo(() =>
    rows.filter(r => r.team_name.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  )

  // Build per-team match map for expanded breakdown
  const teamMatchesMap = useMemo(() => {
    const map: Record<string, MatchEntry[]> = {}
    allMatches.forEach(m => {
      if (!map[m.team_id]) map[m.team_id] = []
      map[m.team_id].push(m)
    })
    return map
  }, [allMatches])

  // Compute per-slot leaderboard for the selected slot
  const slotLeaderboard = useMemo(() => {
    if (!selectedSlotId) return { items: [], hasMatches: false }

    const teamMap: Record<string, {
      team_id: string
      team_name: string
      room_slot_number: number
      m1?: MatchEntry
      m2?: MatchEntry
      m3?: MatchEntry
      total_points: number
      total_kills: number
      total_position_points: number
    }> = {}

    // First, populate all paid bookings for this slot
    const slotBookings = bookings.filter(b => b.slot_id === selectedSlotId)
    slotBookings.forEach((b, index) => {
      const roomSlot = b.room_slot_number || (5 + index)
      teamMap[b.team_id] = {
        team_id: b.team_id,
        team_name: b.teams?.team_name || 'Team #' + b.team_id.slice(0, 5),
        room_slot_number: roomSlot,
        total_points: 0,
        total_kills: 0,
        total_position_points: 0,
      }
    })

    // Then, merge match data for this slot
    const matchesForSlot = allMatches.filter(m => m.slot_id === selectedSlotId)
    matchesForSlot.forEach(m => {
      if (!teamMap[m.team_id]) {
        teamMap[m.team_id] = {
          team_id: m.team_id,
          team_name: m.teams?.team_name || 'Team #' + m.team_id.slice(0, 5),
          room_slot_number: 5,
          total_points: 0,
          total_kills: 0,
          total_position_points: 0,
        }
      }
      const entry = teamMap[m.team_id]
      if (m.match_number === 1) entry.m1 = m
      if (m.match_number === 2) entry.m2 = m
      if (m.match_number === 3) entry.m3 = m
      entry.total_points += m.total_points || 0
      entry.total_kills += m.kills || 0
      const posPts = m.placement_points !== undefined ? m.placement_points : Math.max(0, (m.total_points || 0) - (m.kills || 0))
      entry.total_position_points += posPts
    })

    const hasMatches = matchesForSlot.length > 0

    const list = Object.values(teamMap).sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      if (b.total_kills !== a.total_kills) return b.total_kills - a.total_kills
      return a.room_slot_number - b.room_slot_number
    })

    return {
      items: list.map((item, idx) => ({ ...item, rank: idx + 1 })),
      hasMatches,
    }
  }, [selectedSlotId, allMatches, bookings])

  const selectedSlot = useMemo(() =>
    slots.find(s => s.slot_id === selectedSlotId),
    [slots, selectedSlotId]
  )

  function getRankBadgeClass(rank: number) {
    if (rank === 1) return 'badge-gold'
    if (rank === 2) return 'badge-silver'
    if (rank === 3) return 'badge-bronze'
    return 'badge-neutral'
  }

  function getRowRankClass(rank: number) {
    if (rank === 1) return styles.rank1
    if (rank === 2) return styles.rank2
    if (rank === 3) return styles.rank3
    if (rank <= 16) return styles.qualifies
    return ''
  }

  return (
    <main className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>STANDINGS & LEADERBOARD</h1>
            <p className={styles.subtitle}>
              Official BGFS League Standings • Best 5 Slots (15 Matches) Scoring System
            </p>
          </div>
          <div className={styles.headerRight}>
            {viewMode === 'overall' && (
              <input
                type="text"
                className={styles.searchInput}
                placeholder="🔍 Search team name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* View Mode Switcher Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setViewMode('overall')}
            style={{
              flex: '1 1 240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: viewMode === 'overall' ? '#facc15' : '#1c1c1c',
              color: viewMode === 'overall' ? '#000000' : '#cccccc',
              border: viewMode === 'overall' ? '1px solid #facc15' : '1px solid #2a2a2a',
              fontWeight: 700,
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              boxShadow: viewMode === 'overall' ? '0 2px 10px rgba(250, 204, 21, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              minHeight: '44px',
            }}
          >
            <Trophy size={16} color={viewMode === 'overall' ? '#000000' : '#facc15'} />
            <span>OVERALL STANDINGS (BEST 5 SLOTS)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('slot')}
            style={{
              flex: '1 1 240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: viewMode === 'slot' ? '#facc15' : '#1c1c1c',
              color: viewMode === 'slot' ? '#000000' : '#cccccc',
              border: viewMode === 'slot' ? '1px solid #facc15' : '1px solid #2a2a2a',
              fontWeight: 700,
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              boxShadow: viewMode === 'slot' ? '0 2px 10px rgba(250, 204, 21, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              minHeight: '44px',
            }}
          >
            <Layers size={16} color={viewMode === 'slot' ? '#000000' : '#facc15'} />
            <span>SLOT RESULTS (3 MATCHES)</span>
          </button>
        </div>

        {/* ── MODE 1: OVERALL STANDINGS (BEST 5 SLOTS) ── */}
        {viewMode === 'overall' && (
          <>
            {/* Desktop Table */}
            <div className={`${styles.tableWrapper} hide-mobile`}>
              <div className="table-wrapper">
                <table>
                  <thead style={{ background: '#161616' }}>
                    <tr style={{ background: '#161616', borderBottom: '1px solid #2a2a2a' }}>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', width: '64px' }}>RANK</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a' }}>TEAM NAME</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>MATCHES PLAYED</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>BEST 5 SLOTS TOTAL</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>ELIMINATIONS</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOverall.map((row, idx) => (
                      <Fragment key={row.team_id}>
                        <tr
                          className={`${styles.teamRow} ${getRowRankClass(row.rank)} ${expandedTeam === row.team_id ? styles.expanded : ''}`}
                          onClick={() => setExpandedTeam(expandedTeam === row.team_id ? null : row.team_id)}
                        >
                          <td>
                            <span className={`badge ${getRankBadgeClass(row.rank)}`}>
                              #{row.rank}
                            </span>
                          </td>
                          <td>
                            <div className={styles.teamNameCell}>
                              <span className={styles.teamNameText}>{row.team_name}</span>
                              {row.rank <= 16 && (
                                <span className={styles.qualifiedTag}>✓ FINALS QUALIFIED</span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', color: '#b8b8b8', fontWeight: '600' }}>
                            {row.matches_played}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <strong style={{ color: '#facc15', fontSize: '1.1rem', fontWeight: '800' }}>
                              {row.best_16_total}
                            </strong>
                          </td>
                          <td style={{ textAlign: 'center', color: '#b8b8b8', fontWeight: '600' }}>
                            {row.total_kills}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={styles.expandIcon}>
                              {expandedTeam === row.team_id ? '▲' : '▼'}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded match breakdown */}
                        {expandedTeam === row.team_id && (
                          <tr key={`${row.team_id}-expanded`}>
                            <td colSpan={6} className={styles.expandedCell}>
                              <MatchBreakdown matches={teamMatchesMap[row.team_id] || []} />
                            </td>
                          </tr>
                        )}

                        {/* Grand Finals Qualification Cutoff Line after Rank 16 */}
                        {row.rank === 16 && idx < filteredOverall.length - 1 && (
                          <tr key="cutoff-row" className={styles.cutoffRow}>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <div className={styles.cutoffBanner}>
                                🏆 TOP 16 GRAND FINALS QUALIFICATION CUTOFF 🏆
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {filteredOverall.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: '#888888', padding: '3rem 1.5rem', fontFamily: 'Inter, sans-serif' }}>
                          No registered teams found matching search query
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className={styles.mobileList}>
              {filteredOverall.map((row, idx) => (
                <Fragment key={row.team_id}>
                  <div className={`${styles.mobileCard} ${getRowRankClass(row.rank)}`}>
                    <button
                      className={styles.mobileCardHeader}
                      onClick={() => setExpandedTeam(expandedTeam === row.team_id ? null : row.team_id)}
                    >
                      <div className={styles.mobileCardLeft}>
                        <span className={`badge ${getRankBadgeClass(row.rank)}`}>#{row.rank}</span>
                        <div>
                          <div className={styles.mobileTeamNameRow}>
                            <span className={styles.mobileTeamName}>{row.team_name}</span>
                            {row.rank <= 16 && (
                              <span className={styles.mobileQualifiedTag}>QUALIFIED</span>
                            )}
                          </div>
                          <div className={styles.mobileTeamMeta}>
                            {row.matches_played} MATCHES PLAYED
                          </div>
                        </div>
                      </div>
                      <div className={styles.mobileCardRight}>
                        <div>
                          <div className={styles.mobileStatVal}>{row.best_16_total}</div>
                          <div className={styles.mobileStatLabel}>BEST-16</div>
                        </div>
                        <span className={styles.expandIcon}>{expandedTeam === row.team_id ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {expandedTeam === row.team_id && (
                      <div className={styles.mobileExpanded}>
                        <div className={styles.mobileStats}>
                          <div>
                            <div className={styles.mobileStatVal}>{row.total_kills}</div>
                            <div className={styles.mobileStatLabel}>ELIMINATIONS</div>
                          </div>
                          {row.rank <= 16 && (
                            <span className="badge badge-gold">✓ QUALIFIES FOR FINALS</span>
                          )}
                        </div>
                        <MatchBreakdown matches={teamMatchesMap[row.team_id] || []} />
                      </div>
                    )}
                  </div>

                  {/* Mobile Cutoff Banner */}
                  {row.rank === 16 && idx < filteredOverall.length - 1 && (
                    <div key="cutoff-mobile" className={styles.cutoffBannerMobile}>
                      🏆 TOP 16 GRAND FINALS QUALIFICATION CUTOFF 🏆
                    </div>
                  )}
                </Fragment>
              ))}

              {filteredOverall.length === 0 && (
                <p style={{ textAlign: 'center', color: '#888888', padding: '3rem 1.5rem', fontFamily: 'Inter, sans-serif' }}>
                  No registered teams found matching search query
                </p>
              )}
            </div>
          </>
        )}

        {/* ── MODE 2: PER-SLOT RESULTS (3 MATCHES) ── */}
        {viewMode === 'slot' && (
          <>
            {/* Slot Dropdown Selector Bar */}
            <div className={styles.slotSelectorBar}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#facc15', marginBottom: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  SELECT SLOT TO VIEW RESULTS
                </label>
                <CustomSlotDropdown
                  slots={slots}
                  selectedSlotId={selectedSlotId}
                  onSelectSlot={id => setSelectedSlotId(id)}
                />
              </div>

              {selectedSlot && (
                <div className={styles.slotInfoBadge}>
                  ⚡ {formatMonthDay(selectedSlot.date)} • {selectedSlot.time_label} • 3 MATCHES
                </div>
              )}
            </div>

            {/* Per-Slot Desktop Table */}
            <div className={`${styles.tableWrapper} hide-mobile`}>
              <div className="table-wrapper">
                <table>
                  <thead style={{ background: '#161616' }}>
                    <tr style={{ background: '#161616', borderBottom: '1px solid #2a2a2a' }}>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', width: '64px' }}>RANK</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a' }}>TEAM NAME</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>MATCH 1</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>MATCH 2</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>MATCH 3</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>POSITION POINTS</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>ELIMINATIONS</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>SLOT POINTS</th>
                      <th style={{ background: '#161616', color: '#facc15', padding: '14px 16px', textTransform: 'uppercase', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>SLOT PRIZE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slotLeaderboard.items.map(row => (
                      <tr key={row.team_id} className={`${styles.teamRow} ${getRowRankClass(row.rank)}`}>
                        <td>
                          <span className={`badge ${getRankBadgeClass(row.rank)}`}>
                            #{row.rank}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className={styles.teamNameText}>
                              {row.team_name} {!slotLeaderboard.hasMatches && <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700 }}>[Slot {row.room_slot_number}]</span>}
                            </span>
                            {!slotLeaderboard.hasMatches && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#facc15', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                ROOM SLOT: SLOT {row.room_slot_number}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                          {row.m1 ? (
                            <span style={{ color: '#e5e5e5', fontWeight: 600 }}>
                              {row.m1.total_points} pts <span style={{ color: '#888', fontSize: '0.78rem' }}>(#{row.m1.placement})</span>
                            </span>
                          ) : (
                            <span style={{ color: '#555' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                          {row.m2 ? (
                            <span style={{ color: '#e5e5e5', fontWeight: 600 }}>
                              {row.m2.total_points} pts <span style={{ color: '#888', fontSize: '0.78rem' }}>(#{row.m2.placement})</span>
                            </span>
                          ) : (
                            <span style={{ color: '#555' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                          {row.m3 ? (
                            <span style={{ color: '#e5e5e5', fontWeight: 600 }}>
                              {row.m3.total_points} pts <span style={{ color: '#888', fontSize: '0.78rem' }}>(#{row.m3.placement})</span>
                            </span>
                          ) : (
                            <span style={{ color: '#555' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', color: '#60a5fa', fontWeight: '700', fontSize: '0.95rem' }}>
                          {row.total_position_points}
                        </td>
                        <td style={{ textAlign: 'center', color: '#b8b8b8', fontWeight: '600' }}>
                          {row.total_kills}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong style={{ color: '#facc15', fontSize: '1.1rem', fontWeight: '800' }}>
                            {row.total_points}
                          </strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {row.rank === 1 && (
                            <span className={styles.prizeTagGold}>
                              <Trophy size={12} /> ₹250 REWARD
                            </span>
                          )}
                          {row.rank === 2 && (
                            <span className={styles.prizeTagSilver}>
                              <Medal size={12} /> ₹150 REWARD
                            </span>
                          )}
                          {row.rank === 3 && (
                            <span className={styles.prizeTagBronze}>
                              <Award size={12} /> FREE SLOT PASS
                            </span>
                          )}
                          {row.rank > 3 && (
                            <span style={{ color: '#555555', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {slotLeaderboard.items.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', color: '#888888', padding: '3rem 1.5rem', fontFamily: 'Inter, sans-serif' }}>
                          No registered teams or match scores for this slot yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-Slot Mobile View */}
            <div className={styles.mobileList}>
              {slotLeaderboard.items.map(row => (
                <div key={row.team_id} className={`${styles.mobileCard} ${getRowRankClass(row.rank)}`} style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${getRankBadgeClass(row.rank)}`}>#{row.rank}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className={styles.mobileTeamName}>
                          {row.team_name} {!slotLeaderboard.hasMatches && <span style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 700 }}>[Slot {row.room_slot_number}]</span>}
                        </span>
                        {!slotLeaderboard.hasMatches && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#facc15', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            ROOM SLOT: SLOT {row.room_slot_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className={styles.mobileStatVal}>{row.total_points}</div>
                      <div className={styles.mobileStatLabel}>SLOT PTS</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem', color: '#b8b8b8', background: '#141414', padding: '8px 12px', borderRadius: '6px', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>M1: {row.m1 ? `${row.m1.total_points}pts (#${row.m1.placement})` : '—'}</span>
                    <span>M2: {row.m2 ? `${row.m2.total_points}pts (#${row.m2.placement})` : '—'}</span>
                    <span>M3: {row.m3 ? `${row.m3.total_points}pts (#${row.m3.placement})` : '—'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#b8b8b8', background: '#141414', padding: '6px 12px', borderRadius: '6px', justifyContent: 'space-around', marginBottom: '0.5rem' }}>
                    <span>Pos Pts: <strong style={{ color: '#60a5fa' }}>{row.total_position_points}</strong></span>
                    <span>Elims: <strong style={{ color: '#e5e5e5' }}>{row.total_kills}</strong></span>
                  </div>

                  {row.rank <= 3 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      {row.rank === 1 && <span className={styles.prizeTagGold}><Trophy size={12} /> ₹250 REWARD</span>}
                      {row.rank === 2 && <span className={styles.prizeTagSilver}><Medal size={12} /> ₹150 REWARD</span>}
                      {row.rank === 3 && <span className={styles.prizeTagBronze}><Award size={12} /> FREE SLOT PASS</span>}
                    </div>
                  )}
                </div>
              ))}

              {slotLeaderboard.items.length === 0 && (
                <p style={{ textAlign: 'center', color: '#888888', padding: '3rem 1.5rem', fontFamily: 'Inter, sans-serif' }}>
                  No registered teams or match scores for this slot yet.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function CustomSlotDropdown({
  slots,
  selectedSlotId,
  onSelectSlot,
}: {
  slots: SlotItem[]
  selectedSlotId: string
  onSelectSlot: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedSlot = slots.find(s => s.slot_id === selectedSlotId)

  const getLabel = (s?: SlotItem) => {
    if (!s) return 'No slots created yet'
    const formattedDate = formatFullDate(s.date)
    return `${formattedDate} — ${s.time_label} ${s.status === 'completed' ? '✓ (Completed)' : ''}`
  }

  return (
    <div style={{ position: 'relative', minWidth: '320px', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={slots.length === 0}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: '#161616',
          border: isOpen ? '1px solid #facc15' : '1px solid #2a2a2a',
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          cursor: slots.length === 0 ? 'not-allowed' : 'pointer',
          opacity: slots.length === 0 ? 0.7 : 1,
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 12px rgba(250, 204, 21, 0.15)' : 'none',
        }}
      >
        <span style={{ color: slots.length === 0 ? '#888888' : '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {slots.length === 0 ? 'No slots created yet' : getLabel(selectedSlot)}
        </span>
        <ChevronDown
          size={18}
          color="#facc15"
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {isOpen && slots.length > 0 && (
        <>
          <div className={styles.dropdownBackdrop} onClick={() => setIsOpen(false)} />
          <ul className={styles.customDropdownMenu}>
            {slots.map(s => {
              const isSelected = s.slot_id === selectedSlotId
              return (
                <li
                  key={s.slot_id}
                  className={`${styles.customDropdownItem} ${isSelected ? styles.itemSelected : ''}`}
                  onClick={() => {
                    onSelectSlot(s.slot_id)
                    setIsOpen(false)
                  }}
                >
                  <span>{getLabel(s)}</span>
                  {isSelected && <Check size={14} color="#facc15" />}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function MatchBreakdown({ matches }: { matches: MatchEntry[] }) {
  if (matches.length === 0) {
    return <p style={{ color: '#777777', fontSize: '0.8rem', padding: '0.75rem 1.25rem' }}>No match score history recorded yet</p>
  }

  // Sort by date then match number
  const sorted = [...matches].sort((a, b) => {
    const dateA = a.slots?.date || ''
    const dateB = b.slots?.date || ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return a.match_number - b.match_number
  })

  // Mark top 16 matches
  const scoresSorted = [...matches].sort((a, b) => b.total_points - a.total_points)
  const top16Set = new Set(scoresSorted.slice(0, 16).map(m => `${m.slot_id}-${m.match_number}`))

  return (
    <div style={{ padding: '1rem 1.25rem', overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {sorted.map((m, i) => {
          const key = `${m.slot_id}-${m.match_number}`
          const isTop16 = top16Set.has(key)
          return (
            <div
              key={i}
              title={`Placement: #${m.placement} | Eliminations: ${m.kills} | Points: ${m.total_points}`}
              style={{
                background: isTop16 ? '#272727' : '#1d1d1d',
                border: `1px solid ${isTop16 ? '#facc15' : '#323232'}`,
                borderRadius: '6px',
                padding: '0.35rem 0.6rem',
                fontSize: '0.75rem',
                minWidth: '44px',
                textAlign: 'center',
                color: isTop16 ? '#facc15' : '#b8b8b8',
                fontWeight: isTop16 ? 800 : 500,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {m.total_points} Pts
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: '0.72rem', color: '#777777', marginTop: '0.6rem', fontFamily: 'Inter, sans-serif' }}>
        ⚡ Gold outline indicates scores included in Best-16 total calculation.
      </p>
    </div>
  )
}
