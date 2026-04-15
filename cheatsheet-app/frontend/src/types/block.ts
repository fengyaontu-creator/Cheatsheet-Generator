export type BlockType =
  | 'topic'
  | 'definition'
  | 'formula'
  | 'comparison'
  | 'pitfall'
  | 'procedure'
  | 'exam_tip'
  | 'example'
  | 'image'

export type Compressibility = 'high' | 'medium' | 'low'

export interface Block {
  id: string
  type: BlockType
  title: string
  content: string
  parent_id?: string
  content_short?: string
  content_ultra_short?: string
  latex?: string
  importance: number
  compressibility: Compressibility
  must_keep: boolean
  source_ref?: string
  image_data?: string       // base64 data URI for image blocks
  image_width?: 'small' | 'medium' | 'full'
  image_caption?: string
  image_natural_width?: number
  image_natural_height?: number
}

export interface ExamProfile {
  exam_type: 'MCQ' | 'short' | 'mixed'
  target_pages: number
  priority_mode: 'balanced' | 'formula' | 'definition' | 'pitfall' | 'cram'
}

export type DensityLevel = 1 | 2 | 3 | 4 | 5

export interface ListLayout {
  columns: number
  font_size_pt: number
  line_height: number
  margin_mm: number
  density_level: DensityLevel
}

export interface MindmapLayout {
  orientation: 'horizontal' | 'vertical'
  font_size_pt: number
  margin_mm: number
  level_gap_mm: number
  sibling_gap_mm: number
  density_level: DensityLevel
}

export type PageMode = 'list' | 'mindmap'

export type Page =
  | { id: string; mode: 'list'; layout: ListLayout; block_ids: string[] }
  | { id: string; mode: 'mindmap'; layout: MindmapLayout; block_ids: string[] }

export interface CheatsheetProject {
  document_title: string
  exam_profile: ExamProfile
  blocks: Block[]
  pages: Page[]
  warnings?: string[]
}

export type DensityVersion = 'full' | 'short' | 'ultra_short'
