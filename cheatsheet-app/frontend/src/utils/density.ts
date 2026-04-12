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
      return { font_size_pt: 10 }
    case 2:
      return { font_size_pt: 9 }
    case 3:
      return { font_size_pt: 8 }
    case 4:
      return { font_size_pt: 7 }
    case 5:
      return { font_size_pt: 6 }
    default:
      return {}
  }
}
