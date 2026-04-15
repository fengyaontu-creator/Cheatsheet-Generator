import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { sampleProject } from '../mock/sampleProject'
import type {
  Block,
  CheatsheetProject,
  ListLayout,
  MindmapLayout,
  Page,
  PageMode,
} from '../types/block'
import BlockSidebar from '../components/editor/BlockSidebar'
import PagePreview, { type FitResult } from '../components/editor/PagePreview'
import ControlPanel from '../components/editor/ControlPanel'
import { exportPdf } from '../services/api'
import { collectDescendantIds } from '../utils/hierarchy'

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

const STORAGE_KEY = 'cheatsheet_editor_project'
const HIDDEN_KEY = 'cheatsheet_editor_hidden'

function loadInitialProject(injected: CheatsheetProject | undefined): CheatsheetProject {
  // sessionStorage wins when present — it's the freshest state, including edits.
  // UploadPanel clears it on new submissions, so a non-empty value means
  // "we're refreshing an existing editor session", not "stale previous upload".
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as CheatsheetProject
  } catch { /* ignore corrupt data */ }

  // Fresh navigation from Create page (sessionStorage was just cleared)
  return injected ?? sampleProject
}

function loadHiddenIds(): Set<string> {
  try {
    const stored = sessionStorage.getItem(HIDDEN_KEY)
    if (stored) return new Set(JSON.parse(stored) as string[])
  } catch { /* ignore */ }
  return new Set()
}

export default function EditorPage() {
  const location = useLocation()
  const injected = (location.state as { project?: CheatsheetProject } | null)?.project
  const [project, setProject] = useState<CheatsheetProject>(() => loadInitialProject(injected))
  const [importanceThreshold, setImportanceThreshold] = useState(0)
  const [fitMode, setFitMode] = useState<'auto' | 'manual'>('auto')
  const [targetPages, setTargetPages] = useState<number>(
    project.exam_profile?.target_pages || 1,
  )
  const [lastFit, setLastFit] = useState<FitResult | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(loadHiddenIds)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const insertImgRef = useRef<HTMLInputElement>(null)
  const activePageIdx = 0
  const page = project.pages[activePageIdx]

  const visibleBlocks = project.blocks.filter((b) => !hiddenIds.has(b.id))

  // Persist project and hiddenIds to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(project)) }
    catch { /* quota exceeded — ignore */ }
  }, [project])

  useEffect(() => {
    try { sessionStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenIds])) }
    catch { /* ignore */ }
  }, [hiddenIds])

  useEffect(() => {
    if (fitMode === 'auto') {
      setImportanceThreshold(0)
    }
  }, [targetPages, fitMode])

  // Scroll sidebar to the double-clicked block. rAF ensures the matching
  // BlockCard has actually committed to the DOM (new selection may trigger
  // highlight style change in the same render cycle).
  useEffect(() => {
    if (!selectedBlockId) return
    const id = selectedBlockId
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-sidebar-block-id="${CSS.escape(id)}"]`,
      )
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedBlockId])

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
      if (result.autoFitThreshold != null) {
        setImportanceThreshold(result.autoFitThreshold)
      }
    },
    [],
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
      const movingBlock = p.blocks[idx]

      let target = idx + dir
      if (page.mode === 'mindmap') {
        // Mindmap renders via buildTree(parent_id), so "adjacent" means
        // "next non-hidden sibling with the same parent_id". Swapping with a
        // non-sibling wouldn't change the tree grouping and would look like
        // nothing happened to the user.
        const movingParent = movingBlock.parent_id ?? null
        while (target >= 0 && target < p.blocks.length) {
          const cand = p.blocks[target]
          const candParent = cand.parent_id ?? null
          if (!hiddenIds.has(cand.id) && candParent === movingParent) break
          target += dir
        }
      } else {
        // List renders from page.block_ids (no topics). "Adjacent" means
        // next non-hidden non-topic block; topics get skipped so sidebar
        // and preview stay in sync.
        const isTopic = movingBlock.type === 'topic'
        const shouldSkip = (b: Block) =>
          hiddenIds.has(b.id) || (!isTopic && b.type === 'topic')
        while (target >= 0 && target < p.blocks.length && shouldSkip(p.blocks[target])) {
          target += dir
        }
      }
      if (target < 0 || target >= p.blocks.length) return p

      const targetId = p.blocks[target].id
      const blocks = [...p.blocks]
      ;[blocks[idx], blocks[target]] = [blocks[target], blocks[idx]]

      // Mirror the swap in each page's block_ids so the list preview follows.
      // Topics and rootless siblings (e.g. images with no parent_id swapping
      // with a topic) aren't both in page.block_ids; bIdx < 0 falls through.
      const pages = p.pages.map((pg) => {
        const aIdx = pg.block_ids.indexOf(id)
        const bIdx = pg.block_ids.indexOf(targetId)
        if (aIdx < 0 || bIdx < 0) return pg
        const block_ids = [...pg.block_ids]
        ;[block_ids[aIdx], block_ids[bIdx]] = [block_ids[bIdx], block_ids[aIdx]]
        return { ...pg, block_ids }
      })

      return { ...p, blocks, pages }
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

  function setImageWidth(id: string, width: 'small' | 'medium' | 'full') {
    setProject((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? { ...b, image_width: width } : b)),
    }))
  }

  function handleInsertImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUri = reader.result as string
      const name = file.name.replace(/\.[^.]+$/, '')
      // Decode image to get natural dimensions for correct layout measurement
      const img = new Image()
      img.onload = () => {
        const newBlock: Block = {
          id: `img_${Date.now()}`,
          type: 'image',
          title: name,
          content: '',
          importance: 1,
          compressibility: 'low',
          must_keep: true,
          image_data: dataUri,
          image_width: 'full',
          image_caption: '',
          image_natural_width: img.naturalWidth,
          image_natural_height: img.naturalHeight,
        }
        setProject((p) => ({
          ...p,
          blocks: [...p.blocks, newBlock],
          pages: p.pages.map((pg) => ({ ...pg, block_ids: [...pg.block_ids, newBlock.id] })),
        }))
      }
      img.src = dataUri
    }
    reader.readAsDataURL(file)
    if (insertImgRef.current) insertImgRef.current.value = ''
  }

  async function handleExport() {
    setExportError(null)
    setStatusMessage(null)

    // Grab all rendered page cards from the DOM
    const pages = document.querySelectorAll('.print-page')
    if (pages.length === 0) {
      setExportError('No content to export.')
      return
    }

    const stylesheets = await collectStylesForExport(document.styleSheets)

    // Build self-contained HTML with only the page cards
    const pagesHtml = Array.from(pages)
      .filter((el) => !el.classList.contains('no-print'))
      .map((el) => el.outerHTML)
      .join('\n')

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
${stylesheets}
.print-page {
  page-break-after: always;
  break-after: page;
  box-shadow: none !important;
}
.print-page:last-child {
  page-break-after: auto;
  break-after: auto;
}
.no-print { display: none !important; }
</style>
</head><body>${pagesHtml}</body></html>`

    setExporting(true)
    try {
      const blob = await exportPdf(html)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${slugify(project.document_title)}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
        <input
          ref={insertImgRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handleInsertImage}
        />
        <button
          style={styles.insertImgBtn}
          onClick={() => insertImgRef.current?.click()}
        >
          + Image
        </button>
        <button style={styles.exportBtn} onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export PDF'}
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
            selectedBlockId={selectedBlockId}
            onMove={moveBlock}
            onDelete={deleteBlock}
            onRestore={restoreBlock}
            onToggleLock={toggleMustKeep}
            onSetImageWidth={setImageWidth}
          />
        </div>
        <PagePreview
          documentTitle={project.document_title}
          blocks={visibleBlocks}
          page={page}
          importanceThreshold={importanceThreshold}
          targetPages={targetPages}
          fitMode={fitMode}
          onFitResult={handleFitResult}
          onSelectBlock={setSelectedBlockId}
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
  insertImgBtn: {
    padding: '8px 14px',
    background: '#fff',
    color: '#1f2328',
    border: '1px solid #d0d7de',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
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
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cheatsheet'
}

async function collectStylesForExport(styleSheets: StyleSheetList): Promise<string> {
  const cache = new Map<string, Promise<string>>()
  const chunks = await Promise.all(
    Array.from(styleSheets).map(async (sheet) => {
      const cssSheet = sheet as CSSStyleSheet
      try {
        const cssText = Array.from(cssSheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n')
        return await inlineCssUrls(cssText, cssSheet.href ?? window.location.href, cache)
      } catch {
        return ''
      }
    }),
  )
  return chunks.filter(Boolean).join('\n')
}

async function inlineCssUrls(
  cssText: string,
  baseUrl: string,
  cache: Map<string, Promise<string>>,
): Promise<string> {
  const matches = Array.from(cssText.matchAll(/url\(([^)]+)\)/g))
  if (matches.length === 0) return cssText

  const replacements = await Promise.all(
    matches.map(async (match) => {
      const rawUrl = match[1]?.trim().replace(/^['"]|['"]$/g, '')
      if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.startsWith('#')) {
        return match[0]
      }

      let resolvedUrl: string
      try {
        resolvedUrl = new URL(rawUrl, baseUrl).toString()
      } catch {
        return match[0]
      }

      if (!cache.has(resolvedUrl)) {
        cache.set(
          resolvedUrl,
          fetch(resolvedUrl)
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Failed to fetch asset: ${resolvedUrl}`)
              }
              return res.blob()
            })
            .then(blobToDataUrl),
        )
      }

      try {
        const dataUrl = await cache.get(resolvedUrl)!
        return `url("${dataUrl}")`
      } catch {
        return match[0]
      }
    }),
  )

  let nextCss = cssText
  for (let i = 0; i < matches.length; i++) {
    nextCss = nextCss.replace(matches[i][0], replacements[i])
  }
  return nextCss
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
