import React from 'react'

// Matches **bold**, *italic*, or `code` on a single line. Non-greedy content,
// no nesting. `**` must come before `*` in the alternation so the opener
// doesn't get eaten by the single-star branch.
const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g

/**
 * Render LLM-produced inline markdown to React nodes.
 *
 * Block content from Stage 2/3 of the pipeline can include `**bold**` and
 * similar emphasis. We pass that through as literal text by default; this
 * helper swaps the three common inline forms for the matching HTML element.
 * Unmatched or malformed markers (stray `**`, cross-line spans) fall through
 * as plain text so we never lose content.
 */
export function renderInline(text: string | null | undefined): React.ReactNode {
  if (!text) return text ?? ''
  const parts = text.split(INLINE_RE)
  if (parts.length === 1) return text
  const out: React.ReactNode[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === '') continue
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      out.push(<strong key={i}>{part.slice(2, -2)}</strong>)
    } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
      out.push(<em key={i}>{part.slice(1, -1)}</em>)
    } else if (part.startsWith('`') && part.endsWith('`') && part.length >= 3) {
      out.push(<code key={i}>{part.slice(1, -1)}</code>)
    } else {
      out.push(part)
    }
  }
  return out
}
