'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Download, Plus, Edit2, Trash2, Check, X, RefreshCw, AlertCircle, Sparkles } from 'lucide-react'
import { isSlotPastOrEnded } from '@/lib/utils/slotTime'

interface Slot {
  slot_id: string
  date: string
  time_label: string
  status?: string
  teams_booked_count?: number
  capacity?: number
}

interface BookedTeam {
  team_id: string
  team_name: string
  room_slot_number?: number
  is_false_team?: boolean
  captain_name?: string
  contact_number?: string
}

interface SlotListTabProps {
  slots: Slot[]
  selectedSlot?: string
  setSelectedSlot?: (id: string) => void
  bookedTeams?: BookedTeam[]
  onRefreshSlot?: (slotId: string) => Promise<void>
  supabase?: any
  isSuperAdmin?: boolean
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return 'DATE'
  try {
    const clean = String(dateStr).split('T')[0]
    const [y, m, d] = clean.split('-').map(Number)
    if (!y || !m || !d) return clean
    const dt = new Date(y, m - 1, d)
    const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
    const monthName = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    return `${dayName}, ${String(d).padStart(2, '0')} ${monthName} ${y}`
  } catch {
    return dateStr
  }
}

export default function SlotListTab({
  slots,
  selectedSlot: propSelectedSlot,
  setSelectedSlot: propSetSelectedSlot,
  bookedTeams: propBookedTeams,
  onRefreshSlot: propOnRefreshSlot,
  supabase: propSupabase,
}: SlotListTabProps) {
  // Local state fallbacks if not controlled by parent
  const [internalSelectedSlot, setInternalSelectedSlot] = useState('')
  const [internalBookedTeams, setInternalBookedTeams] = useState<BookedTeam[]>([])

  const selectedSlot = propSelectedSlot !== undefined ? propSelectedSlot : internalSelectedSlot
  const setSelectedSlot = propSetSelectedSlot || setInternalSelectedSlot
  const bookedTeams = propBookedTeams !== undefined ? propBookedTeams : internalBookedTeams

  // Supabase client instance
  const [supabaseClient, setSupabaseClient] = useState<any>(propSupabase || null)
  useEffect(() => {
    if (!propSupabase) {
      import('@/lib/supabase/client').then(({ createClient }) => {
        setSupabaseClient(createClient())
      })
    } else {
      setSupabaseClient(propSupabase)
    }
  }, [propSupabase])

  // Internal load slot data
  const loadSlotData = async (slotId: string) => {
    if (propOnRefreshSlot) {
      await propOnRefreshSlot(slotId)
    }
    if (!slotId) {
      setInternalBookedTeams([])
      return
    }
    if (supabaseClient) {
      const { data: bData } = await supabaseClient
        .from('bookings')
        .select('team_id, room_slot_number, payment_id, teams(team_id, team_name)')
        .eq('slot_id', slotId)
        .eq('payment_status', 'paid')

      const formatted = bData?.map((b: any) => ({
        ...(b.teams || {}),
        room_slot_number: b.room_slot_number || 5,
        is_false_team: b.payment_id === 'FREE_SPOT_ENTRY',
      })).filter(Boolean) || []

      setInternalBookedTeams(formatted)
    }
  }

  // Filter state: 'all' shows both open & closed slots, 'closed' shows only closed, 'open' shows only open
  const [slotFilter, setSlotFilter] = useState<'all' | 'closed' | 'open'>('all')
  
  // False team modal state
  const [showFalseTeamModal, setShowFalseTeamModal] = useState(false)
  const [falseTeamName, setFalseTeamName] = useState('')
  const [isAddingFalseTeam, setIsAddingFalseTeam] = useState(false)
  const [falseTeamError, setFalseTeamError] = useState('')
  const [existingTeamPrompt, setExistingTeamPrompt] = useState<{ team_id: string; team_name: string } | null>(null)
  const [isRemovingFalseTeam, setIsRemovingFalseTeam] = useState<string | null>(null)

  // Team editing state (in-memory only for shortening text on poster)
  const [nameOverrides, setNameOverrides] = useState<Record<number, string>>({})
  const [editingSlotNum, setEditingSlotNum] = useState<number | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Download state
  const [isDownloading, setIsDownloading] = useState(false)

  // Responsive scaling container for the 1100x1338 poster
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.48)

  useEffect(() => {
    function updateScale() {
      if (previewWrapperRef.current) {
        const availableWidth = previewWrapperRef.current.clientWidth - 24
        // target width 1100px
        const newScale = Math.min(Math.max(availableWidth / 1100, 0.28), 0.75)
        setPreviewScale(newScale)
      }
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  // Auto-dismiss feedback message
  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedbackMsg])

  // Filter out any slots marked as done / completed
  const activeSlots = slots.filter(s => s.status !== 'completed' && s.status !== 'done')
  const closedSlots = activeSlots.filter(s => s.status === 'closed' || isSlotPastOrEnded(s.date, s.time_label, s.status))
  const openSlots = activeSlots.filter(s => !(s.status === 'closed' || isSlotPastOrEnded(s.date, s.time_label, s.status)))

  const displayedSlots = slotFilter === 'closed'
    ? closedSlots
    : slotFilter === 'open'
    ? openSlots
    : activeSlots

  // If currently selected slot is not in the active displayed list, pick the first
  useEffect(() => {
    const isSelectedValid = displayedSlots.some(s => s.slot_id === selectedSlot)
    if ((!selectedSlot || !isSelectedValid) && displayedSlots.length > 0) {
      const first = displayedSlots[0].slot_id
      setSelectedSlot(first)
      loadSlotData(first)
    }
  }, [displayedSlots, selectedSlot, setSelectedSlot])

  // When slot changes or supabaseClient becomes ready
  useEffect(() => {
    if (selectedSlot && supabaseClient && propBookedTeams === undefined) {
      loadSlotData(selectedSlot)
    }
  }, [selectedSlot, supabaseClient])

  // Reset in-memory name overrides when selectedSlot changes
  useEffect(() => {
    setNameOverrides({})
    setEditingSlotNum(null)
  }, [selectedSlot])

  const currentSlotObj = slots.find(s => s.slot_id === selectedSlot)

  // Map room slot numbers (05 to 24) to booked teams with in-memory shortened names
  const slotMap: Record<number, BookedTeam> = {}
  bookedTeams.forEach(t => {
    if (t.room_slot_number && t.room_slot_number >= 5 && t.room_slot_number <= 24) {
      const customName = nameOverrides[t.room_slot_number]
      slotMap[t.room_slot_number] = {
        ...t,
        team_name: customName !== undefined ? customName : t.team_name,
      }
    }
  })

  // 1. Handle adding false team
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

      // Success
      setShowFalseTeamModal(false)
      setFalseTeamName('')
      setExistingTeamPrompt(null)
      setFalseTeamError('')
      setFeedbackMsg({ text: `✅ ${data.message || 'False team added successfully!'}`, type: 'success' })

      // Refresh slot data
      await loadSlotData(selectedSlot)
    } catch (err: any) {
      setFalseTeamError(err.message || 'Error adding false team')
    } finally {
      setIsAddingFalseTeam(false)
    }
  }

  // 2. Handle removing false team
  async function handleRemoveFalseTeam(teamId: string, teamName: string) {
    if (!confirm(`Are you sure you want to remove false team "${teamName}" from this slot?`)) {
      return
    }
    setIsRemovingFalseTeam(teamId)
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
        setFeedbackMsg({ text: `❌ ${data.error || 'Failed to remove false team'}`, type: 'error' })
        return
      }

      setFeedbackMsg({ text: `✅ ${data.message || 'False team removed successfully!'}`, type: 'success' })
      await loadSlotData(selectedSlot)
    } catch (err: any) {
      setFeedbackMsg({ text: `❌ ${err.message || 'Error removing false team'}`, type: 'error' })
    } finally {
      setIsRemovingFalseTeam(null)
    }
  }

  // 3. Handle shortening team name (strictly in-memory for poster fitting; never saved to DB or cache)
  function handleSaveShortenedName(slotNum: number) {
    const trimmed = editingTeamName.trim()
    if (!trimmed) {
      setFeedbackMsg({ text: '❌ Team name cannot be empty.', type: 'error' })
      return
    }

    setNameOverrides(prev => ({
      ...prev,
      [slotNum]: trimmed,
    }))
    setEditingSlotNum(null)
    setEditingTeamName('')
    setFeedbackMsg({
      text: `✏️ Shortened name for Slot #${String(slotNum).padStart(2, '0')} applied to poster (not saved globally)`,
      type: 'success',
    })
  }

  function handleResetName(slotNum: number) {
    setNameOverrides(prev => {
      const next = { ...prev }
      delete next[slotNum]
      return next
    })
    setFeedbackMsg({
      text: `↺ Restored original team name for Slot #${String(slotNum).padStart(2, '0')}`,
      type: 'success',
    })
  }

  // 4. Handle downloading PNG
  async function handleDownloadPng() {
    if (!selectedSlot) return
    setIsDownloading(true)
    try {
      // Build team overrides list from current state
      const teamsOverride = Array.from({ length: 20 }, (_, idx) => {
        const slotNum = 5 + idx
        return {
          room_slot_number: slotNum,
          team_name: slotMap[slotNum]?.team_name || '',
        }
      })

      const res = await fetch('/api/admin/slots/generate-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot,
          time_override: currentSlotObj?.time_label,
          date_override: formatDateLabel(currentSlotObj?.date || ''),
          teams_override: teamsOverride,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Failed to generate poster')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bgfs-slot-list-${currentSlotObj?.date || 'match'}.png`
      a.style.display = 'none'
      a.addEventListener('click', (e) => e.stopPropagation())
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setFeedbackMsg({ text: '✅ Slot List poster downloaded successfully!', type: 'success' })
    } catch (err: any) {
      setFeedbackMsg({ text: `❌ ${err.message || 'Download failed'}`, type: 'error' })
    } finally {
      setIsDownloading(false)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('app:hideLoader'))
      }
    }
  }

  const falseTeamsCount = bookedTeams.filter(t => t.is_false_team).length
  const totalBookedCount = bookedTeams.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: feedbackMsg.type === 'success' ? '#14532d' : '#7f1d1d',
            color: '#fff',
            border: `1px solid ${feedbackMsg.type === 'success' ? '#22c55e' : '#ef4444'}`,
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontSize: '0.9rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(380px, 1.15fr) minmax(420px, 1fr)',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* ======================================================== */}
        {/* LEFT COLUMN: Controls, Slot Selector, False Teams & Table */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Card: Slot Selector */}
          <div
            style={{
              background: '#16181a',
              border: '1px solid #2a2e33',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffd000', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} /> Slot List Management
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Manage room slot team names, add on-spot false teams, and generate posters.
                </p>
              </div>

              {/* Status Filter Segmented Controls */}
              <div style={{ display: 'flex', gap: '4px', background: '#0d0f11', padding: '3px', borderRadius: '8px', border: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setSlotFilter('all')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    background: slotFilter === 'all' ? '#ffd000' : 'transparent',
                    color: slotFilter === 'all' ? '#000' : '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  All ({activeSlots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSlotFilter('closed')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    background: slotFilter === 'closed' ? '#ffd000' : 'transparent',
                    color: slotFilter === 'closed' ? '#000' : '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Closed ({closedSlots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSlotFilter('open')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    background: slotFilter === 'open' ? '#ffd000' : 'transparent',
                    color: slotFilter === 'open' ? '#000' : '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Open ({openSlots.length})
                </button>
              </div>
            </div>

            {/* Dropdown */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={selectedSlot}
                onChange={(e) => {
                  setSelectedSlot(e.target.value)
                  loadSlotData(e.target.value)
                }}
                style={{
                  flex: 1,
                  background: '#0d0f11',
                  border: '1px solid #3b424a',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                {displayedSlots.length === 0 ? (
                  <option value="">No open or closed slots found</option>
                ) : slotFilter === 'all' ? (
                  <>
                    {closedSlots.length > 0 && (
                      <optgroup label="🔴 CLOSED SLOTS">
                        {closedSlots.map((s) => (
                          <option key={s.slot_id} value={s.slot_id}>
                            {s.date} • {s.time_label} 🔴 [CLOSED] ({s.teams_booked_count || 0} teams)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {openSlots.length > 0 && (
                      <optgroup label="🟢 OPEN SLOTS">
                        {openSlots.map((s) => (
                          <option key={s.slot_id} value={s.slot_id}>
                            {s.date} • {s.time_label} 🟢 [OPEN] ({s.teams_booked_count || 0} teams)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                ) : (
                  displayedSlots.map((s) => {
                    const isClosed = s.status === 'closed' || isSlotPastOrEnded(s.date, s.time_label, s.status)
                    return (
                      <option key={s.slot_id} value={s.slot_id}>
                        {s.date} • {s.time_label} {isClosed ? '🔴 [CLOSED]' : '🟢 [OPEN]'} ({s.teams_booked_count || 0} teams)
                      </option>
                    )
                  })
                )}
              </select>

              <button
                type="button"
                onClick={() => {
                  setNameOverrides({})
                  setEditingSlotNum(null)
                  if (selectedSlot) loadSlotData(selectedSlot)
                }}
                title="Refresh slot data (resets temporary edits to DB originals)"
                style={{
                  background: '#23272b',
                  border: '1px solid #3b424a',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  padding: '0 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* False Team Mechanism Card (Above the List) */}
          <div
            style={{
              background: '#16181a',
              border: '1px solid #2a2e33',
              borderRadius: '12px',
              padding: '1.1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>
                  False &amp; Spot Teams
                </span>
                <span
                  style={{
                    background: falseTeamsCount > 0 ? '#b45309' : '#334155',
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  {falseTeamsCount} Added
                </span>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                  • {totalBookedCount} / 20 Total
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '3px 0 0 0' }}>
                Teams added here auto-sync to the <strong>Score Entry</strong> page and occupy the next room slot.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFalseTeamError('')
                setFalseTeamName('')
                setExistingTeamPrompt(null)
                setShowFalseTeamModal(true)
              }}
              disabled={!selectedSlot}
              style={{
                background: '#ffd000',
                color: '#111',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: selectedSlot ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(255, 208, 0, 0.25)',
                opacity: selectedSlot ? 1 : 0.5,
              }}
            >
              <Plus size={15} strokeWidth={3} /> Add False Team
            </button>
          </div>

          {/* Editable Team List (Slots 05 to 24) */}
          <div
            style={{
              background: '#16181a',
              border: '1px solid #2a2e33',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a2e33', paddingBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Assigned Room Slots (05 – 24)
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                ✏️ Edit button shortens name for this poster only (never saved globally)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '580px', overflowY: 'auto', paddingRight: '4px' }}>
              {Array.from({ length: 20 }, (_, idx) => {
                const slotNum = 5 + idx
                const slotStr = String(slotNum).padStart(2, '0')
                const team = slotMap[slotNum]
                const isOccupied = !!team
                const isEditing = editingSlotNum === slotNum
                const isCustomized = nameOverrides[slotNum] !== undefined

                return (
                  <div
                    key={slotNum}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isOccupied ? '#1c2024' : '#101214',
                      border: isOccupied ? '1px solid #374151' : '1px dashed #262c33',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Left: Slot number & Team Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          background: isOccupied ? '#ffd000' : '#272d33',
                          color: isOccupied ? '#000' : '#94a3b8',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          borderRadius: '6px',
                          padding: '3px 8px',
                          minWidth: '32px',
                          textAlign: 'center',
                        }}
                      >
                        {slotStr}
                      </span>

                      {/* Name or Inline Editor */}
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                          <input
                            type="text"
                            value={editingTeamName}
                            onChange={(e) => setEditingTeamName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveShortenedName(slotNum)
                              if (e.key === 'Escape') setEditingSlotNum(null)
                            }}
                            placeholder="Shorten name for poster box..."
                            autoFocus
                            style={{
                              background: '#0d0f11',
                              border: '1px solid #ffd000',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '0.85rem',
                              padding: '4px 8px',
                              flex: 1,
                              outline: 'none',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveShortenedName(slotNum)}
                            title="Apply shortened name to poster"
                            style={{
                              background: '#22c55e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSlotNum(null)}
                            title="Cancel"
                            style={{
                              background: '#475569',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                          <span
                            style={{
                              fontSize: '0.86rem',
                              fontWeight: isOccupied ? 700 : 500,
                              color: isOccupied ? '#f1f5f9' : '#525a66',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {isOccupied ? team.team_name : '— Empty Slot —'}
                          </span>

                          {isCustomized && (
                            <span
                              style={{
                                background: 'rgba(52, 211, 153, 0.15)',
                                color: '#34d399',
                                border: '1px solid rgba(52, 211, 153, 0.35)',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                padding: '1px 5px',
                                whiteSpace: 'nowrap',
                              }}
                              title="Shortened for poster only (original DB name untouched)"
                            >
                              Poster Shortened
                            </span>
                          )}

                          {team?.is_false_team && (
                            <span
                              style={{
                                background: '#78350f',
                                color: '#fef3c7',
                                border: '1px solid #d97706',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                borderRadius: '4px',
                                padding: '1px 6px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              False Team
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    {isOccupied && !isEditing && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                        {isCustomized && (
                          <button
                            type="button"
                            onClick={() => handleResetName(slotNum)}
                            title="Revert to original DB team name"
                            style={{
                              background: '#23272b',
                              border: '1px solid #3b424a',
                              color: '#94a3b8',
                              borderRadius: '4px',
                              padding: '3px 7px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <RefreshCw size={12} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingSlotNum(slotNum)
                            setEditingTeamName(team.team_name)
                          }}
                          title="Shorten name for poster"
                          style={{
                            background: '#293038',
                            border: '1px solid #3e4854',
                            color: '#cbd5e1',
                            borderRadius: '4px',
                            padding: '3px 7px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>

                        {team.is_false_team && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFalseTeam(team.team_id, team.team_name)}
                            disabled={isRemovingFalseTeam === team.team_id}
                            title="Remove false team"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#ef4444',
                              borderRadius: '4px',
                              padding: '3px 7px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Download Action & Exact Poster Live Preview */}
        {/* ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} ref={previewWrapperRef}>
          {/* Download Action Bar */}
          <div
            style={{
              background: '#16181a',
              border: '1px solid #2a2e33',
              borderRadius: '12px',
              padding: '0.9rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>
                Official Poster Preview
              </span>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                1100 × 1338 px • Sharp PNG Export
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isDownloading || !selectedSlot}
              style={{
                background: '#ffd000',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: selectedSlot && !isDownloading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(255, 208, 0, 0.3)',
                opacity: selectedSlot && !isDownloading ? 1 : 0.6,
              }}
            >
              {isDownloading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Download size={16} strokeWidth={2.5} /> Download List in PNG
                </>
              )}
            </button>
          </div>

          {/* Scaled Poster Container */}
          <div
            style={{
              background: '#0a0b0d',
              border: '1px solid #2a2e33',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              overflow: 'hidden',
              minHeight: `${Math.round(1338 * previewScale) + 32}px`,
              position: 'relative',
            }}
          >
            {/* The 1100x1338 Exact Template Element */}
            <div
              style={{
                width: '1100px',
                height: '1338px',
                transform: `scale(${previewScale})`,
                transformOrigin: 'top center',
                position: 'relative',
                overflow: 'hidden',
                background: 'radial-gradient(ellipse at center, #191c1f 0%, #0c0e10 55%, #050607 100%)',
                color: '#ffffff',
                fontFamily: 'Arial, Helvetica, sans-serif',
                boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
                flexShrink: 0,
              }}
            >
              {/* Subtle background diagonal lines */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.08,
                  backgroundImage: 'repeating-linear-gradient(125deg, transparent 0px, transparent 48px, #ffffff 49px, transparent 50px)',
                  pointerEvents: 'none',
                }}
              />

              {/* Yellow side accents (Left) */}
              <div
                style={{
                  position: 'absolute',
                  width: '28px',
                  height: '22px',
                  background: '#ffd000',
                  zIndex: 2,
                  left: 0,
                  top: '205px',
                  clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '28px',
                  height: '22px',
                  background: '#ffd000',
                  zIndex: 2,
                  left: 0,
                  top: '245px',
                  clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '28px',
                  height: '22px',
                  background: '#ffd000',
                  zIndex: 2,
                  left: 0,
                  top: '285px',
                  clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                }}
              />

              {/* Yellow side accents (Right) */}
              <div
                style={{
                  position: 'absolute',
                  width: '28px',
                  height: '22px',
                  background: '#ffd000',
                  zIndex: 2,
                  right: 0,
                  top: '205px',
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '28px',
                  height: '22px',
                  background: '#ffd000',
                  zIndex: 2,
                  right: 0,
                  top: '245px',
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '28px',
                  height: '22px',
                  background: '#ffd000',
                  zIndex: 2,
                  right: 0,
                  top: '285px',
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
                }}
              />

              {/* Header: BATTLEGROUNDS FACEOFF SERIES */}
              <div
                style={{
                  position: 'absolute',
                  top: '68px',
                  left: 0,
                  width: '100%',
                  textAlign: 'center',
                  fontFamily: "'Inter', Arial, Helvetica, sans-serif",
                  fontSize: '28px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: '#ffffff', textShadow: '0 4px 20px rgba(0, 0, 0, 0.8)' }}>
                  BATTLEGROUNDS{' '}
                </span>
                <span
                  style={{
                    color: '#fbbf24',
                    textShadow: '0 0 25px rgba(251, 191, 36, 0.4), 0 4px 20px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  FACEOFF SERIES
                </span>
              </div>

              {/* Header: P R E S E N T S */}
              <div
                style={{
                  position: 'absolute',
                  top: '125px',
                  left: 0,
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '8px',
                  color: '#ffffff',
                }}
              >
                P R E S E N T S
              </div>

              {/* Dynamic Time */}
              <div
                style={{
                  position: 'absolute',
                  top: '185px',
                  left: 0,
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '62px',
                  lineHeight: 1,
                  fontWeight: 800,
                  color: '#ffffff',
                }}
              >
                {currentSlotObj?.time_label || 'TIME'}
              </div>

              {/* Dynamic Date */}
              <div
                style={{
                  position: 'absolute',
                  top: '275px',
                  left: 0,
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '20px',
                  letterSpacing: '5px',
                  fontWeight: 500,
                  color: '#ffffff',
                }}
              >
                {formatDateLabel(currentSlotObj?.date || '')}
              </div>

              {/* Slot Title Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '350px',
                  left: '395px',
                  width: '310px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#ffffff',
                  color: '#111111',
                  borderRadius: '7px',
                  fontSize: '20px',
                  fontWeight: 800,
                  letterSpacing: '5px',
                }}
              >
                SLOT LIST
              </div>

              {/* 20 PRESET SLOTS GRID */}
              <div
                style={{
                  position: 'absolute',
                  top: '445px',
                  left: '55px',
                  width: '990px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  columnGap: '22px',
                  rowGap: '10px',
                }}
              >
                {/* LEFT COLUMN: Slots 05 - 14 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {Array.from({ length: 10 }, (_, i) => {
                    const slotNum = 5 + i
                    const slotStr = String(slotNum).padStart(2, '0')
                    const teamName = slotMap[slotNum]?.team_name || ''

                    return (
                      <div
                        key={slotNum}
                        style={{
                          height: '62px',
                          display: 'flex',
                          alignItems: 'center',
                          background: '#121416',
                          border: '1px solid #4c5054',
                          borderRadius: '8px',
                          padding: '0 6px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: '50px',
                            height: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '22px',
                            fontWeight: 900,
                            fontFamily: "'Inter', Arial, Helvetica, sans-serif",
                            color: '#000000',
                            background: '#ffd000',
                            borderRadius: '6px',
                            flexShrink: 0,
                          }}
                        >
                          {slotStr}
                        </div>
                        <div
                          style={{
                            height: '50px',
                            flex: 1,
                            marginLeft: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: '16px',
                            paddingRight: '12px',
                            borderRadius: '6px',
                            background: '#1a1d20',
                            color: '#ffffff',
                            fontSize: '19px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {teamName}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* RIGHT COLUMN: Slots 15 - 24 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {Array.from({ length: 10 }, (_, i) => {
                    const slotNum = 15 + i
                    const slotStr = String(slotNum).padStart(2, '0')
                    const teamName = slotMap[slotNum]?.team_name || ''

                    return (
                      <div
                        key={slotNum}
                        style={{
                          height: '62px',
                          display: 'flex',
                          alignItems: 'center',
                          background: '#121416',
                          border: '1px solid #4c5054',
                          borderRadius: '8px',
                          padding: '0 6px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: '50px',
                            height: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '22px',
                            fontWeight: 900,
                            fontFamily: "'Inter', Arial, Helvetica, sans-serif",
                            color: '#000000',
                            background: '#ffd000',
                            borderRadius: '6px',
                            flexShrink: 0,
                          }}
                        >
                          {slotStr}
                        </div>
                        <div
                          style={{
                            height: '50px',
                            flex: 1,
                            marginLeft: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: '16px',
                            paddingRight: '12px',
                            borderRadius: '6px',
                            background: '#1a1d20',
                            color: '#ffffff',
                            fontSize: '19px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {teamName}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Reserved 15% Bottom Area for Logos */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  width: '100%',
                  height: '15%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/faceofflogo.png"
                  alt="Faceoff Logo"
                  style={{ maxHeight: '108px', maxWidth: '288px', objectFit: 'contain', opacity: 0.9 }}
                  onError={(e) => {
                    // Fallback to text if image not available
                    (e.target as HTMLElement).style.display = 'none'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ADD FALSE TEAM MODAL */}
      {/* ======================================================== */}
      {showFalseTeamModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#16181a',
              border: '1px solid #3b424a',
              borderRadius: '12px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffd000', margin: 0 }}>
                + Add False / Spot Team
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowFalseTeamModal(false)
                  setExistingTeamPrompt(null)
                  setFalseTeamError('')
                }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {falseTeamError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={15} /> {falseTeamError}
              </div>
            )}

            {existingTeamPrompt ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  A team named <strong>&quot;{existingTeamPrompt.team_name}&quot;</strong> already exists in the system database.
                  Would you like to assign this existing team to this slot?
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setExistingTeamPrompt(null)}
                    style={{
                      background: '#334155',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    No, Enter Different Name
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddFalseTeam(true)}
                    disabled={isAddingFalseTeam}
                    style={{
                      background: '#ffd000',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {isAddingFalseTeam ? 'Adding...' : 'Yes, Add Existing Team'}
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAddFalseTeam(false)
                }}
              >
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                  Team Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Soul, GodLike, Velocity..."
                  value={falseTeamName}
                  onChange={(e) => setFalseTeamName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    background: '#0d0f11',
                    border: '1px solid #3b424a',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    marginBottom: '1rem',
                  }}
                />
                <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '-8px 0 16px 0' }}>
                  The team will automatically be allocated the first free room slot number (starting from 05) and appear in Score Entry.
                </p>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowFalseTeamModal(false)}
                    style={{
                      background: '#334155',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingFalseTeam || !falseTeamName.trim()}
                    style={{
                      background: '#ffd000',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: falseTeamName.trim() && !isAddingFalseTeam ? 'pointer' : 'not-allowed',
                      opacity: falseTeamName.trim() && !isAddingFalseTeam ? 1 : 0.5,
                    }}
                  >
                    {isAddingFalseTeam ? 'Adding Team...' : '+ Add Team to Slot'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
