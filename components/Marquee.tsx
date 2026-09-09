'use client'

import styles from './Marquee.module.css'

export default function Marquee() {
  const items = [
    { text: '🔥 BGFS SEASON 1 REGISTRATIONS ARE NOW LIVE', highlight: true },
    { text: 'WEEK 1 PAID LEAGUE SLOTS • ₹50 ENTRY FEE', highlight: false },
    { text: 'TOP 16 TEAMS QUALIFY FOR FREE GRAND FINALS', highlight: true },
    { text: 'BEST 5 SLOTS (15 MATCHES) SCORING SYSTEM ACTIVE', highlight: false },
    { text: 'DAILY MATCHES: 3 MATCHES PER SLOT', highlight: true },
  ]

  const list = [...items, ...items, ...items]

  return (
    <div className={styles.marqueeContainer}>
      <span className={styles.badge}>ANNOUNCEMENTS</span>
      <div className={styles.track}>
        {list.map((item, idx) => (
          <div key={idx} className={styles.item}>
            <span className={item.highlight ? styles.itemGold : ''}>{item.text}</span>
            <span className={styles.dot} />
          </div>
        ))}
      </div>
    </div>
  )
}
