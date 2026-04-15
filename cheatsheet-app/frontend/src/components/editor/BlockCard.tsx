import React from 'react'
import type { Block } from '../../types/block'

interface Props {
  block: Block
  index: number
  total: number
  isSelected?: boolean
  onMove: (id: string, dir: -1 | 1) => void
  onDelete: (id: string) => void
  onToggleLock: (id: string) => void
  onSetImageWidth?: (id: string, width: 'small' | 'medium' | 'full') => void
}

const IMAGE_SIZE_OPTIONS: Array<{ value: 'small' | 'medium' | 'full'; label: string }> = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'full', label: 'L' },
]

const typeColors: Record<Block['type'], string> = {
  topic: '#1f2328',
  definition: '#0969da',
  formula: '#8250df',
  comparison: '#1a7f37',
  pitfall: '#cf222e',
  procedure: '#bf8700',
  exam_tip: '#d4379a',
  example: '#57606a',
  image: '#0550ae',
}

export default function BlockCard({ block, index, total, isSelected = false, onMove, onDelete, onToggleLock, onSetImageWidth }: Props) {
  const color = typeColors[block.type]
  const cardStyle = isSelected ? { ...styles.card, ...styles.cardSelected } : styles.card
  const isImage = block.type === 'image'
  const currentWidth = block.image_width ?? 'full'
  return (
    <div style={cardStyle} data-sidebar-block-id={block.id}>
      <div style={styles.head}>
        <span style={{ ...styles.typePill, background: color }}>{block.type}</span>
        <span style={styles.importance}>★ {block.importance.toFixed(2)}</span>
      </div>
      <div style={styles.title}>{block.title}</div>
      {isImage && block.image_data ? (
        <img src={block.image_data} alt={block.title} style={styles.thumbPreview} />
      ) : (
        <div style={styles.preview}>{block.content_short ?? block.content}</div>
      )}
      {block.source_ref && <div style={styles.source}>{block.source_ref}</div>}
      {isImage && onSetImageWidth && (
        <div style={styles.sizeRow}>
          <span style={styles.sizeLabel}>Size</span>
          {IMAGE_SIZE_OPTIONS.map((opt) => {
            const active = currentWidth === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                style={active ? { ...styles.sizeBtn, ...styles.sizeBtnActive } : styles.sizeBtn}
                onClick={() => onSetImageWidth(block.id, opt.value)}
                title={`Set image width: ${opt.value}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
      <div style={styles.actions}>
        <button
          style={styles.iconBtn}
          onClick={() => onMove(block.id, -1)}
          disabled={index === 0}
          title="Move up"
        >
          ↑
        </button>
        <button
          style={styles.iconBtn}
          onClick={() => onMove(block.id, 1)}
          disabled={index === total - 1}
          title="Move down"
        >
          ↓
        </button>
        <button
          style={{
            ...styles.iconBtn,
            background: block.must_keep ? '#1f2328' : '#fff',
            color: block.must_keep ? '#fff' : '#1f2328',
          }}
          onClick={() => onToggleLock(block.id)}
          title="Toggle must-keep"
        >
          {block.must_keep ? '🔒' : '🔓'}
        </button>
        <button
          style={{ ...styles.iconBtn, marginLeft: 'auto', color: '#cf222e' }}
          onClick={() => onDelete(block.id)}
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    border: '1px solid #d0d7de',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 12,
  },
  cardSelected: {
    borderColor: '#0969da',
    background: '#ddf4ff',
    boxShadow: '0 0 0 2px rgba(9,105,218,0.2)',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typePill: {
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  importance: {
    fontSize: 11,
    color: '#57606a',
  },
  title: {
    fontWeight: 600,
    fontSize: 13,
    color: '#1f2328',
    marginBottom: 4,
  },
  preview: {
    color: '#57606a',
    fontSize: 11,
    lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  thumbPreview: {
    maxWidth: '100%',
    maxHeight: 60,
    borderRadius: 4,
    objectFit: 'contain' as const,
  },
  source: {
    fontSize: 10,
    color: '#8b949e',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  iconBtn: {
    border: '1px solid #d0d7de',
    background: '#fff',
    borderRadius: 4,
    width: 26,
    height: 24,
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  sizeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  sizeLabel: {
    fontSize: 10,
    color: '#57606a',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
    marginRight: 2,
  },
  sizeBtn: {
    border: '1px solid #d0d7de',
    background: '#fff',
    color: '#1f2328',
    borderRadius: 4,
    minWidth: 22,
    height: 22,
    fontSize: 11,
    fontWeight: 600,
    padding: '0 4px',
    cursor: 'pointer',
  },
  sizeBtnActive: {
    borderColor: '#0969da',
    background: '#0969da',
    color: '#fff',
  },
}
