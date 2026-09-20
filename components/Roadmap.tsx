import Link from 'next/link'
import { Trophy, Shield, Swords, Award, ArrowRight, Zap } from 'lucide-react'
import styles from './Roadmap.module.css'

export default function Roadmap() {
  const timelineEvents = [
    {
      dateMonth: '16 SEP',
      dateSub: 'REGISTRATIONS',
      icon: Shield,
      crestLabel: 'BGFS SQUAD',
      acronym: 'REGISTRATIONS OPEN',
      subtitle: 'SLOT BOOKINGS LIVE',
      details: 'Captain signup in 30s • 1 Team, 1 Login • Roster lock',
      sideBadgeLabel: 'OPEN FOR ALL',
      sideBadgeSub: 'ALL SQUADS ELIGIBLE',
      isActive: true,
    },
    {
      dateMonth: '21 SEP – 16 OCT',
      dateSub: 'LEAGUE PHASE',
      icon: Swords,
      crestLabel: 'DAILY SLOTS',
      acronym: 'DAILY LEAGUE SLOTS',
      subtitle: '3 MATCHES PER SLOT',
      details: 'Play unlimited slots • Best 6 Slots count • Instant UPI match rewards',
      sideBadgeLabel: '21 SEP – 16 OCT',
      sideBadgeSub: 'DAILY 3-MATCH SLOTS',
      isActive: false,
    },
    {
      dateMonth: '16 OCT',
      dateSub: 'OFFICIAL CUTOFF',
      icon: Award,
      crestLabel: 'STANDINGS',
      acronym: 'TOP 16 CUTOFF',
      subtitle: 'LEADERBOARD LOCK',
      details: 'Top 16 squads lock their qualifying spots • Verified Gold Qualified badges',
      sideBadgeLabel: 'QUALIFIED BADGE',
      sideBadgeSub: 'TOP 16 ADVANCE FREE',
      isActive: false,
    },
    {
      dateMonth: '17 – 18 OCT',
      dateSub: 'GRAND FINALS',
      icon: Trophy,
      crestLabel: 'FINALS CUP',
      acronym: 'GRAND FINALS',
      subtitle: 'SEASON 01 FINALE',
      details: '₹20,000 Guaranteed Prize Pool • Physical BGFS Trophy • Winner Wall',
      sideBadgeLabel: '17 – 18 OCT',
      sideBadgeSub: '₹20,000 PRIZE POOL',
      isActive: false,
      isGrandFinale: true,
    },
  ]

  return (
    <section className={styles.roadmapSection} id="roadmap">
      <div className={styles.container}>
        {/* Top Broadcast Graphic Header */}
        <div className={styles.topBroadcastHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.mainTitleBlock}>
              <span className={styles.seasonTag}>OFFICIAL ESPORTS CALENDAR</span>
              <h2 className={styles.mainTitle}>SEASON 01 ROADMAP</h2>
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.statusIndicator}>
              <span className={styles.pulseDot} />
              <span>REGISTRATIONS &amp; SLOTS OPEN</span>
            </div>
          </div>
        </div>

        {/* Timeline Broadcast Canvas */}
        <div className={styles.timelineWrapper}>
          {timelineEvents.map((item, index) => {
            const Icon = item.icon
            return (
              <div key={index} className={styles.timelineRow}>
                {/* Left Date Marker */}
                <div className={styles.dateMarker}>
                  <div className={styles.dateMonth}>{item.dateMonth}</div>
                  <div className={styles.dateSub}>{item.dateSub}</div>
                </div>

                {/* Branch Line with Node */}
                <div className={styles.branchLine} />

                {/* Two-Tone Official Tournament Block */}
                <div className={`${styles.twoToneBlock} ${item.isActive ? styles.blockActive : ''}`}>
                  {/* Left Gold/Tan Half */}
                  <div className={styles.blockGoldSide}>
                    <Icon size={24} strokeWidth={2.2} className={styles.crestIcon} />
                    <span className={styles.crestLabel}>{item.crestLabel}</span>
                  </div>

                  {/* Right Black Half */}
                  <div className={styles.blockBlackSide}>
                    <div className={styles.blockAcronym}>{item.acronym}</div>
                    <div className={styles.blockYear}>{item.subtitle}</div>
                    <div className={styles.blockDetails}>{item.details}</div>
                  </div>
                </div>

                {/* Side Track Extension & Gold Badge */}
                <div className={styles.sideTrackContainer}>
                  <div className={styles.trackLine} />
                  <div className={styles.openForAllBadge}>
                    <div>
                      <span>{item.sideBadgeLabel}</span>
                      <span className={styles.openForAllBadgeSub}>{item.sideBadgeSub}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Broadcast Footer */}
        <div className={styles.broadcastFooter}>
          <div className={styles.footerLeftText}>
            <h4 className={styles.footerTitle}>Season 01 Slot Registrations Are Live</h4>
            <p className={styles.footerSubtitle}>
              Create your squad account, lock your slot, and grind the daily leaderboard to reach the Grand Finals.
            </p>
          </div>

          <Link href="/slots" className={styles.footerCta}>
            <span>BOOK A SLOT NOW</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
