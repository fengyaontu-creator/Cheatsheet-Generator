import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Block, Page } from '../../types/block'
import {
  createEmptyColumns,
  findAutoFitThreshold,
  paginateMeasuredItems,
  samePageAssignments,
  type PageColumnAssignments,
} from '../../layout/pagination'
import { filterByImportance } from '../../utils/filterByImportance'
import {
  buildTree,
  flattenTreeToAtoms,
  orderBlocksByIds,
  type MindmapAtom,
} from '../../utils/hierarchy'
import ListPreview, { BlockRender } from './ListPreview'
import MindmapPreview, { MindmapAtomRender } from './MindmapPreview'

const PX_PER_MM = 96 / 25.4
const PAGE_W_MM = 210
const PAGE_H_MM = 297

export interface FitResult {
  actualPages: number
  columnHeightMm: number
  pageContentHeightMm: number
  autoFitThreshold?: number
}

interface Props {
  documentTitle: string
  blocks: Block[]
  page: Page
  importanceThreshold?: number
  targetPages?: number
  fitMode?: 'auto' | 'manual'
  onFitResult?: (r: FitResult) => void
  onSelectBlock?: (id: string) => void
}

export default function PagePreview({
  documentTitle,
  blocks,
  page,
  importanceThreshold = 0,
  targetPages = 1,
  fitMode = 'manual',
  onFitResult,
  onSelectBlock,
}: Props) {
  const filteredBlocks = useMemo(
    () => filterByImportance(blocks, importanceThreshold),
    [blocks, importanceThreshold],
  )
  const listBlocks = useMemo(
    () => orderBlocksByIds(filteredBlocks, page.block_ids),
    [filteredBlocks, page.block_ids],
  )

  // All content blocks without importance filtering — used for measurement
  // in list mode so the binary search can evaluate any threshold in one pass
  const allContentBlocks = useMemo(() => {
    if (page.mode !== 'list') return []
    return orderBlocksByIds(blocks, page.block_ids).filter((b) => b.type !== 'topic')
  }, [page.mode, blocks, page.block_ids])
  const keptCount = filteredBlocks.filter((b) => b.type !== 'topic').length
  const totalContent = blocks.filter((b) => b.type !== 'topic').length

  const marginMm = page.layout.margin_mm
  const pageContentHeightMm = PAGE_H_MM - 2 * marginMm
  const contentWidthMm = PAGE_W_MM - 2 * marginMm
  const columns =
    page.mode === 'list'
      ? page.layout.columns
      : page.layout.orientation === 'horizontal'
        ? 2
        : 1
  const columnGapMm =
    page.mode === 'list' ? 6 : page.layout.orientation === 'horizontal' ? 8 : 0
  const singleColWidthMm = (contentWidthMm - columnGapMm * (columns - 1)) / columns

  const fontSize = page.layout.font_size_pt
  const lineHeight = page.mode === 'list' ? page.layout.line_height : 1.22
  const densityLevel = page.layout.density_level
  const mindmapIndent =
    page.mode === 'mindmap'
      ? `${Math.max(0.9, page.layout.level_gap_mm / 18).toFixed(2)}em`
      : '1.2em'
  const mindmapRowGap =
    page.mode === 'mindmap'
      ? `${Math.max(0.08, page.layout.sibling_gap_mm / 16).toFixed(2)}em`
      : '0.2em'
  const mindmapTopicGap =
    page.mode === 'mindmap'
      ? `${Math.max(0.4, page.layout.sibling_gap_mm / 4).toFixed(2)}em`
      : '1em'

  const topicNodes = useMemo(() => {
    if (page.mode !== 'mindmap') return []
    return buildTree(filteredBlocks, documentTitle).children
  }, [page.mode, filteredBlocks, documentTitle])

  const mindmapAtoms = useMemo(
    () => (page.mode === 'mindmap' ? flattenTreeToAtoms(topicNodes) : []),
    [page.mode, topicNodes],
  )

  const contentBlocks = useMemo(() => {
    if (page.mode !== 'list') return []
    return listBlocks.filter((b) => b.type !== 'topic')
  }, [page.mode, listBlocks])

  // For measurement: count of items in the hidden container
  const measureItemCount =
    page.mode === 'mindmap' ? mindmapAtoms.length : allContentBlocks.length

  const titleRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)

  const [pageColumns, setPageColumns] = useState<PageColumnAssignments>([
    createEmptyColumns(columns),
  ])
  const [localFit, setLocalFit] = useState<FitResult | null>(null)

  // Signature of what's in the measurement container
  const measureSignature = useMemo(
    () =>
      page.mode === 'mindmap'
        ? mindmapAtoms.map((a) => a.nodeId).join('|')
        : allContentBlocks.map((block) => block.id).join('|'),
    [page.mode, mindmapAtoms, allContentBlocks],
  )

  useLayoutEffect(() => {
    const titleEl = titleRef.current
    const itemsEl = itemsRef.current

    if (!itemsEl || measureItemCount === 0) {
      const result: FitResult = { actualPages: 1, columnHeightMm: 0, pageContentHeightMm }
      const emptyPages = [createEmptyColumns(columns)]
      setPageColumns((prev) => (samePageAssignments(prev, emptyPages) ? prev : emptyPages))
      setLocalFit((prev) =>
        prev &&
        prev.actualPages === result.actualPages &&
        Math.abs(prev.columnHeightMm - result.columnHeightMm) < 1
          ? prev
          : result,
      )
      onFitResult?.(result)
      return
    }

    const titleHMm = titleEl ? titleEl.getBoundingClientRect().height / PX_PER_MM : 0
    const firstPageCap = Math.max(0, pageContentHeightMm - titleHMm)

    // Measure all items in the hidden container
    const allHeights: number[] = []
    const allMargins: number[] = []
    const children = itemsEl.children
    for (let i = 0; i < children.length; i++) {
      const bare = children[i].getBoundingClientRect().height / PX_PER_MM
      if (i + 1 < children.length) {
        const top = children[i].getBoundingClientRect().top
        const nextTop = children[i + 1].getBoundingClientRect().top
        const full = (nextTop - top) / PX_PER_MM
        allHeights.push(full)
        allMargins.push(full - bare)
      } else {
        allHeights.push(bare)
        allMargins.push(0)
      }
    }

    let autoFitThreshold: number | undefined
    let heights: number[]
    let margins: number[]
    let keepWithNextArr: boolean[] | undefined

    if (page.mode === 'list') {
      // List mode: measurement container has allContentBlocks.
      // Binary search for auto-fit threshold, then paginate the filtered subset.
      if (fitMode === 'auto') {
        autoFitThreshold = findAutoFitThreshold(
          allContentBlocks,
          allHeights,
          allMargins,
          columns,
          firstPageCap,
          pageContentHeightMm,
          targetPages,
        )
      }

      // Map current contentBlocks to allContentBlocks indices
      const idToIdx = new Map(allContentBlocks.map((b, i) => [b.id, i]))
      const displayIndices = contentBlocks
        .map((b) => idToIdx.get(b.id))
        .filter((i): i is number => i != null)
      heights = displayIndices.map((i) => allHeights[i])
      margins = displayIndices.map((i) => allMargins[i])
    } else {
      // Mindmap mode: measurement container has flattened atoms.
      heights = allHeights
      margins = allMargins
      keepWithNextArr = mindmapAtoms.map((a) => a.keepWithNext)

      if (fitMode === 'auto') {
        const testAssign = paginateMeasuredItems(
          heights,
          margins,
          columns,
          firstPageCap,
          pageContentHeightMm,
          keepWithNextArr,
        )
        if (testAssign.length > targetPages) {
          // Heuristic: estimate threshold from overflow ratio
          const importances = blocks
            .filter((b) => b.type !== 'topic' && !b.must_keep)
            .map((b) => b.importance)
            .sort((a, b) => a - b)
          const overflowRatio = 1 - targetPages / testAssign.length
          const removeCount = Math.ceil(overflowRatio * importances.length)
          autoFitThreshold =
            removeCount >= importances.length ? 1 : (importances[removeCount] ?? 1)
        }
      }
    }

    const assignments = paginateMeasuredItems(
      heights,
      margins,
      columns,
      firstPageCap,
      pageContentHeightMm,
      keepWithNextArr,
    )

    setPageColumns((prev) => (samePageAssignments(prev, assignments) ? prev : assignments))

    const usedColumnHeights = assignments.flatMap((pageCols) =>
      pageCols.map((col) => {
        if (col.length === 0) return 0
        return col.reduce((sum, idx) => sum + heights[idx], 0) - margins[col[col.length - 1]]
      }),
    )
    const columnHeightMm =
      usedColumnHeights.length > 0 ? Math.max(...usedColumnHeights) : 0
    const result: FitResult = {
      actualPages: assignments.length,
      columnHeightMm,
      pageContentHeightMm,
      autoFitThreshold,
    }

    setLocalFit((prev) =>
      prev &&
      prev.actualPages === result.actualPages &&
      Math.abs(prev.columnHeightMm - result.columnHeightMm) < 1
        ? prev
        : result,
    )
    onFitResult?.(result)
  }, [
    measureItemCount,
    measureSignature,
    columns,
    pageContentHeightMm,
    singleColWidthMm,
    contentWidthMm,
    fontSize,
    lineHeight,
    densityLevel,
    mindmapIndent,
    mindmapRowGap,
    mindmapTopicGap,
    documentTitle,
    onFitResult,
    fitMode,
    targetPages,
    importanceThreshold,
    mindmapAtoms,
  ])

  const actualPages = pageColumns.length
  const overflowing = localFit != null && localFit.actualPages > targetPages
  const displayPages = actualPages

  const renderedPages = useMemo(() => {
    if (page.mode === 'mindmap') {
      return pageColumns.map((cols) =>
        cols.map((indices) =>
          indices.filter((i) => i < mindmapAtoms.length).map((i) => mindmapAtoms[i]),
        ),
      )
    }

    return pageColumns.map((cols) =>
      cols.map((indices) =>
        indices.filter((i) => i < contentBlocks.length).map((i) => contentBlocks[i]),
      ),
    )
  }, [pageColumns, page.mode, mindmapAtoms, contentBlocks])

  const measureFontStyle: React.CSSProperties = {
    fontSize: `${fontSize}pt`,
    lineHeight,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#1f2328',
  }

  return (
    <div style={styles.wrap} className="preview-backdrop">
      <div style={styles.meta} className="no-print">
        <span>A4 / {PAGE_W_MM}x{PAGE_H_MM}mm</span>
        <span>
          showing {keptCount}/{totalContent} blocks
        </span>
        {overflowing && localFit && (
          <span style={styles.overflowTag}>
            ! overflows {localFit.actualPages}/{targetPages} pages
          </span>
        )}
        <span>
          {page.mode === 'list'
            ? `${columns} col / ${fontSize}pt / lh ${page.layout.line_height}`
            : `${fontSize}pt`}
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          left: -9999,
        }}
      >
        <div ref={titleRef} style={{ width: `${contentWidthMm}mm`, ...measureFontStyle }}>
          <h1 style={page.mode === 'list' ? listTitleStyle : mindmapTitleStyle}>{documentTitle}</h1>
        </div>
        <div ref={itemsRef} style={{ width: `${singleColWidthMm}mm`, ...measureFontStyle }}>
          {page.mode === 'mindmap'
            ? mindmapAtoms.map((atom, idx) => (
                <div
                  key={`${atom.nodeId}-${idx}`}
                  style={
                    idx > 0 && atom.kind === 'topic-header'
                      ? { marginTop: mindmapTopicGap }
                      : undefined
                  }
                >
                  <MindmapAtomRender
                    atom={atom}
                    indent={mindmapIndent}
                    rowGap={mindmapRowGap}
                    densityLevel={densityLevel}
                  />
                </div>
              ))
            : allContentBlocks.map((block) => (
                <div key={block.id}>
                  <BlockRender block={block} densityLevel={densityLevel} />
                </div>
              ))}
        </div>
      </div>

      {Array.from({ length: displayPages }).map((_, pageIdx) => {
        const pageContent = renderedPages[pageIdx]
        const hasContent = Boolean(pageContent?.some((col) => col.length > 0))
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

            {hasContent &&
              (page.mode === 'list' ? (
                <ListPreview
                  documentTitle={documentTitle}
                  columns={pageContent as Block[][]}
                  layout={page.layout}
                  showTitle={isFirstPage}
                  onSelectBlock={onSelectBlock}
                />
              ) : (
                <MindmapPreview
                  documentTitle={documentTitle}
                  columns={pageContent as MindmapAtom[][]}
                  layout={page.layout}
                  showTitle={isFirstPage}
                  onSelectBlock={onSelectBlock}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}

const listTitleStyle: React.CSSProperties = {
  fontSize: '1.4em',
  fontWeight: 700,
  margin: '0 0 0.4em',
  textAlign: 'center',
  borderBottom: '1px solid #1f2328',
  paddingBottom: '0.2em',
}

const mindmapTitleStyle: React.CSSProperties = {
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
