import React from 'react'
import type { Block, ListLayout } from '../../types/block'
import { pickVersion } from '../../utils/density'
import Katex from '../ui/Katex'

interface Props {
  documentTitle: string
  blocks: Block[]
  layout: ListLayout
  showTitle?: boolean
}

export default function ListPreview({ documentTitle, blocks, layout, showTitle = true }: Props) {
  const contentBlocks = blocks.filter((b) => b.type !== 'topic')

  const contentStyle: React.CSSProperties = {
    columnCount: layout.columns,
    columnGap: '6mm',
    columnRule: '1px dashed #e1e4e8',
    fontSize: `${layout.font_size_pt}pt`,
    lineHeight: layout.line_height,
  }

  return (
    <div style={contentStyle}>
      {showTitle && <h1 style={styles.docTitle}>{documentTitle}</h1>}
      {contentBlocks.map((b) => (
        <BlockRender key={b.id} block={b} densityLevel={layout.density_level} />
      ))}
    </div>
  )
}

export function BlockRender({ block, densityLevel }: { block: Block; densityLevel: number }) {
  const text = pickVersion(block, densityLevel)
  return (
    <div style={styles.block}>
      <div style={styles.blockTitle}>
        {block.must_keep && <span style={styles.lock}>🔒</span>}
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
    columnSpan: 'all' as React.CSSProperties['columnSpan'],
    borderBottom: '1px solid #1f2328',
    paddingBottom: '0.2em',
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
