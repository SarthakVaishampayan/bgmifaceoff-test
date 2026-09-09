'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

export default function PageLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const prevPath = useRef(pathname)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Detect route change completion
  useEffect(() => {
    if (prevPath.current !== pathname) {
      setProgress(100)
      hideTimerRef.current = setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 300)
      prevPath.current = pathname
    }
  }, [pathname])

  // Listen for custom show/hide events (login, signout, etc.)
  useEffect(() => {
    const handleShow = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      setLoading(true)
      setProgress(0)

      let p = 0
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        p += Math.random() * 20 + 5
        if (p > 85) p = 85
        setProgress(p)
      }, 120)
    }

    const handleHide = () => {
      setProgress(100)
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 300)
    }

    window.addEventListener('app:showLoader', handleShow)
    window.addEventListener('app:hideLoader', handleHide)
    return () => {
      window.removeEventListener('app:showLoader', handleShow)
      window.removeEventListener('app:hideLoader', handleHide)
    }
  }, [])

  // Intercept link clicks to trigger loader
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return
      if (href === pathname) return

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      setLoading(true)
      setProgress(0)

      let p = 0
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        p += Math.random() * 25 + 5
        if (p > 85) p = 85
        setProgress(p)
      }, 120)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      if (timerRef.current) clearInterval(timerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10, 10, 10, 0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* Crosshair / Scope Animation */}
      <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '2rem' }}>
        <div style={{
          position: 'absolute', inset: 0,
          border: '2px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '50%',
          animation: 'scopeSpin 3s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: '12px',
          border: '2px solid rgba(251, 191, 36, 0.5)',
          borderRadius: '50%',
          animation: 'scopeSpin 2s linear infinite reverse',
        }} />
        <div style={{
          position: 'absolute', inset: '24px',
          border: '1.5px solid rgba(251, 191, 36, 0.7)',
          borderRadius: '50%',
          animation: 'scopePulse 1.5s ease-in-out infinite',
        }} />
        <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '1px', background: 'rgba(251, 191, 36, 0.4)', transform: 'translateY(-50%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '0', bottom: '0', width: '1px', background: 'rgba(251, 191, 36, 0.4)', transform: 'translateX(-50%)' }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '8px', height: '8px',
          background: '#fbbf24',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 12px rgba(251, 191, 36, 0.6), 0 0 24px rgba(251, 191, 36, 0.3)',
          animation: 'dotPulse 1s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '40px', height: '40px',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, transparent 70%)',
          animation: 'flash 0.8s ease-out infinite',
        }} />
      </div>

      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '0.7rem',
        fontWeight: 800,
        letterSpacing: '0.25em',
        color: 'rgba(251, 191, 36, 0.6)',
        textTransform: 'uppercase',
        marginBottom: '1.5rem',
      }}>
        BGFS
      </div>

      <div style={{
        width: '200px',
        height: '4px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #dc2626, #fbbf24)',
          borderRadius: '2px',
          transition: 'width 150ms ease',
          boxShadow: '0 0 8px rgba(251, 191, 36, 0.4)',
        }} />
      </div>

      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '0.65rem',
        fontWeight: 600,
        letterSpacing: '0.15em',
        color: 'rgba(255, 255, 255, 0.3)',
        textTransform: 'uppercase',
        marginTop: '0.75rem',
      }}>
        LOADING
      </div>

      <style>{`
        @keyframes scopeSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scopePulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
        }
        @keyframes flash {
          0% { opacity: 0.8; transform: translate(-50%, -50%) scale(0.5); }
          50% { opacity: 0.3; transform: translate(-50%, -50%) scale(1.5); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2); }
        }
      `}</style>
    </div>
  )
}
