import type { CheatsheetProject } from '../types/block'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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
