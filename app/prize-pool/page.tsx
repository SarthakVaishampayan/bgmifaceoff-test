export const dynamic = 'force-dynamic'

import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import styles from './page.module.css'
import {
  Trophy,
  Medal,
  Award,
  CreditCard,
  Sparkles,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Prize Pool & Rewards | BGFS',
  description: 'Explore the tournament prize structure and how captains configure UPI for instant payouts.',
}

export default async function PrizePoolPage() {
  const supabase = await createClient()

  // Fetch live config values
  const { data: configRows } = await supabase
    .from('config')
    .select('key, value')
    .in('key', [
      'slot_first_prize',
      'slot_second_prize',
      'slot_third_prize',
      'slot_entry_fee',
    ])

  const config: Record<string, string> = {}
  configRows?.forEach(r => { config[r.key] = r.value })

  const firstPrize = parseInt(config.slot_first_prize || '160', 10)
  const secondPrize = parseInt(config.slot_second_prize || '80', 10)
  const thirdPrize = parseInt(config.slot_third_prize || '60', 10)

  return (
    <div className={styles.container}>
      {/* ── HERO SECTION ── */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <Sparkles size={14} /> Official Reward Policy
        </div>
        <h1 className={styles.heroTitle}>
          TOURNAMENT <span className={styles.heroTitleHighlight}>PRIZE POOL</span> &amp; REWARDS
        </h1>
        <p className={styles.heroSubtitle}>
          Every slot has guaranteed rewards: instant cash payouts sent directly via UPI to top 3 squads, and automated 100% Free Slot passes for 4th place finishers.
        </p>
      </section>

      {/* ── STANDARD MATCHDAYS ── */}
      <section style={{ marginBottom: '2.5rem', background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '16px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0, color: '#60a5fa' }}>
            <Trophy size={22} color="#60a5fa" /> Standard Matchday Rewards
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #d97706', color: '#fbbf24', fontSize: '0.78rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
              Slot Prize Pool = ₹900
            </span>
            <span style={{ background: '#2563eb', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '999px', textTransform: 'uppercase' }}>
              🏆 ₹40 Entry
            </span>
          </div>
        </div>
        <p className={styles.sectionSubtitle} style={{ marginBottom: '1.25rem' }}>
          Entry fee: <strong style={{ color: '#60a5fa', fontSize: '1.05rem' }}>₹40</strong> / team · 3 matches per slot · up to 20 teams · top 4 get rewarded.
        </p>

        <div className={styles.podiumGrid}>
          {/* 1st Place */}
          <div className={`${styles.prizeCard} ${styles.prizeCardGold}`}>
            <div className={`${styles.rankBadge} ${styles.rankBadgeGold}`}>
              <Trophy size={13} /> 1st Place (Champion)
            </div>
            <div className={styles.rewardAmount} style={{ color: '#60a5fa' }}>₹{firstPrize}</div>
            <div className={styles.rewardType}>Instant UPI Cash Reward</div>
            <p className={styles.rewardDesc}>
              Transferred directly to the winning captain's verified UPI ID right after match score verification.
            </p>
          </div>

          {/* 2nd Place */}
          <div className={`${styles.prizeCard} ${styles.prizeCardSilver}`}>
            <div className={`${styles.rankBadge} ${styles.rankBadgeSilver}`}>
              <Medal size={13} /> 2nd Place (Runner-Up)
            </div>
            <div className={styles.rewardAmount}>₹{secondPrize}</div>
            <div className={styles.rewardType}>Instant UPI Cash Reward</div>
            <p className={styles.rewardDesc}>
              Disbursed directly via UPI with an official settlement receipt on the platform.
            </p>
          </div>

          {/* 3rd Place */}
          <div className={`${styles.prizeCard} ${styles.prizeCardBronze}`}>
            <div className={`${styles.rankBadge} ${styles.rankBadgeBronze}`}>
              <Award size={13} /> 3rd Place (Podium)
            </div>
            <div className={styles.rewardAmount} style={{ color: '#4ade80' }}>₹{thirdPrize}</div>
            <div className={styles.rewardType}>Instant UPI Cash Reward</div>
            <p className={styles.rewardDesc}>
              Cash prize sent directly to captain's verified UPI ID after match score verification.
            </p>
          </div>

          {/* 4th Place */}
          <div className={`${styles.prizeCard} ${styles.prizeCardBronze}`} style={{ opacity: 0.85 }}>
            <div className={`${styles.rankBadge} ${styles.rankBadgeBronze}`}>
              <Award size={13} /> 4th Place
            </div>
            <div className={styles.rewardAmount} style={{ color: '#4ade80' }}>FREE</div>
            <div className={styles.rewardType}>Tournament Slot Pass</div>
            <p className={styles.rewardDesc}>
              Automated single-use coupon code generated instantly for ₹0 entry on any upcoming slot.
            </p>
          </div>
        </div>

        {/* ── SPECIAL ACHIEVEMENT PRIZE CARD ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(220, 38, 38, 0.08) 100%)',
          border: '1px solid rgba(249, 115, 22, 0.45)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginTop: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.3rem' }}>🔥</span>
              <strong style={{ color: '#ffedd5', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
                Special Achievement Prize
              </strong>
            </div>
            <div style={{ background: '#ea580c', color: '#ffffff', fontSize: '0.85rem', fontWeight: 900, padding: '3px 10px', borderRadius: '6px' }}>
              ₹560 CASH BOUNTY
            </div>
          </div>
          <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1.05rem', marginTop: '4px' }}>
            B2B 3 Chicken Dinners + 50 Kills = ₹560
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#a1a1aa', lineHeight: '1.5' }}>
            Dominate all 3 matches of the slot back-to-back with 50+ total team finishes to unlock the ₹560 jackpot prize!
          </p>
        </div>
      </section>

      {/* ── CONCISE UPI SETUP BOX ── */}
      <section className={styles.guideSection} style={{ borderLeft: '4px solid #22c55e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <CreditCard size={20} color="#22c55e" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            How to Set Up Your UPI ID for Cash Payouts
          </h2>
        </div>
        <p style={{ color: '#a1a1aa', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
          Ensure your captain account has a valid UPI ID saved so prize disbursements are sent immediately after matches.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#18181b', padding: '1rem', borderRadius: '10px', border: '1px solid #27272a' }}>
            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px' }}>1. Go to Your Profile</div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>
              Sign in and visit your Profile page.
            </p>
          </div>

          <div style={{ background: '#18181b', padding: '1rem', borderRadius: '10px', border: '1px solid #27272a' }}>
            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px' }}>2. Enter UPI ID</div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>
              Add your active UPI handle (e.g. <code style={{ color: '#4ade80' }}>yourname@oksbi</code>) &amp; click <strong>Save</strong>.
            </p>
          </div>

          <div style={{ background: '#18181b', padding: '1rem', borderRadius: '10px', border: '1px solid #27272a' }}>
            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px' }}>3. Receive Direct Cash</div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>
              Rank in the top 3 to get prize money sent directly to your UPI post-match!
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/profile" className="btn btn-primary" style={{ background: '#22c55e', color: '#000000', fontWeight: 800 }}>
            Open Profile to Add UPI ID →
          </Link>
        </div>
      </section>
    </div>
  )
}
