'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff, MessageCircle, ShieldCheck, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const redirect = getRedirectUrl()
        router.replace(redirect)
      }
    })
  }, [router, supabase])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgotModal, setShowForgotModal] = useState(false)

  function getRedirectUrl() {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('redirectTo') || '/dashboard'
    }
    return '/dashboard'
  }

  // Standard Password Sign In
  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      setLoading(false)
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        setError('Invalid email or password. Please check your spelling or click "Forgot Password?" below.')
      } else {
        setError(error.message)
      }
      return
    }

    const userId = data.user?.id
    if (userId) {
      setLoading(false)
      window.dispatchEvent(new Event('app:showLoader'))
      window.location.href = getRedirectUrl()
    } else {
      setLoading(false)
    }
  }




  return (
    <div className={styles.page}>
      {/* Top Left Back Button */}
      <div className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>
      </div>

      <div className={styles.card}>
        <div className={styles.headerArea}>
          <span className={styles.brandTag}>BGMI FACEOFF SERIES</span>
          <h1 className={styles.title}>SIGN IN</h1>
          <p className={styles.subtitle}>
            Access your BGFS portal, slot bookings, &amp; standings.
          </p>
        </div>



        {/* ── FORM 1: STANDARD ID & PASSWORD ── */}
        <form onSubmit={handlePasswordSignIn} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="login-email">EMAIL ADDRESS</label>
            <input
              id="login-email"
              type="email"
              className={styles.input}
              placeholder="player@bgfsesports.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.label} htmlFor="login-password">PASSWORD</label>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#facc15', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                onClick={() => setShowForgotModal(true)}
              >
                Forgot Password?
              </button>
            </div>

            <div className={styles.passwordWrapper}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.input} ${styles.passwordInput}`}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button
            id="password-signin-btn"
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> SIGNING IN...</> : 'SIGN IN →'}
          </button>
        </form>

        {/* New User Option Section */}
        <div className={styles.signupFooter}>
          <p className={styles.signupText}>Don't have an account yet?</p>
          <Link href="/register" className={styles.signupLink}>
            CREATE ACCOUNT / REGISTER NOW →
          </Link>
        </div>
      </div>

      {/* ── FORGOT PASSWORD WHATSAPP OVERLAY MODAL ── */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            style={{
              background: '#141416',
              border: '1px solid #27272a',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.9)',
              textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowForgotModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: '#f59e0b',
            }}>
              <ShieldCheck size={28} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.02em' }}>
              RESET ACCOUNT PASSWORD
            </h3>

            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#a1a1aa', lineHeight: '1.5' }}>
              To protect your tournament registrations and prevent unauthorized account takeover, password resets are verified directly by our admin team on WhatsApp.
            </p>

            <div style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              textAlign: 'left',
              fontSize: '0.8rem',
              color: '#bbf7d0',
              marginBottom: '1.5rem',
              lineHeight: '1.45',
            }}>
              <div style={{ fontWeight: 800, color: '#4ade80', marginBottom: '4px' }}>
                How it works:
              </div>
              <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>Tap the WhatsApp button below to message admin.</li>
                <li>Provide your <strong>Registered Email</strong> &amp; <strong>Team Name</strong>.</li>
                <li>Admin will verify your identity &amp; issue an instant temporary password.</li>
              </ol>
            </div>

            <a
              href={`https://wa.me/919425340813?text=${encodeURIComponent(email.trim() ? `Hi Admin, I forgot my BGFS password. My registered email is: ${email.trim()}` : `Hi Admin, I forgot my BGFS account password. Please help me reset it.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '0.85rem 1rem',
                background: '#22c55e',
                color: '#000000',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.9rem',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
                marginBottom: '0.85rem',
                transition: 'all 0.2s ease',
              }}
            >
              <MessageCircle size={18} />
              Message Admin on WhatsApp  →
            </a>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '0.5rem',
              }}
            >
              ← Back to Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
