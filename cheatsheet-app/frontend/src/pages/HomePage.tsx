import React from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

export default function HomePage() {
  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.inner}>
          <h1 style={styles.title}>Cheatsheet</h1>
          <p style={styles.tagline}>
            Turn lecture materials into print-ready exam cheatsheets that actually fit the page.
          </p>

          <ul style={styles.features}>
            <li>Exam-focused structured blocks, not prose summaries</li>
            <li>Program-controlled A4 layout — you tune parameters, not prompts</li>
            <li>Real-time preview, instant re-flow on every change</li>
          </ul>

          <div style={styles.ctaRow}>
            <Link to="/create" style={styles.cta}>
              Create from text →
            </Link>
            <Link to="/editor" style={styles.ctaSecondary}>
              Open demo editor
            </Link>
            <Link to="/pricing" style={styles.ctaGhost}>
              Pricing
            </Link>
          </div>

          <p style={styles.note}>
            Paste lecture notes or markdown · LLM extracts structured blocks · tune layout live
          </p>
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
  wrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  inner: {
    maxWidth: 640,
    width: '100%',
  },
  title: {
    fontSize: 48,
    margin: '0 0 12px',
    letterSpacing: '-0.02em',
  },
  tagline: {
    fontSize: 18,
    color: '#57606a',
    margin: '0 0 28px',
    lineHeight: 1.5,
  },
  features: {
    padding: '0 0 0 20px',
    margin: '0 0 32px',
    color: '#24292f',
    lineHeight: 1.8,
  },
  ctaRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  cta: {
    display: 'inline-block',
    padding: '12px 22px',
    background: '#1f2328',
    color: '#fff',
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: 'none',
  },
  ctaSecondary: {
    display: 'inline-block',
    padding: '12px 22px',
    background: '#fff',
    color: '#1f2328',
    border: '1px solid #d0d7de',
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: 'none',
  },
  ctaGhost: {
    display: 'inline-block',
    padding: '12px 22px',
    color: '#57606a',
    fontWeight: 500,
    textDecoration: 'none',
  },
  note: {
    marginTop: 20,
    fontSize: 13,
    color: '#8b949e',
  },
}
