import React from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

const LAST_UPDATED = '22 April 2026'

export default function PrivacyPage() {
  return (
    <div style={styles.page}>
      <div style={styles.main}>
        <div style={styles.topbar}>
          <Link to="/" style={styles.back}>← Cheatsheet</Link>
        </div>

        <h1 style={styles.title}>Privacy Policy</h1>
        <p style={styles.updated}>Last updated: {LAST_UPDATED}</p>

        <section style={styles.section}>
          <h2 style={styles.h2}>1. What this covers</h2>
          <p style={styles.p}>
            This Privacy Policy explains what data Cheatsheet Generator ("we", "us") collects when you use the Service, how we use it, and who we share it with.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>2. Data we collect</h2>

          <p style={styles.pLabel}>Account data</p>
          <p style={styles.p}>
            Email address (used for sign-in, receipts, and occasional product announcements if you opt in).
          </p>

          <p style={styles.pLabel}>Content you upload</p>
          <p style={styles.p}>
            The study materials you submit for cheatsheet generation (PDFs, documents, pasted text, images). Content is processed in transit and may be cached briefly on our servers to support features like re-generation within the same session.
          </p>

          <p style={styles.pLabel}>Usage data</p>
          <p style={styles.p}>
            Which features you use, generation counts, error logs, request timestamps, and IP address. Used to operate the Service, debug, and enforce rate limits.
          </p>

          <p style={styles.pLabel}>Payment data</p>
          <p style={styles.p}>
            When you purchase credits, Paddle collects and processes payment details (card number, billing address, etc.). We do not store card numbers ourselves; we only receive a transaction ID and status from Paddle.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>3. How we use your data</h2>
          <ul style={styles.ul}>
            <li>To generate your cheatsheets</li>
            <li>To authenticate you and manage your credit balance</li>
            <li>To process payments and send receipts</li>
            <li>To operate, monitor, and improve the Service</li>
            <li>To respond to support requests</li>
            <li>To comply with legal obligations</li>
          </ul>
          <p style={styles.p}>
            <strong>We do not use your uploaded content to train AI models.</strong>
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>4. Third-party processors</h2>
          <p style={styles.p}>
            We use the following services to operate Cheatsheet Generator. Each processes a subset of your data for the purpose listed:
          </p>
          <ul style={styles.ul}>
            <li>
              <strong>Google (Gemini API)</strong> and <strong>OpenRouter</strong> (routing to Anthropic Claude, etc.) — AI models that process your uploaded content to generate cheatsheets. Both providers have their own data-handling policies; we configure requests to exclude training where possible.
            </li>
            <li>
              <strong>Paddle</strong> (Paddle.com Market Ltd.) — payment processing and Merchant of Record. Paddle receives your billing details and transaction information.
            </li>
            <li>
              <strong>Supabase</strong> — authentication and database hosting for account data (email, credit balance, purchase history).
            </li>
            <li>
              <strong>Resend</strong> — transactional email delivery (sign-in links, purchase receipts, optional announcements).
            </li>
            <li>
              <strong>Hetzner Cloud</strong> — server infrastructure where the Service is hosted.
            </li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>5. Data retention</h2>
          <ul style={styles.ul}>
            <li>Account data (email, credits): kept as long as your account exists. Deleted on request.</li>
            <li>Uploaded content: cached for up to 7 days to support re-generation; then purged.</li>
            <li>Generation logs: kept for up to 90 days for debugging.</li>
            <li>Payment records: retained as required by tax and accounting law (typically 7 years).</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>6. Your rights</h2>
          <p style={styles.p}>
            You can request to access, correct, or delete your personal data at any time. Email us at <a href="mailto:fengyaontu@gmail.com" style={styles.link}>fengyaontu@gmail.com</a>. If you are in the EEA, UK, or California, you have additional rights under GDPR / CCPA, including data portability and the right to object to certain processing.
          </p>
          <p style={styles.p}>
            You can unsubscribe from product announcements via the link in any marketing email. Transactional emails (receipts, security alerts) cannot be unsubscribed from without deleting your account.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>7. Cookies</h2>
          <p style={styles.p}>
            We use essential cookies and local storage to keep you signed in and to remember in-progress work. We do not use advertising or cross-site tracking cookies.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>8. International transfers</h2>
          <p style={styles.p}>
            The Service is hosted in Singapore; AI providers and payment processors may process your data in the United States, the European Union, or other countries. By using the Service you consent to these transfers, subject to the safeguards described in this policy.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>9. Children</h2>
          <p style={styles.p}>
            The Service is not intended for children under 13. If you believe a child has provided us with personal data, contact us and we will delete it.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>10. Changes</h2>
          <p style={styles.p}>
            We may update this Privacy Policy. Material changes will be announced on this page; the "Last updated" date will change accordingly.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>11. Contact</h2>
          <p style={styles.p}>
            Privacy questions or requests: <a href="mailto:fengyaontu@gmail.com" style={styles.link}>fengyaontu@gmail.com</a>.
          </p>
        </section>
      </div>

      <Footer />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    maxWidth: 720,
    width: '100%',
    margin: '0 auto',
    padding: '24px 20px',
  },
  topbar: {
    marginBottom: 32,
  },
  back: {
    fontSize: 14,
    color: '#57606a',
    textDecoration: 'none',
  },
  title: {
    fontSize: 34,
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  updated: {
    fontSize: 13,
    color: '#8b949e',
    margin: '0 0 32px',
  },
  section: {
    marginBottom: 28,
  },
  h2: {
    fontSize: 19,
    margin: '0 0 10px',
    color: '#1f2328',
  },
  p: {
    margin: '0 0 10px',
    color: '#24292f',
    lineHeight: 1.65,
    fontSize: 15,
  },
  pLabel: {
    margin: '12px 0 4px',
    color: '#1f2328',
    fontWeight: 600,
    fontSize: 14,
  },
  ul: {
    margin: '0 0 10px',
    paddingLeft: 22,
    color: '#24292f',
    lineHeight: 1.75,
    fontSize: 15,
  },
  link: {
    color: '#0969da',
    textDecoration: 'none',
  },
}
