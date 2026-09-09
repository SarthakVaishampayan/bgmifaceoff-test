'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, KeyRound, Shield, Zap, Database, Server, CheckCircle } from 'lucide-react'
import styles from './page.module.css'

const SYSTEMS = [
  { icon: Database, label: 'Database Optimization', status: 'in_progress' },
  { icon: Zap, label: 'Leaderboard Engine', status: 'in_progress' },
  { icon: Server, label: 'Slot Booking System', status: 'queued' },
  { icon: Shield, label: 'Security & Auth Layer', status: 'done' },
]

export default function MaintenancePage() {
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState(38)
  const [dots, setDots] = useState('')

  // Animate the loading dots
  useEffect(() => {
    const iv = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'))
    }, 500)
    return () => clearInterval(iv)
  }, [])

  // Slowly animate the progress bar
  useEffect(() => {
    const iv = setInterval(() => {
      setProgress(p => {
        const next = p + (Math.random() * 0.4)
        return next >= 72 ? 72 : next
      })
    }, 800)
    return () => clearInterval(iv)
  }, [])

  function handleCheckStatus() {
    setChecking(true)
    setTimeout(() => {
      window.location.href = '/'
    }, 1200)
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

        {/* Progress bar */}
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>UPGRADE PROGRESS</span>
            <span className={styles.progressPct}>{Math.floor(progress)}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.progressNote}>Estimated completion: 15–30 minutes{dots}</p>
        </div>

        {/* System status list */}
        <div className={styles.systemList}>
          {SYSTEMS.map(({ icon: Icon, label, status }) => (
            <div key={label} className={styles.systemRow}>
              <div className={styles.systemIcon}>
                <Icon size={14} color={status === 'done' ? '#4ade80' : status === 'in_progress' ? '#fbbf24' : '#555'} />
              </div>
              <span className={styles.systemLabel}>{label}</span>
              <span className={`${styles.systemStatus} ${styles['status_' + status]}`}>
                {status === 'done' && <CheckCircle size={12} />}
                {status === 'in_progress' && <span className={styles.miniSpinner} />}
                {status === 'in_progress' ? 'IN PROGRESS' : status === 'done' ? 'COMPLETE' : 'QUEUED'}
              </span>
            </div>
          ))}
        </div>

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

          <Link href="/login?redirectTo=/admin" className={styles.adminBtn}>
            <KeyRound size={14} />
            <span>Admin Portal</span>
          </Link>
        </div>

        <p className={styles.footerNote}>
          Thank you for your patience • BGFS Platform Team
        </p>
      </div>
    </div>
  )
}
