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

  // If target date is invalid or in the past, fallback to upcoming September 21 at 1:00 PM IST (Slot 1 start)
  if (isNaN(target) || target <= now) {
    const currentYear = new Date().getFullYear()
    let sep21 = new Date(`${currentYear}-09-21T13:00:00+05:30`).getTime()
    if (sep21 <= now) {
      sep21 = new Date(`${currentYear + 1}-09-21T13:00:00+05:30`).getTime()
    }
    return sep21
  }

  return target
}

export default function CountdownTimer({
  targetDate,
  label = 'LEAGUE STAGE STARTS IN',
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
