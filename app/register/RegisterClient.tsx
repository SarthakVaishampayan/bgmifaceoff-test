'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

export default function RegisterClient() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        router.replace('/slots')
      }
    })
  }, [router, supabase])

  const [teamName, setTeamName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmEmail, setConfirmEmail] = useState(false)

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()

    // Step 1: Register the auth user & save metadata
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { display_name: teamName.trim(), team_name: teamName.trim() },
      },
    })

    if (authErr) {
      setLoading(false)
      setError(
        authErr.message.toLowerCase().includes('already registered') || authErr.message.toLowerCase().includes('already exists')
          ? 'This email is already registered. Please sign in instead.'
          : authErr.message
      )
      return
    }

    const user = authData.user
    if (!user) {
      setLoading(false)
      setError('Failed to create account. Please try again.')
      return
    }

    // Create team and profile in database immediately using userId and validate name availability
    try {
      const regRes = await fetch('/api/register-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName: teamName.trim(), displayName: teamName.trim(), userId: user.id }),
      })
      const regData = await regRes.json()

      if (!regRes.ok) {
        setLoading(false)
        setError(regData.error || 'Registration failed. Please choose a different team name.')
        return
      }
    } catch (e: any) {
      console.error('Pre-provision team error:', e)
    }

    if (!authData.session) {
      setLoading(false)
      setConfirmEmail(true)
      return
    }

    router.push('/slots?welcome=registered')
  }

  if (confirmEmail) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
        </div>
        <div className={styles.card}>
          <div className={styles.headerArea}>
            <span className={styles.brandTag}>BGMI FACEOFF SERIES</span>
            <h1 className={styles.title}>CHECK YOUR EMAIL</h1>
          </div>
          <p className={styles.subtitle} style={{ marginBottom: '1.25rem' }}>
            We sent a confirmation link to <strong style={{ color: '#fbbf24' }}>{email}</strong>.
            Click the link in your email to verify your account, then sign in.
          </p>
          <Link href="/login" className={styles.submitBtn} style={{ textDecoration: 'none' }}>
            GO TO SIGN IN →
          </Link>
        </div>
      </div>
    )
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
          <h1 className={styles.title}>CREATE AN ACCOUNT</h1>
          <p className={styles.subtitle}>
            Register your squad &amp; compete in daily BGMI slots.
          </p>
        </div>

        <form onSubmit={handleCreateAccount} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-teamname">
              TEAM NAME *
            </label>
            <input
              id="register-teamname"
              type="text"
              className={styles.input}
              placeholder="e.g. Team Nemesis"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-email">
              EMAIL ADDRESS *
            </label>
            <input
              id="register-email"
              type="email"
              className={styles.input}
              placeholder="captain@bgfsesports.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-password">
              CREATE PASSWORD *
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.input} ${styles.passwordInput}`}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
            id="register-account-btn"
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> CREATING ACCOUNT...</> : 'CREATE ACCOUNT & CONTINUE →'}
          </button>
        </form>

        <div className={styles.loginFooter}>
          <p className={styles.loginText}>Already have an account?</p>
          <Link href="/login" className={styles.loginLink}>
            SIGN IN TO YOUR ACCOUNT →
          </Link>
        </div>
      </div>
    </div>
  )
}
