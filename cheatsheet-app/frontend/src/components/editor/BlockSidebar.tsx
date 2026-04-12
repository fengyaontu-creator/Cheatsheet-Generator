import React, { useMemo, useState } from 'react'
import type { Block } from '../../types/block'
import { collectDescendantIds } from '../../utils/hierarchy'
import BlockCard from './BlockCard'

interface Props {
  blocks: Block[]
  hiddenIds: Set<string>
  onMove: (id: string, dir: -1 | 1) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onToggleLock: (id: string) => void
}

interface HiddenGroup {
  root: Block
  count: number
  preview: string[]
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
  const hiddenGroups = useMemo(() => deriveHiddenGroups(blocks, hiddenIds), [blocks, hiddenIds])
  const hiddenCount = hiddenGroups.reduce((sum, group) => sum + group.count, 0)
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
        {hiddenGroups.length > 0 && (
          <div style={styles.hiddenSection}>
            <button
              type="button"
              style={styles.hiddenHeader}
              onClick={() => setShowHidden((v) => !v)}
            >
              <span>{showHidden ? '[-]' : '[+]'} Hidden groups</span>
              <span style={styles.hiddenCount}>{hiddenCount}</span>
            </button>
            {showHidden &&
              hiddenGroups.map((group) => (
                <div key={group.root.id} style={styles.hiddenCard}>
                  <div style={styles.hiddenCardTop}>
                    <div style={styles.hiddenMeta}>
                      <span style={styles.hiddenType}>{group.root.type}</span>
                      <span style={styles.hiddenSize}>
                        {group.count} {group.count === 1 ? 'block' : 'blocks'}
                      </span>
                    </div>
                    <button
                      type="button"
                      style={styles.restoreBtn}
                      onClick={() => onRestore(group.root.id)}
                      title="Restore hidden group"
                    >
                      Restore
                    </button>
                  </div>
                  <div style={styles.hiddenTitle} title={group.root.title}>
                    {group.root.title}
                  </div>
                  {group.preview.length > 0 && (
                    <div style={styles.hiddenPreview}>{group.preview.join(' / ')}</div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function deriveHiddenGroups(blocks: Block[], hiddenIds: Set<string>): HiddenGroup[] {
  const byId = new Map(blocks.map((block) => [block.id, block]))
  const hiddenBlocks = blocks.filter((block) => hiddenIds.has(block.id))
  const roots = hiddenBlocks.filter(
    (block) => !block.parent_id || !hiddenIds.has(block.parent_id) || !byId.has(block.parent_id),
  )

  return roots.map((root) => {
    const ids = collectDescendantIds(blocks, root.id).filter((id) => hiddenIds.has(id))
    const descendants = ids
      .slice(1)
      .map((id) => byId.get(id))
      .filter((block): block is Block => Boolean(block))
    return {
      root,
      count: ids.length,
      preview: descendants.slice(0, 2).map((block) => block.title),
    }
  })
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
  hiddenCard: {
    marginTop: 8,
    padding: 8,
    background: '#fff',
    border: '1px solid #e1e4e8',
    borderRadius: 6,
  },
  hiddenCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  hiddenMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  hiddenType: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#57606a',
    fontWeight: 700,
  },
  hiddenSize: {
    fontSize: 10,
    color: '#8b949e',
  },
  hiddenTitle: {
    color: '#57606a',
    textDecoration: 'line-through',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    fontWeight: 600,
  },
  hiddenPreview: {
    marginTop: 4,
    fontSize: 11,
    color: '#8b949e',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  restoreBtn: {
    border: '1px solid #d0d7de',
    background: '#fff',
    borderRadius: 4,
    minWidth: 58,
    height: 24,
    fontSize: 11,
    padding: '0 8px',
    color: '#1a7f37',
    cursor: 'pointer',
    flexShrink: 0,
  },
}
