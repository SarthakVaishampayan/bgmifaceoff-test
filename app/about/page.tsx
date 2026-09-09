import type { Metadata } from 'next'
import { Shield, Calendar, Crosshair, Trophy } from 'lucide-react'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'About Us | BGFS',
  description: "Learn about Battlegrounds Faceoff Series: India's premier BGMI competitive tournament platform.",
}

export default function AboutPage() {
  const features = [
    {
      icon: Calendar,
      title: 'Structured Slot System',
      desc: 'Daily match slots with limited team capacity per slot ensure competitive, fair games. Teams can book multiple slots across the season.',
    },
    {
      icon: Crosshair,
      title: 'BGIS Scoring Engine',
      desc: 'Official BGIS placement points + 1 point per elimination. Our Best-16 auto-calculator picks your top 16 match scores: off-days never hurt your rank.',
    },
    {
      icon: Trophy,
      title: 'Live Leaderboard',
      desc: 'Real-time public leaderboard updated after every slot. Track per-slot results and overall standings in one place.',
    },
    {
      icon: Shield,
      title: 'Secure Payments',
      desc: "Entry fees processed via secure UPI payment gateway. Payouts transferred after slot completion.",
    },
  ]

  const stats = [
    { value: '18', label: 'Teams Per Slot' },
    { value: '3', label: 'Matches Per Slot' },
    { value: '16', label: 'Grand Finals Qualifiers' },
    { value: '₹50', label: 'Entry Fee Per Slot' },
  ]

  return (
    <main className={styles.page}>
      {/* ── PAGE HERO ── */}
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>About BGFS</p>
          <h1 className={styles.heroTitle}>
            Battlegrounds <span className={styles.gold}>Faceoff Series</span>
          </h1>
          <p className={styles.heroDesc}>
            India&rsquo;s premier unofficial BGMI competitive league: built by players, for players.
          </p>
        </div>
      </section>

      {/* ── WHO WE ARE ── */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.twoCol}>
            <div>
              <p className={styles.sectionEyebrow}>Who We Are</p>
              <h2 className={styles.sectionTitle}>A Platform Built Around the Game</h2>
              <p className={styles.body}>
                BGFS (Battlegrounds Faceoff Series) is a grassroots BGMI (Battlegrounds Mobile India)
                tournament platform that runs structured, week-long competitive cycles for mobile players
                across India. We provide a fair, transparent, and accessible competitive environment
                without requiring massive budgets or professional infrastructure.
              </p>
              <p className={styles.body}>
                Our platform runs on a <strong className={styles.accent}>2-week competitive cycle</strong>: daily paid league
                slots Monday through Friday across two weeks, culminating in a free Grand Finals event
                for the top 16 qualifying teams. Every team plays on equal footing: your ranking is
                determined purely by your best 16 match performances across the entire season.
              </p>
            </div>

            <div className={styles.statGrid}>
              {stats.map(s => (
                <div key={s.label} className="stat-box">
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE DO ── */}
      <section className={`${styles.section} ${styles.altBg}`}>
        <div className="container">
          <div className={styles.sectionCenter}>
            <p className={styles.sectionEyebrow}>What We Do</p>
            <h2 className={styles.sectionTitle}>Tournament Infrastructure, End-to-End</h2>
            <p className={styles.sectionSubtitleText}>
              From slot booking to score tracking to prize payouts: we handle it all.
            </p>
          </div>

          <div className="grid-2" style={{ marginTop: '2.5rem' }}>
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className={styles.featureCard}>
                <div className={styles.iconBox}>
                  <Icon size={22} color="#fbbf24" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className={styles.featureTitle}>{title}</h3>
                  <p className={styles.featureDesc}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO RUNS IT ── */}
      <section className={styles.section}>
        <div className={styles.narrowContainer}>
          <p className={styles.sectionEyebrow}>Who Runs It</p>
          <h2 className={styles.sectionTitle}>Built by a BGMI Enthusiast</h2>
          <p className={styles.body}>
            BGFS is an independent platform founded and operated by a passionate BGMI player and
            developer from India. The mission is simple: give serious mobile players a structured
            competitive outlet without the chaos of informal scrims or the exclusivity of large
            professional leagues.
          </p>
          <p className={styles.body}>
            Every feature on the platform, from the slot booking system to the Best-16 scoring
            engine, has been designed with the needs of competitive BGMI players in mind. We are
            not affiliated with Krafton or BGMI officially; we are a community-first, player-first
            initiative.
          </p>
          <div className={styles.noteBox}>
            <p>
              <strong style={{ color: '#fbbf24' }}>Questions or feedback?</strong>{' '}
              We&rsquo;re always open to hearing from the community.{' '}
              <a href="/contact" style={{ color: '#fbbf24', textDecoration: 'underline' }}>
                Reach out to us →
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
