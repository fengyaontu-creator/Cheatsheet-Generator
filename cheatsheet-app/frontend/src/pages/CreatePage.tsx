import React from 'react'
import { Link } from 'react-router-dom'
import UploadPanel from '../components/create/UploadPanel'

export default function CreatePage() {
  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <Link to="/" style={styles.brand}>
          ← Cheatsheet
        </Link>
        <h1 style={styles.title}>New cheatsheet</h1>
      </header>
      <div style={styles.inner}>
        <UploadPanel />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    padding: '28px 20px 60px',
    maxWidth: 820,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 18,
    marginBottom: 28,
  },
  brand: {
    fontSize: 14,
    fontWeight: 600,
    color: '#57606a',
    textDecoration: 'none',
  },
  title: {
    fontSize: 28,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  inner: {
    background: '#fff',
    padding: 28,
    borderRadius: 10,
    border: '1px solid #d0d7de',
  },
}
