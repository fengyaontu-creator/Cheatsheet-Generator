import React, { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { sampleProject } from '../mock/sampleProject'
import type {
  CheatsheetProject,
  ListLayout,
  MindmapLayout,
  Page,
  PageMode,
} from '../types/block'
import BlockSidebar from '../components/editor/BlockSidebar'
import PagePreview, { type FitResult } from '../components/editor/PagePreview'
import ControlPanel from '../components/editor/ControlPanel'
import {
  blocksToExportPayload,
  exportDocument,
} from '../services/api'
import { pickVersion } from '../utils/density'
import { filterByImportance } from '../utils/filterByImportance'
import { collectDescendantIds, orderBlocksByIds } from '../utils/hierarchy'

const FIT_STEP = 0.05

const DEFAULT_LIST_LAYOUT: ListLayout = {
  columns: 2,
  font_size_pt: 8,
  line_height: 1.15,
  margin_mm: 10,
  density_level: 3,
}

const DEFAULT_MINDMAP_LAYOUT: MindmapLayout = {
  orientation: 'horizontal',
  font_size_pt: 8,
  margin_mm: 12,
  level_gap_mm: 42,
  sibling_gap_mm: 7,
  density_level: 3,
}

export default function EditorPage() {
  const location = useLocation()
  const injected = (location.state as { project?: CheatsheetProject } | null)?.project
  const [project, setProject] = useState<CheatsheetProject>(injected ?? sampleProject)
  const [importanceThreshold, setImportanceThreshold] = useState(0)
  const [fitMode, setFitMode] = useState<'auto' | 'manual'>('auto')
  const [targetPages, setTargetPages] = useState<number>(
    project.exam_profile?.target_pages || 1,
  )
  const [lastFit, setLastFit] = useState<FitResult | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const activePageIdx = 0
  const page = project.pages[activePageIdx]

  const visibleBlocks = project.blocks.filter((b) => !hiddenIds.has(b.id))
  const exportableBlocks = orderBlocksByIds(
    filterByImportance(visibleBlocks, importanceThreshold),
    page.block_ids,
  ).filter((b) => b.type !== 'topic')

  useEffect(() => {
    if (fitMode === 'auto') {
      setImportanceThreshold(0)
    }
  }, [targetPages, fitMode])

  const handleFitResult = useCallback(
    (result: FitResult) => {
      setLastFit((prev) => {
        if (
          prev &&
          prev.actualPages === result.actualPages &&
          Math.abs(prev.columnHeightMm - result.columnHeightMm) < 1
        ) {
          return prev
        }
        return result
      })
      if (fitMode === 'auto' && result.actualPages > targetPages) {
        setImportanceThreshold((t) => {
          if (t >= 1) return t
          return Math.min(1, Math.round((t + FIT_STEP) * 100) / 100)
        })
      }
    },
    [fitMode, targetPages],
  )

  function handleThresholdSlider(v: number) {
    setImportanceThreshold(v)
    setFitMode('manual')
  }

  function handleAutoFit() {
    setFitMode('auto')
    setImportanceThreshold(0)
  }

  function handleTargetPagesChange(n: number) {
    setTargetPages(Math.max(1, Math.min(6, n)))
  }

  function mutatePage(updater: (p: Page) => Page) {
    setProject((proj) => ({
      ...proj,
      pages: proj.pages.map((p, i) => (i === activePageIdx ? updater(p) : p)),
    }))
  }

  function handleModeChange(mode: PageMode) {
    if (mode === page.mode) return
    mutatePage((p) =>
      mode === 'list'
        ? { id: p.id, mode: 'list', layout: DEFAULT_LIST_LAYOUT, block_ids: p.block_ids }
        : {
            id: p.id,
            mode: 'mindmap',
            layout: DEFAULT_MINDMAP_LAYOUT,
            block_ids: p.block_ids,
          },
    )
  }

  function handleListChange(patch: Partial<ListLayout>) {
    mutatePage((p) =>
      p.mode === 'list' ? { ...p, layout: { ...p.layout, ...patch } } : p,
    )
  }

  function handleMindmapChange(patch: Partial<MindmapLayout>) {
    mutatePage((p) =>
      p.mode === 'mindmap' ? { ...p, layout: { ...p.layout, ...patch } } : p,
    )
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setProject((p) => {
      const idx = p.blocks.findIndex((b) => b.id === id)
      if (idx < 0) return p
      // Find next visible neighbour in the given direction
      let target = idx + dir
      while (target >= 0 && target < p.blocks.length && hiddenIds.has(p.blocks[target].id)) {
        target += dir
      }
      if (target < 0 || target >= p.blocks.length) return p
      const blocks = [...p.blocks]
      ;[blocks[idx], blocks[target]] = [blocks[target], blocks[idx]]
      return { ...p, blocks }
    })
  }

  function deleteBlock(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      for (const blockId of collectDescendantIds(project.blocks, id)) {
        next.add(blockId)
      }
      return next
    })
  }

  function restoreBlock(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      for (const blockId of collectDescendantIds(project.blocks, id)) {
        next.delete(blockId)
      }
      return next
    })
  }

  function toggleMustKeep(id: string) {
    setProject((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? { ...b, must_keep: !b.must_keep } : b)),
    }))
  }

  async function handleExport() {
    setExportError(null)
    setStatusMessage(null)

    if (page.mode !== 'list') {
      window.print()
      return
    }

    if (exportableBlocks.length === 0) {
      setExportError('No visible content to export.')
      return
    }

    setExporting(true)
    try {
      const result = await exportDocument({
        document_title: project.document_title,
        blocks: blocksToExportPayload(exportableBlocks, (block) =>
          pickVersion(block, page.layout.density_level),
        ),
        cols: page.layout.columns,
        margin_mm: Math.round(page.layout.margin_mm),
      })
      const extension = result.isTexFallback ? 'tex' : 'pdf'
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${slugify(project.document_title)}.${extension}`
      anchor.click()
      URL.revokeObjectURL(url)
      if (result.isTexFallback) {
        setStatusMessage(
          'PDF compiler was unavailable, so the export fell back to a .tex file.',
        )
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={styles.app}>
      <header style={styles.header} className="no-print">
        <Link to="/" style={styles.brand}>
          ← Cheatsheet
        </Link>
        <h2 style={styles.docTitle}>{project.document_title}</h2>
        <button style={styles.exportBtn} onClick={handleExport} disabled={exporting}>
          {page.mode === 'list'
            ? exporting
              ? 'Exporting...'
              : 'Export PDF'
            : 'Print / Save PDF'}
        </button>
      </header>

      {(project.warnings?.length || exportError || statusMessage) && (
        <div className="no-print" style={styles.noticeStack}>
          {project.warnings?.map((warning) => (
            <div key={warning} style={styles.warningBanner}>
              {warning}
            </div>
          ))}
          {statusMessage && <div style={styles.infoBanner}>{statusMessage}</div>}
          {exportError && <div style={styles.errorBanner}>{exportError}</div>}
        </div>
      )}

      <div className="no-print">
        <ControlPanel
          page={page}
          totalBlocks={project.blocks.length}
          importanceThreshold={importanceThreshold}
          onThresholdChange={handleThresholdSlider}
          fitMode={fitMode}
          targetPages={targetPages}
          onTargetPagesChange={handleTargetPagesChange}
          onAutoFit={handleAutoFit}
          lastFit={lastFit}
          onModeChange={handleModeChange}
          onListChange={handleListChange}
          onMindmapChange={handleMindmapChange}
        />
      </div>

      <main style={styles.main}>
        <div className="no-print" style={styles.sidebarWrap}>
          <BlockSidebar
            blocks={project.blocks}
            hiddenIds={hiddenIds}
            onMove={moveBlock}
            onDelete={deleteBlock}
            onRestore={restoreBlock}
            onToggleLock={toggleMustKeep}
          />
        </div>
        <PagePreview
          documentTitle={project.document_title}
          blocks={visibleBlocks}
          page={page}
          importanceThreshold={importanceThreshold}
          targetPages={targetPages}
          onFitResult={handleFitResult}
        />
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f4f5f7',
  },
  header: {
    height: 52,
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    background: '#fff',
    borderBottom: '1px solid #d0d7de',
    flexShrink: 0,
  },
  brand: {
    fontWeight: 700,
    color: '#1f2328',
    textDecoration: 'none',
  },
  docTitle: {
    fontSize: 15,
    fontWeight: 500,
    margin: 0,
    flex: 1,
    color: '#57606a',
  },
  exportBtn: {
    padding: '8px 16px',
    background: '#1f2328',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontWeight: 600,
  },
  noticeStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 20px 0',
    background: '#f4f5f7',
  },
  warningBanner: {
    padding: '10px 12px',
    borderRadius: 8,
    background: '#fff8c5',
    color: '#7d4e00',
    border: '1px solid #d4a72c',
    fontSize: 13,
  },
  infoBanner: {
    padding: '10px 12px',
    borderRadius: 8,
    background: '#ddf4ff',
    color: '#0550ae',
    border: '1px solid #54aeff',
    fontSize: 13,
  },
  errorBanner: {
    padding: '10px 12px',
    borderRadius: 8,
    background: '#ffebe9',
    color: '#cf222e',
    border: '1px solid #ff8182',
    fontSize: 13,
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },
  sidebarWrap: {
    display: 'flex',
    flexShrink: 0,
  },
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cheatsheet'
}
