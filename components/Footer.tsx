import Link from 'next/link'
import { Lock, Zap } from 'lucide-react'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">

        {/* ── THREE COLUMN LINK GRID ── */}
        <div className={styles.footerTop}>

          {/* Platform */}
          <div className={styles.linkGroup}>
            <p className={styles.groupTitle}>PLATFORM</p>
            <Link href="/" className={styles.footerLink}>Home</Link>
            <Link href="/leaderboard" className={styles.footerLink}>Leaderboard</Link>
            <Link href="/slots" className={styles.footerLink}>Register for Slot</Link>
            <Link href="/dashboard" className={styles.footerLink}>My Dashboard</Link>
          </div>

          {/* Company */}
          <div className={styles.linkGroup}>
            <p className={styles.groupTitle}>COMPANY</p>
            <Link href="/about" className={styles.footerLink}>About Us</Link>
            <Link href="/contact" className={styles.footerLink}>Contact Support</Link>
            <Link href="/fair-play" className={styles.footerLink}>Fair Play Policy</Link>
          </div>

          {/* Legal & Trust */}
          <div className={styles.linkGroup}>
            <p className={styles.groupTitle}>LEGAL & TRUST</p>
            <Link href="/terms" className={styles.footerLink}>Terms &amp; Conditions</Link>
            <Link href="/privacy-policy" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/refund-policy" className={styles.footerLink}>Cancellation &amp; Refund</Link>
            <Link href="/fair-play" className={styles.footerLink}>Skill-Based Gaming</Link>
            <div className={styles.trustBadges}>
              <span className={styles.trustChip}>
                <Lock size={10} color="#fbbf24" /> SSL SECURED
              </span>
              <span className={styles.trustChip}>
                <Zap size={10} color="#fbbf24" /> RAZORPAY
              </span>
            </div>
          </div>

        </div>

        {/* ── BOTTOM BAR ── */}
        <div className={styles.footerBottom}>
          <p className={styles.copyright} suppressHydrationWarning>
            © {new Date().getFullYear()} Battlegrounds Faceoff Series (BGFS). All rights reserved. Skill-based esports tournament platform — match outcomes determined entirely by in-game performance.
          </p>
          <div className={styles.legalLinks}>
            <Link href="/terms" className={styles.legalLink}>Terms</Link>
            <span className={styles.dot}>·</span>
            <Link href="/privacy-policy" className={styles.legalLink}>Privacy</Link>
            <span className={styles.dot}>·</span>
            <Link href="/refund-policy" className={styles.legalLink}>Refunds</Link>
            <span className={styles.dot}>·</span>
            <Link href="/fair-play" className={styles.legalLink}>Fair Play</Link>
          </div>
        </div>

      </div>
    </footer>
  )
}
