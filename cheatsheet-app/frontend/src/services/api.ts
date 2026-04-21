import type { CheatsheetProject } from '../types/block'

// Empty string → fetch uses relative paths like `/api/ingest`. In dev the
// Vite dev server proxies `/api` to the backend (see vite.config.ts); in
// prod nginx proxies the same prefix to the uvicorn port. Override with
// `VITE_API_URL=http://localhost:8000` if you ever want to bypass the proxy.
const API_URL = import.meta.env.VITE_API_URL ?? ''

export type JobStage = 'comprehend' | 'topics' | 'outline' | 'compress'
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface JobProgress {
  job_id: string
  status: JobStatus
  stage: JobStage | null
  topics_total: number | null
  topics_done: number | null
  warnings: string[]
  result: CheatsheetProject | null
  error: string | null
  created_at: string
  updated_at: string
}

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

/** Unified file upload — documents + images in one request. */
export async function ingestFiles(
  files: File[],
  userFocus: string,
  language: string = 'en',
): Promise<CheatsheetProject> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  form.append('user_focus', userFocus)
  form.append('language', language)
  const res = await fetch(`${API_URL}/api/ingest`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res, 'File ingest failed')
}

/** Paste text — JSON body. */
export async function ingestText(
  sourceText: string,
  userFocus: string,
  language: string = 'en',
): Promise<CheatsheetProject> {
  const res = await fetch(`${API_URL}/api/ingest/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_text: sourceText,
      user_focus: userFocus,
      language,
    }),
  })
  return handleResponse(res, 'Ingest failed')
}

async function handleJobStart(res: Response, label: string): Promise<string> {
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
  const body = (await res.json()) as { job_id: string }
  return body.job_id
}

/** Start an async job for pasted text. Returns the job id. */
export async function startIngestTextJob(
  sourceText: string,
  userFocus: string,
  language: string = 'en',
): Promise<string> {
  const res = await fetch(`${API_URL}/api/ingest/jobs/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_text: sourceText,
      user_focus: userFocus,
      language,
    }),
  })
  return handleJobStart(res, 'Ingest failed')
}

/** Start an async job for uploaded files. Returns the job id. */
export async function startIngestFilesJob(
  files: File[],
  userFocus: string,
  language: string = 'en',
): Promise<string> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  form.append('user_focus', userFocus)
  form.append('language', language)
  const res = await fetch(`${API_URL}/api/ingest/jobs/files`, {
    method: 'POST',
    body: form,
  })
  return handleJobStart(res, 'File ingest failed')
}

/** Poll current job state. */
export async function getIngestJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobProgress> {
  const res = await fetch(`${API_URL}/api/ingest/jobs/${jobId}`, { signal })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      // ignore
    }
    throw new Error(`Job poll failed: ${detail}`)
  }
  return (await res.json()) as JobProgress
}
