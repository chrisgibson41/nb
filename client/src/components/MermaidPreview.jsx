import { useEffect, useRef, useState } from 'react'

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
  body: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    padding: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    position: 'relative',
  },
  invalidHint: {
    position: 'absolute',
    bottom: '16px',
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

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!code) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const m = await getMermaid()
        const id = `mermaid-preview-${++seq}`
        const { svg: rendered } = await m.render(id, code)
        if (!mountedRef.current) return
        setLastValidSvg(rendered)
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
    <div style={{ ...s.panel, width: `${width}px`, minWidth: '200px', maxWidth: '80vw' }}>
      <div style={s.header}>
        <span style={s.dot(dotColor)} />
        Diagram preview
      </div>
      <div style={s.body}>
        {/* Always show the last valid diagram if we have one */}
        {lastValidSvg && (
          <div
            dangerouslySetInnerHTML={{ __html: lastValidSvg }}
            style={{ maxWidth: '100%', opacity: invalid ? 0.4 : 1, transition: 'opacity 0.15s' }}
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
