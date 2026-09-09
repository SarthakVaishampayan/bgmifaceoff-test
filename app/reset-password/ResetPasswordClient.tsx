'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, KeyRound, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from '../login/page.module.css'

export default function ResetPasswordClient() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function verifyResetAccess() {
      // Check existing session
      const { data: { session } } = await supabase.auth.getSession()

      // Check if URL has PKCE code parameter
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')

      if (session) {
        setHasValidSession(true)
        setCheckingSession(false)
      } else if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error && data.session) {
          setHasValidSession(true)
        } else {
          setHasValidSession(false)
        }
        setCheckingSession(false)
      } else {
        setHasValidSession(false)
        setCheckingSession(false)
      }
    }

    verifyResetAccess()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasValidSession(true)
        setCheckingSession(false)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error: updateErr } = await supabase.auth.updateUser({
      password: password,
    })

    setLoading(false)

    if (updateErr) {
      setError(updateErr.message)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/dashboard')
    }, 2000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/login" className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Back to Sign In</span>
        </Link>
      </div>

      <div className={styles.card}>
        <div className={styles.headerArea}>
          <span className={styles.brandTag}>BGMI FACEOFF SERIES</span>
          <h1 className={styles.title}>SET NEW PASSWORD</h1>
          <p className={styles.subtitle}>
            Enter your new secure password below to update your account.
          </p>
        </div>

        {checkingSession ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#aaaaaa' }}>
            <span className="spinner" style={{ display: 'inline-block', marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Verifying password reset session...</p>
          </div>
        ) : !hasValidSession && !success ? (
          <div style={{
            textAlign: 'center',
            padding: '1.5rem 1rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
          }}>
            <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', display: 'block' }} />
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800 }}>Invalid or Expired Link</h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#cccccc', lineHeight: 1.5 }}>
              Your password reset link is invalid or has expired. Please request a new reset link from the sign-in page.
            </p>
            <Link
              href="/login"
              className="btn btn-primary"
              style={{ display: 'inline-block', padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 800 }}
            >
              Request New Reset Link →
            </Link>
          </div>
        ) : success ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid #4ade80',
            borderRadius: '8px',
            color: '#4ade80',
          }}>
            <Check size={32} style={{ margin: '0 auto 0.75rem', display: 'block' }} />
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 800 }}>Password Updated Successfully!</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cccccc' }}>
              Redirecting you to your dashboard...
            </p>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className={styles.form}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="new-password">NEW PASSWORD</label>
              <div className={styles.passwordWrapper}>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`${styles.input} ${styles.passwordInput}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                  autoFocus
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

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="confirm-password">CONFIRM NEW PASSWORD</label>
              <div className={styles.passwordWrapper}>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`${styles.input} ${styles.passwordInput}`}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  minLength={6}
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
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> UPDATING PASSWORD...</> : 'UPDATE PASSWORD →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
