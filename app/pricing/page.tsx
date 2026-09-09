import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Zap, Shield, Repeat } from 'lucide-react'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Pricing | BGFS',
  description: 'BGFS tournament entry fee: ₹50 per slot, 3 matches per slot, no cap on slots per team.',
}

export default function PricingPage() {
  const included = [
    '3 competitive matches in your chosen time slot',
    'Access to that slot\'s in-game room credentials via WhatsApp',
    'Scores recorded and reflected on the public leaderboard',
    'Qualifies toward your Best-16 seasonal score',
    'Eligible for slot rewards (₹250 / ₹150 / Free Slot Pass)',
    'Grand Finals qualification tracking (top 16 overall teams)',
  ]

  const faqs = [
    {
      q: 'Can a team register for more than one slot?',
      a: 'Yes, there is no cap on how many slots a team can register for across the season. The more slots you play, the more chances your best scores have to count toward your Best-16 ranking.',
    },
    {
      q: 'Is there an entry fee for the Grand Finals?',
      a: 'No. The Grand Finals is completely free for the top 16 qualifying teams. There is no additional payment required to participate in the Grand Finals weekend.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'All UPI apps (GPay, PhonePe, Paytm, BHIM), Debit/Credit Cards, and Net Banking via secure payment gateway.',
    },
    {
      q: 'Are refunds available?',
      a: 'Slot fees are non-refundable once registered and confirmed, except in the case of a tournament cancellation by BGFS. See our Refund Policy for full details.',
    },
  ]

  return (
    <main className={styles.page}>
      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Transparent Pricing</p>
          <h1 className={styles.heroTitle}>
            Simple. <span className={styles.gold}>Flat. Fair.</span>
          </h1>
          <p className={styles.heroDesc}>
            One entry fee. Three matches. Unlimited opportunities to climb the leaderboard.
          </p>
        </div>
      </section>

      {/* ── PRICE CARD ── */}
      <section className={styles.section}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p className={styles.priceTag}>₹50</p>
            <p className={styles.priceTagSub}>per slot · per team</p>
          </div>

          <div className={styles.pricingCard}>
            <p className={styles.pricingCardTitle}>What&rsquo;s Included in Each Slot</p>
            <p className={styles.pricingCardSub}>Every ₹50 entry unlocks the following for your team</p>

            <ul className={styles.priceList}>
              {included.map(item => (
                <li key={item}>
                  <Check size={16} className={styles.checkIcon} strokeWidth={2.5} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/slots"
              className="btn btn-primary"
              style={{
                width: '100%',
                background: '#facc15',
                color: '#111111',
                fontWeight: 800,
                textTransform: 'uppercase',
                justifyContent: 'center',
              }}
            >
              REGISTER FOR A SLOT NOW
            </Link>
          </div>
        </div>
      </section>

      {/* ── VALUE PROPS ── */}
      <section className={`${styles.section} ${styles.altBg}`}>
        <div className="container">
          <div className={styles.sectionCenter} style={{ marginBottom: '2.5rem' }}>
            <p className={styles.sectionEyebrow}>Why It Works</p>
            <h2 className={styles.sectionTitle}>No Tricks. No Hidden Fees.</h2>
          </div>

          <div className="grid-3">
            {[
              {
                Icon: Repeat,
                title: 'No Slot Cap',
                desc: 'Register for as many slots as you want across the season. Only your best 16 match scores count.',
              },
              {
                Icon: Zap,
                title: 'Payouts After Slot Completion',
                desc: 'Slot prize money is paid directly to winners via UPI after slot completion: no waiting.',
              },
              {
                Icon: Shield,
                title: 'Free Grand Finals',
                desc: 'Top 16 teams qualify for the Grand Finals weekend at zero additional cost.',
              },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className={styles.featureCard} style={{ flexDirection: 'column', gap: '0.85rem' }}>
                <div className={styles.iconBox} style={{ width: 'fit-content' }}>
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

      {/* ── FAQ ── */}
      <section className={styles.section}>
        <div className={styles.legalContent} style={{ margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p className={styles.sectionEyebrow}>FAQs</p>
            <h2 className={styles.sectionTitle}>Common Pricing Questions</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {faqs.map(({ q, a }) => (
              <div key={q} className={styles.contactCard}>
                <h3 style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '0.5rem',
                }}>
                  {q}
                </h3>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                  color: '#888888',
                  lineHeight: 1.65,
                }}>
                  {a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
