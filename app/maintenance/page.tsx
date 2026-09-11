'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Shield } from 'lucide-react'
import styles from './page.module.css'

export default function MaintenancePage() {
  const [checking, setChecking] = useState(false)
  const supabase = createClient()

  // Auto-check: if maintenance mode was turned off, redirect to home immediately
  useEffect(() => {
    let isMounted = true

    async function checkMaintenanceStatus() {
      try {
        const { data } = await supabase
          .from('config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle()

        if (data?.value === 'false' && isMounted) {
          window.location.replace('/')
        }
      } catch (err) {
        // ignore
      }
    }

    checkMaintenanceStatus()
    const interval = setInterval(checkMaintenanceStatus, 3000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [supabase])

  async function handleCheckStatus() {
    setChecking(true)
    try {
      const { data } = await supabase
        .from('config')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle()

      if (data?.value === 'false') {
        window.location.replace('/')
        return
      }
    } catch (err) {}

    setTimeout(() => {
      setChecking(false)
    }, 1000)
  }

  return (
    <div className={styles.page}>
      {/* Animated background orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      <div className={styles.card}>
        {/* Top accent bar */}
        <div className={styles.accentBar} />

        {/* Brand tag */}
        <div className={styles.brandRow}>
          <span className={styles.brandTag}>BGFS</span>
          <span className={styles.dividerDot}>·</span>
          <span className={styles.brandSub}>BATTLEGROUNDS FACEOFF SERIES</span>
        </div>

        {/* Status badge */}
        <div className={styles.badgeRow}>
          <span className={styles.statusBadge}>
            <span className={styles.dot} />
            SYSTEM MAINTENANCE
          </span>
        </div>

        {/* Icon */}
        <div className={styles.iconRing}>
          <div className={styles.iconInner}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        </div>

        <h1 className={styles.title}>SCHEDULED UPGRADE<br />IN PROGRESS</h1>

        <p className={styles.description}>
          Our engineering team is performing a scheduled platform upgrade to optimize match infrastructure,
          scoring engines, and slot booking performance. We'll be back shortly.
        </p>

        {/* Data safety notice */}
        <div className={styles.safetyNote}>
          <Shield size={14} color="#4ade80" />
          <span>Your squad data, match scores, and booked slots are <strong>100% safe</strong> and unaffected.</span>
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.checkBtn}
            onClick={handleCheckStatus}
            disabled={checking}
          >
            <RefreshCw size={15} className={checking ? styles.spin : ''} />
            <span>{checking ? 'Checking...' : 'Check Status'}</span>
          </button>
        </div>

        <p className={styles.footerNote}>
          Thank you for your patience • BGFS Platform Team
        </p>
      </div>
    </div>
  )
}
