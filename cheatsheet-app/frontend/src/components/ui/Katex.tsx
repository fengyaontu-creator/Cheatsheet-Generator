import React, { useMemo } from 'react'
import katex from 'katex'

interface Props {
  latex: string
  displayMode?: boolean
}

export default function Katex({ latex, displayMode = false }: Props) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        output: 'html',
      }),
    [latex, displayMode],
  )
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
