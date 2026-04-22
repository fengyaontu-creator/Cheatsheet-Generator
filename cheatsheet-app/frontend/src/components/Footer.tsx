import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={styles.wrap} className="no-print">
      <div style={styles.inner}>
        <div style={styles.links}>
          <Link to="/pricing" style={styles.link}>Pricing</Link>
          <span style={styles.dot}>·</span>
          <Link to="/terms" style={styles.link}>Terms</Link>
          <span style={styles.dot}>·</span>
          <Link to="/privacy" style={styles.link}>Privacy</Link>
          <span style={styles.dot}>·</span>
          <a href="mailto:fengyaontu@gmail.com" style={styles.link}>Contact</a>
        </div>
        <div style={styles.copy}>
          © {new Date().getFullYear()} Cheatsheet Generator
        </div>
      </div>
    </footer>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    borderTop: '1px solid #e5e7eb',
    padding: '20px 20px 24px',
    marginTop: 40,
    background: 'transparent',
  },
  inner: {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    fontSize: 13,
    color: '#6b7280',
  },
  links: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  link: {
    color: '#6b7280',
    textDecoration: 'none',
  },
  dot: {
    color: '#d1d5db',
  },
  copy: {
    color: '#9ca3af',
  },
}
