'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import styles from '@/app/page.module.css'

export default function HeroCTA() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className={styles.heroCta}>
      <Link href="/register" className={styles.registerCta}>
        REGISTER NOW
      </Link>
      <Link href="/login" className={styles.secondaryCta}>
        LOGIN
      </Link>
      {!loading && user && (
        <Link href="/dashboard" className={styles.secondaryCta}>
          DASHBOARD
        </Link>
      )}
    </div>
  )
}
