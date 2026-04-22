import React from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

export default function PricingPage() {
  return (
    <div style={styles.page}>
      <div style={styles.main}>
        <div style={styles.topbar}>
          <Link to="/" style={styles.back}>← Cheatsheet</Link>
        </div>

        <div style={styles.hero}>
          <h1 style={styles.title}>Pricing</h1>
          <p style={styles.subtitle}>
            Simple credit packs. One credit = one cheatsheet generation. No subscriptions, no auto-renewal.
          </p>
        </div>

        <div style={styles.plans}>
          <div style={styles.plan}>
            <div style={styles.planName}>Free</div>
            <div style={styles.price}>
              <span style={styles.priceNum}>$0</span>
            </div>
            <ul style={styles.features}>
              <li>5 free credits on sign-up</li>
              <li>Powered by Gemini 2.5 Flash</li>
              <li>All layout modes (list, mindmap)</li>
              <li>PDF export</li>
            </ul>
            <button style={styles.ctaDisabled} disabled>
              Sign-up opens soon
            </button>
          </div>

          <div style={{ ...styles.plan, ...styles.planFeatured }}>
            <div style={styles.planName}>Starter pack</div>
            <div style={styles.price}>
              <span style={styles.priceNum}>$5</span>
              <span style={styles.priceUnit}>one-time</span>
            </div>
            <ul style={styles.features}>
              <li>10 credits</li>
              <li>Powered by Claude Sonnet 4.5</li>
              <li>Higher-quality structured blocks</li>
              <li>Credits never expire</li>
            </ul>
            <button style={styles.ctaDisabled} disabled>
              Checkout opens soon
            </button>
          </div>

          <div style={styles.plan}>
            <div style={styles.planName}>Study-season pack</div>
            <div style={styles.price}>
              <span style={styles.priceNum}>$12</span>
              <span style={styles.priceUnit}>one-time</span>
            </div>
            <ul style={styles.features}>
              <li>30 credits</li>
              <li>Powered by Claude Sonnet 4.5</li>
              <li>Best price per credit</li>
              <li>Credits never expire</li>
            </ul>
            <button style={styles.ctaDisabled} disabled>
              Checkout opens soon
            </button>
          </div>
        </div>

        <div style={styles.faq}>
          <h2 style={styles.faqTitle}>FAQ</h2>

          <div style={styles.faqItem}>
            <div style={styles.q}>What is a "credit"?</div>
            <div style={styles.a}>
              One credit lets you generate one cheatsheet from a set of source files. Regenerating the same cheatsheet counts as a new credit.
            </div>
          </div>

          <div style={styles.faqItem}>
            <div style={styles.q}>Do credits expire?</div>
            <div style={styles.a}>
              No. Once purchased, credits stay in your account until used.
            </div>
          </div>

          <div style={styles.faqItem}>
            <div style={styles.q}>Can I get a refund?</div>
            <div style={styles.a}>
              Unused credits can be refunded within 14 days of purchase by contacting us. Consumed credits are non-refundable.
              See our <Link to="/terms" style={styles.inlineLink}>Terms of Service</Link> for full details.
            </div>
          </div>

          <div style={styles.faqItem}>
            <div style={styles.q}>Which payment methods do you accept?</div>
            <div style={styles.a}>
              Payments are handled by Paddle, our Merchant of Record. Paddle accepts major credit and debit cards, Apple Pay, Google Pay, PayPal, Alipay, and WeChat Pay, among others.
            </div>
          </div>

          <div style={styles.faqItem}>
            <div style={styles.q}>What about privacy?</div>
            <div style={styles.a}>
              Uploaded files are processed to generate your cheatsheet and are not used to train models.
              See our <Link to="/privacy" style={styles.inlineLink}>Privacy Policy</Link>.
            </div>
          </div>
        </div>
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
    maxWidth: 960,
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
  hero: {
    textAlign: 'center',
    margin: '0 0 48px',
  },
  title: {
    fontSize: 42,
    margin: '0 0 12px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 17,
    color: '#57606a',
    margin: 0,
    lineHeight: 1.5,
    maxWidth: 600,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  plans: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 20,
    marginBottom: 56,
  },
  plan: {
    border: '1px solid #d0d7de',
    borderRadius: 12,
    padding: 28,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  planFeatured: {
    borderColor: '#1f2328',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  planName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#57606a',
    marginBottom: 12,
  },
  price: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 20,
  },
  priceNum: {
    fontSize: 36,
    fontWeight: 700,
    color: '#1f2328',
  },
  priceUnit: {
    fontSize: 13,
    color: '#8b949e',
  },
  features: {
    padding: '0 0 0 20px',
    margin: '0 0 24px',
    color: '#24292f',
    fontSize: 14,
    lineHeight: 1.8,
    flex: 1,
  },
  ctaDisabled: {
    display: 'inline-block',
    padding: '10px 18px',
    background: '#f3f4f6',
    color: '#9ca3af',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'not-allowed',
    textAlign: 'center',
  },
  faq: {
    maxWidth: 720,
    margin: '0 auto',
  },
  faqTitle: {
    fontSize: 22,
    margin: '0 0 20px',
  },
  faqItem: {
    marginBottom: 20,
  },
  q: {
    fontWeight: 600,
    color: '#1f2328',
    marginBottom: 6,
  },
  a: {
    color: '#57606a',
    lineHeight: 1.6,
    fontSize: 15,
  },
  inlineLink: {
    color: '#0969da',
    textDecoration: 'none',
  },
}
