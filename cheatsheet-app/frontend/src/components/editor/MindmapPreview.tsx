import React, { useMemo } from 'react'
import type { Block, MindmapLayout } from '../../types/block'
import { buildTree, type TreeNode } from '../../utils/hierarchy'

interface Props {
  documentTitle: string
  blocks: Block[]
  layout: MindmapLayout
  showTitle?: boolean
}

export default function MindmapPreview({
  documentTitle,
  blocks,
  layout,
  showTitle = true,
}: Props) {
  const root = useMemo(() => buildTree(blocks, documentTitle), [blocks, documentTitle])
  const layoutMetrics = useMemo(
    () => ({
      indent: `${Math.max(0.9, layout.level_gap_mm / 18).toFixed(2)}em`,
      rowGap: `${Math.max(0.08, layout.sibling_gap_mm / 16).toFixed(2)}em`,
      topicGap: `${Math.max(0.4, layout.sibling_gap_mm / 4).toFixed(2)}em`,
    }),
    [layout.level_gap_mm, layout.sibling_gap_mm],
  )

  const pageStyle: React.CSSProperties = {
    fontSize: `${layout.font_size_pt}pt`,
    lineHeight: 1.22,
    fontFamily: 'inherit',
    color: '#1f2328',
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

  const columnsStyle: React.CSSProperties = {
    columnCount: layout.orientation === 'horizontal' ? 2 : 1,
    columnGap: layout.orientation === 'horizontal' ? '8mm' : 0,
    columnRule:
      layout.orientation === 'horizontal' ? '1px dashed #d0d7de' : 'none',
    columnFill: 'balance',
    overflowWrap: 'break-word',
  }

  return (
    <div style={pageStyle}>
      {showTitle && <h1 style={titleStyle}>{documentTitle}</h1>}
      <div style={columnsStyle}>
        {root.children.map((topic) => (
          <TopicGroup
            key={topic.id}
            node={topic}
            indent={layoutMetrics.indent}
            rowGap={layoutMetrics.rowGap}
            topicGap={layoutMetrics.topicGap}
          />
        ))}
      </div>
    </div>
  )
}

export function TopicGroup({
  node,
  indent,
  rowGap,
  topicGap,
}: {
  node: TreeNode
  indent: string
  rowGap: string
  topicGap: string
}) {
  return (
    <div style={{ ...topicGroupStyle, marginBottom: topicGap }}>
      <div style={topicHeaderStyle}>{node.title}</div>
      <div style={{ ...childrenWrapStyle, paddingLeft: indent }}>
        {node.children.map((child) => (
          <BlockLine
            key={child.id}
            node={child}
            indent={indent}
            rowGap={rowGap}
          />
        ))}
      </div>
    </div>
  )
}

function BlockLine({
  node,
  indent,
  rowGap,
}: {
  node: TreeNode
  indent: string
  rowGap: string
}) {
  const block = node.block
  const subtitle =
    block && block.type !== 'topic'
      ? block.content_ultra_short ?? block.content_short ?? ''
      : ''

  return (
    <div>
      <div style={{ ...rowStyle, marginBottom: rowGap }}>
        <span style={connectorStyle} />
        <span style={blockTitleStyle}>{node.title}</span>
        {subtitle && <span style={subtitleStyle}> 鈥?{subtitle}</span>}
      </div>
      {node.children.length > 0 && (
        <div style={{ ...childrenWrapStyle, paddingLeft: indent }}>
          {node.children.map((child) => (
            <BlockLine
              key={child.id}
              node={child}
              indent={indent}
              rowGap={rowGap}
            />
          ))}
        </div>
      )}
    </div>
  )
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
