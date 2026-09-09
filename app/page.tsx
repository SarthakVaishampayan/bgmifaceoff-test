export const dynamic = 'force-dynamic'

import Link from 'next/link'
import Image from 'next/image'
import { Users, Calendar, Crosshair, Trophy, Medal, Award, Zap, Check, ArrowRight, ShieldCheck } from 'lucide-react'
import CountdownTimer from '@/components/CountdownTimer'
import { createClient } from '@/lib/supabase/server'
import styles from './page.module.css'

export default async function LandingPage() {
  // Fetch grand finals date from config (fallback to August 29, 11:00 PM IST)
  const supabase = await createClient()
  const { data: configRows } = await supabase
    .from('config')
    .select('key, value')
    .in('key', ['grand_finals_date', 'cycle_start_date', 'cycle_end_date'])

  const config: Record<string, string> = {}
  configRows?.forEach(row => { config[row.key] = row.value })

  const grandFinalsDate = config.grand_finals_date || '2026-10-03T21:30:00+05:30'

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
              <CountdownTimer targetDate={grandFinalsDate} />

              {/* Action buttons */}
              <div className={styles.heroCta}>
                <Link href="/slots" className={styles.primaryCta}>
                  REGISTER NOW
                </Link>
                <Link href="/leaderboard" className={styles.secondaryCta}>
                  VIEW LEADERBOARD
                </Link>
              </div>
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

        {/* ── HOW IT WORKS ── */}
        <section className={styles.howItWorks}>
          <div className="container">
            <div className={styles.sectionCenter}>
              <h2 className={styles.sectionTitle}>
                ROAD TO GRAND FINALS
              </h2>
              <p className={styles.sectionSubtitle}>
                Four structured steps from signup to championship glory
              </p>
            </div>

            <div className={styles.stepsGrid}>
              {[
                {
                  num: '01',
                  step: 'STEP 01',
                  title: 'SIGN UP & SQUAD UP',
                  desc: 'Log in via secure email OTP, create your roster, and invite your teammates.',
                  Icon: Users,
                },
                {
                  num: '02',
                  step: 'STEP 02',
                  title: 'REGISTER FOR SLOTS',
                  desc: 'Select preferred daily match slots with instant registration confirmation.',
                  Icon: Calendar,
                },
                {
                  num: '03',
                  step: 'STEP 03',
                  title: 'GRIND & DOMINATE',
                  desc: '3 matches per slot. Play as many slots as you want: only your top 5 slot scores (15 matches) count.',
                  Icon: Crosshair,
                },
                {
                  num: '04',
                  step: 'STEP 04',
                  title: 'EARN REWARDS & QUALIFY',
                  desc: 'Prize pool rewards distributed after slot completion. Top 16 overall teams advance to FREE Grand Finals.',
                  Icon: Trophy,
                },
              ].map((s) => (
                <div key={s.step} className={styles.stepCard}>
                  <div className={styles.stepBgNum}>{s.num}</div>
                  <div className={styles.stepHeader}>
                    <s.Icon className={styles.stepIconLucide} size={20} color="#facc15" strokeWidth={2} />
                    <span className={styles.stepNum}>{s.step}</span>
                  </div>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepDesc}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

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

        {/* ── SCORING FORMAT ── */}
        <section className={styles.scoringSection}>
          <div className="container">
            <div className={styles.scoringInner}>
              <div>
                <h2 className={styles.sectionTitle}>BGIS SCORING SYSTEM</h2>
                <p className={styles.scoringDesc}>
                  Official esports placement point system + 1 point per elimination. Play unlimited slots without penalty: our system automatically aggregates your <strong>Best 5 Slots (15 Matches total)</strong>.
                </p>
                <div className={styles.scoringFeatures}>
                  {[
                    '1st Place = 10 Placement Points',
                    '1 Elimination = 1 Point',
                    'Unlimited Slot Re-entry allowed',
                    'Best 5 Slots (15 Matches) auto-calculation',
                    'Off-days do not hurt your overall rank',
                  ].map(f => (
                    <div key={f} className={styles.scoringFeature}>
                      <Check size={16} color="#facc15" style={{ flexShrink: 0 }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/leaderboard" className={styles.secondaryCta} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <span>VIEW STANDINGS</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
              <div className={styles.scoringTable}>
                <h3 className={styles.tableHeading}>Placement Point Table</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Placement</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['1st Place', '10 Pts'], ['2nd Place', '6 Pts'], ['3rd Place', '5 Pts'], ['4th Place', '4 Pts'],
                      ['5th Place', '3 Pts'], ['6th–10th', '2 Pts'], ['11th–15th', '1 Pt'], ['16th–24th', '0 Pts'],
                    ].map(([p, pts]) => (
                      <tr key={p}>
                        <td>{p}</td>
                        <td style={{ color: '#fbbf24', fontWeight: '800' }}>{pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUSTED INFRASTRUCTURE STRIP ── */}
        <section className={styles.infraSection}>
          <div className="container">
            <div className={styles.infraContainer}>
              <span className={styles.infraLabel}>TRUSTED INFRASTRUCTURE</span>
              <div className={styles.infraGrid}>
                {/* Razorpay */}
                <div className={styles.infraItem}>
                  <span className={styles.infraCaption}>PAYMENTS SECURED BY</span>
                  <img
                    src="/photos/razorpaywhite.png"
                    alt="Razorpay"
                    className={styles.infraLogo}
                  />
                </div>

                {/* Divider */}
                <div className={styles.infraDivider} />

                {/* Vercel */}
                <div className={styles.infraItem}>
                  <span className={styles.infraCaption}>DEPLOYED ON</span>
                  <img
                    src="/photos/vercel.png"
                    alt="Vercel"
                    className={styles.infraLogoVercel}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
    </main>
  )
}
