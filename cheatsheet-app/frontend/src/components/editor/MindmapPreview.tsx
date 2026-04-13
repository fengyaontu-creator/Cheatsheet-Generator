import React from 'react'
import type { MindmapLayout } from '../../types/block'
import { pickMindmapVersion } from '../../utils/density'
import type { MindmapAtom } from '../../utils/hierarchy'
import Katex from '../ui/Katex'

/* ── Public props ── */

interface Props {
  documentTitle: string
  columns: MindmapAtom[][]
  layout: MindmapLayout
  showTitle?: boolean
}

/* ── Fragment: a contiguous run of atoms from the same topic in one column ── */

interface MindmapFragment {
  topicId: string
  topicTitle: string
  isContinuation: boolean
  atoms: MindmapAtom[]
}

/* ── Main component ── */

export default function MindmapPreview({
  documentTitle,
  columns,
  layout,
  showTitle = true,
}: Props) {
  const renderedColumns = Array.from(
    { length: layout.orientation === 'horizontal' ? 2 : 1 },
    (_, idx) => columns[idx] ?? [],
  )

  const indent = `${Math.max(0.9, layout.level_gap_mm / 18).toFixed(2)}em`
  const rowGap = `${Math.max(0.08, layout.sibling_gap_mm / 16).toFixed(2)}em`
  const topicGap = `${Math.max(0.4, layout.sibling_gap_mm / 4).toFixed(2)}em`

  const pageStyle: React.CSSProperties = {
    fontSize: `${layout.font_size_pt}pt`,
    lineHeight: 1.22,
    fontFamily: 'inherit',
    color: '#1f2328',
  }

  // Track which topic IDs we've already seen across all columns on this page
  // so we can mark cross-column continuations.
  const seenTopics = new Set<string>()

  return (
    <div style={pageStyle}>
      {showTitle && <h1 style={titleStyle}>{documentTitle}</h1>}
      <div
        style={{
          ...styles.columns,
          gap: layout.orientation === 'horizontal' ? '8mm' : 0,
        }}
      >
        {renderedColumns.map((colAtoms, idx) => {
          const fragments = groupIntoFragments(colAtoms, seenTopics)
          return (
            <div key={idx} style={styles.column}>
              {idx > 0 && (
                <div style={{ ...styles.separator, borderLeft: '1px dashed #d0d7de' }} />
              )}
              {fragments.map((frag) => (
                <FragmentRender
                  key={`${frag.topicId}-${frag.isContinuation ? 'c' : 'h'}`}
                  fragment={frag}
                  indent={indent}
                  rowGap={rowGap}
                  topicGap={topicGap}
                  densityLevel={layout.density_level}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Exported measurement component (used by PagePreview) ── */

export function MindmapAtomRender({
  atom,
  indent,
  rowGap,
  densityLevel,
}: {
  atom: MindmapAtom
  indent: string
  rowGap: string
  densityLevel: number
}) {
  if (atom.kind === 'topic-header') {
    return <div style={topicHeaderStyle}>{atom.title}</div>
  }

  const block = atom.node.block
  const subtitle =
    block && block.type !== 'topic' ? pickMindmapVersion(block, densityLevel) : ''
  const latex = block?.latex?.trim()

  return (
    <div
      style={{
        paddingLeft: `calc((0.35em + 1px + ${indent}) * ${atom.depth})`,
      }}
    >
      <div style={{ ...rowStyle, marginBottom: rowGap }}>
        <span style={connectorStyle} />
        <span style={blockTitleStyle}>{atom.title}</span>
        {latex ? (
          <span style={formulaStyle}>
            <Katex latex={latex} />
          </span>
        ) : (
          subtitle && <span style={subtitleStyle}> - {subtitle}</span>
        )}
      </div>
    </div>
  )
}

/* ── Fragment grouping ── */

function groupIntoFragments(
  atoms: MindmapAtom[],
  seenTopics: Set<string>,
): MindmapFragment[] {
  if (atoms.length === 0) return []

  const fragments: MindmapFragment[] = []
  let curTopicId = atoms[0].topicId
  let curAtoms: MindmapAtom[] = [atoms[0]]

  for (let i = 1; i < atoms.length; i++) {
    if (atoms[i].topicId !== curTopicId) {
      fragments.push(buildFragment(curAtoms, seenTopics))
      curTopicId = atoms[i].topicId
      curAtoms = [atoms[i]]
    } else {
      curAtoms.push(atoms[i])
    }
  }
  fragments.push(buildFragment(curAtoms, seenTopics))

  return fragments
}

function buildFragment(
  atoms: MindmapAtom[],
  seenTopics: Set<string>,
): MindmapFragment {
  const topicId = atoms[0].topicId
  const isContinuation = seenTopics.has(topicId)
  seenTopics.add(topicId)

  return {
    topicId,
    topicTitle: atoms[0].topicTitle,
    isContinuation,
    atoms,
  }
}

/* ── Fragment rendering ── */

function FragmentRender({
  fragment,
  indent,
  rowGap,
  topicGap,
  densityLevel,
}: {
  fragment: MindmapFragment
  indent: string
  rowGap: string
  topicGap: string
  densityLevel: number
}) {
  const contentAtoms = fragment.atoms.filter((a) => a.kind !== 'topic-header')

  return (
    <div style={{ ...topicGroupStyle, marginBottom: topicGap }}>
      <div style={topicHeaderStyle}>
        {fragment.topicTitle}
        {fragment.isContinuation && (
          <span style={contBadgeStyle}> (cont.)</span>
        )}
      </div>
      {contentAtoms.length > 0 && (
        <div style={{ ...childrenWrapStyle, paddingLeft: indent }}>
          {contentAtoms.map((atom) => (
            <AtomLine
              key={atom.nodeId}
              atom={atom}
              indent={indent}
              rowGap={rowGap}
              densityLevel={densityLevel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AtomLine({
  atom,
  indent,
  rowGap,
  densityLevel,
}: {
  atom: MindmapAtom
  indent: string
  rowGap: string
  densityLevel: number
}) {
  const block = atom.node.block
  const subtitle =
    block && block.type !== 'topic' ? pickMindmapVersion(block, densityLevel) : ''
  const latex = block?.latex?.trim()
  // depth 1 = direct child of topic, already inside one childrenWrap
  const extraDepth = atom.depth - 1

  return (
    <div
      style={
        extraDepth > 0
          ? { paddingLeft: `calc((0.35em + 1px + ${indent}) * ${extraDepth})` }
          : undefined
      }
    >
      <div style={{ ...rowStyle, marginBottom: rowGap }}>
        <span style={connectorStyle} />
        <span style={blockTitleStyle}>{atom.title}</span>
        {latex ? (
          <span style={formulaStyle}>
            <Katex latex={latex} />
          </span>
        ) : (
          subtitle && <span style={subtitleStyle}> - {subtitle}</span>
        )}
      </div>
    </div>
  )
}

/* ── Styles ── */

const styles: Record<string, React.CSSProperties> = {
  columns: {
    display: 'flex',
    alignItems: 'stretch',
  },
  column: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    overflowWrap: 'break-word',
  },
  separator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '-4mm',
    pointerEvents: 'none',
  },
}

const titleStyle: React.CSSProperties = {
  fontSize: '1.5em',
  fontWeight: 700,
  margin: '0 0 0.35em',
  textAlign: 'center',
  borderBottom: '1px solid #1f2328',
  paddingBottom: '0.15em',
  flexShrink: 0,
}

const topicGroupStyle: React.CSSProperties = {
  breakInside: 'avoid',
}

const topicHeaderStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1.05em',
  marginBottom: '0.1em',
  paddingLeft: '0.3em',
  borderLeft: '2.5px solid #1f2328',
  color: '#1f2328',
}

const childrenWrapStyle: React.CSSProperties = {
  marginLeft: '0.35em',
  borderLeft: '1px solid #8b949e',
}

const rowStyle: React.CSSProperties = {
  position: 'relative',
}

const connectorStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '0.55em',
  height: '0.55em',
  marginLeft: '-0.75em',
  marginRight: '0.2em',
  borderBottom: '1px solid #8b949e',
  verticalAlign: 'middle',
}

const blockTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#24292f',
}

const subtitleStyle: React.CSSProperties = {
  color: '#57606a',
  fontSize: '0.9em',
}

const formulaStyle: React.CSSProperties = {
  marginLeft: '0.35em',
  fontSize: '0.9em',
  color: '#57606a',
}

const contBadgeStyle: React.CSSProperties = {
  fontWeight: 400,
  fontSize: '0.85em',
  color: '#57606a',
}
