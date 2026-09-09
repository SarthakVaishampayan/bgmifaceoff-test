import type { Metadata } from 'next'
import { ShieldCheck, Award, Zap, Crosshair, AlertTriangle } from 'lucide-react'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Fair Play & Skill-Based Gaming Policy | BGFS',
  description: 'Battlegrounds Faceoff Series Fair Play Policy: explicit disclosures regarding skill-based esports competition, anti-cheat, and compliance.',
}

export default function FairPlayPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Compliance &amp; Ethics</p>
          <h1 className={styles.heroTitle}>
            Fair Play &amp; <span className={styles.gold}>Skill-Based Gaming</span>
          </h1>
          <p className={styles.heroDesc}>
            BGFS operates strictly as a skill-based esports tournament platform. Match outcomes are determined entirely by player skill, strategy, and in-game performance.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.legalContent}>
            <p className={styles.legalMeta}>Last updated: August 2026 · Official BGFS Skill-Based Gaming Declaration</p>

            {/* ── SECTION 1 ── */}
            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>1. Game of Skill Classification</h2>
              <p className={styles.legalBody}>
                Battlegrounds Mobile India (BGMI) competitive tournaments hosted on BGFS are classified as{' '}
                <strong style={{ color: '#ffffff' }}>Games of Skill</strong> under Indian law.
              </p>
              <p className={styles.legalBody}>
                In accordance with the jurisprudence established by the Supreme Court of India under Article 19(1)(g) of the Constitution, a &quot;Game of Skill&quot; is one where the element of skill predominates over the element of chance. Success in BGMI matches depends on:
              </p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Mechanical Skill &amp; Precision:</strong> Recoil control, aiming accuracy, reflexes, and movement mechanics.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Tactical Strategy &amp; Positioning:</strong> Zone prediction, map movement, high-ground control, and rotational awareness.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Team Synergy &amp; Communication:</strong> Squad calls, role specialization (IGL, Assaulter, Support, Scout), and utility usage.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Survival &amp; Placement Optimization:</strong> Engaging in favorable fights and maintaining placement positioning.</span></li>
              </ul>
            </div>

            <hr className={styles.legalDivider} />

            {/* ── SECTION 2 ── */}
            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>2. Strict No-Gambling / No-Betting Policy</h2>
              <p className={styles.legalBody}>
                BGFS is <strong style={{ color: '#fbbf24' }}>NOT a gambling, betting, or wagering platform</strong>.
              </p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span>We do NOT support or facilitate betting, live odds, wagers, or chance-based gambling.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Participants do NOT place bets or wager money against other players.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Slot fees represent fixed match entry fees for participating in organized tournament matches.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Prizes are predetermined tournament prize pools awarded strictly to top-ranked teams based on transparent BGIS match scoring.</span></li>
              </ul>
            </div>

            <hr className={styles.legalDivider} />

            {/* ── SECTION 3 ── */}
            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>3. Anti-Cheat &amp; Integrity Enforcement</h2>
              <p className={styles.legalBody}>
                To maintain equal footing and competitive integrity for all participants, BGFS enforces a zero-tolerance policy against unfair advantages:
              </p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>No Emulators / PC Modifiers:</strong> Matches must be played exclusively on mobile devices (iOS / Android).</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>No Third-Party Hacks or Scripts:</strong> Use of ESP, aimbot, wallhacks, or modified APKs results in immediate permanent ban and forfeiture of points.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>No Teaming or Collusion:</strong> Squads found teaming with opponent teams will be disqualified immediately.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Roster Lock Verification:</strong> In-game player IDs must match registered squad rosters.</span></li>
              </ul>
            </div>

            <hr className={styles.legalDivider} />

            {/* ── SECTION 4 ── */}
            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>4. Transparent BGIS Point Structure</h2>
              <p className={styles.legalBody}>
                Match outcomes are evaluated transparently using official BGIS scoring standards:
              </p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Placement Points:</strong> 1st Place (10 pts), 2nd Place (6 pts), 3rd Place (5 pts), 4th Place (4 pts), 5th Place (3 pts), 6th–10th (2 pts), 11th–15th (1 pt).</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Elimination Points:</strong> 1 Point per verified in-game elimination.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Best 5 Slots Aggregate:</strong> Leaderboard rankings automatically calculate a team&apos;s best 5 slot scores (15 matches total) across the cycle.</span></li>
              </ul>
            </div>

            <hr className={styles.legalDivider} />

            {/* ── SECTION 5 ── */}
            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>5. Operator Information &amp; Support</h2>
              <p className={styles.legalBody}>
                Battlegrounds Faceoff Series (BGFS) is operated in India as a dedicated esports tournament platform.
              </p>
              <p className={styles.legalBody}>
                For any compliance, rule clarification, or match support inquiries:
              </p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Email Support:</strong> <a href="mailto:battlegroundsfaceoffseries@gmail.com" style={{ color: '#fbbf24' }}>battlegroundsfaceoffseries@gmail.com</a></span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>WhatsApp Support:</strong> <a href="https://wa.me/916388024698?text=Hi%20BGFS%20Support%2C%20I%20have%20a%20query%20regarding%20fair%20play." target="_blank" rel="noopener noreferrer" style={{ color: '#22c55e' }}>+91 63880 24698</a></span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Hours:</strong> 10:00 AM to 8:00 PM IST (All Days)</span></li>
              </ul>
            </div>

            <div className={styles.noteBox}>
              <p>
                <strong style={{ color: '#fbbf24' }}>Legal Notice:</strong> Battlegrounds Faceoff Series (BGFS) is an independent esports platform. BGMI and related game assets are trademarks of Krafton Inc. BGFS is not officially affiliated with or sponsored by Krafton.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
