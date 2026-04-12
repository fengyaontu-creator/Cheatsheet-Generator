import React, { useState } from 'react'
import type { Block } from '../../types/block'
import BlockCard from './BlockCard'

interface Props {
  blocks: Block[]
  hiddenIds: Set<string>
  onMove: (id: string, dir: -1 | 1) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onToggleLock: (id: string) => void
}

export default function BlockSidebar({
  blocks,
  hiddenIds,
  onMove,
  onDelete,
  onRestore,
  onToggleLock,
}: Props) {
  const visible = blocks.filter((b) => !hiddenIds.has(b.id))
  const hidden = blocks.filter((b) => hiddenIds.has(b.id))
  const [showHidden, setShowHidden] = useState(true)

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <span>Blocks</span>
        <span style={styles.count}>{visible.length}</span>
      </div>
      <div style={styles.list}>
        {visible.map((b, i) => (
          <BlockCard
            key={b.id}
            block={b}
            index={i}
            total={visible.length}
            onMove={onMove}
            onDelete={onDelete}
            onToggleLock={onToggleLock}
          />
        ))}
        {hidden.length > 0 && (
          <div style={styles.hiddenSection}>
            <button
              type="button"
              style={styles.hiddenHeader}
              onClick={() => setShowHidden((v) => !v)}
            >
              <span>{showHidden ? '▾' : '▸'} Hidden</span>
              <span style={styles.hiddenCount}>{hidden.length}</span>
            </button>
            {showHidden &&
              hidden.map((b) => (
                <div key={b.id} style={styles.hiddenRow}>
                  <span style={styles.hiddenTitle} title={b.title}>
                    {b.title}
                  </span>
                  <button
                    type="button"
                    style={styles.restoreBtn}
                    onClick={() => onRestore(b.id)}
                    title="Restore"
                  >
                    ↺
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 320,
    background: '#f6f8fa',
    borderRight: '1px solid #d0d7de',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  header: {
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#57606a',
    borderBottom: '1px solid #d0d7de',
    display: 'flex',
    justifyContent: 'space-between',
  },
  count: {
    background: '#d0d7de',
    color: '#1f2328',
    padding: '1px 8px',
    borderRadius: 10,
    fontSize: 11,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
  },
  hiddenSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px dashed #c0c7d0',
  },
  hiddenHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: '4px 2px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#57606a',
    cursor: 'pointer',
  },
  hiddenCount: {
    background: '#d0d7de',
    color: '#1f2328',
    padding: '1px 8px',
    borderRadius: 10,
    fontSize: 11,
  },
  hiddenRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 6px',
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e1e4e8',
    borderRadius: 4,
    fontSize: 11,
  },
  hiddenTitle: {
    flex: 1,
    color: '#8b949e',
    textDecoration: 'line-through',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  restoreBtn: {
    border: '1px solid #d0d7de',
    background: '#fff',
    borderRadius: 4,
    width: 22,
    height: 20,
    fontSize: 12,
    padding: 0,
    color: '#1a7f37',
    cursor: 'pointer',
    flexShrink: 0,
  },
}
