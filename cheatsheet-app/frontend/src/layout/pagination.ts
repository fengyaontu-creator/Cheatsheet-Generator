import type { Block } from '../types/block'

/**
 * PageColumnAssignments — one entry per page, each page has N columns,
 * each column is an array of item indices into the measured heights array.
 */
export type PageColumnAssignments = number[][][]

export interface PartitionOption {
  columns: number[][]
  maxHeight: number
  minHeight: number
}

// ─── Core pagination ────────────────────────────────────────────────

/**
 * Given measured item heights, split them into pages × columns.
 *
 * @param heights    - height (mm) of each item including its gap
 * @param margins    - trailing gap (mm) per item (subtracted at column bottom)
 * @param columns    - number of columns per page
 * @param firstPageCapacity  - usable height (mm) on the first page (after title)
 * @param followingPageCapacity - usable height (mm) on subsequent pages
 * @param keepWithNext - per-item flag: if true, this item must not be the last
 *                       item before a page or column break
 */
export function paginateMeasuredItems(
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

// ─── Column partitioning ────────────────────────────────────────────

export function findBestPartition(
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

// ─── Auto-fit threshold search ──────────────────────────────────────

/**
 * Binary-search for the minimum importance threshold that makes content
 * fit within targetPages. Returns 0 if everything already fits.
 *
 * Callers can override the default strict filter via `pickKeptIndices`
 * (e.g. list mode needs keep-ancestors semantics so topic headers survive
 * with their surviving children) and provide a `computeKeepWithNext`
 * hook so subtree-cohesion hints apply during the search.
 */
export function findAutoFitThreshold(
  allBlocks: Block[],
  allHeights: number[],
  allMargins: number[],
  columns: number,
  firstPageCap: number,
  followingPageCap: number,
  targetPages: number,
  pickKeptIndices?: (threshold: number) => number[],
  computeKeepWithNext?: (keptIndices: number[]) => boolean[] | undefined,
): number {
  const allIndices = allBlocks.map((_, i) => i)

  const fullKwn = computeKeepWithNext?.(allIndices)
  const fullAssign = paginateMeasuredItems(
    allHeights,
    allMargins,
    columns,
    firstPageCap,
    followingPageCap,
    fullKwn,
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

    const kept = pickKeptIndices
      ? pickKeptIndices(t)
      : allIndices.filter((i) => allBlocks[i].must_keep || allBlocks[i].importance >= t)
    const keptH = kept.map((i) => allHeights[i])
    const keptM = kept.map((i) => allMargins[i])
    const keptKwn = computeKeepWithNext?.(kept)
    const assign = paginateMeasuredItems(
      keptH,
      keptM,
      columns,
      firstPageCap,
      followingPageCap,
      keptKwn,
    )

    if (assign.length <= targetPages) {
      best = mid
      hi = mid - 1 // try to keep more blocks (lower threshold)
    } else {
      lo = mid + 1
    }
  }

  return best >= 0 ? thresholds[best] : 1
}

// ─── Helpers ────────────────────────────────────────────────────────

export function createEmptyColumns(columns: number): number[][] {
  return Array.from({ length: columns }, () => [])
}

export function samePageAssignments(
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
