import type { CheatsheetProject } from '../types/block'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function exportPdf(html: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
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
  return await res.blob()
}

export async function ingestPdf(
  file: File,
  userFocus: string,
  language: string = 'en',
): Promise<CheatsheetProject> {
  const form = new FormData()
  form.append('file', file)
  form.append('user_focus', userFocus)
  form.append('language', language)
  const res = await fetch(`${API_URL}/api/ingest/pdf`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // ignore
    }
    throw new Error(`PDF ingest failed: ${detail}`)
  }
  return (await res.json()) as CheatsheetProject
}

export async function ingestText(
  sourceText: string,
  userFocus: string,
  language: string = 'en',
): Promise<CheatsheetProject> {
  const res = await fetch(`${API_URL}/api/ingest/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_text: sourceText, user_focus: userFocus, language }),
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
