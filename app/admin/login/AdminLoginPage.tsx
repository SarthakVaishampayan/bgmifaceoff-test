'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdminEmail } from '@/lib/auth/adminGuard'
import styles from './page.module.css'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        // Check if user is admin before redirecting
        checkAdminAndRedirect(data.user.id, data.user.email)
      }
    })
  }, [router, supabase])

  async function checkAdminAndRedirect(userId: string, userEmail?: string | null) {
    if (isSuperAdminEmail(userEmail)) {
      router.replace('/admin')
      return
    }

    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (data?.role === 'admin' || data?.role === 'admin_scores') {
      router.replace('/admin')
    }
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAdminSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (signInError) {
      setLoading(false)
      if (signInError.message.toLowerCase().includes('invalid login credentials')) {
        setError('Invalid admin credentials. Please check your email and password.')
      } else {
        setError(signInError.message)
      }
      return
    }

    if (data.user) {
      const isPermanentAdmin = isSuperAdminEmail(data.user.email) || isSuperAdminEmail(cleanEmail)

      // Verify admin role
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle()

      const effectiveRole = isPermanentAdmin ? 'admin' : profile?.role

      if (effectiveRole !== 'admin' && effectiveRole !== 'admin_scores') {
        setLoading(false)
        setError('Access denied. This account does not have admin privileges.')
        // Sign out the non-admin user
        await supabase.auth.signOut()
        return
      }

      // Self-heal: Ensure role is 'admin' in database for permanent admin
      if (isPermanentAdmin && profile?.role !== 'admin') {
        await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('user_id', data.user.id)
      }

      setLoading(false)
      window.dispatchEvent(new Event('app:showLoader'))
      window.location.href = '/admin'
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
          <span>Back to Site</span>
        </Link>
      </div>

      <div className={styles.card}>
        {/* Admin Shield Icon */}
        <div className={styles.shieldWrap}>
          <ShieldCheck size={36} color="#fbbf24" strokeWidth={1.5} />
        </div>

        <div className={styles.headerArea}>
          <span className={styles.brandTag}>ADMIN PORTAL</span>
          <h1 className={styles.title}>ADMIN SIGN IN</h1>
          <p className={styles.subtitle}>
            Restricted access for authorized administrators only.
          </p>
        </div>

        <form onSubmit={handleAdminSignIn} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="admin-email">ADMIN EMAIL</label>
            <input
              id="admin-email"
              type="email"
              className={styles.input}
              placeholder="admin@bgfsesports.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="admin-password">PASSWORD</label>
            <div className={styles.passwordWrapper}>
              <input
                id="admin-password"
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
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> AUTHENTICATING...</> : 'SIGN IN TO ADMIN →'}
          </button>
        </form>

        <div className={styles.footerNote}>
          <p className={styles.footerText}>
            Player? <Link href="/login" className={styles.footerLink}>Go to Player Login →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
