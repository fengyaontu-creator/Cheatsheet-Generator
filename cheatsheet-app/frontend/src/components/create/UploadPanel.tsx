import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ingestText } from '../../services/api'

export default function UploadPanel() {
  const navigate = useNavigate()
  const [sourceText, setSourceText] = useState('')
  const [userFocus, setUserFocus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sourceText.trim()) {
      setError('Source text is empty')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const project = await ingestText(sourceText, userFocus)
      navigate('/editor', { state: { project } })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const charCount = sourceText.length

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      <div style={styles.field}>
        <label style={styles.label}>
          Source material
          <span style={styles.hint}>
            Paste lecture notes, textbook sections, or any markdown/plain text.
            {charCount > 0 && ` · ${charCount.toLocaleString()} chars`}
          </span>
        </label>
        <textarea
          style={{ ...styles.textarea, minHeight: 320 }}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Paste your source material here…"
          disabled={loading}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>
          Focus instructions <span style={styles.hint}>optional</span>
        </label>
        <textarea
          style={{ ...styles.textarea, minHeight: 80 }}
          value={userFocus}
          onChange={(e) => setUserFocus(e.target.value)}
          placeholder="e.g. Emphasize Bayesian inference and overfitting detection. The exam is MCQ-heavy."
          disabled={loading}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.actions}>
        <button type="submit" style={styles.submit} disabled={loading}>
          {loading ? 'Extracting… (this takes ~20-40s)' : 'Generate cheatsheet →'}
        </button>
      </div>
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    fontSize: 13,
    fontWeight: 600,
    color: '#24292f',
  },
  hint: {
    fontSize: 11,
    fontWeight: 400,
    color: '#8b949e',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    lineHeight: 1.5,
    border: '1px solid #d0d7de',
    borderRadius: 6,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  error: {
    padding: '10px 12px',
    background: '#ffebe9',
    border: '1px solid #ffc1bc',
    borderRadius: 6,
    color: '#82071e',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  submit: {
    padding: '10px 20px',
    background: '#1f2328',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
