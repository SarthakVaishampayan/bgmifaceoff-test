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
          <a href="#" className={styles.socialIcon} aria-label="YouTube" target="_blank" rel="noopener noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
            </svg>
          </a>
          <a href="#" className={styles.socialIcon} aria-label="X (Twitter)" target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
