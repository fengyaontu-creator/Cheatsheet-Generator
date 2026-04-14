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

async function handleResponse(res: Response, label: string): Promise<CheatsheetProject> {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // ignore
    }
    throw new Error(`${label}: ${detail}`)
  }
  return (await res.json()) as CheatsheetProject
}

function appendImages(form: FormData, images?: File[]) {
  if (images) {
    for (const img of images) form.append('images', img)
  }
}

export async function ingestPdf(
  file: File,
  userFocus: string,
  language: string = 'en',
  images?: File[],
): Promise<CheatsheetProject> {
  const form = new FormData()
  form.append('file', file)
  form.append('user_focus', userFocus)
  form.append('language', language)
  appendImages(form, images)
  const res = await fetch(`${API_URL}/api/ingest/pdf`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res, 'PDF ingest failed')
}

export async function ingestText(
  sourceText: string,
  userFocus: string,
  language: string = 'en',
  images?: File[],
): Promise<CheatsheetProject> {
  const form = new FormData()
  form.append('source_text', sourceText)
  form.append('user_focus', userFocus)
  form.append('language', language)
  appendImages(form, images)
  const res = await fetch(`${API_URL}/api/ingest/text`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res, 'Ingest failed')
}
