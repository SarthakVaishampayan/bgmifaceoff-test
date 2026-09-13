'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

export default function PageLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
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
        setMessage(null)
      }, 350)
      prevPath.current = pathname
    }
  }, [pathname])

  // Listen for custom show/hide events & dev preview key 'L'
  useEffect(() => {
    const handleShow = (e?: any) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      setMessage(e?.detail?.message || null)
      setLoading(true)
      setProgress(0)

      let p = 0
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        p += Math.random() * 18 + 7
        if (p > 90) p = 90
        setProgress(p)
      }, 100)
    }

    const handleHide = () => {
      setProgress(100)
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
        setMessage(null)
      }, 350)
    }

    window.addEventListener('app:showLoader', handleShow)
    window.addEventListener('app:hideLoader', handleHide)

    // Press 'L' to preview the loader in real-time
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        handleShow()
        setTimeout(() => {
          handleHide()
        }, 3200)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('app:showLoader', handleShow)
      window.removeEventListener('app:hideLoader', handleHide)
      window.removeEventListener('keydown', handleKeyDown)
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
        p += Math.random() * 20 + 8
        if (p > 90) p = 90
        setProgress(p)
      }, 100)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      if (timerRef.current) clearInterval(timerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [pathname])

  if (!loading) return null

  const isComplete = progress >= 95

  // Map progress (0 -> 100) to bottom-to-top reveal across visible logo bounds in faceofflogo.png (25% top to 75% bottom)
  // At progress 0: top inset is 75% (0% of logo revealed)
  // At progress 100: top inset is 24% (100% of logo revealed)
  const insetTopPercent = Math.max(24, 75 - (progress / 100) * 51)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10, 10, 10, 0.94)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      userSelect: 'none',
    }}>
      {/* Centered Logo Container */}
      <div style={{
        position: 'relative',
        width: '260px',
        height: '260px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* 1. Base Ghost Logo: raw logo at 20% opacity */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/faceofflogo.png"
          alt="BGFS Faceoff Series"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: 0.2,
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />

        {/* 2. Active Raw Logo filling from bottom to top */}
        <div style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(${insetTopPercent}% 0 0 0)`,
          WebkitClipPath: `inset(${insetTopPercent}% 0 0 0)`,
          transition: 'clip-path 100ms ease-out, -webkit-clip-path 100ms ease-out',
          pointerEvents: 'none',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/faceofflogo.png"
            alt="BGFS Faceoff Series Active"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {message && (
        <div style={{
          marginTop: '1.25rem',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#fbbf24',
          textAlign: 'center',
          maxWidth: '90vw',
          padding: '0 1rem',
          textShadow: '0 0 16px rgba(251, 191, 36, 0.4)',
        }}>
          {message}
        </div>
      )}
    </div>
  )
}
