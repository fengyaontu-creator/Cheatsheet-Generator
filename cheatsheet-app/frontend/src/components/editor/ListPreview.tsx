import React from 'react'
import type { Block, ListLayout } from '../../types/block'
import { pickVersion } from '../../utils/density'
import Katex from '../ui/Katex'

interface Props {
  documentTitle: string
  columns: Block[][]
  layout: ListLayout
  showTitle?: boolean
}

export default function ListPreview({
  documentTitle,
  columns,
  layout,
  showTitle = true,
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
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function BlockRender({
  block,
  densityLevel,
}: {
  block: Block
  densityLevel: number
}) {
  const text = pickVersion(block, densityLevel)
  return (
    <div style={styles.block}>
      <div style={styles.blockTitle}>
        {block.must_keep && <span style={styles.lock}>LOCK</span>}
        {block.title}
      </div>
      {block.latex ? (
        <div style={styles.formula}>
          <Katex latex={block.latex} />
        </div>
      ) : (
        <div style={styles.blockBody}>{text}</div>
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
}
