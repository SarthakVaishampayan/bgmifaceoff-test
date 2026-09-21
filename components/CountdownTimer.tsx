'use client'

import { useEffect, useState } from 'react'
import styles from './CountdownTimer.module.css'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

interface CountdownTimerProps {
  targetDate?: string
  label?: string
}

function parseTargetTime(targetDateProp?: string): number {
  if (targetDateProp) {
    const parsed = new Date(targetDateProp).getTime()
    if (!isNaN(parsed)) return parsed
  }
  // Default: Season 01 Slot 1 start (September 21, 2026 at 1:00 PM IST)
  return new Date('2026-09-21T13:00:00+05:30').getTime()
}

export default function CountdownTimer({
  targetDate,
  label = 'LEAGUE STAGE STARTS IN',
}: CountdownTimerProps) {
  const targetTime = parseTargetTime(targetDate)

  const [isLive, setIsLive] = useState<boolean>(() => {
    return Date.now() >= targetTime
  })

  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const validTargetTime = parseTargetTime(targetDate)

    function updateTimer() {
      const now = Date.now()
      const diff = validTargetTime - now

      if (diff <= 0) {
        setIsLive(true)
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      setIsLive(false)
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft({ days, hours, minutes, seconds })
    }

    updateTimer()
    const timerId = setInterval(updateTimer, 1000)

    return () => clearInterval(timerId)
  }, [targetDate])

  // If tournament has started / is live
  if (isLive) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.liveLabelWrapper}>
          <span className={styles.liveDotRed} />
          <span>TOURNAMENT IS LIVE</span>
        </div>
      </div>
    )
  }

  // Pre-tournament countdown state
  const units = [
    { label: 'DAYS', value: timeLeft.days },
    { label: 'HOURS', value: timeLeft.hours },
    { label: 'MINUTES', value: timeLeft.minutes },
    { label: 'SECONDS', value: timeLeft.seconds },
  ]

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.labelWrapper}>
          <span className={styles.liveDot} />
          <span>{label}</span>
        </div>
      )}
      <div className={styles.container}>
        {units.map((u) => (
          <div key={u.label} className={styles.box}>
            <span className={styles.num}>
              {mounted ? String(u.value).padStart(2, '0') : '00'}
            </span>
            <span className={styles.unitLabel}>{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


