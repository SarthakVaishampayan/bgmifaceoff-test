'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Sparkles, X, Lock, MessageCircle, Flame, Key, FlaskConical, Ticket, BookOpen, FileText, ShieldAlert, ShieldCheck, Calendar, AlertCircle, Trophy, CreditCard, Compass, Swords, Users, Target } from 'lucide-react'
import { isSlotPastOrEnded, getSlotStartMinutes, getSlotWindowOnly, computeSlotMatchTimes } from '@/lib/utils/slotTime'
import styles from './page.module.css'

interface Slot {
  slot_id: string
  date: string
  time_label: string
  capacity: number
  teams_booked_count: number
  entry_fee: number
  first_prize?: number
  second_prize?: number
  status: 'open' | 'full' | 'completed'
  is_grand_finals: boolean
  whatsapp_link?: string
  m1_time?: string
  m2_time?: string
  m3_time?: string
  close_time?: string
}

interface FreeCoupon {
  coupon_id: string
  code: string
}

interface Props {
  slots: Slot[]
  userTeam: any
  freeCoupon: FreeCoupon | null
  unusedCoupons?: FreeCoupon[]
  userBookedSlotIds?: string[]
  userBookedSlotsMap?: Record<string, number>
  whatsappLink: string
  entryFee: number
  firstPrize?: number
  secondPrize?: number
  thirdPrize?: number
  defaultMatch1Offset?: number
  defaultMatch2Offset?: number
  defaultMatch3Offset?: number
  defaultSlotCloseMinutes?: number
  isLoggedIn: boolean
  isTestAccount?: boolean
}

type FilterTab = 'upcoming' | 'past' | 'all'

interface MatchTimeItem {
  name: string
  time: string
  map: string
}

function getMatchTimes(
  slot: Slot,
  offsets?: { m1?: number; m2?: number; m3?: number }
): MatchTimeItem[] {
  return computeSlotMatchTimes(
    slot.time_label,
    { m1: slot.m1_time, m2: slot.m2_time, m3: slot.m3_time },
    offsets
  )
}

export default function SlotsClient({
  slots,
  userTeam,
  freeCoupon,
  unusedCoupons = [],
  userBookedSlotIds = [],
  userBookedSlotsMap = {},
  whatsappLink,
  entryFee = 50,
  firstPrize = 200,
  secondPrize = 100,
  thirdPrize = 80,
  defaultMatch1Offset = 12,
  defaultMatch2Offset = 52,
  defaultMatch3Offset = 92,
  defaultSlotCloseMinutes = 13,
  isLoggedIn,
  isTestAccount = false,
}: Props) {
  const router = useRouter()
  const effectiveEntryFee = entryFee || 50

  const [slotsList, setSlotsList] = useState<Slot[]>(slots)
  useEffect(() => {
    setSlotsList(slots)
  }, [slots])

  const [bookedSlotsMap, setBookedSlotsMap] = useState<Record<string, number>>(userBookedSlotsMap || {})
  const [bookedSlotIds, setBookedSlotIds] = useState<string[]>(() => {
    return Array.from(new Set([...userBookedSlotIds, ...Object.keys(userBookedSlotsMap || {})]))
  })

  // Sync state when server props update on navigation or re-render
  useEffect(() => {
    if (userBookedSlotsMap) {
      setBookedSlotsMap(prev => ({ ...prev, ...userBookedSlotsMap }))
    }
  }, [userBookedSlotsMap])

  useEffect(() => {
    setBookedSlotIds(prev => Array.from(new Set([...prev, ...(userBookedSlotIds || []), ...Object.keys(userBookedSlotsMap || {})])))
  }, [userBookedSlotIds, userBookedSlotsMap])
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null)
  const [confirmFreeSlot, setConfirmFreeSlot] = useState<Slot | null>(null)
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false)
  const [showPrizeModal, setShowPrizeModal] = useState<boolean>(false)

  const [remainingCoupons, setRemainingCoupons] = useState<FreeCoupon[]>(() => {
    if (unusedCoupons && unusedCoupons.length > 0) return unusedCoupons
    if (freeCoupon) return [freeCoupon]
    return []
  })
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>('upcoming')

  const [mounted, setMounted] = useState<boolean>(false)
  const [tick, setTick] = useState<number>(0)
  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => {
      setTick(t => t + 1)
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const [testModeEnabled, setTestModeEnabled] = useState<boolean>(true)

  async function toggleTestMode() {
    const nextState = !testModeEnabled
    setTestModeEnabled(nextState)
    try {
      await fetch('/api/user/toggle-test-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      })
    } catch (e) {}
  }

  // Filter slots based on date/time expiration (auto-closes based on custom cutoff or default minutes)
  const filteredSlots = useMemo(() => {
    const list = slotsList.filter(slot => {
      if (!mounted) return true
      const isPast = isSlotPastOrEnded(slot.date, slot.time_label, slot.status, slot.close_time, defaultSlotCloseMinutes)
      if (filterTab === 'upcoming') return !isPast
      if (filterTab === 'past') return isPast
      return true
    })

    return [...list].sort((a, b) => {
      const aDate = String(a.date || '').split('T')[0]
      const bDate = String(b.date || '').split('T')[0]
      const dateComp = aDate.localeCompare(bDate)
      if (dateComp !== 0) return dateComp

      const aMins = getSlotStartMinutes(a.time_label)
      const bMins = getSlotStartMinutes(b.time_label)
      return aMins - bMins
    })
  }, [slotsList, filterTab, mounted, tick])

  // Group filtered slots by date, ensuring morning to night ordering within each date
  const slotsByDate = useMemo(() => {
    const groups: Record<string, Slot[]> = {}
    filteredSlots.forEach(slot => {
      if (!groups[slot.date]) groups[slot.date] = []
      groups[slot.date].push(slot)
    })
    Object.keys(groups).forEach(date => {
      groups[date].sort((a, b) => {
        const aMins = getSlotStartMinutes(a.time_label)
        const bMins = getSlotStartMinutes(b.time_label)
        return aMins - bMins
      })
    })
    return groups
  }, [filteredSlots])

// Helper to load Razorpay Checkout JS script dynamically
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

  // Handle Free Slot button click -> opens confirm dialog
  function handleFreeButtonClick(slot: Slot) {
    if (!isLoggedIn) {
      router.push(`/login?redirectTo=/slots`)
      return
    }
    setConfirmFreeSlot(slot)
  }

  // ── DIRECT SLOT BOOKING (PAID OR FREE) ──
  async function handleDirectBookSlot(slot: Slot, isFree: boolean = false) {
    if (!isLoggedIn) {
      router.push(`/login?redirectTo=/slots`)
      return
    }

    if (!userTeam?.team_name) {
      alert('Please set up your official team name in Profile before registering for slots.')
      router.push('/profile')
      return
    }

    setBookingSlotId(slot.slot_id)
    window.dispatchEvent(new CustomEvent('app:showLoader', {
      detail: { message: isFree ? 'Redeeming Free Slot Reward...' : 'Preparing Secure Registration...' }
    }))

    let allocatedRoomSlot = 5

    try {
      if (isFree && remainingCoupons.length > 0) {
        const couponToUse = remainingCoupons[0]
        // Redeem free slot reward
        const res = await fetch('/api/coupon/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coupon_id: couponToUse.coupon_id,
            slot_id: slot.slot_id,
            team_name: userTeam.team_name,
          }),
        })
        const data = await res.json()

        if (!res.ok || !data.success) {
          window.dispatchEvent(new Event('app:hideLoader'))
          alert(data.error || 'Failed to claim free slot.')
          setBookingSlotId(null)
          return
        }

        allocatedRoomSlot = data.room_slot_number || 5
        setRemainingCoupons(prev => prev.slice(1))
      } else {
        // Create booking record first
        const createRes = await fetch('/api/booking/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot_id: slot.slot_id,
            team_name: userTeam.team_name,
            test_mode: isTestAccount && testModeEnabled,
          }),
        })
        let createData: any = {}
        try {
          createData = await createRes.json()
        } catch (e) {
          createData = { error: 'Server returned invalid response.' }
        }

        if (!createRes.ok || !createData.booking_id) {
          window.dispatchEvent(new Event('app:hideLoader'))
          if (createRes.status === 401) {
            alert('Your session has expired. Please sign in again to book a slot.')
            router.push('/login?redirect=/slots')
            setBookingSlotId(null)
            return
          }
          alert(createData.error || 'Failed to book slot.')
          setBookingSlotId(null)
          return
        }

        // Direct Instant Booking Confirmation (Bypasses Razorpay for testing)
        if (createData.auto_confirmed || createData.is_test_booking) {
          allocatedRoomSlot = createData.room_slot_number || 5
          window.dispatchEvent(new Event('app:hideLoader'))
          setBookedSlotIds(prev => Array.from(new Set([...prev, slot.slot_id])))
          setBookedSlotsMap(prev => ({ ...prev, [slot.slot_id]: allocatedRoomSlot }))
          setSlotsList(prev => prev.map(s => {
            if (s.slot_id === slot.slot_id) {
              const newCount = (s.teams_booked_count || 0) + 1
              const isFull = newCount >= s.capacity
              return { ...s, teams_booked_count: newCount, status: isFull ? 'full' : s.status }
            }
            return s
          }))
          setSuccessToast(`✅ Slot for ${getSlotWindowOnly(slot.time_label)} registered! You are alloted Room Slot #${allocatedRoomSlot}.`)
          setBookingSlotId(null)
          return
        }

        // Try Razorpay order creation
        let rzpOpened = false
        try {
          const orderRes = await fetch('/api/payment/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId: createData.booking_id,
              amount: (slot.entry_fee !== undefined && slot.entry_fee !== null) ? slot.entry_fee : effectiveEntryFee,
            }),
          })

          if (orderRes.ok) {
            const orderData = await orderRes.json()
            const loaded = await loadRazorpayScript()

            if (loaded && (window as any).Razorpay && orderData.keyId) {
              const rzp = new (window as any).Razorpay({
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'Battlegrounds Faceoff Series',
                description: `Slot Registration: ${getSlotWindowOnly(slot.time_label)}`,
                order_id: orderData.orderId,
                handler: async function (response: any) {
                  // Show loader during server signature verification & slot allocation
                  window.dispatchEvent(new CustomEvent('app:showLoader', {
                    detail: { message: 'Verifying Payment & Allocating Room Slot...' }
                  }))
                  try {
                    const verifyRes = await fetch('/api/payment/verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        bookingId: createData.booking_id,
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpayOrderId: response.razorpay_order_id,
                        razorpaySignature: response.razorpay_signature,
                      }),
                    })
                    const verifyData = await verifyRes.json()
                    window.dispatchEvent(new Event('app:hideLoader'))
                    if (verifyRes.ok && verifyData.success) {
                      const rSlot = verifyData.room_slot_number || 5
                      setBookedSlotIds(prev => Array.from(new Set([...prev, slot.slot_id])))
                      setBookedSlotsMap(prev => ({ ...prev, [slot.slot_id]: rSlot }))
                      setSuccessToast(`Slot for ${getSlotWindowOnly(slot.time_label)} booked! You are alloted Room Slot #${rSlot}. Join WhatsApp group below.`)
                    } else {
                      alert(verifyData.error || 'Payment verification failed. Please contact support.')
                    }
                  } catch (err: any) {
                    window.dispatchEvent(new Event('app:hideLoader'))
                    alert('Payment verification connection error. Please contact support.')
                  }
                  setBookingSlotId(null)
                },
                modal: {
                  ondismiss: function () {
                    window.dispatchEvent(new Event('app:hideLoader'))
                    setBookingSlotId(null)
                    if (createData?.booking_id) {
                      fetch('/api/booking/cancel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ booking_id: createData.booking_id }),
                      }).catch(() => {})
                    }
                  },
                },
                prefill: {},
                theme: { color: '#fbbf24' },
              })
              // Hide page loader just before opening checkout modal
              window.dispatchEvent(new Event('app:hideLoader'))
              rzp.open()
              rzpOpened = true
              return
            }
          }
        } catch {
          rzpOpened = false
        }

        // Fallback confirmation only if test mode is active
        if (!rzpOpened) {
          if (createData.is_test_booking || (isTestAccount && testModeEnabled)) {
            const confirmRes = await fetch('/api/booking/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                booking_id: createData.booking_id,
                razorpay_payment_id: `pay_sim_${Date.now()}`,
                razorpay_order_id: `order_sim_${Date.now()}`,
                razorpay_signature: 'simulated_signature',
              }),
            })
            const confirmData = await confirmRes.json()

            if (!confirmRes.ok) {
              window.dispatchEvent(new Event('app:hideLoader'))
              alert(confirmData.error || 'Registration confirmation failed.')
              setBookingSlotId(null)
              return
            }

            allocatedRoomSlot = confirmData.room_slot_number || 5
          } else {
            // Cancel pending booking if payment failed to open
            if (createData?.booking_id) {
              fetch('/api/booking/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booking_id: createData.booking_id }),
              }).catch(() => {})
            }
            window.dispatchEvent(new Event('app:hideLoader'))
            alert('Unable to launch Razorpay payment. Please disable pop-up blockers, check your internet connection, or try again.')
            setBookingSlotId(null)
            return
          }
        }
      }

      // Success for Free Coupon or Authorized Test Mode
      window.dispatchEvent(new Event('app:hideLoader'))
      setBookedSlotIds(prev => Array.from(new Set([...prev, slot.slot_id])))
      setBookedSlotsMap(prev => ({ ...prev, [slot.slot_id]: allocatedRoomSlot }))
      setSuccessToast(`Slot for ${getSlotWindowOnly(slot.time_label)} registered! You are alloted Room Slot #${allocatedRoomSlot}. Join WhatsApp group below.`)
      setBookingSlotId(null)

      setTimeout(() => setSuccessToast(null), 5000)
    } catch (err: any) {
      window.dispatchEvent(new Event('app:hideLoader'))
      console.error('Booking error:', err)
      const errMsg = err?.message?.includes('Load failed') || err?.message?.includes('Failed to fetch')
        ? 'Connection lost or session expired. Please refresh the page and try again.'
        : (err?.message || 'Connection error during booking.')
      alert(errMsg)
      setBookingSlotId(null)
    }
  }

  // Deterministic date formatters
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  function fmtDateHeader(dStr: string) {
    const d = new Date(dStr + 'T00:00:00')
    if (isNaN(d.getTime())) return dStr
    const fullDate = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`

    if (dStr === '2026-10-10' || dStr === '2026-10-11') {
      return 'Semi Finals (10–11 Oct 2026)'
    }
    if (dStr > '2026-10-11') {
      return `Finals Stage (${fullDate})`
    }

    // Qualifiers started on Monday, 21 Sep 2026 (Day 1)
    const startDate = new Date('2026-09-21T00:00:00')
    const diffDays = Math.round((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays >= 0) {
      const dayNum = diffDays + 1
      return `Qualifier Day ${dayNum} (${fullDate})`
    }
    return fullDate
  }

  // ─────────────────────────────────────────────
  // RENDER — MAIN GRID UI
  // ─────────────────────────────────────────────
  return (
    <main className={styles.page}>
      <div className="container">
        {/* Banner for Admin Test Mode */}
        {isTestAccount && (
          <div style={{
            background: '#151515',
            border: '1px solid #262626',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FlaskConical size={16} style={{ color: testModeEnabled ? '#fbbf24' : '#666666', flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#ffffff', fontSize: '0.9rem', display: 'block' }}>
                  ADMIN TEST MODE
                </strong>
                <span style={{ color: '#888888', fontSize: '0.8rem' }}>
                  {testModeEnabled ? 'Auto-confirms for ₹0 without Razorpay' : 'Standard user payment flow'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTestMode}
              style={{
                background: testModeEnabled ? '#fbbf24' : '#262626',
                color: testModeEnabled ? '#111111' : '#aaaaaa',
                border: testModeEnabled ? 'none' : '1px solid #333333',
                borderRadius: '20px',
                padding: '5px 14px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all 0.18s ease',
              }}
            >
              TEST MODE: {testModeEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        {/* Banner if team has earned a free slot */}
        {remainingCoupons.length > 0 && (
          <div className={styles.freeRewardBanner}>
            <div className={styles.freeRewardBannerLeft}>
              <Sparkles size={20} className={styles.sparkleIcon} />
              <div>
                <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>FREE SLOT REWARD UNLOCKED!</strong>
                <span className={styles.bannerSubtext}>
                  You earned free slot reward pass(es) from placing 4th in slot matches. Select any open slot below to claim for ₹0!
                </span>
              </div>
            </div>
            <span className={styles.freeRewardTag}>{remainingCoupons.length} FREE REWARD{remainingCoupons.length > 1 ? 'S' : ''}</span>
          </div>
        )}

        {/* Success Toast */}
        {successToast && (
          <div className={styles.successToast}>
            <Check size={18} color="#22c55e" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Page header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>SEMI FINALS REGISTRATION</h1>
            <p className={styles.subtitle}>
              Semi Finals: 10–11 Oct 2026 • Grand Finals: 17–18 Oct 2026 • Top 6 squads qualify.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={styles.rulesBtnHeader}
              onClick={() => setShowRulesModal(true)}
            >
              <BookOpen size={16} color="#fbbf24" />
              <span>TOURNAMENT RULES</span>
            </button>
            {!isLoggedIn && (
              <Link href="/login?redirectTo=/slots" className="btn btn-primary" style={{ background: '#fbbf24', color: '#111' }}>
                SIGN IN TO REGISTER →
              </Link>
            )}
          </div>
        </div>

        {/* Empty state */}
        {Object.keys(slotsByDate).length === 0 && (
          <div className={styles.emptyState}>
            No upcoming tournament slots available right now. Check back soon!
          </div>
        )}

        {/* Date groups with Square Card Grid (Earliest/upcoming dates first) */}
        {Object.keys(slotsByDate).sort((a, b) => a.localeCompare(b)).map(date => {
          const dateSlots = slotsByDate[date]
          return (
            <div key={date} className={styles.daySection}>
            <h2 className={styles.dayHeader}>
              <Calendar size={18} color="#94a3b8" />
              <span>{fmtDateHeader(date)}</span>
            </h2>

            <div className={styles.slotGrid}>
              {dateSlots.map(slot => {
                const isSemiFinals = (slot.time_label && slot.time_label.toLowerCase().includes('semi finals')) || slot.date === '2026-10-10' || (slot.capacity || 0) >= 999
                const isAlreadyBooked = bookedSlotIds.some(id => String(id).trim().toLowerCase() === String(slot.slot_id).trim().toLowerCase())
                const isBookingThis = bookingSlotId === slot.slot_id
                const spotsLeft = Math.max(0, slot.capacity - slot.teams_booked_count)

                // Strict expiration check
                const isEnded = isSlotPastOrEnded(slot.date, slot.time_label, slot.status, slot.close_time, defaultSlotCloseMinutes)
                const isCompleted = isEnded || slot.status === 'completed'
                const isFull = !isCompleted && !isSemiFinals && (spotsLeft <= 0 || slot.status === 'full')
                const isUrgent = !isFull && !isCompleted && !isAlreadyBooked && !isSemiFinals && spotsLeft < 5

                const showFreeOption = Boolean(remainingCoupons.length > 0 && !isFull && !isCompleted && !isAlreadyBooked)
                const currentFee = (slot.entry_fee !== undefined && slot.entry_fee !== null) ? slot.entry_fee : effectiveEntryFee

                if (isAlreadyBooked) {
                  const matchTimes = getMatchTimes(slot, { m1: defaultMatch1Offset, m2: defaultMatch2Offset, m3: defaultMatch3Offset })
                  const roomSlotNum = bookedSlotsMap[slot.slot_id] ?? Object.entries(bookedSlotsMap).find(([k]) => k.toLowerCase() === slot.slot_id.toLowerCase())?.[1] ?? 5

                  return (
                    <div key={slot.slot_id} className={styles.slotCardBooked}>
                      <div className={styles.cardTopRow}>
                        <span className={styles.bookedBadge}>
                          <Check size={10} /> {isSemiFinals ? 'SEMI FINALS REGISTERED' : 'REGISTERED'}
                        </span>
                      </div>

                      <div className={styles.bookedCenter}>
                        <div className={styles.bookedTime}>
                          {isSemiFinals ? 'SEMI FINALS • 10–11 OCT 2026' : getSlotWindowOnly(slot.time_label)}
                        </div>
                        {isSemiFinals && (
                          <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, marginTop: '2px', textAlign: 'center' }}>
                            Grand Finals Date: 17–18 OCT 2026 (Top 6 Advance)
                          </div>
                        )}

                        {isSemiFinals ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', margin: '0.65rem 0' }}>
                            <div style={{ background: '#18181c', border: '1px solid #272730', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fbbf24' }}>2 MATCHES</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc' }}>ERANGEL</div>
                            </div>
                            <div style={{ background: '#18181c', border: '1px solid #272730', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fbbf24' }}>2 MATCHES</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc' }}>MIRAMAR</div>
                            </div>
                            <div style={{ background: '#18181c', border: '1px solid #272730', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fbbf24' }}>2 MATCHES</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc' }}>RONDO</div>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.matchCellsGrid}>
                            {matchTimes.map((m, idx) => (
                              <div key={idx} className={styles.matchCellBooked}>
                                <div className={styles.matchCellLabelBooked}>
                                  MATCH {idx + 1}
                                </div>
                                <div className={styles.matchCellTime}>
                                  {m.time}
                                </div>
                                <div className={styles.matchCellMap}>
                                  {m.map}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div
                          className={styles.whatsappReasonBanner}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '2px',
                            width: '100%',
                            margin: '0.2rem 0 0.3rem 0',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              color: '#ffffff',
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              width: '100%',
                            }}
                          >
                            <Key size={11} color="#fbbf24" style={{ flexShrink: 0 }} />
                            <span>Room ID &amp; Password on WhatsApp</span>
                          </div>
                          <div
                            style={{
                              color: '#9ca3af',
                              fontSize: '0.55rem',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              lineHeight: 1,
                            }}
                          >
                            Posted before tournament match start
                          </div>
                        </div>
                      </div>

                      {/* Single bottom row divided into 2 buttons: Left = Join WhatsApp, Right = Slot # info */}
                      <div className={styles.bookedActionRow}>
                        <a
                          href={slot.whatsapp_link || whatsappLink || 'https://chat.whatsapp.com'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.bookedWhatsappBtn}
                        >
                          <MessageCircle size={13} />
                          <span>Join WhatsApp</span>
                        </a>

                        <div className={styles.bookedSlotBtn}>
                          <span className={styles.bookedSlotDot}>●</span>
                          <span>Room Slot: #{roomSlotNum}</span>
                        </div>
                      </div>
                    </div>
                  )
                }

                const matchTimes = getMatchTimes(slot, { m1: defaultMatch1Offset, m2: defaultMatch2Offset, m3: defaultMatch3Offset })

                return (
                  <div
                    key={slot.slot_id}
                    className={`
                      ${styles.slotCard}
                      ${isFull || isCompleted ? styles.slotCardFull : ''}
                      ${showFreeOption ? styles.slotCardFree : ''}
                    `}
                  >
                    {/* Diagonal Corner Ribbon stating OFFER */}
                    {currentFee === 1 && !isCompleted && !showFreeOption && !isSemiFinals && (
                      <div className={styles.cornerRibbonWrapper}>
                        <div className={styles.cornerRibbonOffer}>OFFER</div>
                      </div>
                    )}

                    {/* Top Row: Spots Left Pill (Top-Left) & FREE Ribbon (Top-Right) */}
                    <div className={styles.cardTopRow}>
                      {!isSemiFinals ? (
                        <span
                          className={`
                            ${styles.spotsBadge}
                            ${isFull || isCompleted ? styles.spotsFull : ''}
                            ${isUrgent ? styles.spotsUrgent : ''}
                          `}
                        >
                          {isCompleted ? (
                            'CLOSED'
                          ) : isFull ? (
                            'SLOTS FULL (0 LEFT)'
                          ) : isUrgent ? (
                            <><Flame size={11} className={styles.flameIcon} /> {spotsLeft} SPOTS LEFT</>
                          ) : (
                            `${spotsLeft}/${slot.capacity} SPOTS LEFT`
                          )}
                        </span>
                      ) : isCompleted ? (
                        <span
                          className={`${styles.spotsBadge} ${styles.spotsFull}`}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', fontWeight: 800 }}
                        >
                          REGISTRATION CLOSED
                        </span>
                      ) : null}

                      {showFreeOption && (
                        <span className={styles.freeRibbon} style={{ marginLeft: 'auto' }}>
                          <Sparkles size={10} /> FREE
                        </span>
                      )}
                    </div>

                    {/* Time Label (Large) */}
                    <div className={styles.cardTime}>
                      {isSemiFinals ? (
                        <div>
                          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.02em' }}>
                            10–11 OCT 2026
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginTop: '3px' }}>
                            Grand Finals: <span style={{ color: '#fbbf24', fontWeight: 800 }}>17–18 OCT 2026</span>
                          </div>
                        </div>
                      ) : (
                        getSlotWindowOnly(slot.time_label)
                      )}
                    </div>

                    {slot.is_grand_finals && (
                      <div className={styles.cardGFBadge}>
                        <Trophy size={12} color="#fbbf24" />
                        <span>Grand Finals</span>
                      </div>
                    )}

                    {/* Price Line */}
                    <div className={styles.cardPriceRow}>
                      {isCompleted ? (
                        <div className={styles.priceMeta}>REGISTRATION CLOSED</div>
                      ) : isSemiFinals ? (
                        <div className={styles.normalPriceTag} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1.05rem' }}>₹{currentFee}</span>
                          <span className={styles.priceMeta}>Squad Entry Fee</span>
                        </div>
                      ) : showFreeOption ? (
                        <div className={styles.rewardAvailableText}>
                          <Check size={13} color="#22c55e" /> Reward available
                        </div>
                      ) : (
                        <div className={styles.normalPriceTag} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {currentFee === 1 ? (
                            <>
                              <span style={{ textDecoration: 'line-through', color: '#71717a', fontSize: '0.92em', fontWeight: 600 }}>₹{slot.entry_fee && slot.entry_fee !== 1 ? slot.entry_fee : (effectiveEntryFee !== 1 ? effectiveEntryFee : 50)}</span>
                              <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1.05em' }}>₹1</span>
                              <span className={styles.priceMeta}>/ 3 Matches</span>
                            </>
                          ) : (
                            <>₹{currentFee} <span className={styles.priceMeta}>/ 3 Matches</span></>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3-cell match timings grid OR 3-map rotation showcase for Semi Finals */}
                    {isSemiFinals ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', margin: '0.65rem 0' }}>
                        <div style={{ background: '#18181c', border: '1px solid #272730', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fbbf24' }}>2 MATCHES</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc' }}>ERANGEL</div>
                        </div>
                        <div style={{ background: '#18181c', border: '1px solid #272730', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fbbf24' }}>2 MATCHES</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc' }}>MIRAMAR</div>
                        </div>
                        <div style={{ background: '#18181c', border: '1px solid #272730', borderRadius: '8px', padding: '0.45rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fbbf24' }}>2 MATCHES</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc' }}>RONDO</div>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.matchCellsGrid}>
                        {matchTimes.map((m, idx) => (
                          <div key={idx} className={styles.matchCellOpen}>
                            <div className={styles.matchCellLabelOpen}>
                              MATCH {idx + 1}
                            </div>
                            <div className={styles.matchCellTime}>
                              {m.time}
                            </div>
                            <div className={styles.matchCellMap}>
                              {m.map}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bottom Action Button (Pinned) */}
                    <div className={styles.cardBottomAction}>
                      {isCompleted ? (
                        <button disabled className={styles.cardBtnDisabled}>
                          REGISTRATION CLOSED
                        </button>
                      ) : isFull ? (
                        <button disabled className={styles.cardBtnDisabled}>
                          <Lock size={13} /> Full
                        </button>
                      ) : showFreeOption ? (
                        <button
                          className={styles.cardBtnFreeOutline}
                          onClick={() => handleFreeButtonClick(slot)}
                          disabled={isBookingThis}
                        >
                          {isBookingThis ? (
                            <><span className="spinner" /> REGISTERING...</>
                          ) : (
                            <><Sparkles size={13} /> Register Free</>
                          )}
                        </button>
                      ) : isSemiFinals ? (
                        <button
                          className={styles.semiFinalsRegisterBtn}
                          onClick={() => handleDirectBookSlot(slot, false)}
                          disabled={isBookingThis}
                        >
                          {isBookingThis ? (
                            <span className={styles.semiBtnLoading}>
                              <span className="spinner" /> REGISTERING...
                            </span>
                          ) : (
                            <>
                              <span className={styles.semiBtnTitle}>REGISTER SQUAD • ₹{currentFee}</span>
                              <span className={styles.semiBtnTiming}>Match Timings: ~7:00 PM – 11:00 PM</span>
                              <span className={styles.semiBtnQualify}>Top 6 Qualify for Finals (17–18 Oct)</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          className={styles.cardBtnNormal}
                          onClick={() => handleDirectBookSlot(slot, false)}
                          disabled={isBookingThis}
                        >
                          {isBookingThis ? (
                            <><span className="spinner" /> REGISTERING...</>
                          ) : isTestAccount && testModeEnabled ? (
                            <><FlaskConical size={13} /> Register (Test Mode)</>
                          ) : currentFee === 1 ? (
                            <span>
                              Register • <span style={{ textDecoration: 'line-through', opacity: 0.65, fontSize: '0.88em', marginRight: '2px' }}>₹{effectiveEntryFee !== 1 ? effectiveEntryFee : 50}</span> ₹1
                            </span>
                          ) : (
                            'Register'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )})}

        {/* ── HIGHLIGHTER SEPARATOR LINE (PROMINENT ON MOBILE) ── */}
        <div className={styles.slotHighlightSeparator} />

        {/* ── ON-PAGE FORMAT & ROADMAP SECTION (DIRECTLY UNDER SLOTS) ── */}
        <section className={styles.onPageRoadmapSection}>
          {/* ── SEMI FINALS FORMAT & GROUP STAGE DETAILS ── */}
          <div className={styles.roadmapSectionBlock}>
            <div className={styles.sectionTitleRow}>
              <h3 className={styles.sectionHeading}>
                Semi Finals Format &amp; Group Stage Structure
              </h3>
              <span className={styles.sectionTagNeutral}>10 – 11 OCT 2026</span>
            </div>

            <div className={styles.formatOverviewBox}>
              <div className={styles.formatItem}>
                <div className={styles.formatIconWrap}>
                  <Users size={16} color="#94a3b8" />
                </div>
                <div className={styles.formatInfo}>
                  <h4>Dynamic Group Seeding</h4>
                  <p>Groups are formed based on the total number of squads registered for Semi Finals.</p>
                </div>
              </div>

              <div className={styles.formatItem}>
                <div className={styles.formatIconWrap}>
                  <Swords size={16} color="#94a3b8" />
                </div>
                <div className={styles.formatInfo}>
                  <h4>Round Robin Battles</h4>
                  <p>Groups clash against each other in a structured round-robin schedule across both days.</p>
                </div>
              </div>

              <div className={styles.formatItem}>
                <div className={styles.formatIconWrap}>
                  <Target size={16} color="#94a3b8" />
                </div>
                <div className={styles.formatInfo}>
                  <h4>6 Matches Per Squad</h4>
                  <p>Every squad plays 6 total matches (2 Erangel, 2 Miramar, 2 Rondo) for Top 6 qualification.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── OFFICIAL 3-MAP ROTATION SHOWCASE ── */}
          <div className={styles.roadmapSectionBlock}>
            <div className={styles.sectionTitleRow}>
              <h3 className={styles.sectionHeading}>
                Official Map Rotation • 6 Matches Guaranteed
              </h3>
              <span className={styles.sectionTagNeutral}>2 ERANGEL • 2 MIRAMAR • 2 RONDO</span>
            </div>

            <div className={styles.mapShowcaseGrid}>
              {/* Map 1: Erangel */}
              <div className={styles.mapCard}>
                <div className={styles.mapImageWrapper}>
                  <img
                    src="/images/maps/erangel.png"
                    alt="Erangel Map"
                    className={styles.mapImage}
                  />
                  <span className={styles.mapMatchesBadge}>2 MATCHES</span>
                </div>
                <div className={styles.mapCardBody}>
                  <div className={styles.mapHeaderRow}>
                    <h4 className={styles.mapName}>ERANGEL</h4>
                    <span className={styles.mapDim}>8x8 KM</span>
                  </div>
                  <p className={styles.mapDesc}>
                    Classic tactical combat. Iconic compound holds, bridge defenses, and intense Pochinki &amp; Rozhok rotations.
                  </p>
                </div>
              </div>

              {/* Map 2: Miramar */}
              <div className={styles.mapCard}>
                <div className={styles.mapImageWrapper}>
                  <img
                    src="/images/maps/miramar.png"
                    alt="Miramar Map"
                    className={styles.mapImage}
                  />
                  <span className={styles.mapMatchesBadge}>2 MATCHES</span>
                </div>
                <div className={styles.mapCardBody}>
                  <div className={styles.mapHeaderRow}>
                    <h4 className={styles.mapName}>MIRAMAR</h4>
                    <span className={styles.mapDim}>8x8 KM</span>
                  </div>
                  <p className={styles.mapDesc}>
                    Rugged desert terrain. High-ground ridge supremacy, long-range sniper duels, and open-terrain vehicle rotations.
                  </p>
                </div>
              </div>

              {/* Map 3: Rondo */}
              <div className={styles.mapCard}>
                <div className={styles.mapImageWrapper}>
                  <img
                    src="/images/maps/rondo.png"
                    alt="Rondo Map"
                    className={styles.mapImage}
                  />
                  <span className={styles.mapMatchesBadge}>2 MATCHES</span>
                </div>
                <div className={styles.mapCardBody}>
                  <div className={styles.mapHeaderRow}>
                    <h4 className={styles.mapName}>RONDO</h4>
                    <span className={styles.mapDim}>8x8 KM</span>
                  </div>
                  <p className={styles.mapDesc}>
                    Dynamic modern warfare. Jadena City urban heights, escalators, bamboo forests, and high-intensity close combat.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── GRAND FINALS 16-TEAM ROSTER EQUATION ── */}
          <div className={styles.finalsFormulaBar}>
            <div className={styles.formulaInputsRow}>
              <div className={styles.formulaItem}>
                <span className={styles.formulaVal}>8 TEAMS</span>
                <span className={styles.formulaLabel}>League Top 8</span>
              </div>
              <span className={styles.formulaOperator}>+</span>
              <div className={styles.formulaItem}>
                <span className={styles.formulaVal}>6 TEAMS</span>
                <span className={styles.formulaLabel}>Semi Finals Top 6</span>
              </div>
              <span className={styles.formulaOperator}>+</span>
              <div className={styles.formulaItem}>
                <span className={styles.formulaVal}>2 TEAMS</span>
                <span className={styles.formulaLabel}>Wildcard Entries</span>
              </div>
            </div>
            <span className={styles.formulaEquals}>=</span>
            <div className={styles.formulaResultBox}>
              <span className={styles.formulaResultVal}>16 GRAND FINALISTS</span>
              <span className={styles.formulaResultLabel}>Grand Finals • 17–18 OCT 2026</span>
            </div>
          </div>

          {/* ── SEMI FINALS HERO HEADER ── */}
          <div className={styles.onPageRoadmapHero}>
            <div className={styles.onPageRoadmapHeaderContent}>
              <h2 className={styles.onPageRoadmapTitle}>ONE LAST CHANCE TO QUALIFY FOR GRAND FINALS</h2>
              <p className={styles.onPageRoadmapDesc}>
                Dynamic Round Robin Groups • 6 Matches (2 Erangel, 2 Miramar, 2 Rondo) • Top 6 teams qualify for the Grand Finals on 17–18 Oct 2026. Open for all squads to register!
              </p>
            </div>
          </div>

          {/* ── STAGE PROGRESSION PIPELINE ── */}
          <div className={styles.roadmapSectionBlock}>
            <div className={styles.sectionTitleRow}>
              <h3 className={styles.sectionHeading}>
                Tournament Roadmap &amp; Qualification Path
              </h3>
              <span className={styles.sectionTagNeutral}>16 GRAND FINALISTS TOTAL</span>
            </div>

            <div className={styles.roadmapGrid}>
              {/* Step 1 */}
              <div className={styles.roadmapCardFinals}>
                <div className={styles.roadmapCardTop}>
                  <span className={styles.stepNum}>STEP 01</span>
                  <span className={styles.badgeGold}>DIRECT TO FINALS</span>
                </div>
                <h4 className={styles.roadmapCardTitle}>Top 8 Direct Finalists</h4>
                <p className={styles.roadmapCardText}>
                  Top 8 teams from official league standings qualify directly for Grand Finals (17–18 Oct 2026).
                </p>
                <div className={styles.stepFootNoteGold}>8 Teams Guaranteed</div>
              </div>

              {/* Step 2 */}
              <div className={styles.roadmapCard}>
                <div className={styles.roadmapCardTop}>
                  <span className={styles.stepNum}>STEP 02</span>
                  <span className={styles.badgeNeutral}>SEEDED IN SEMIS</span>
                </div>
                <h4 className={styles.roadmapCardTitle}>Teams 9–16 Seeded</h4>
                <p className={styles.roadmapCardText}>
                  Teams finishing #9 to #16 in the league stage receive seeded semi-finals entry.
                </p>
                <div className={styles.stepFootNote}>8 Seeded Squads</div>
              </div>

              {/* Step 3 */}
              <div className={styles.roadmapCard}>
                <div className={styles.roadmapCardTop}>
                  <span className={styles.stepNum}>STEP 03</span>
                  <span className={styles.badgeNeutral}>OPEN ENTRY</span>
                </div>
                <h4 className={styles.roadmapCardTitle}>Open Challenger Entry</h4>
                <p className={styles.roadmapCardText}>
                  Any squad can book a Semi Finals slot and fight for a Grand Finals ticket.
                </p>
                <div className={styles.stepFootNote}>Open For All Squads</div>
              </div>

              {/* Step 4 */}
              <div className={styles.roadmapCardFinals}>
                <div className={styles.roadmapCardTop}>
                  <span className={styles.stepNum}>STEP 04</span>
                  <span className={styles.badgeGold}>TOP 6 ADVANCE</span>
                </div>
                <h4 className={styles.roadmapCardTitle}>Top 6 Advance to Finals</h4>
                <p className={styles.roadmapCardText}>
                  The Top 6 teams from the Semi Finals group stage advance to the Grand Finals (17–18 Oct 2026).
                </p>
                <div className={styles.stepFootNoteGold}>Top 6 Reach Finals</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── CONFIRM DIALOG FOR FREE SLOT ── */}
      {confirmFreeSlot && (
        <div className={styles.modalOverlay} onClick={() => setConfirmFreeSlot(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.modalCloseBtn} onClick={() => setConfirmFreeSlot(null)}>
              <X size={20} />
            </button>

            <div className={styles.modalIconWrapGold}>
              <Sparkles size={28} color="#fbbf24" />
            </div>

            <h2 className={styles.modalTitle}>Redeem Free Slot Pass?</h2>
            <p className={styles.modalBody}>
              You are using 1 of your Free Slot Pass Rewards for:
            </p>

            <div className={styles.modalSlotPreview}>
              <div className={styles.previewTime}>
                {confirmFreeSlot.time_label && confirmFreeSlot.time_label.toLowerCase().includes('semi')
                  ? 'Semi Finals • 10–11 OCT 2026'
                  : getSlotWindowOnly(confirmFreeSlot.time_label)}
              </div>
              <div className={styles.previewDate}>{fmtDateHeader(confirmFreeSlot.date)}</div>
              <div className={styles.previewFee}>
                Entry Fee: <span style={{ textDecoration: 'line-through' }}>₹{(confirmFreeSlot.entry_fee !== undefined && confirmFreeSlot.entry_fee !== null) ? confirmFreeSlot.entry_fee : effectiveEntryFee}</span>{' '}
                <strong style={{ color: '#22c55e' }}>₹0 FREE (Reward Applied)</strong>
              </div>
            </div>

            <p className={styles.modalWarningText}>
              Confirming will redeem 1 free slot reward and immediately register your team into this slot without payment.
            </p>

            <div className={styles.modalActionColumn}>
              <button
                className={styles.confirmFreeBtn}
                onClick={() => {
                  const slotToBook = confirmFreeSlot
                  setConfirmFreeSlot(null)
                  handleDirectBookSlot(slotToBook, true)
                }}
              >
                CONFIRM FREE REGISTRATION
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmFreeSlot(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── PRIZE POOL OVERLAY MODAL ── */}
      {showPrizeModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPrizeModal(false)}>
          <div className={styles.prizeModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.rulesModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={20} color="#f59e0b" />
                <h2 className={styles.rulesModalTitle}>Slot Prize Pool &amp; Rewards</h2>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setShowPrizeModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Top Prize Pool Banner */}
            <div style={{
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.16) 0%, rgba(234, 179, 8, 0.08) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '10px',
              padding: '10px 16px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.04em' }}>
                Slot Prize Pool = ₹1000
              </span>
              <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600 }}>
                ₹{entryFee || 50} entry · 3 matches · top 4 rewarded
              </span>
            </div>

            {/* Prize rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🥇</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#e5e5e5', fontSize: '0.9rem' }}>1st Place</div>
                    <div style={{ fontSize: '0.72rem', color: '#71717a' }}>Instant UPI transfer after verification</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fbbf24' }}>
                  ₹{firstPrize || 200}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🥈</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#e5e5e5', fontSize: '0.9rem' }}>2nd Place</div>
                    <div style={{ fontSize: '0.72rem', color: '#71717a' }}>Instant UPI transfer after verification</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#cbd5e1' }}>₹{secondPrize}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(180,120,60,0.06)', border: '1px solid rgba(180,120,60,0.2)', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🥉</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#e5e5e5', fontSize: '0.9rem' }}>3rd Place</div>
                    <div style={{ fontSize: '0.72rem', color: '#71717a' }}>Instant UPI transfer after verification</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#a78060' }}>₹{thirdPrize}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🎟️</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#e5e5e5', fontSize: '0.9rem' }}>4th Place</div>
                    <div style={{ fontSize: '0.72rem', color: '#71717a' }}>Auto-issued coupon · ₹0 entry on any slot</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#4ade80' }}>FREE SLOT</div>
              </div>
            </div>

            {/* ── SPECIAL ACHIEVEMENT PRIZE ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(220, 38, 38, 0.08) 100%)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.15rem' }}>🔥</span>
                  <strong style={{ color: '#ffedd5', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
                    Special Achievement Prize
                  </strong>
                </div>
                <div style={{ background: '#ea580c', color: '#ffffff', fontSize: '0.82rem', fontWeight: 900, padding: '2px 8px', borderRadius: '6px' }}>
                  ₹570
                </div>
              </div>
              <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.95rem', marginTop: '4px' }}>
                B2B 3 Chicken Dinners + 55 Kills = ₹570
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '3px' }}>
                Squad bonus: Win all 3 matches of the slot back-to-back with 55+ total team finishes.
              </div>
            </div>

            {/* Concise UPI Setup Instructions Box */}
            <div className={styles.prizeModalUpiBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <CreditCard size={16} color="#22c55e" />
                <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>How to Add UPI ID for Prize Payouts</strong>
              </div>
              <ol style={{ margin: 0, paddingLeft: '1.1rem', color: '#a1a1aa', fontSize: '0.78rem', lineHeight: '1.55' }}>
                <li>Go to Your Profile.</li>
                <li>Enter your active <strong>UPI ID</strong> (e.g. <code style={{ color: '#4ade80' }}>yourname@oksbi</code>, <code style={{ color: '#4ade80' }}>mobile@paytm</code>) &amp; click <strong>Save</strong>.</li>
                <li>Finish top 3 and cash lands in your UPI within minutes of score verification.</li>
              </ol>
            </div>

            {/* Modal Bottom Action Row */}
            <div className={styles.prizeModalFooter}>
              <Link
                href="/profile"
                className={styles.prizeProfileLink}
              >
                Open Profile to Add UPI ID →
              </Link>
              <button
                type="button"
                className={styles.prizeGotItBtn}
                onClick={() => setShowPrizeModal(false)}
              >
                OK, Got It
              </button>
            </div>
          </div>
        </div>
      )}




      {/* ── TOURNAMENT RULES & GUIDELINES MODAL ── */}
      {showRulesModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRulesModal(false)}>
          <div className={styles.rulesModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.rulesModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} color="#fbbf24" />
                <h2 className={styles.rulesModalTitle}>Tournament Rules &amp; Guidelines</h2>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setShowRulesModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p className={styles.rulesModalSubtitle}>
              Please read all rules carefully before participating. All players and team captains must adhere to these guidelines.
            </p>

            <div className={styles.rulesListScroll}>
              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>01</span>
                  <h3>Removal of Unknown Players in Assigned Slot</h3>
                </div>
                <p>
                  If an unknown or unauthorized player enters your assigned slot (e.g. Slot 5), registered team members from that slot must report it in the <strong>in-game custom room chat</strong>.
                </p>
                <p className={styles.ruleNote}>
                  * A minimum of <strong>2 registered team members</strong> from that slot must message in the room chat for admin verification and removal of the unknown player.
                </p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>02</span>
                  <h3>Hacking &amp; Fair Play Policy</h3>
                </div>
                <p>
                  Any player found using <strong>hacks, cheats, exploits, unauthorized software, or illicit tools</strong> will be <strong>permanently banned</strong> from all BGFS tournaments.
                </p>
                <p className={styles.ruleNoteDanger}>
                  BGFS enforcement team reserves the right to take immediate action against any team violating fair-play rules.
                </p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>03</span>
                  <h3>Match Timings &amp; Punctuality</h3>
                </div>
                <p>
                  All matches start <strong>strictly on time</strong> according to the slot schedule.
                </p>
                <p>
                  Players are responsible for entering the custom room before the scheduled start time. Delays caused by individual teams will not delay match start.
                </p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>04</span>
                  <h3>Custom Room Credentials Security</h3>
                </div>
                <p>
                  Custom Room <strong>ID and passwords must never be shared or leaked</strong> outside your registered team.
                </p>
                <p className={styles.ruleNoteDanger}>
                  If any player leaks room credentials, the team will be disqualified and <strong>no refund</strong> will be issued.
                </p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>05</span>
                  <h3>Finals Match Recordings</h3>
                </div>
                <p>
                  All teams qualifying for the <strong>Finals must record their POV match recordings</strong>.
                </p>
                <p>
                  In the event of a cheating or hacking complaint, finalists may be required to submit match recordings for official review.
                </p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>06</span>
                  <h3>Finals Security Deposit (₹200 - Refundable)</h3>
                </div>
                <p>
                  For teams qualifying for the <strong>Grand Finals only</strong>, a <strong>₹200 security deposit</strong> must be paid prior to the Finals matches.
                </p>
                <p className={styles.ruleNoteWarning}>
                  This amount is 100% fully refundable after Finals matches, provided the team is not disqualified for hacking or fair-play violations.
                </p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>07</span>
                  <h3>Points &amp; Score Verification</h3>
                </div>
                <p>
                  Captains are advised to capture a <strong>screenshot of scoreboards immediately after each match</strong>.
                </p>
                <p>
                  In case of any points dispute on the BGFS leaderboard, screenshots serve as official evidence for review.
                </p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>08</span>
                  <h3>Finals Prize Pool &amp; Trophy Delivery</h3>
                </div>
                <p>Upon final verification of Grand Finals standings:</p>
                <p>• Prize money will be transferred directly to the captain&apos;s verified account.</p>
                <p>• Official BGFS Champion Trophy will be dispatched to the winning team&apos;s registered address.</p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>09</span>
                  <h3>Official Communications</h3>
                </div>
                <p>
                  All official updates and notices for qualifying teams will be issued via the <strong>WhatsApp phone number registered during onboarding</strong>.
                </p>
              </div>

              <div className={styles.ruleCard}>
                <div className={styles.ruleCardHeader}>
                  <span className={styles.ruleNumber}>10</span>
                  <h3>Terms &amp; Tournament Compliance</h3>
                </div>
                <p>
                  By registering and joining a slot on BGFS, all players agree to comply with these official rules and decisions made by tournament marshals.
                </p>
                <div className={styles.playFairBadge}>
                  Play Fair • Respect Competitors • Honor the Game
                </div>
              </div>
            </div>

            <div className={styles.rulesModalFooter}>
              <button className={styles.rulesAgreeBtn} onClick={() => setShowRulesModal(false)}>
                I UNDERSTAND &amp; AGREE TO RULES
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
