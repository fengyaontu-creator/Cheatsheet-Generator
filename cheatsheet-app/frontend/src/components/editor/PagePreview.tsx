import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Block, Page } from '../../types/block'
import { filterByImportance } from '../../utils/filterByImportance'
import { buildTree, type TreeNode } from '../../utils/hierarchy'
import ListPreview, { BlockRender } from './ListPreview'
import MindmapPreview, { TopicGroup } from './MindmapPreview'

const PX_PER_MM = 96 / 25.4
const PAGE_W_MM = 210
const PAGE_H_MM = 297

export interface FitResult {
  actualPages: number
  columnHeightMm: number
  pageContentHeightMm: number
}

interface Props {
  documentTitle: string
  blocks: Block[]
  page: Page
  importanceThreshold?: number
  targetPages?: number
  onFitResult?: (r: FitResult) => void
}

export default function PagePreview({
  documentTitle,
  blocks,
  page,
  importanceThreshold = 0,
  targetPages = 1,
  onFitResult,
}: Props) {
  const filteredBlocks = useMemo(
    () => filterByImportance(blocks, importanceThreshold),
    [blocks, importanceThreshold],
  )
  const listBlocks = filteredBlocks.filter((b) => page.block_ids.includes(b.id))
  const keptCount = filteredBlocks.filter((b) => b.type !== 'topic').length
  const totalContent = blocks.filter((b) => b.type !== 'topic').length

  // Layout dimensions
  const marginMm = page.layout.margin_mm
  const pageContentHeightMm = PAGE_H_MM - 2 * marginMm
  const contentWidthMm = PAGE_W_MM - 2 * marginMm
  const columns = page.mode === 'list' ? page.layout.columns : 2
  const columnGapMm = page.mode === 'list' ? 6 : 8
  const singleColWidthMm = (contentWidthMm - columnGapMm * (columns - 1)) / columns

  // Font config for measurement containers
  const fontSize = page.layout.font_size_pt
  const lineHeight = page.mode === 'list' ? page.layout.line_height : 1.22
  const densityLevel = page.layout.density_level

  // Build items: TreeNode[] for mindmap, Block[] for list
  const topicNodes = useMemo(() => {
    if (page.mode !== 'mindmap') return []
    return buildTree(filteredBlocks, documentTitle).children
  }, [page.mode, filteredBlocks, documentTitle])

  const contentBlocks = useMemo(() => {
    if (page.mode !== 'list') return []
    return listBlocks.filter((b) => b.type !== 'topic')
  }, [page.mode, listBlocks])

  const itemCount = page.mode === 'mindmap' ? topicNodes.length : contentBlocks.length

  // Refs for measurement
  const titleRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)

  // Page assignments: array of index arrays
  const [pageGroups, setPageGroups] = useState<number[][]>([[]])
  const [localFit, setLocalFit] = useState<FitResult | null>(null)

  useLayoutEffect(() => {
    const titleEl = titleRef.current
    const itemsEl = itemsRef.current
    if (!itemsEl || itemCount === 0) {
      const result: FitResult = { actualPages: 1, columnHeightMm: 0, pageContentHeightMm }
      setPageGroups([[]])
      setLocalFit(result)
      onFitResult?.(result)
      return
    }

    // Measure title height (at full content width)
    const titleHMm = titleEl ? titleEl.getBoundingClientRect().height / PX_PER_MM : 0

    // Measure each item height (at single-column width)
    const heights: number[] = []
    for (let i = 0; i < itemsEl.children.length; i++) {
      heights.push(itemsEl.children[i].getBoundingClientRect().height / PX_PER_MM)
    }

    // Simulate per-column filling to match actual CSS column layout.
    // Items can't split across columns (breakInside: avoid), so we track
    // each column's height individually instead of using total capacity.
    const groups: number[][] = []
    let current: number[] = []
    let colIdx = 0
    let colH = 0
    // Page 1 columns are shorter because the title sits above all columns
    let colCapacity = pageContentHeightMm - titleHMm

    for (let i = 0; i < heights.length; i++) {
      const h = heights[i]
      // If this item won't fit in the current column (and column has content)
      if (colH > 0 && colH + h > colCapacity) {
        colIdx++
        colH = 0
        // All columns on this page are full — start a new page
        if (colIdx >= columns) {
          groups.push(current)
          current = []
          colIdx = 0
          colCapacity = pageContentHeightMm // subsequent pages have no title
        }
      }
      current.push(i)
      colH += h
    }
    if (current.length > 0) groups.push(current)

    setPageGroups((prev) => {
      if (
        prev.length === groups.length &&
        prev.every((g, gi) => g.length === groups[gi].length && g.every((v, vi) => v === groups[gi][vi]))
      ) {
        return prev
      }
      return groups
    })

    // Report fit result
    const totalSingleCol = heights.reduce((s, h) => s + h, 0) + titleHMm * columns
    const columnHeightMm = totalSingleCol / columns
    const actualPages = groups.length
    const result: FitResult = { actualPages, columnHeightMm, pageContentHeightMm }
    setLocalFit((prev) => {
      if (
        prev &&
        prev.actualPages === result.actualPages &&
        Math.abs(prev.columnHeightMm - result.columnHeightMm) < 1
      ) {
        return prev
      }
      return result
    })
    onFitResult?.(result)
  })

  // Derived state
  const actualPages = pageGroups.length
  const overflowing = localFit != null && localFit.actualPages > targetPages
  const displayPages = Math.max(targetPages, actualPages)

  // Build per-page block subsets (guard stale indices after filter changes)
  const pageBlockSets = useMemo(() => {
    if (page.mode === 'mindmap') {
      return pageGroups.map((indices) => {
        const topics = indices
          .filter((i) => i < topicNodes.length)
          .map((i) => topicNodes[i])
        if (topics.length === 0) return [] as Block[]
        const idSet = new Set(topics.flatMap(collectNodeIds))
        return filteredBlocks.filter((b) => idSet.has(b.id))
      })
    } else {
      return pageGroups.map((indices) =>
        indices.filter((i) => i < contentBlocks.length).map((i) => contentBlocks[i]),
      )
    }
  }, [pageGroups, page.mode, topicNodes, filteredBlocks, contentBlocks])

  // Measurement container font style
  const measureFontStyle: React.CSSProperties = {
    fontSize: `${fontSize}pt`,
    lineHeight,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#1f2328',
  }

  return (
    <div style={styles.wrap} className="preview-backdrop">
      {/* Meta bar */}
      <div style={styles.meta} className="no-print">
        <span>A4 · {PAGE_W_MM}×{PAGE_H_MM}mm</span>
        <span>
          showing {keptCount}/{totalContent} blocks
        </span>
        {overflowing && localFit && (
          <span style={styles.overflowTag}>
            ⚠ overflows {localFit.actualPages}/{targetPages} pages
          </span>
        )}
        <span>
          {page.mode === 'list'
            ? `${columns} col · ${fontSize}pt · lh ${page.mode === 'list' ? page.layout.line_height : ''}`
            : `${fontSize}pt`}
        </span>
      </div>

      {/* Hidden measurement containers */}
      <div
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          left: -9999,
        }}
      >
        {/* Title at full content width */}
        <div ref={titleRef} style={{ width: `${contentWidthMm}mm`, ...measureFontStyle }}>
          <h1 style={titleMeasureStyle}>{documentTitle}</h1>
        </div>
        {/* Items at single-column width */}
        <div ref={itemsRef} style={{ width: `${singleColWidthMm}mm`, ...measureFontStyle }}>
          {page.mode === 'mindmap'
            ? topicNodes.map((node) => (
                <div key={node.id}>
                  <TopicGroup node={node} />
                </div>
              ))
            : contentBlocks.map((block) => (
                <div key={block.id}>
                  <BlockRender block={block} densityLevel={densityLevel} />
                </div>
              ))}
        </div>
      </div>

      {/* Page cards */}
      {Array.from({ length: displayPages }).map((_, pageIdx) => {
        const hasContent = pageIdx < pageBlockSets.length && pageBlockSets[pageIdx].length > 0
        const isFirstPage = pageIdx === 0

        return (
          <div
            key={pageIdx}
            className={hasContent ? 'print-page' : 'print-page no-print'}
            style={{
              width: `${PAGE_W_MM}mm`,
              height: `${PAGE_H_MM}mm`,
              flexShrink: 0,
              background: '#fff',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              boxSizing: 'border-box',
              padding: `${marginMm}mm`,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Page number */}
            <div
              className="no-print"
              style={{
                position: 'absolute',
                bottom: 4,
                right: 10,
                fontSize: 10,
                color: '#8b949e',
              }}
            >
              {pageIdx + 1} / {displayPages}
            </div>

            {/* Per-page content with independent columns */}
            {hasContent &&
              (page.mode === 'list' ? (
                <ListPreview
                  documentTitle={documentTitle}
                  blocks={pageBlockSets[pageIdx]}
                  layout={page.layout}
                  showTitle={isFirstPage}
                />
              ) : (
                <MindmapPreview
                  documentTitle={documentTitle}
                  blocks={pageBlockSets[pageIdx]}
                  layout={page.layout}
                  showTitle={isFirstPage}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}

// Collect all block IDs in a TreeNode subtree
function collectNodeIds(node: TreeNode): string[] {
  return [node.id, ...node.children.flatMap(collectNodeIds)]
}

const titleMeasureStyle: React.CSSProperties = {
  fontSize: '1.5em',
  fontWeight: 700,
  margin: '0 0 0.35em',
  textAlign: 'center',
  borderBottom: '1px solid #1f2328',
  paddingBottom: '0.15em',
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    flex: 1,
    overflow: 'auto',
    padding: 40,
    background: '#e9ecef',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    width: `${PAGE_W_MM}mm`,
    flexShrink: 0,
    fontSize: 11,
    color: '#57606a',
    fontFamily: 'ui-monospace, monospace',
  },
  overflowTag: {
    color: '#82071e',
    fontWeight: 600,
  },
}
