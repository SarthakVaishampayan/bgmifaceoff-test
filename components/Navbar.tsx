'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import styles from './Navbar.module.css'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    setMenuOpen(false)
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/slots', label: 'Slot Registration' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ]

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.inner}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <Image
            src="/images/faceofflogo.png"
            alt="BGFS Faceoff Series"
            width={320}
            height={74}
            className={styles.logoImg}
            priority
          />
          <Image
            src="/images/bgmilogo.png"
            alt="BGMI Official Logo"
            width={160}
            height={74}
            className={styles.bgmiLogoImg}
            priority
          />
        </Link>

        {/* Desktop Nav Links (Center) */}
        <div className={styles.links}>
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.link} ${pathname === link.href ? styles.active : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Side Actions: Dashboard & Login */}
        <div className={styles.actions}>
          <Link
            href="/dashboard"
            className={`${styles.secondaryBtn} ${pathname === '/dashboard' ? styles.activeBtn : ''}`}
          >
            Dashboard
          </Link>
          {user ? (
            <button onClick={handleSignOut} className={styles.secondaryBtn}>
              Sign Out
            </button>
          ) : (
            <Link
              href="/login"
              className={`${styles.ctaBtn} ${pathname === '/login' ? styles.activeCta : ''}`}
            >
              Login
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen1 : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen2 : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen3 : ''}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <button onClick={handleSignOut} className={styles.mobileLink}>
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
              Join Tournament
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
