import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Block, Page } from '../../types/block'
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

type PageColumnAssignments = number[][][]

interface Props {
  documentTitle: string
  blocks: Block[]
  page: Page
  importanceThreshold?: number
  targetPages?: number
  fitMode?: 'auto' | 'manual'
  onFitResult?: (r: FitResult) => void
}

export default function PagePreview({
  documentTitle,
  blocks,
  page,
  importanceThreshold = 0,
  targetPages = 1,
  fitMode = 'manual',
  onFitResult,
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
                />
              ) : (
                <MindmapPreview
                  documentTitle={documentTitle}
                  columns={pageContent as MindmapAtom[][]}
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

function createEmptyColumns(columns: number): number[][] {
  return Array.from({ length: columns }, () => [])
}

function samePageAssignments(
  current: PageColumnAssignments,
  next: PageColumnAssignments,
): boolean {
  if (current.length !== next.length) return false

  return current.every((page, pageIdx) => {
    const otherPage = next[pageIdx]
    if (!otherPage || page.length !== otherPage.length) return false

    return page.every((column, columnIdx) => {
      const otherColumn = otherPage[columnIdx]
      return (
        Boolean(otherColumn) &&
        column.length === otherColumn.length &&
        column.every((value, itemIdx) => value === otherColumn[itemIdx])
      )
    })
  })
}

function paginateMeasuredItems(
  heights: number[],
  margins: number[],
  columns: number,
  firstPageCapacity: number,
  followingPageCapacity: number,
  keepWithNext?: boolean[],
): PageColumnAssignments {
  if (heights.length === 0) {
    return [createEmptyColumns(columns)]
  }

  const prefix = buildPrefixSums(heights)
  const pages: PageColumnAssignments = []
  let start = 0
  let pageIdx = 0

  while (start < heights.length) {
    const capacity = pageIdx === 0 ? firstPageCapacity : followingPageCapacity
    let bestEnd = start
    let bestPartition: PartitionOption | null = null

    for (let end = start + 1; end <= heights.length; end++) {
      const partition = findBestPartition(prefix, margins, keepWithNext, start, end, columns, capacity)
      if (!partition) break
      // Respect keepWithNext at page boundaries
      if (end < heights.length && keepWithNext?.[end - 1]) continue
      bestEnd = end
      bestPartition = partition
    }

    if (!bestPartition || bestEnd === start) {
      pages.push(padColumns([buildIndexRange(start, start + 1)], columns))
      start += 1
      pageIdx += 1
      continue
    }

    pages.push(bestPartition.columns)
    start = bestEnd
    pageIdx += 1
  }

  return pages
}

interface PartitionOption {
  columns: number[][]
  maxHeight: number
  minHeight: number
}

function findBestPartition(
  prefix: number[],
  margins: number[],
  keepWithNext: boolean[] | undefined,
  start: number,
  end: number,
  columns: number,
  capacity: number,
): PartitionOption | null {
  const memo = new Map<string, PartitionOption | null>()

  function search(from: number, remainingColumns: number): PartitionOption | null {
    const key = `${from}:${remainingColumns}`
    if (memo.has(key)) {
      return memo.get(key) ?? null
    }

    if (from === end) {
      const done: PartitionOption = { columns: [], maxHeight: 0, minHeight: Infinity }
      memo.set(key, done)
      return done
    }

    if (remainingColumns === 0) {
      memo.set(key, null)
      return null
    }

    let best: PartitionOption | null = null

    for (let cut = from + 1; cut <= end; cut++) {
      // Don't split at keepWithNext boundary (item cut-1 must stay with item cut)
      if (cut < end && keepWithNext?.[cut - 1]) continue
      // Subtract trailing margin of last item — it doesn't occupy
      // vertical space when the item is at the bottom of its column
      const segmentHeight = prefix[cut] - prefix[from] - margins[cut - 1]
      if (segmentHeight > capacity) break

      const rest = search(cut, remainingColumns - 1)
      if (!rest) continue

      const minHeight =
        rest.minHeight === Infinity
          ? segmentHeight
          : Math.min(segmentHeight, rest.minHeight)
      const candidate: PartitionOption = {
        columns: [buildIndexRange(from, cut), ...rest.columns],
        maxHeight: Math.max(segmentHeight, rest.maxHeight),
        minHeight,
      }

      if (!best || isBetterPartition(candidate, best)) {
        best = candidate
      }
    }

    memo.set(key, best)
    return best
  }

  const result = search(start, columns)
  if (!result) return null

  return {
    ...result,
    columns: padColumns(result.columns, columns),
  }
}

function findAutoFitThreshold(
  allBlocks: Block[],
  allHeights: number[],
  allMargins: number[],
  columns: number,
  firstPageCap: number,
  followingPageCap: number,
  targetPages: number,
): number {
  // Check if everything fits without filtering
  const fullAssign = paginateMeasuredItems(
    allHeights,
    allMargins,
    columns,
    firstPageCap,
    followingPageCap,
  )
  if (fullAssign.length <= targetPages) return 0

  // Collect unique importance values from removable blocks
  const thresholds = [
    ...new Set(allBlocks.filter((b) => !b.must_keep).map((b) => b.importance)),
  ].sort((a, b) => a - b)

  if (thresholds.length === 0) return 0 // all blocks are must_keep, nothing to remove

  // Binary search: find the minimum threshold where content fits
  let lo = 0
  let hi = thresholds.length - 1
  let best = -1

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const t = thresholds[mid]

    const kept = allBlocks
      .map((_, i) => i)
      .filter((i) => allBlocks[i].must_keep || allBlocks[i].importance >= t)
    const keptH = kept.map((i) => allHeights[i])
    const keptM = kept.map((i) => allMargins[i])
    const assign = paginateMeasuredItems(keptH, keptM, columns, firstPageCap, followingPageCap)

    if (assign.length <= targetPages) {
      best = mid
      hi = mid - 1 // try to keep more blocks (lower threshold)
    } else {
      lo = mid + 1
    }
  }

  return best >= 0 ? thresholds[best] : 1
}

function isBetterPartition(candidate: PartitionOption, current: PartitionOption): boolean {
  if (candidate.maxHeight !== current.maxHeight) {
    return candidate.maxHeight < current.maxHeight
  }

  const candidateSpread = candidate.maxHeight - candidate.minHeight
  const currentSpread = current.maxHeight - current.minHeight
  if (candidateSpread !== currentSpread) {
    return candidateSpread < currentSpread
  }

  return candidate.columns.length > current.columns.length
}

function buildPrefixSums(values: number[]): number[] {
  const prefix = [0]
  for (const value of values) {
    prefix.push(prefix[prefix.length - 1] + value)
  }
  return prefix
}

function buildIndexRange(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, idx) => start + idx)
}

function padColumns(columns: number[][], totalColumns: number): number[][] {
  return [
    ...columns,
    ...Array.from({ length: Math.max(0, totalColumns - columns.length) }, () => []),
  ]
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
