import type { Block, DensityVersion, ListLayout, MindmapLayout } from '../types/block'

export function pickVersion(block: Block, densityLevel: number): string {
  const v = versionForLevel(densityLevel)
  if (v === 'ultra_short' && block.content_ultra_short) return block.content_ultra_short
  if ((v === 'short' || v === 'ultra_short') && block.content_short) return block.content_short
  return block.content
}

export function versionForLevel(level: number): DensityVersion {
  if (level <= 2) return 'full'
  if (level === 3) return 'full'
  if (level === 4) return 'short'
  return 'ultra_short'
}

/**
 * Mindmap subtitle version — shifted one notch tighter than list mode.
 * Level 5 returns '' (title-only skeleton).
 */
export function pickMindmapVersion(block: Block, densityLevel: number): string {
  if (densityLevel >= 5) return ''
  if (densityLevel >= 3) {
    // dense / exam-cram → ultra_short
    if (block.content_ultra_short) return block.content_ultra_short
    if (block.content_short) return block.content_short
    return block.content
  }
  // readable / balanced → short
  if (block.content_short) return block.content_short
  return block.content
}

export function densityLabel(level: number): string {
  return ['', 'Readable', 'Balanced', 'Dense', 'Exam cram', 'Max density'][level] ?? ''
}

export function layoutPresetForDensity(level: number): Partial<ListLayout> {
  switch (level) {
    case 1:
      return { font_size_pt: 10, line_height: 1.35 }
    case 2:
      return { font_size_pt: 9, line_height: 1.25 }
    case 3:
      return { font_size_pt: 8, line_height: 1.15 }
    case 4:
      return { font_size_pt: 7, line_height: 1.05 }
    case 5:
      return { font_size_pt: 6.5, line_height: 1.0 }
    default:
      return {}
  }
}

export function mindmapPresetForDensity(level: number): Partial<MindmapLayout> {
  switch (level) {
    case 1:
      return { font_size_pt: 10, level_gap_mm: 52, sibling_gap_mm: 10 }
    case 2:
      return { font_size_pt: 9, level_gap_mm: 46, sibling_gap_mm: 8 }
    case 3:
      return { font_size_pt: 8, level_gap_mm: 42, sibling_gap_mm: 7 }
    case 4:
      return { font_size_pt: 7, level_gap_mm: 36, sibling_gap_mm: 5.5 }
    case 5:
      return { font_size_pt: 6, level_gap_mm: 32, sibling_gap_mm: 4.5 }
    default:
      return {}
  }
}
