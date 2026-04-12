import type { Block, CheatsheetProject } from '../types/block'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface ExportBlockPayload {
  title: string
  content: string
  latex?: string
}

export interface ExportDocumentPayload {
  document_title: string
  blocks: ExportBlockPayload[]
  cols?: number
  margin_mm?: number
}

export interface ExportDocumentResult {
  blob: Blob
  isTexFallback: boolean
}

export async function exportDocument(
  payload: ExportDocumentPayload,
): Promise<ExportDocumentResult> {
  const res = await fetch(`${API_URL}/api/export/latex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // ignore
    }
    throw new Error(`Export failed: ${detail}`)
  }
  return {
    blob: await res.blob(),
    isTexFallback: res.headers.get('X-Export-Fallback') === 'tex',
  }
}

export function blocksToExportPayload(
  blocks: Block[],
  versionPicker: (b: Block) => string,
): ExportBlockPayload[] {
  return blocks.map((b) => ({
    title: b.title,
    content: b.latex ? b.content : versionPicker(b),
    latex: b.latex || undefined,
  }))
}

export async function ingestText(
  sourceText: string,
  userFocus: string,
): Promise<CheatsheetProject> {
  const res = await fetch(`${API_URL}/api/ingest/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_text: sourceText, user_focus: userFocus }),
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // ignore
    }
    throw new Error(`Ingest failed: ${detail}`)
  }
  return (await res.json()) as CheatsheetProject
}
