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

function getValidTargetTime(targetDateProp?: string): number {
  const now = Date.now()
  let target = targetDateProp ? new Date(targetDateProp).getTime() : NaN

  // If target date is invalid or in the past, fallback to upcoming October 3 at 9:30 PM IST
  if (isNaN(target) || target <= now) {
    const currentYear = new Date().getFullYear()
    let oct3 = new Date(`${currentYear}-10-03T21:30:00+05:30`).getTime()
    if (oct3 <= now) {
      oct3 = new Date(`${currentYear + 1}-10-03T21:30:00+05:30`).getTime()
    }
    return oct3
  }

  return target
}

export default function CountdownTimer({
  targetDate,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const targetTime = getValidTargetTime(targetDate)

    function updateTimer() {
      const now = Date.now()
      const diff = Math.max(0, targetTime - now)

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

  const units = [
    { label: 'DAYS', value: timeLeft.days },
    { label: 'HOURS', value: timeLeft.hours },
    { label: 'MINUTES', value: timeLeft.minutes },
    { label: 'SECONDS', value: timeLeft.seconds },
  ]

  return (
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
  )
}
