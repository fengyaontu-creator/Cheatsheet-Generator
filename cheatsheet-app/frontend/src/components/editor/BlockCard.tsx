import React from 'react'
import type { Block, BlockDraft, BlockType } from '../../types/block'
import { renderInline } from '../../utils/inlineMarkdown'

interface Props {
  block: Block
  index: number
  total: number
  isSelected?: boolean
  isEditing?: boolean
  draft?: BlockDraft | null
  onMove: (id: string, dir: -1 | 1) => void
  onDelete: (id: string) => void
  onToggleLock: (id: string) => void
  onSetImageWidth?: (id: string, width: 'small' | 'medium' | 'full') => void
  onStartEdit?: (id: string) => void
  onUpdateDraft?: (patch: Partial<BlockDraft>) => void
  onEndEdit?: () => void
}

const IMAGE_SIZE_OPTIONS: Array<{ value: 'small' | 'medium' | 'full'; label: string }> = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'full', label: 'L' },
]

const TYPE_OPTIONS: BlockType[] = [
  'topic',
  'definition',
  'formula',
  'comparison',
  'pitfall',
  'procedure',
  'exam_tip',
  'example',
  'image',
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

export default function BlockCard({
  block,
  index,
  total,
  isSelected = false,
  isEditing = false,
  draft = null,
  onMove,
  onDelete,
  onToggleLock,
  onSetImageWidth,
  onStartEdit,
  onUpdateDraft,
  onEndEdit,
}: Props) {
  const isImage = block.type === 'image'
  const editable = isEditing && draft !== null
  const displayType = editable ? draft!.type : block.type
  const color = typeColors[displayType]
  const cardStyle = isSelected
    ? { ...styles.card, ...styles.cardSelected }
    : editable
    ? { ...styles.card, ...styles.cardEditing }
    : styles.card
  const currentWidth = block.image_width ?? 'full'
  const showLatexField = editable && !isImage && (displayType === 'formula' || draft!.latex.length > 0)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && editable && onEndEdit) {
      e.stopPropagation()
      onEndEdit()
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!editable || !onEndEdit) return
    const next = e.relatedTarget as Node | null
    // Focus moving between inputs inside the card should NOT trigger exit —
    // only focus leaving the card boundary does.
    if (next && e.currentTarget.contains(next)) return
    onEndEdit()
  }

  function handleDoubleClick() {
    if (editable || !onStartEdit) return
    onStartEdit(block.id)
  }

  const titleValue = editable ? draft!.title : block.title
  const contentValue = editable ? draft!.content : block.content_short ?? block.content
  const textareaRows = Math.min(
    10,
    Math.max(3, (editable ? draft!.content : '').split('\n').length),
  )

  return (
    <div
      style={cardStyle}
      data-sidebar-block-id={block.id}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <div style={styles.head}>
        {editable ? (
          <select
            value={draft!.type}
            onChange={(e) => onUpdateDraft?.({ type: e.target.value as BlockType })}
            style={{ ...styles.typeSelect, color }}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ ...styles.typePill, background: color }}>{block.type}</span>
        )}
        {editable ? (
          <div style={styles.importanceEdit}>
            <span style={styles.importanceLabel}>★</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft!.importance}
              onChange={(e) => onUpdateDraft?.({ importance: Number(e.target.value) })}
              style={styles.importanceSlider}
            />
            <span style={styles.importanceValue}>{draft!.importance.toFixed(2)}</span>
          </div>
        ) : (
          <span style={styles.importance}>★ {block.importance.toFixed(2)}</span>
        )}
      </div>
      {editable ? (
        <input
          type="text"
          value={titleValue}
          onChange={(e) => onUpdateDraft?.({ title: e.target.value })}
          autoFocus
          style={styles.titleInput}
          placeholder="Block title"
        />
      ) : (
        <div style={styles.title} onDoubleClick={handleDoubleClick}>
          {block.title}
        </div>
      )}
      {isImage && block.image_data && (
        <img src={block.image_data} alt={block.title} style={styles.thumbPreview} />
      )}
      {!isImage && (editable ? (
        <textarea
          value={contentValue}
          onChange={(e) => onUpdateDraft?.({ content: e.target.value })}
          rows={textareaRows}
          style={styles.contentTextarea}
          placeholder="Block content"
        />
      ) : (
        <div style={styles.preview} onDoubleClick={handleDoubleClick}>
          {renderInline(block.content_short ?? block.content)}
        </div>
      ))}
      {showLatexField && (
        <textarea
          value={draft!.latex}
          onChange={(e) => onUpdateDraft?.({ latex: e.target.value })}
          rows={2}
          style={styles.latexTextarea}
          placeholder="LaTeX (optional)"
        />
      )}
      {isImage && editable && (
        <input
          type="text"
          value={draft!.image_caption}
          onChange={(e) => onUpdateDraft?.({ image_caption: e.target.value })}
          style={styles.captionInput}
          placeholder="Image caption (optional)"
        />
      )}
      {isImage && !editable && block.image_caption && (
        <div style={styles.caption}>{block.image_caption}</div>
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
  cardEditing: {
    borderColor: '#bf8700',
    boxShadow: '0 0 0 2px rgba(191,135,0,0.2)',
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
  typeSelect: {
    border: '1px solid #d0d7de',
    borderRadius: 4,
    background: '#fff',
    padding: '2px 4px',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'inherit',
    textTransform: 'lowercase',
  },
  importance: {
    fontSize: 11,
    color: '#57606a',
  },
  importanceEdit: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  importanceLabel: {
    fontSize: 11,
    color: '#bf8700',
  },
  importanceSlider: {
    width: 80,
    accentColor: '#bf8700',
  },
  importanceValue: {
    fontSize: 11,
    color: '#57606a',
    minWidth: 28,
    textAlign: 'right',
  },
  title: {
    fontWeight: 600,
    fontSize: 13,
    color: '#1f2328',
    marginBottom: 4,
  },
  titleInput: {
    width: '100%',
    fontWeight: 600,
    fontSize: 13,
    color: '#1f2328',
    marginBottom: 4,
    padding: '4px 6px',
    border: '1px solid #d0d7de',
    borderRadius: 4,
    background: '#fff',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
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
  contentTextarea: {
    width: '100%',
    color: '#1f2328',
    fontSize: 11,
    lineHeight: 1.5,
    padding: '6px 8px',
    border: '1px solid #d0d7de',
    borderRadius: 4,
    background: '#fff',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  latexTextarea: {
    width: '100%',
    color: '#1f2328',
    fontSize: 11,
    lineHeight: 1.4,
    padding: '6px 8px',
    marginTop: 6,
    border: '1px solid #d0d7de',
    borderRadius: 4,
    background: '#f6f8fa',
    boxSizing: 'border-box',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    resize: 'vertical',
  },
  captionInput: {
    width: '100%',
    fontSize: 11,
    color: '#1f2328',
    marginTop: 6,
    padding: '4px 6px',
    border: '1px solid #d0d7de',
    borderRadius: 4,
    background: '#fff',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontStyle: 'italic',
  },
  caption: {
    fontSize: 10,
    color: '#57606a',
    marginTop: 4,
    fontStyle: 'italic',
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
