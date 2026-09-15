export const dynamic = 'force-dynamic'

import Link from 'next/link'
import Image from 'next/image'
import { Users, Calendar, Crosshair, Trophy, Medal, Award, Zap, Check, ArrowRight, ShieldCheck } from 'lucide-react'
import CountdownTimer from '@/components/CountdownTimer'
import HeroCTA from '@/components/HeroCTA'
import Roadmap from '@/components/Roadmap'
import HowItWorks from '@/components/HowItWorks'
import { createClient } from '@/lib/supabase/server'
import styles from './page.module.css'

export default async function LandingPage() {
  // Fetch slot 1 date from config (fallback to September 21, 1:00 PM IST)
  const supabase = await createClient()
  const { data: configRows } = await supabase
    .from('config')
    .select('key, value')
    .in('key', ['first_slot_date', 'grand_finals_date', 'cycle_start_date', 'cycle_end_date'])

  const config: Record<string, string> = {}
  configRows?.forEach(row => { config[row.key] = row.value })

  const firstSlotDate = config.first_slot_date || '2026-09-21T13:00:00+05:30'

  return (
    <main>
        {/* ── HERO ── */}
        <section className={styles.hero}>
          <div className={styles.heroOverlay} />
          <div className={styles.heroGrid} />
          <div className={styles.heroContainer}>
            <div className={styles.heroContent}>
              {/* Logo above heading */}
              <div className={styles.heroLogoWrapper}>
                <Image
                  src="/images/faceofflogo.png"
                  alt="BGFS Faceoff Series"
                  width={720}
                  height={240}
                  className={styles.heroLogoImg}
                  priority
                />
              </div>

              <h1 className={styles.heroTitle}>
                BATTLEGROUNDS<br />
                <span className={styles.goldText}>FACEOFF SERIES</span>
              </h1>
              <p className={styles.heroDesc}>
                India's 100% skill-based competitive esports league for BGMI mobile players. Match outcomes and rankings are determined strictly by in-game performance, eliminations, and placement points, not chance. Compete from home, grind the Season 1 leaderboard, and qualify for the Grand Finals.
              </p>

              {/* Countdown timer block */}
              <CountdownTimer targetDate={firstSlotDate} />

              {/* Action buttons */}
              <HeroCTA />
            </div>
          </div>
        </section>

 
        {/* ── SKILL-BASED GAMING DISCLAIMER BANNER ── */}
        <section className={styles.skillSection}>
          <div className="container">
            <div className={styles.skillBar}>
              <div className={styles.skillContent}>
                <ShieldCheck size={20} color="#fbbf24" className={styles.skillIcon} />
                <p className={styles.skillText}>
                  <strong className={styles.skillHighlight}>Skill-Based Esports:</strong> Match results &amp; rankings are 100% determined by player performance, eliminations &amp; placement: strictly not chance.
                </p>
              </div>
              <Link href="/fair-play" className={styles.fairPlayBtn}>
                Fair Play Policy →
              </Link>
            </div>
          </div>
        </section>

        {/* ── ROADMAP SECTION ── */}
        <Roadmap />

        {/* ── HOW IT WORKS SECTION ── */}
        <HowItWorks />

        {/* ── GRAND FINALS PRIZE POOL ── */}
        <section className={styles.prizesSection}>
          <div className="container">
            <div className={styles.gfContainer}>
              <div className={styles.gfHeaderRow}>
                <span className={styles.gfTag}>// SEASON 1 CHAMPIONSHIP</span>
                <span className={styles.gfSubTag}>GRAND FINALS POOL &amp; RECOGNITION</span>
              </div>

              <div className={styles.gfHeroSplit}>
                {/* Left Block: Dominant Prize Amount + Trophy */}
                <div className={styles.gfAmountBlock}>
                  <div className={styles.gfAmountHeader}>
                    <Trophy size={36} color="#fbbf24" strokeWidth={2} className={styles.gfInlineTrophy} />
                    <h2 className={styles.gfMainNumber}>₹20,000</h2>
                  </div>
                  <div className={styles.gfAmountLabel}>Guaranteed Grand Finals Prize Pool</div>
                  <p className={styles.gfAmountDesc}>
                    Top 16 qualified squads fight for the Season 1 Championship title, prize money, and supreme esports bragging rights.
                  </p>
                </div>

                {/* Right Block: 3 Secondary Feature Rows */}
                <div className={styles.gfFeatureList}>
                  <div className={styles.gfFeatureRow}>
                    <span className={styles.gfFeatureNum}>01</span>
                    <div>
                      <strong className={styles.gfFeatureHeading}>Official Physical Trophy</strong>
                      <p className={styles.gfFeatureText}>
                        Season 1 Champions win the physical BGFS Trophy + major share of the ₹20,000 pool.
                      </p>
                    </div>
                  </div>

                  <div className={styles.gfFeatureRow}>
                    <span className={styles.gfFeatureNum}>02</span>
                    <div>
                      <strong className={styles.gfFeatureHeading}>100% Free Grand Finals Entry</strong>
                      <p className={styles.gfFeatureText}>
                        Top 16 overall leaderboard teams advance directly with ₹0 additional entry fee.
                      </p>
                    </div>
                  </div>

                  <div className={styles.gfFeatureRow}>
                    <span className={styles.gfFeatureNum}>03</span>
                    <div>
                      <strong className={styles.gfFeatureHeading}>Winner&apos;s Wall Recognition</strong>
                      <p className={styles.gfFeatureText}>
                        Championship squad permanently showcased on the BGFS website homepage &amp; hall of fame.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
    </main>
  )
}
