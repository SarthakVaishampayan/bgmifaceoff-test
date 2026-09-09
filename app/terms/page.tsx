import type { Metadata } from 'next'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Terms & Conditions — BGFS',
  description: 'Battlegrounds Faceoff Series Terms & Conditions — tournament participation rules, eligibility, conduct, and policies.',
}

export default function TermsPage() {
  return (
    <main className={styles.page}>
      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Legal</p>
          <h1 className={styles.heroTitle}>
            Terms &amp; <span className={styles.gold}>Conditions</span>
          </h1>
          <p className={styles.heroDesc}>
            Please read these terms carefully before participating in any BGFS tournament slot.
          </p>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.legalContent}>
            <p className={styles.legalMeta}>Last updated: August 2026 · Applies to all BGFS Season 1 participants</p>

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>1. Acceptance of Terms</h2>
              <p className={styles.legalBody}>
                By registering an account, booking a match slot, or participating in any activity on
                the Battlegrounds Faceoff Series (BGFS) platform, you agree to be bound by these
                Terms &amp; Conditions. If you do not agree, you must not use the platform or
                participate in any BGFS tournament.
              </p>
            </div>

            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>2. Eligibility</h2>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span>Participants must be 13 years of age or older. Players under 18 must have parental or guardian consent.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Participants must have a valid BGMI (Battlegrounds Mobile India) game account in good standing.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Only one account per player is permitted. Duplicate accounts will result in immediate disqualification.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Participants must reside in India and play on the India server.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>BGFS reserves the right to verify eligibility at any time and refuse participation to any player without explanation.</span></li>
              </ul>
            </div>

            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>3. Team &amp; Roster Rules</h2>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span>Each team must have a designated captain who holds the registered account and is responsible for all bookings and payments.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Roster lock applies 24 hours before a booked slot.</strong> Teams cannot change their in-game roster after roster lock.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Player substitutions after roster lock are only permitted in case of a verified emergency and must be approved by BGFS admin.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Teams must use the same registered team name and in-game name during all matches. Impersonation of other teams will result in disqualification.</span></li>
              </ul>
            </div>

            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>4. Code of Conduct</h2>
              <p className={styles.legalBody}>
                All participants are expected to maintain sportsmanlike conduct at all times.
                The following actions are strictly prohibited:
              </p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span>Using any hacks, cheats, mods, emulators, or third-party software that provides an unfair advantage.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Teaming with opponents from outside your squad during a match.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Abusive, harassing, or discriminatory communication in any BGFS channel or community.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Deliberately losing a match, match-fixing, or collusion with other teams.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Sharing room credentials with teams not booked in the slot.</span></li>
              </ul>
            </div>

            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>5. Disqualification &amp; Bans</h2>
              <p className={styles.legalBody}>
                BGFS reserves the right to disqualify any team or player at any time, with or without
                prior notice, for:
              </p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span>Violation of any rule stated in these Terms &amp; Conditions.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Confirmed or suspected cheating, as determined at BGFS admin&rsquo;s sole discretion based on game data, reports, or screen recordings.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Failure to join the match room within the designated wait period (typically 5 minutes after lobby launch).</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Repeat violations of conduct rules.</span></li>
              </ul>
              <p className={styles.legalBody}>
                Disqualified teams forfeit all scores for the affected slot. Entry fees for
                disqualified slots are non-refundable.
              </p>
            </div>

            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>6. Schedule &amp; Prize Changes</h2>
              <p className={styles.legalBody}>
                BGFS reserves the right to modify the match schedule, prize pool structure, slot
                timings, or any tournament format element at its sole discretion. Participants will
                be notified of material changes via the official BGFS WhatsApp group or platform
                announcements with reasonable advance notice wherever possible.
              </p>
              <p className={styles.legalBody}>
                In the event of a full tournament cancellation by BGFS, refunds will be processed as
                described in our <a href="/refund-policy" style={{ color: '#fbbf24' }}>Cancellation &amp; Refund Policy</a>.
              </p>
            </div>

            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>7. Limitation of Liability</h2>
              <p className={styles.legalBody}>
                BGFS is an independent community platform and is not responsible for any technical
                issues on Krafton&rsquo;s end (server outages, game patches, account bans by Krafton).
                BGFS shall not be liable for any indirect, incidental, or consequential damages
                arising from participation in the tournament.
              </p>
            </div>

            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>8. Governing Law</h2>
              <p className={styles.legalBody}>
                These Terms &amp; Conditions are governed by the laws of India. Any disputes shall be
                subject to the exclusive jurisdiction of the courts of India.
              </p>
            </div>

            <div className={styles.noteBox}>
              <p>
                Questions about these terms?{' '}
                <a href="/contact" style={{ color: '#fbbf24', textDecoration: 'underline' }}>
                  Contact us →
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
