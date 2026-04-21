import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGenerationJob } from '../../hooks/useGenerationJob'
import GenerationOverlay from './GenerationOverlay'
import WhipOverlay from './WhipOverlay'

const WHIP_DELAY_MS = 10_000

type Mode = 'files' | 'text'
type Language = 'en' | 'zh' | 'mixed'

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'mixed', label: 'Mixed (中英)' },
]

const MAX_FILES = 10

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.pptx', '.xlsx', '.xls',
  '.html', '.htm', '.csv', '.json', '.xml',
  '.txt', '.md', '.rst', '.rtf',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
].join(',')

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

function fileTag(f: File): string {
  if (IMAGE_TYPES.has(f.type)) return 'Image'
  const ext = f.name.split('.').pop()?.toUpperCase() ?? 'File'
  return ext
}

export default function UploadPanel() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('files')
  const [language, setLanguage] = useState<Language>('en')
  const [sourceText, setSourceText] = useState('')
  const [userFocus, setUserFocus] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const job = useGenerationJob()
  const [whipActive, setWhipActive] = useState(false)

  const loading = job.status === 'pending' || job.status === 'running'

  useEffect(() => {
    if (job.status === 'completed' && job.project) {
      sessionStorage.removeItem('cheatsheet_editor_project')
      sessionStorage.removeItem('cheatsheet_editor_hidden')
      navigate('/editor', { state: { project: job.project } })
    }
  }, [job.status, job.project, navigate])

  useEffect(() => {
    if (!loading) {
      setWhipActive(false)
      return
    }
    const id = window.setTimeout(() => setWhipActive(true), WHIP_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'files' && files.length === 0) {
      setValidationError('Please select at least one file.')
      return
    }
    if (mode === 'text' && !sourceText.trim()) {
      setValidationError('Source text is empty.')
      return
    }
    setValidationError(null)
    await job.start({
      files: mode === 'files' ? files : undefined,
      text: mode === 'text' ? sourceText : undefined,
      userFocus,
      language,
    })
  }

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming)
    setFiles((prev) => [...prev, ...arr].slice(0, MAX_FILES))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const charCount = sourceText.length

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      {/* Tab switcher */}
      <div style={styles.tabs}>
        <button
          type="button"
          style={mode === 'files' ? styles.tabActive : styles.tab}
          onClick={() => setMode('files')}
        >
          Upload files
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
      {mode === 'files' ? (
        <div style={styles.field}>
          <label style={styles.label}>
            Files
            <span style={styles.hint}>
              PDF, Word, Excel, PowerPoint, HTML, CSV, images, etc. (max {MAX_FILES})
            </span>
          </label>
          <div
            style={styles.dropZone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {files.length > 0 ? (
              <div style={styles.fileList} onClick={(e) => e.stopPropagation()}>
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} style={styles.fileRow}>
                    {IMAGE_TYPES.has(f.type) && (
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        style={styles.fileThumb}
                      />
                    )}
                    <span style={styles.fileTag}>{fileTag(f)}</span>
                    <span style={styles.fileName}>{f.name}</span>
                    <span style={styles.hint}>{formatSize(f.size)}</span>
                    <button
                      type="button"
                      style={styles.removeBtn}
                      onClick={() => removeFile(i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button
                    type="button"
                    style={styles.addMoreBtn}
                    onClick={() => fileRef.current?.click()}
                  >
                    + Add more files
                  </button>
                )}
              </div>
            ) : (
              <span style={styles.hint}>
                Drop files here or click to browse
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

      {validationError && <div style={styles.error}>{validationError}</div>}

      <div style={styles.actions}>
        <button type="submit" style={styles.submit} disabled={loading}>
          {loading ? 'Generating…' : 'Generate cheatsheet →'}
        </button>
      </div>

      <GenerationOverlay
        status={job.status}
        stage={job.stage}
        topicsTotal={job.topicsTotal}
        topicsDone={job.topicsDone}
        error={job.error}
        onDismiss={job.reset}
      />
      <WhipOverlay active={whipActive} />
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
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
  },
  fileThumb: {
    width: 28,
    height: 28,
    objectFit: 'cover' as const,
    borderRadius: 4,
    flexShrink: 0,
  },
  fileTag: {
    padding: '2px 8px',
    background: '#f6f8fa',
    border: '1px solid #d0d7de',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: '#57606a',
    flexShrink: 0,
  },
  fileName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  removeBtn: {
    padding: '4px 10px',
    background: '#ffebe9',
    color: '#82071e',
    border: '1px solid #ffc1bc',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
  },
  addMoreBtn: {
    padding: '6px 0',
    background: 'none',
    border: 'none',
    fontSize: 12,
    color: '#0969da',
    cursor: 'pointer',
    textAlign: 'left' as const,
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
