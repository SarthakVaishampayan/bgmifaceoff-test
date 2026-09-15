'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Users,
  Calendar,
  CreditCard,
  LayoutDashboard,
  Wallet,
  Trophy,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Lock,
  Flame,
  Search
} from 'lucide-react'
import styles from './HowItWorks.module.css'

export default function HowItWorks() {
  const [activeTab, setActiveTab] = useState(0)

  const steps = [
    {
      id: '01',
      tabLabel: 'Account',
      tag: 'STEP 01',
      category: 'CREATE YOUR TEAM ACCOUNT',
      headline: 'ONE TEAM. ONE LOGIN.',
      headlineHighlight: 'ONE LOGIN.',
      description: 'Zero verification queues or complex forms. Register your squad in under 30 seconds.',
      points: [
        {
          title: 'TEAM NAME',
          desc: 'Your squad identity on every leaderboard, match bracket, and slot result.',
          icon: Users,
        },
        {
          title: 'EMAIL + PASSWORD',
          desc: 'One captain account manages the whole squad, registers slots, and collects prizes.',
          icon: Lock,
        },
        {
          title: '30 SECONDS',
          desc: 'No documents or verification queue required. Instant onboarding.',
          icon: Zap,
        },
      ],
      warning: {
        title: 'HEADS UP',
        desc: 'Team name can be changed only once after signup — then it is permanently locked.',
      },
      ctaText: 'CREATE TEAM ACCOUNT',
      ctaHref: '/register',
      // Screen simulation
      screenType: 'account',
    },
    {
      id: '02',
      tabLabel: 'Book Slot',
      tag: 'STEP 02',
      category: 'PICK YOUR SLOT & REGISTER',
      headline: '3 MATCHES PER SLOT',
      headlineHighlight: 'PER SLOT',
      description: 'Choose your preferred match timings. Join live daily rooms with instant registration confirmation.',
      points: [
        {
          title: 'LIVE SPOT COUNT',
          desc: 'Max 20 teams per room — see available spots left in real time.',
          icon: Users,
        },
        {
          title: 'REGISTERED TAG',
          desc: 'Booked slots flip green instantly on your dashboard.',
          icon: CheckCircle2,
        },
        {
          title: 'ROOM ID & PASS',
          desc: 'Delivered directly to your captain WhatsApp 10 minutes before match time.',
          icon: Zap,
        },
      ],
      warning: null,
      ctaText: 'BROWSE MATCH SLOTS',
      ctaHref: '/slots',
      screenType: 'slots',
    },
    {
      id: '03',
      tabLabel: 'Pay',
      tag: 'STEP 03',
      category: 'PAY & LOCK THE SLOT',
      headline: 'UPI IN ONE TAP',
      headlineHighlight: 'ONE TAP',
      description: 'Fast, secure slot checkout powered by Razorpay. Zero manual screenshot approvals.',
      points: [
        {
          title: 'SECURED BY RAZORPAY',
          desc: 'Pay via Google Pay, PhonePe, Paytm, CRED, or any UPI app instantly.',
          icon: ShieldCheck,
        },
        {
          title: 'INSTANT CONFIRMATION',
          desc: 'Immediate payment receipt and your slot status switches to CONFIRMED right away.',
          icon: CheckCircle2,
        },
        {
          title: 'FLAT ENTRY',
          desc: 'Clean, transparent slot entry fee with 100% of room rewards distributed.',
          icon: CreditCard,
        },
      ],
      warning: null,
      ctaText: 'REGISTER FOR A SLOT',
      ctaHref: '/slots',
      screenType: 'payment',
    },
    {
      id: '04',
      tabLabel: 'Dashboard',
      tag: 'STEP 04',
      category: 'YOUR TEAM DASHBOARD',
      headline: 'RANK, SLOTS & TOP 6',
      headlineHighlight: 'TOP 6',
      description: 'Track all your active bookings, match stats, standings, and Best 6 calculation in real time.',
      points: [
        {
          title: 'LIVE RANK',
          desc: 'Total points, total matches played, and qualifying cutoff status.',
          icon: Trophy,
        },
        {
          title: 'ALL YOUR SLOTS',
          desc: 'Active and past match rooms with assigned room number and direct WhatsApp group link.',
          icon: Calendar,
        },
        {
          title: 'TOP 6 SLOTS SYSTEM',
          desc: 'Per-match placement, eliminations, and highest points that count towards finals.',
          icon: Flame,
        },
      ],
      warning: null,
      ctaText: 'OPEN DASHBOARD',
      ctaHref: '/dashboard',
      screenType: 'dashboard',
    },
    {
      id: '05',
      tabLabel: 'Payout',
      tag: 'STEP 05',
      category: 'PROFILE & PAYOUT DETAILS',
      headline: 'WIN. GET PAID.',
      headlineHighlight: 'GET PAID.',
      description: 'Set your UPI ID and holder name once — slot rewards land straight in your bank account.',
      points: [
        {
          title: 'CHOOSE YOUR UPI',
          desc: 'Any UPI ID (e.g. yourname@oksbi, yourname@ybl) you want cash rewards sent to.',
          icon: Wallet,
        },
        {
          title: 'HOLDER NAME',
          desc: 'Must match the registered bank UPI account for smooth automated payouts.',
          icon: Users,
        },
        {
          title: 'UPDATE ANYTIME',
          desc: 'Update your UPI credentials or account password from Settings whenever needed.',
          icon: Zap,
        },
        {
          title: 'REWARDS PER SLOT',
          desc: 'Top teams in every room earn cash, credited directly to your UPI handle.',
          icon: Trophy,
        },
      ],
      warning: {
        title: 'PAYOUT NOTICE',
        desc: 'Provide the correct UPI ID and account holder name to avoid payout delays.',
      },
      ctaText: 'UPDATE PAYOUT PROFILE',
      ctaHref: '/profile',
      screenType: 'payout',
    },
    {
      id: '06',
      tabLabel: 'Leaderboard',
      tag: 'SEASON 01',
      category: 'EVERYTHING FEEDS THE LEADERBOARD',
      headline: 'GRIND YOUR WAY IN',
      headlineHighlight: 'YOUR WAY IN',
      description: 'Public standings update after every slot. Search any team, inspect room results, and see where you stand.',
      points: [
        {
          title: 'TOP 6 SLOTS SCORING',
          desc: 'Placement plus elimination points calculated automatically from your strongest 6 slots (18 matches).',
          icon: Flame,
        },
        {
          title: 'SLOT-BY-SLOT RESULTS',
          desc: 'Every room, every match, every kill and prize reward is 100% public and verifiable.',
          icon: Search,
        },
        {
          title: 'QUALIFIED BADGE',
          desc: 'Hold a top-16 spot on the leaderboard and you advance to the Grand Finals for FREE.',
          icon: Trophy,
        },
      ],
      warning: {
        title: 'GRAND FINALS ACCESS',
        desc: 'Top 16 squads on the final cutoff date compete for ₹20,000 + the physical BGFS Trophy.',
      },
      ctaText: 'VIEW LIVE LEADERBOARD',
      ctaHref: '/leaderboard',
      screenType: 'leaderboard',
    },
  ]

  const current = steps[activeTab]

  return (
    <section className={styles.howSection} id="how-it-works">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>HOW IT WORKS</h2>

          {/* Flow Indicator Pill */}
          <div className={styles.flowRow}>
            <span className={styles.flowPill}>SIGN UP</span>
            <span className={styles.flowArrow}>→</span>
            <span className={styles.flowPill}>BOOK</span>
            <span className={styles.flowArrow}>→</span>
            <span className={styles.flowPill}>GRIND</span>
            <span className={styles.flowArrow}>→</span>
            <span className={styles.flowPill} style={{ color: '#fbbf24', borderColor: '#fbbf24' }}>GET PAID</span>
          </div>

          <p className={styles.subtitle}>
            A full walkthrough of the BGFS platform — from creating your team account to receiving your prize payout.
          </p>
        </div>

        {/* Step Tabs Navigation */}
        <div className={styles.tabsContainer}>
          {steps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(idx)}
              className={`${styles.tabBtn} ${activeTab === idx ? styles.tabActive : ''}`}
            >
              <span className={styles.tabNum}>{s.id}</span>
              <span>{s.tabLabel}</span>
            </button>
          ))}
        </div>

        {/* Active Step Content Card */}
        <div className={styles.contentCard}>
          {/* Left Column: Details & Points */}
          <div className={styles.leftContent}>
            <div className={styles.stepHeaderRow}>
              <span className={styles.stepTag}>// BGFS {current.tag}</span>
              <span className={styles.stepIndicator}>STEP {activeTab + 1} OF {steps.length}</span>
            </div>

            <div className={styles.stepNumberBig}>{current.id}</div>
            <div className={styles.stepCategory}>{current.category}</div>
            <h3 className={styles.stepHeadline}>
              {current.headline.replace(current.headlineHighlight, '')}
              <span className={styles.stepHeadlineHighlight}>{current.headlineHighlight}</span>
            </h3>

            <p className={styles.stepDescription}>{current.description}</p>

            {/* Feature Points */}
            <div className={styles.featureList}>
              {current.points.map((pt, pIdx) => {
                const Icon = pt.icon
                return (
                  <div key={pIdx} className={styles.featureRow}>
                    <div className={styles.featureIconBox}>
                      <Icon size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className={styles.featureTitle}>{pt.title}</div>
                      <p className={styles.featureDesc}>{pt.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Warning Callout Box if present */}
            {current.warning && (
              <div className={styles.warningBox}>
                <div className={styles.warningHeading}>⚠ {current.warning.title}</div>
                <p className={styles.warningText}>{current.warning.desc}</p>
              </div>
            )}

            {/* Card Footer Navigation */}
            <div className={styles.cardNavFooter}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setActiveTab((prev) => Math.max(0, prev - 1))}
                  disabled={activeTab === 0}
                  className={styles.navActionBtn}
                  aria-label="Previous step"
                >
                  <ArrowLeft size={16} />
                  <span>PREV</span>
                </button>
                <button
                  onClick={() => setActiveTab((prev) => Math.min(steps.length - 1, prev + 1))}
                  disabled={activeTab === steps.length - 1}
                  className={styles.navActionBtn}
                  aria-label="Next step"
                >
                  <span>NEXT</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              <Link href={current.ctaHref} className={styles.directCta}>
                <span>{current.ctaText}</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Right Column: High-Fidelity Simulated Phone Screen */}
          <div className={styles.rightMockup}>
            <div className={styles.phoneFrame}>
              <div className={styles.phoneNotch} />

              <div className={styles.mockupScreen}>
                <div className={styles.mockupHeader}>
                  <span className={styles.mockupBrand}>BGFS PLATFORM</span>
                  <span className={`${styles.mockupBadge} ${styles.mockupBadgeGreen}`}>LIVE</span>
                </div>

                {/* Simulation based on current.screenType */}
                {current.screenType === 'account' && (
                  <>
                    <div className={styles.mockupCard}>
                      <div className={styles.mockupCardTitle}>Create Team Account</div>
                      <div className={styles.mockupInput}>TEAM NAME: Team Nemesis</div>
                      <div className={styles.mockupInput}>CAPTAIN EMAIL: captain@bgfs.in</div>
                      <div className={styles.mockupInput}>PASSWORD: ••••••••••••</div>
                      <div className={styles.mockupBtnGold}>CREATE ACCOUNT &amp; CONTINUE →</div>
                    </div>
                    <div className={styles.mockupCard}>
                      <div className={styles.mockupStatRow}>
                        <span>Verification Queue</span>
                        <span className={styles.mockupStatValGold}>0 SEC (INSTANT)</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Roster Lock</span>
                        <span className={styles.mockupStatVal}>AUTOMATIC</span>
                      </div>
                    </div>
                  </>
                )}

                {current.screenType === 'slots' && (
                  <>
                    <div className={styles.mockupCardActive}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={styles.mockupCardTitle}>DAILY SLOT #04</span>
                        <span className={styles.mockupBadgeGreen}>REGISTERED</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Schedule</span>
                        <span className={styles.mockupStatVal}>9:00 PM – 11:00 PM</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Format</span>
                        <span className={styles.mockupStatValGold}>3 MATCHES (E / M / E)</span>
                      </div>
                      <div className={styles.mockupBtnGreen}>
                        <span>JOIN WHATSAPP GROUP</span>
                      </div>
                    </div>

                    <div className={styles.mockupCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={styles.mockupCardTitle}>LATE NIGHT SLOT #05</span>
                        <span className={styles.mockupBadge}>4 SPOTS LEFT</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Schedule</span>
                        <span className={styles.mockupStatVal}>11:00 PM – 1:00 AM</span>
                      </div>
                    </div>
                  </>
                )}

                {current.screenType === 'payment' && (
                  <>
                    <div className={styles.mockupCardActive}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={styles.mockupCardTitle}>RAZORPAY SECURE UPI</span>
                        <span className={styles.mockupBadgeGreen}>256-BIT SSL</span>
                      </div>
                      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#4ade80' }}>✓</div>
                        <div style={{ fontWeight: '800', color: '#ffffff', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                          PAYMENT SUCCESSFUL
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#a3a3a3', marginTop: '0.2rem' }}>
                          Slot locked &amp; confirmed instantly
                        </div>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Method</span>
                        <span className={styles.mockupStatVal}>GPay / PhonePe / UPI</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Status</span>
                        <span className={styles.mockupStatValGold}>CONFIRMED</span>
                      </div>
                    </div>
                  </>
                )}

                {current.screenType === 'dashboard' && (
                  <>
                    <div className={styles.mockupCardActive}>
                      <div className={styles.mockupCardTitle}>OVERALL STANDINGS</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.4rem 0' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '900', color: '#fbbf24' }}>#1</span>
                        <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: '800' }}>QUALIFIED SPOT</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Best 6 Slots Total</span>
                        <span className={styles.mockupStatValGold}>123 PTS</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Matches Counted</span>
                        <span className={styles.mockupStatVal}>18 MATCHES</span>
                      </div>
                    </div>

                    <div className={styles.mockupCard}>
                      <div className={styles.mockupCardTitle}>TOP 6 SLOTS BREAKDOWN</div>
                      <div className={styles.mockupStatRow}>
                        <span>Slot #12 (Sun 9 PM)</span>
                        <span className={styles.mockupStatValGold}>52 PTS</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Slot #08 (Fri 7 PM)</span>
                        <span className={styles.mockupStatValGold}>41 PTS</span>
                      </div>
                    </div>
                  </>
                )}

                {current.screenType === 'payout' && (
                  <>
                    <div className={styles.mockupCardActive}>
                      <div className={styles.mockupCardTitle}>PAYOUT DETAILS (UPI)</div>
                      <div className={styles.mockupInput}>UPI ID: teamcaptain@oksbi</div>
                      <div className={styles.mockupInput}>HOLDER: Team Captain Name</div>
                      <div className={styles.mockupStatRow} style={{ marginTop: '0.5rem' }}>
                        <span>Payout Mode</span>
                        <span className={styles.mockupStatValGold}>DIRECT BANK UPI</span>
                      </div>
                      <div className={styles.mockupStatRow}>
                        <span>Verification</span>
                        <span className={styles.mockupStatVal} style={{ color: '#4ade80' }}>VERIFIED ✓</span>
                      </div>
                      <div className={styles.mockupBtnGold}>SAVE &amp; LOCK CREDENTIALS</div>
                    </div>
                  </>
                )}

                {current.screenType === 'leaderboard' && (
                  <>
                    <div className={styles.mockupCardActive}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={styles.mockupCardTitle}>SEASON 1 STANDINGS</span>
                        <span className={styles.mockupBadgeGreen}>TOP 16 ADVANCE</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                        <div className={styles.mockupStatRow} style={{ background: '#171717', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                          <span style={{ fontWeight: '800', color: '#fbbf24' }}>#1 TEAM TEST1</span>
                          <span className={styles.mockupStatValGold}>123 PTS (QUALIFIED)</span>
                        </div>
                        <div className={styles.mockupStatRow} style={{ background: '#171717', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                          <span style={{ fontWeight: '800', color: '#ffffff' }}>#2 TEST2</span>
                          <span className={styles.mockupStatValGold}>43 PTS (QUALIFIED)</span>
                        </div>
                        <div className={styles.mockupStatRow} style={{ background: '#171717', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                          <span style={{ fontWeight: '800', color: '#ffffff' }}>#3 SOUL SQUAD</span>
                          <span className={styles.mockupStatValGold}>31 PTS (QUALIFIED)</span>
                        </div>
                      </div>
                      <div className={styles.mockupBtnGold} style={{ marginTop: '0.5rem' }}>
                        SEARCH ANY SQUAD / RESULT
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
