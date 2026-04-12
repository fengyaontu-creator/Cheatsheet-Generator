import React from 'react'
import type { ListLayout, MindmapLayout, Page, PageMode } from '../../types/block'
import type { FitResult } from './PagePreview'
import {
  densityLabel,
  layoutPresetForDensity,
  mindmapPresetForDensity,
} from '../../utils/density'

interface Props {
  page: Page
  totalBlocks: number
  importanceThreshold: number
  onThresholdChange: (v: number) => void
  fitMode: 'auto' | 'manual'
  targetPages: number
  onTargetPagesChange: (n: number) => void
  onAutoFit: () => void
  lastFit: FitResult | null
  onModeChange: (mode: PageMode) => void
  onListChange: (patch: Partial<ListLayout>) => void
  onMindmapChange: (patch: Partial<MindmapLayout>) => void
}

export default function ControlPanel({
  page,
  totalBlocks,
  importanceThreshold,
  onThresholdChange,
  fitMode,
  targetPages,
  onTargetPagesChange,
  onAutoFit,
  lastFit,
  onModeChange,
  onListChange,
  onMindmapChange,
}: Props) {
  return (
    <div style={styles.bar}>
      <ModeSwitch mode={page.mode} onChange={onModeChange} />
      <div style={styles.divider} />
      <PageFitControl
        targetPages={targetPages}
        onTargetPagesChange={onTargetPagesChange}
        fitMode={fitMode}
        onAutoFit={onAutoFit}
        lastFit={lastFit}
      />
      <div style={styles.divider} />
      <ImportanceControl
        threshold={importanceThreshold}
        totalBlocks={totalBlocks}
        onChange={onThresholdChange}
      />
      <div style={styles.divider} />
      {page.mode === 'list' ? (
        <ListControls layout={page.layout} onChange={onListChange} />
      ) : (
        <MindmapControls layout={page.layout} onChange={onMindmapChange} />
      )}
    </div>
  )
}

function PageFitControl({
  targetPages,
  onTargetPagesChange,
  fitMode,
  onAutoFit,
  lastFit,
}: {
  targetPages: number
  onTargetPagesChange: (n: number) => void
  fitMode: 'auto' | 'manual'
  onAutoFit: () => void
  lastFit: FitResult | null
}) {
  const actual = lastFit?.actualPages ?? targetPages
  const overflow = lastFit ? lastFit.actualPages > targetPages : false
  const statusLabel = `${fitMode === 'auto' ? 'auto' : 'manual'} · ${actual}/${targetPages}${overflow ? ' ⚠' : ''}`

  return (
    <Control label={`Target pages · ${statusLabel}`}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="number"
          min={1}
          max={6}
          step={1}
          value={targetPages}
          onChange={(e) => onTargetPagesChange(Number(e.target.value))}
          style={{ ...styles.num, width: 48 }}
        />
        <button
          type="button"
          onClick={onAutoFit}
          style={{
            ...styles.autoBtn,
            ...(fitMode === 'auto' ? styles.autoBtnActive : {}),
            ...(overflow ? styles.autoBtnWarn : {}),
          }}
          title={overflow ? 'Content overflows target pages — click to auto-fit' : 'Auto-fit content to target pages'}
        >
          Auto
        </button>
      </div>
    </Control>
  )
}

function ImportanceControl({
  threshold,
  totalBlocks,
  onChange,
}: {
  threshold: number
  totalBlocks: number
  onChange: (v: number) => void
}) {
  const pct = Math.round(threshold * 100)
  return (
    <Control label={`Importance ≥ ${threshold.toFixed(2)} · ${totalBlocks} total`}>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={threshold}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 160 }}
        title={`Hide blocks below ${pct}% importance`}
      />
    </Control>
  )
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: PageMode
  onChange: (m: PageMode) => void
}) {
  return (
    <div style={styles.segment}>
      <button
        style={{
          ...styles.segmentBtn,
          ...(mode === 'list' ? styles.segmentActive : {}),
        }}
        onClick={() => onChange('list')}
      >
        List
      </button>
      <button
        style={{
          ...styles.segmentBtn,
          ...(mode === 'mindmap' ? styles.segmentActive : {}),
        }}
        onClick={() => onChange('mindmap')}
      >
        Mindmap
      </button>
    </div>
  )
}

function ListControls({
  layout,
  onChange,
}: {
  layout: ListLayout
  onChange: (patch: Partial<ListLayout>) => void
}) {
  function handleDensity(level: number) {
    const preset = layoutPresetForDensity(level)
    onChange({ density_level: level as ListLayout['density_level'], ...preset })
  }

  return (
    <>
      <Control label={`Density · ${densityLabel(layout.density_level)}`}>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={layout.density_level}
          onChange={(e) => handleDensity(Number(e.target.value))}
          style={{ width: 140 }}
        />
      </Control>

      <Control label="Columns">
        <select
          value={layout.columns}
          onChange={(e) => onChange({ columns: Number(e.target.value) })}
          style={styles.select}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </Control>

      <Control label="Font pt">
        <input
          type="number"
          step={0.5}
          min={5}
          max={14}
          value={layout.font_size_pt}
          onChange={(e) => onChange({ font_size_pt: Number(e.target.value) })}
          style={styles.num}
        />
      </Control>

      <Control label="Line-height">
        <input
          type="number"
          step={0.05}
          min={0.9}
          max={2}
          value={layout.line_height}
          onChange={(e) => onChange({ line_height: Number(e.target.value) })}
          style={styles.num}
        />
      </Control>

      <Control label="Margin mm">
        <input
          type="number"
          step={1}
          min={2}
          max={25}
          value={layout.margin_mm}
          onChange={(e) => onChange({ margin_mm: Number(e.target.value) })}
          style={styles.num}
        />
      </Control>
    </>
  )
}

function MindmapControls({
  layout,
  onChange,
}: {
  layout: MindmapLayout
  onChange: (patch: Partial<MindmapLayout>) => void
}) {
  function handleDensity(level: number) {
    const preset = mindmapPresetForDensity(level)
    onChange({ density_level: level as MindmapLayout['density_level'], ...preset })
  }

  return (
    <>
      <Control label={`Density · ${densityLabel(layout.density_level)}`}>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={layout.density_level}
          onChange={(e) => handleDensity(Number(e.target.value))}
          style={{ width: 140 }}
        />
      </Control>

      <Control label="Font pt">
        <input
          type="number"
          step={0.5}
          min={5}
          max={14}
          value={layout.font_size_pt}
          onChange={(e) => onChange({ font_size_pt: Number(e.target.value) })}
          style={styles.num}
        />
      </Control>

      <Control label="Margin mm">
        <input
          type="number"
          step={1}
          min={2}
          max={25}
          value={layout.margin_mm}
          onChange={(e) => onChange({ margin_mm: Number(e.target.value) })}
          style={styles.num}
        />
      </Control>
    </>
  )
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.control}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '10px 20px',
    background: '#fff',
    borderBottom: '1px solid #d0d7de',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  divider: {
    width: 1,
    height: 28,
    background: '#d0d7de',
  },
  segment: {
    display: 'flex',
    border: '1px solid #d0d7de',
    borderRadius: 6,
    overflow: 'hidden',
  },
  segmentBtn: {
    padding: '6px 14px',
    background: '#fff',
    border: 'none',
    borderRight: '1px solid #d0d7de',
    fontSize: 12,
    fontWeight: 600,
    color: '#57606a',
  },
  segmentActive: {
    background: '#1f2328',
    color: '#fff',
  },
  control: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: '#57606a',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  select: {
    padding: '4px 8px',
    border: '1px solid #d0d7de',
    borderRadius: 4,
    background: '#fff',
  },
  num: {
    width: 60,
    padding: '4px 6px',
    border: '1px solid #d0d7de',
    borderRadius: 4,
  },
  autoBtn: {
    padding: '5px 10px',
    background: '#fff',
    border: '1px solid #d0d7de',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    color: '#57606a',
    cursor: 'pointer',
  },
  autoBtnActive: {
    background: '#1f2328',
    color: '#fff',
    borderColor: '#1f2328',
  },
  autoBtnWarn: {
    background: '#ffebe9',
    borderColor: '#ff8182',
    color: '#82071e',
  },
}
