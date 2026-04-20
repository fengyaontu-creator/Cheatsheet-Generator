import React from 'react'
import type { JobStage, JobStatus } from '../../services/api'

interface Props {
  status: JobStatus | 'idle'
  stage: JobStage | null
  topicsTotal: number | null
  topicsDone: number | null
  error: string | null
  onDismiss: () => void
}

const STAGE_LABELS: Record<JobStage, string> = {
  comprehend: 'Reading source material',
  topics: 'Extracting topic structure',
  outline: 'Building topic content',
  compress: 'Compressing for density',
}

const STAGE_ORDER: JobStage[] = ['comprehend', 'topics', 'outline', 'compress']

function stageLabel(
  stage: JobStage | null,
  topicsTotal: number | null,
  topicsDone: number | null,
): string {
  if (stage === null) return 'Starting generation…'
  if (stage === 'outline' && topicsTotal && topicsTotal > 0) {
    return `${STAGE_LABELS.outline} (${topicsDone ?? 0}/${topicsTotal})`
  }
  return STAGE_LABELS[stage]
}

export default function GenerationOverlay(props: Props) {
  const { status, stage, topicsTotal, topicsDone, error, onDismiss } = props
  const isRunning = status === 'pending' || status === 'running'
  const currentIdx = stage ? STAGE_ORDER.indexOf(stage) : -1

  if (status === 'idle' || status === 'completed') return null

  return (
    <div style={styles.mask}>
      <div style={styles.card}>
        {status === 'failed' ? (
          <>
            <div style={styles.title}>Generation failed</div>
            <div style={styles.errorBox}>{error || 'Unknown error'}</div>
            <button type="button" style={styles.backBtn} onClick={onDismiss}>
              Back
            </button>
          </>
        ) : (
          <>
            <div style={styles.title}>
              {stageLabel(stage, topicsTotal, topicsDone)}
              <span style={styles.dots}>…</span>
            </div>
            <div style={styles.stages}>
              {STAGE_ORDER.map((s, i) => {
                const done = currentIdx > i
                const active = currentIdx === i
                return (
                  <div
                    key={s}
                    style={{
                      ...styles.stageRow,
                      color: done ? '#6a737d' : active ? '#1f2328' : '#c4cad1',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span style={styles.stageMark}>{done ? '✓' : active ? '›' : '·'}</span>
                    <span>{STAGE_LABELS[s]}</span>
                    {active && s === 'outline' && topicsTotal ? (
                      <span style={styles.stageCount}>
                        {topicsDone ?? 0}/{topicsTotal}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {isRunning && <div style={styles.hint}>Takes about 20–40s. Please keep this tab open.</div>}
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  mask: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 20, 25, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(2px)',
  },
  card: {
    minWidth: 360,
    maxWidth: 480,
    padding: 28,
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2328',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  dots: {
    display: 'inline-block',
    animation: 'none',
  },
  stages: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '4px 0',
  },
  stageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
  },
  stageMark: {
    display: 'inline-block',
    width: 12,
    textAlign: 'center',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  stageCount: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: 500,
    color: '#57606a',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  },
  hint: {
    fontSize: 12,
    color: '#8b949e',
  },
  errorBox: {
    padding: '10px 12px',
    background: '#ffebe9',
    border: '1px solid #ffc1bc',
    borderRadius: 6,
    color: '#82071e',
    fontSize: 13,
    whiteSpace: 'pre-wrap',
  },
  backBtn: {
    alignSelf: 'flex-end',
    padding: '8px 16px',
    background: '#1f2328',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
