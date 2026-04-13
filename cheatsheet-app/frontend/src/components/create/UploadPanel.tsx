import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ingestPdf, ingestText } from '../../services/api'

type Mode = 'pdf' | 'text'
type Language = 'en' | 'zh' | 'mixed'

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'mixed', label: 'Mixed (中英)' },
]

export default function UploadPanel() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('pdf')
  const [language, setLanguage] = useState<Language>('en')
  const [sourceText, setSourceText] = useState('')
  const [userFocus, setUserFocus] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'pdf' && !pdfFile) {
      setError('Please select a PDF file')
      return
    }
    if (mode === 'text' && !sourceText.trim()) {
      setError('Source text is empty')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const project =
        mode === 'pdf'
          ? await ingestPdf(pdfFile!, userFocus, language)
          : await ingestText(sourceText, userFocus, language)
      navigate('/editor', { state: { project } })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') setPdfFile(file)
    else setError('Only PDF files are accepted.')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setPdfFile(file)
  }

  const charCount = sourceText.length

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      {/* Tab switcher */}
      <div style={styles.tabs}>
        <button
          type="button"
          style={mode === 'pdf' ? styles.tabActive : styles.tab}
          onClick={() => setMode('pdf')}
        >
          Upload PDF
        </button>
        <button
          type="button"
          style={mode === 'text' ? styles.tabActive : styles.tab}
          onClick={() => setMode('text')}
        >
          Paste text
        </button>
      </div>

      {/* Source input */}
      {mode === 'pdf' ? (
        <div style={styles.field}>
          <label style={styles.label}>PDF file</label>
          <div
            style={styles.dropZone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {pdfFile ? (
              <div style={styles.fileInfo}>
                <span>{pdfFile.name}</span>
                <span style={styles.hint}>
                  {(pdfFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  style={styles.removeBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPdfFile(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <span style={styles.hint}>
                Drop a PDF here or click to browse (max 20 MB)
              </span>
            )}
          </div>
        </div>
      ) : (
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
      )}

      {/* Language selector */}
      <div style={styles.field}>
        <label style={styles.label}>Output language</label>
        <div style={styles.langRow}>
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              style={language === opt.value ? styles.langActive : styles.langBtn}
              onClick={() => setLanguage(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Focus instructions */}
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
  tabs: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #d0d7de',
  },
  tab: {
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: 13,
    fontWeight: 600,
    color: '#57606a',
    cursor: 'pointer',
  },
  tabActive: {
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid #1f2328',
    fontSize: 13,
    fontWeight: 600,
    color: '#1f2328',
    cursor: 'pointer',
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
  dropZone: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    padding: 20,
    border: '2px dashed #d0d7de',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
  },
  removeBtn: {
    padding: '4px 10px',
    background: '#ffebe9',
    color: '#82071e',
    border: '1px solid #ffc1bc',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
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
  langRow: {
    display: 'flex',
    gap: 6,
  },
  langBtn: {
    padding: '6px 14px',
    background: '#f6f8fa',
    border: '1px solid #d0d7de',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    color: '#57606a',
    cursor: 'pointer',
  },
  langActive: {
    padding: '6px 14px',
    background: '#1f2328',
    border: '1px solid #1f2328',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
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
