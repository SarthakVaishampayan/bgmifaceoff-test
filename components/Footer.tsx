import Link from 'next/link'
import Image from 'next/image'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      {/* Top: Logo + Social */}
      <div className={styles.topRow}>
        <Link href="/" className={styles.logoLink}>
          <Image
            src="/images/faceofflogo.png"
            alt="BGFS Faceoff Series"
            width={280}
            height={65}
            className={styles.logoImg}
            priority
          />
          <Image
            src="/images/bgmilogo.png"
            alt="BGMI Official Logo"
            width={120}
            height={50}
            className={styles.logoImg}
            priority
          />
        </Link>

        <div className={styles.socials}>
          <a href="#" className={styles.socialIcon} aria-label="Instagram" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </a>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Navigation Links */}
      <nav className={styles.navLinks}>
        <Link href="/about" className={styles.navLink}>ABOUT</Link>
        <Link href="/leaderboard" className={styles.navLink}>LEADERBOARD</Link>
        <Link href="/slots" className={styles.navLink}>SLOT REGISTRATION</Link>
        <Link href="/contact" className={styles.navLink}>SUPPORT</Link>
        <Link href="/terms" className={styles.navLink}>TERMS</Link>
        <Link href="/privacy-policy" className={styles.navLink}>PRIVACY POLICY</Link>
        <Link href="/refund-policy" className={styles.navLink}>REFUND POLICY</Link>
        <Link href="/fair-play" className={styles.navLink}>FAIR PLAY</Link>
      </nav>

      {/* Copyright */}
      <p className={styles.copyright} suppressHydrationWarning>
        © {new Date().getFullYear()} Battlegrounds Faceoff Series (BGFS). All rights reserved.
      </p>
    </footer>
  )
}
