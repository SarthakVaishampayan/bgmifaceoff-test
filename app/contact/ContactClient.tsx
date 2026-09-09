'use client'

import { useState } from 'react'
import { Mail, MessageCircle, Clock, Send } from 'lucide-react'
import styles from './page.module.css'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    // Mailto fallback — opens mail client with pre-filled content
    const subject = encodeURIComponent(`BGFS Support Request from ${form.name}`)
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`
    )
    window.location.href = `mailto:battlegroundsfaceoffseries@gmail.com?subject=${subject}&body=${body}`
    setTimeout(() => setStatus('sent'), 800)
  }

  return (
    <main className={styles.page}>
      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Get In Touch</p>
          <h1 className={styles.heroTitle}>
            Contact <span className={styles.gold}>Us</span>
          </h1>
          <p className={styles.heroDesc}>
            Have a question about a slot, payment, or tournament rules? We&rsquo;re here to help.
          </p>
        </div>
      </section>

      {/* ── CONTACT BODY ── */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.contactGrid}>
            {/* Info card */}
            <div>
              <p className={styles.sectionEyebrow}>Contact Info</p>
              <h2 className={styles.sectionTitle} style={{ marginBottom: '1.75rem' }}>Reach Us Directly</h2>

              <div className={styles.contactCard}>
                <div className={styles.contactRow}>
                  <div className={styles.contactIcon}>
                    <Mail size={18} color="#fbbf24" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className={styles.contactLabel}>Email</p>
                    <p className={styles.contactValue}>
                      <a href="mailto:battlegroundsfaceoffseries@gmail.com" style={{ color: '#fbbf24' }}>
                        battlegroundsfaceoffseries@gmail.com
                      </a>
                    </p>
                    <p className={styles.contactValueNote}>We typically reply within 12–24 hours</p>
                  </div>
                </div>

                <div className={styles.contactRow}>
                  <div className={styles.contactIcon}>
                    <MessageCircle size={18} color="#22c55e" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className={styles.contactLabel}>WhatsApp Support</p>
                    <p className={styles.contactValue}>
                      <a
                        href="https://wa.me/916388024698?text=Hi%20BGFS%20Support%2C%20I%20have%20a%20query%20regarding%20tournament%20slots."
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#22c55e', fontWeight: 700 }}
                      >
                        +91 63880 24698
                      </a>
                    </p>
                    <p className={styles.contactValueNote}>Click to chat directly on WhatsApp</p>
                  </div>
                </div>

                <div className={styles.contactRow}>
                  <div className={styles.contactIcon}>
                    <Clock size={18} color="#fbbf24" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className={styles.contactLabel}>Support Hours</p>
                    <p className={styles.contactValue}>10:00 AM – 8:00 PM IST</p>
                    <p className={styles.contactValueNote}>All days including weekends &amp; match days</p>
                  </div>
                </div>
              </div>

              <div className={styles.noteBox} style={{ marginTop: '1.5rem' }}>
                <p>
                  For <strong style={{ color: '#ffffff' }}>payment issues</strong> or{' '}
                  <strong style={{ color: '#ffffff' }}>slot discrepancies</strong>, please include your
                  registered email address and Payment Reference ID / Transaction ID when contacting us.
                </p>
              </div>
            </div>

            {/* Contact form */}
            <div>
              <div className={styles.contactCard}>
                <p className={styles.formTitle}>Send Us a Message</p>
                <p className={styles.formSubtitle}>
                  Fill in the form below and we&rsquo;ll open your email client with a pre-filled message.
                </p>

                {status === 'sent' && (
                  <div className={styles.successMsg} style={{ marginBottom: '1rem' }}>
                    ✓ Your email client should have opened. If not, email us directly at the address above.
                  </div>
                )}

                <form onSubmit={handleSubmit} className={styles.contactForm}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-name">Your Name</label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      className="form-input"
                      placeholder="Captain / Team Name"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-email">Your Email</label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      className="form-input"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-message">Message</label>
                    <textarea
                      id="contact-message"
                      name="message"
                      className="form-input"
                      placeholder="Describe your issue or question in detail..."
                      value={form.message}
                      onChange={handleChange}
                      rows={5}
                      required
                      style={{ resize: 'vertical', minHeight: '130px' }}
                    />
                  </div>

                  <button
                    id="contact-submit-btn"
                    type="submit"
                    className="btn btn-primary"
                    disabled={status === 'sending'}
                    style={{
                      width: '100%',
                      background: '#facc15',
                      color: '#111111',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <Send size={16} />
                    {status === 'sending' ? 'Opening email client...' : 'Send Message'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
