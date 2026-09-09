import type { Metadata } from 'next'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy — BGFS',
  description: 'Battlegrounds Faceoff Series refund and cancellation policy for tournament slot fees.',
}

export default function RefundPolicyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Legal</p>
          <h1 className={styles.heroTitle}>Cancellation &amp; <span className={styles.gold}>Refund Policy</span></h1>
          <p className={styles.heroDesc}>Our refund policy is straightforward. Please read it before booking a slot.</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.legalContent}>
            <p className={styles.legalMeta}>Last updated: August 2026 · Applies to all BGFS Season 1 slot bookings</p>

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>1. General Policy</h2>
              <p className={styles.legalBody}>
                All slot booking fees paid on the BGFS platform are{' '}
                <strong style={{ color: '#ffffff' }}>non-refundable once a booking is confirmed</strong> and
                a payment receipt has been issued. By completing a payment, you acknowledge and agree to
                this policy.
              </p>
              <p className={styles.legalBody}>
                Confirmation is defined as the moment our payment gateway successfully processes your payment and
                BGFS receives a verified payment confirmation. You will receive a booking confirmation
                reflected in your Dashboard.
              </p>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>2. Exceptions — When Refunds Are Issued</h2>
              <p className={styles.legalBody}>Refunds will only be processed in the following circumstances:</p>
              <ul className={styles.legalList}>
                <li>
                  <span className={styles.legalBullet}>●</span>
                  <span>
                    <strong style={{ color: '#ffffff' }}>Tournament Cancellation by BGFS:</strong> If BGFS
                    cancels an entire tournament cycle (not an individual slot), full refunds for all
                    booked slots within that cycle will be processed within{' '}
                    <strong style={{ color: '#fbbf24' }}>5–7 business days</strong> to the original
                    payment method.
                  </span>
                </li>
                <li>
                  <span className={styles.legalBullet}>●</span>
                  <span>
                    <strong style={{ color: '#ffffff' }}>Double Charge / Technical Error:</strong> If a
                    technical error results in a duplicate charge for the same slot, the duplicate
                    amount will be refunded within 5–7 business days upon verification.
                  </span>
                </li>
                <li>
                  <span className={styles.legalBullet}>●</span>
                  <span>
                    <strong style={{ color: '#ffffff' }}>Payment Deducted but Booking Not Confirmed:</strong>{' '}
                    If your payment was deducted but your booking was not recorded in our system, contact
                    us within 48 hours with your Payment Reference ID. We will investigate and either
                    confirm your booking or issue a full refund.
                  </span>
                </li>
              </ul>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>3. Non-Refundable Situations</h2>
              <p className={styles.legalBody}>The following situations do <strong style={{ color: '#ffffff' }}>not</strong> qualify for a refund:</p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span>Failure to join the match room within the given time window.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Disqualification due to cheating or conduct violations.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Change of mind after booking is confirmed.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Internet connectivity issues or device problems on the participant&apos;s end.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Cancellation of an individual slot due to insufficient team sign-ups — affected teams will receive a free coupon for the next available slot instead.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Match reschedule — if BGFS reschedules (not cancels) a slot due to server issues or other reasons, no refund is issued; the booking remains valid for the rescheduled time.</span></li>
              </ul>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>4. Refund Process</h2>
              <p className={styles.legalBody}>To request a refund under an eligible exception:</p>
              <ul className={styles.legalList}>
                <li><span className={styles.legalBullet}>●</span><span>Email us at <a href="mailto:battlegroundsfaceoffseries@gmail.com" style={{ color: '#fbbf24' }}>battlegroundsfaceoffseries@gmail.com</a> with your registered email and Payment Transaction Reference ID.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Our team will verify the claim within 2–3 business days.</span></li>
                <li><span className={styles.legalBullet}>●</span><span>Approved refunds are credited to the original payment method within 5–7 business days. Processing time may vary by bank or UPI provider.</span></li>
              </ul>
            </div>
            <hr className={styles.legalDivider} />

            <div className={styles.legalSection}>
              <h2 className={styles.legalSectionTitle}>5. Contact</h2>
              <p className={styles.legalBody}>
                For any payment or refund concerns, reach us at{' '}
                <a href="mailto:battlegroundsfaceoffseries@gmail.com" style={{ color: '#fbbf24' }}>
                  battlegroundsfaceoffseries@gmail.com
                </a>{' '}
                or via our <a href="/contact" style={{ color: '#fbbf24' }}>contact page</a>.
                Support is available 10:00 AM – 8:00 PM IST, all days.
              </p>
            </div>

            <div className={styles.noteBox}>
              <p>
                <strong style={{ color: '#fbbf24' }}>Summary:</strong> Slot fees are non-refundable
                once confirmed, except in case of BGFS-initiated tournament cancellation or a verified
                technical double-charge. Refunds are processed within 5–7 business days.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
