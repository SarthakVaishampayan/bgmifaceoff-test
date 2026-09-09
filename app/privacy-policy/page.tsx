import type { Metadata } from 'next'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Privacy Policy — BGFS',
  description: 'Battlegrounds Faceoff Series Privacy Policy — what data we collect, why we collect it, and how it is used.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Legal</p>
          <h1 className={styles.heroTitle}>Privacy <span className={styles.gold}>Policy</span></h1>
          <p className={styles.heroDesc}>We are committed to being transparent about the data we collect and how we use it.</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.legalContent}>
            <p className={styles.legalMeta}>Last updated: August 2026 · Applies to all users of battlegroundsfaceoffseries.com</p>

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>1. Who We Are</h2>
              <p className={styles.legalBody}>BGFS is an independent BGMI tournament platform operated in India. Contact: <a href="mailto:battlegroundsfaceoffseries@gmail.com" style={{ color: '#fbbf24' }}>battlegroundsfaceoffseries@gmail.com</a>.</p>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>2. Data We Collect</h2>
              <p className={styles.legalBody}>We collect only what is necessary to operate the tournament:</p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Account Data:</strong> Your email address (stored securely via Supabase Auth). Passwords are hashed and never stored in plain text.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Team Information:</strong> Team name, captain designation, and roster details you enter during registration.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Booking Records:</strong> Slots booked, timestamps, and payment status (paid / pending).</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Payment Confirmation:</strong> Transaction Reference ID and Payment ID only. We do NOT store card numbers, UPI IDs, or any raw payment credentials.</span></li>
                <li><span className={styles.legalBullet}>●</span><span><strong style={{ color: '#ffffff' }}>Match Scores:</strong> Placement and elimination data entered by BGFS admins for leaderboard computation.</span></li>
              </ul>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>3. How We Use Your Data</h2>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span>To authenticate you and manage your account.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>To confirm slot bookings and provide room credentials.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>To compute leaderboard standings and Best-16 scores.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>To verify payment completion via secure payment gateway before granting slot access.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>To contact you regarding schedules, prize payouts, or platform updates.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>To prevent fraud and enforce our Terms &amp; Conditions.</span></li>
              </ul>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>4. Payment Data &amp; Security</h2>
              <p className={styles.legalBody}>All payments are processed by PCI-DSS compliant secure UPI payment gateways. BGFS never sees or stores your card, banking, or UPI PIN details. Payment gateways send us only a payment confirmation reference code to confirm your slot booking.</p>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>5. Data Sharing</h2>
              <p className={styles.legalBody}>We do <strong style={{ color: '#ffffff' }}>not</strong> sell or share your personal data for marketing purposes. We share data only with PCI-DSS payment processors (payment confirmation), Supabase (secure database storage), or if required by law. Team names and match scores are publicly visible on the leaderboard by design.</p>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>6. Data Retention &amp; Your Rights</h2>
              <p className={styles.legalBody}>We retain data for the active season plus up to 12 months for record-keeping. You may request access, correction, or deletion of your data by contacting <a href="mailto:battlegroundsfaceoffseries@gmail.com" style={{ color: '#fbbf24' }}>battlegroundsfaceoffseries@gmail.com</a>.</p>
            </div>

            <div className={styles.noteBox}>
              <p>Questions about your privacy? <a href="/contact" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Contact us →</a></p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
