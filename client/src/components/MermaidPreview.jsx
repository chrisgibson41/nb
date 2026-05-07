import { useEffect, useLayoutEffect, useRef, useState } from 'react'

let mermaidReady = null  // shared promise so init runs only once

async function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then(({ default: m }) => {
      m.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          background: '#1e1e1e',
          primaryColor: '#2d5a8e',
          primaryTextColor: '#cccccc',
          lineColor: '#666',
          edgeLabelBackground: '#1e1e1e',
          fontSize: '14px',
        },
      })
      return m
    })
  }
  return mermaidReady
}

let seq = 0

/**
 * Strip mermaid's hard-coded max-width inline style, and replace the SVG's
 * explicit pixel width/height with the natural values extracted from the
 * viewBox (e.g. "0 0 677 420" → width=677, height=420).  The body container
 * uses overflow:auto so large diagrams scroll; min-width:100% on the SVG
 * ensures small diagrams still fill the panel.
 */
function normaliseSvg(svg) {
  // Parse the 3rd and 4th viewBox tokens as the natural pixel dimensions.
  // viewBox can have negative offsets: "-50 -10 677 420" → w=677, h=420
  const vb = svg.match(/viewBox="[^"]*\s([0-9.]+)\s+([0-9.]+)"/)
  const w   = vb ? Math.ceil(parseFloat(vb[1])) : null
  const h   = vb ? Math.ceil(parseFloat(vb[2])) : null

  return svg
    .replace(/\s+width="[^"]*"/, w ? ` width="${w}"` : '')
    .replace(/\s+height="[^"]*"/, h ? ` height="${h}"` : '')
    .replace(/\s+style="[^"]*max-width:[^"]*"/, '')
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a1a',
    overflow: 'hidden',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderBottom: '1px solid #2e2e2e',
    fontSize: '11px',
    fontWeight: 600,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontFamily: 'system-ui, sans-serif',
    flexShrink: 0,
  },
  dot: (color) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
  // Body scrolls in both axes — large diagrams overflow, small ones centre
  body: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: '16px',
    position: 'relative',
  },
  // SVG wrapper: at least as wide as the body; SVG renders at its natural size
  svgWrap: {
    display: 'inline-block',
    minWidth: '100%',
    minHeight: '100%',
  },
  invalidHint: {
    position: 'absolute',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '11px',
    color: '#e5c07b',
    background: 'rgba(229,192,123,0.1)',
    border: '1px solid rgba(229,192,123,0.25)',
    borderRadius: '4px',
    padding: '4px 10px',
    whiteSpace: 'nowrap',
    fontFamily: 'system-ui, sans-serif',
    pointerEvents: 'none',
  },
  loading: {
    color: '#555',
    fontSize: '12px',
    fontFamily: 'system-ui, sans-serif',
  },
}

export default function MermaidPreview({ code, width = 400 }) {
  const [lastValidSvg, setLastValidSvg] = useState(null)  // never wiped on error
  const [invalid, setInvalid]           = useState(false)  // true while syntax is broken
  const [loading, setLoading]           = useState(true)
  const timerRef    = useRef(null)
  const mountedRef  = useRef(true)
  const bodyRef     = useRef(null)   // scroll container
  const scrollRef   = useRef({ top: 0, left: 0 })  // saved scroll position

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // After the SVG DOM updates, restore the scroll position so edits don't
  // jump the view back to the top-left corner.
  useLayoutEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop  = scrollRef.current.top
      bodyRef.current.scrollLeft = scrollRef.current.left
    }
  }, [lastValidSvg])

  useEffect(() => {
    if (!code) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const m = await getMermaid()
        const id = `mermaid-preview-${++seq}`
        const { svg: rendered } = await m.render(id, code)
        if (!mountedRef.current) return
        setLastValidSvg(normaliseSvg(rendered))
        setInvalid(false)
        setLoading(false)
      } catch {
        if (!mountedRef.current) return
        // Keep the last valid diagram visible; just flag the syntax as incomplete
        setInvalid(true)
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timerRef.current)
  }, [code])

  const dotColor = loading ? '#555' : invalid ? '#e5c07b' : '#4ec9a2'

  return (
    <div style={{ ...s.panel, width: `${width}px`, minWidth: '200px' }}>
      <div style={s.header}>
        <span style={s.dot(dotColor)} />
        Diagram preview
      </div>
      <div
        ref={bodyRef}
        style={s.body}
        onScroll={(e) => {
          scrollRef.current = { top: e.target.scrollTop, left: e.target.scrollLeft }
        }}
      >
        {/* Always show the last valid diagram if we have one */}
        {lastValidSvg && (
          <div
            dangerouslySetInnerHTML={{ __html: lastValidSvg }}
            style={{ ...s.svgWrap, opacity: invalid ? 0.4 : 1, transition: 'opacity 0.15s' }}
          />
        )}
        {/* Overlay hint when syntax is currently broken */}
        {invalid && (
          <div style={s.invalidHint}>
            {lastValidSvg ? 'Diagram not yet valid — showing last valid state' : 'Diagram not yet valid'}
          </div>
        )}
        {/* Initial loading state before any render attempt completes */}
        {loading && !lastValidSvg && (
          <span style={s.loading}>Rendering…</span>
        )}
      </div>
    </div>
  )
}
