import React from 'react'
import type { Block, ListLayout } from '../../types/block'
import { pickVersion } from '../../utils/density'
import { renderInline } from '../../utils/inlineMarkdown'
import Katex from '../ui/Katex'

interface Props {
  documentTitle: string
  columns: Block[][]
  layout: ListLayout
  showTitle?: boolean
  onSelectBlock?: (id: string) => void
}

export default function ListPreview({
  documentTitle,
  columns,
  layout,
  showTitle = true,
  onSelectBlock,
}: Props) {
  const renderedColumns = Array.from({ length: layout.columns }, (_, idx) => columns[idx] ?? [])

  const pageStyle: React.CSSProperties = {
    fontSize: `${layout.font_size_pt}pt`,
    lineHeight: layout.line_height,
  }

  return (
    <div style={pageStyle}>
      {showTitle && <h1 style={styles.docTitle}>{documentTitle}</h1>}
      <div style={{ ...styles.columns, gap: '6mm' }}>
        {renderedColumns.map((blocks, idx) => (
          <div key={idx} style={styles.column}>
            {idx > 0 && <div style={{ ...styles.separator, borderLeft: '1px dashed #e1e4e8' }} />}
            {blocks.map((block) => (
              <BlockRender
                key={block.id}
                block={block}
                densityLevel={layout.density_level}
                onSelectBlock={onSelectBlock}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export const IMAGE_MAX_WIDTH: Record<string, string> = {
  small: '40%',
  medium: '70%',
  full: '100%',
}

export function BlockRender({
  block,
  densityLevel,
  onSelectBlock,
}: {
  block: Block
  densityLevel: number
  onSelectBlock?: (id: string) => void
}) {
  const handleDoubleClick = onSelectBlock
    ? (e: React.MouseEvent) => {
        e.stopPropagation()
        onSelectBlock(block.id)
      }
    : undefined

  if (block.type === 'topic') {
    return (
      <div
        style={styles.topicHeader}
        data-block-id={block.id}
        onDoubleClick={handleDoubleClick}
      >
        {block.title}
      </div>
    )
  }
  if (block.type === 'image' && block.image_data) {
    const maxW = IMAGE_MAX_WIDTH[block.image_width ?? 'full'] ?? '100%'
    const ar = block.image_natural_width && block.image_natural_height
      ? `${block.image_natural_width} / ${block.image_natural_height}`
      : undefined
    return (
      <div
        style={styles.block}
        data-block-id={block.id}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={block.image_data}
          alt={block.title}
          style={{ ...styles.blockImage, maxWidth: maxW, aspectRatio: ar }}
        />
        {block.image_caption && (
          <div style={styles.imageCaption}>{block.image_caption}</div>
        )}
      </div>
    )
  }
  const text = pickVersion(block, densityLevel)
  return (
    <div
      style={styles.block}
      data-block-id={block.id}
      onDoubleClick={handleDoubleClick}
    >
      <div style={styles.blockTitle}>
        {block.must_keep && <span style={styles.lock}>🔒</span>}
        {block.title}
      </div>
      {block.latex ? (
        <div style={styles.formula}>
          <Katex latex={block.latex} />
        </div>
      ) : (
        <div style={styles.blockBody}>{renderInline(text)}</div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  docTitle: {
    fontSize: '1.4em',
    margin: '0 0 0.4em',
    textAlign: 'center',
    borderBottom: '1px solid #1f2328',
    paddingBottom: '0.2em',
  },
  columns: {
    display: 'flex',
    alignItems: 'stretch',
  },
  column: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  separator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '-3mm',
    pointerEvents: 'none',
  },
  block: {
    breakInside: 'avoid',
    marginBottom: '0.5em',
  },
  topicHeader: {
    breakInside: 'avoid',
    fontSize: '1.1em',
    fontWeight: 700,
    color: '#1f2328',
    marginTop: '0.35em',
    marginBottom: '0.25em',
    paddingBottom: '0.1em',
    borderBottom: '1px solid #d0d7de',
    letterSpacing: '0.01em',
  },
  blockTitle: {
    fontWeight: 700,
    fontSize: '1em',
    marginBottom: '0.15em',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  blockBody: {
    color: '#1f2328',
  },
  formula: {
    fontSize: '0.95em',
    padding: '1px 0',
  },
  lock: {
    fontSize: '0.8em',
  },
  blockImage: {
    display: 'block',
    width: 'auto',
    height: 'auto',
    borderRadius: 2,
  },
  imageCaption: {
    fontSize: '0.85em',
    color: '#57606a',
    marginTop: '0.15em',
    fontStyle: 'italic',
  },
}
