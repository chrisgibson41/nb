import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

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
 * Strip mermaid's hard-coded max-width inline style and normalise width/height
 * to natural pixel values from the viewBox so the SVG renders at its intrinsic
 * size (zoom/pan then handles scaling, not CSS stretching).
 */
function normaliseSvg(svg) {
  const vb = svg.match(/viewBox="[^"]*\s([0-9.]+)\s+([0-9.]+)"/)
  const w   = vb ? Math.ceil(parseFloat(vb[1])) : null
  const h   = vb ? Math.ceil(parseFloat(vb[2])) : null
  return svg
    .replace(/\s+width="[^"]*"/, w ? ` width="${w}"` : '')
    .replace(/\s+height="[^"]*"/, h ? ` height="${h}"` : '')
    .replace(/\s+style="[^"]*max-width:[^"]*"/, '')
}

const ZOOM_MIN = 0.1
const ZOOM_MAX = 8
const ZOOM_STEP = 0.25

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
    gap: '4px',
    padding: '5px 8px 5px 12px',
    borderBottom: '1px solid #2e2e2e',
    fontSize: '11px',
    fontWeight: 600,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontFamily: 'system-ui, sans-serif',
    flexShrink: 0,
  },
  dot: (color) => ({ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }),
  zoomBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '1px 4px',
    fontSize: '13px',
    lineHeight: 1,
    borderRadius: '3px',
    fontFamily: 'system-ui, sans-serif',
  },
  zoomLabel: {
    fontSize: '10px',
    color: '#555',
    minWidth: '34px',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'default',
    userSelect: 'none',
  },
  // The viewport — clips the transformed canvas; no native scroll
  body: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
    cursor: 'grab',
  },
  invalidHint: {
    position: 'absolute',
    bottom: '10px',
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
    zIndex: 2,
  },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#555',
    fontSize: '12px',
    fontFamily: 'system-ui, sans-serif',
  },
}

function ZoomBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={s.zoomBtn}
      onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = '#2a2a2a' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'none' }}
    >
      {children}
    </button>
  )
}

export default function MermaidPreview({ code, height = 280, collapsed = false, focusText = null, onToggleCollapse }) {
  const [lastValidSvg, setLastValidSvg] = useState(null)
  const [invalid, setInvalid]           = useState(false)
  const [loading, setLoading]           = useState(true)
  const [zoomPct, setZoomPct]           = useState(100)   // display only

  const timerRef   = useRef(null)
  const mountedRef = useRef(true)
  const bodyRef    = useRef(null)    // viewport div
  const canvasRef  = useRef(null)    // transformed inner div
  const viewRef    = useRef({ zoom: 1, x: 0, y: 0 })   // current transform (no re-render on change)
  const dragRef    = useRef(null)    // { startX, startY, origX, origY }

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  // Apply the current transform directly to the DOM — no React re-render needed
  const applyTransform = useCallback(() => {
    if (!canvasRef.current) return
    const { zoom, x, y } = viewRef.current
    canvasRef.current.style.transform        = `translate(${x}px, ${y}px) scale(${zoom})`
    canvasRef.current.style.transformOrigin  = '0 0'
  }, [])

  // Reset view to 100 % with diagram centered/top-padded
  const resetView = useCallback(() => {
    viewRef.current = { zoom: 1, x: 16, y: 16 }
    applyTransform()
    setZoomPct(100)
  }, [applyTransform])

  // Restore sensible default when a new diagram first appears
  useLayoutEffect(() => {
    if (lastValidSvg) resetView()
  }, [lastValidSvg])  // eslint-disable-line react-hooks/exhaustive-deps

  // Render mermaid diagram after a short debounce
  useEffect(() => {
    if (!code) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const m   = await getMermaid()
        const id  = `mermaid-preview-${++seq}`
        const { svg: rendered } = await m.render(id, code)
        if (!mountedRef.current) return
        setLastValidSvg(normaliseSvg(rendered))
        setInvalid(false)
        setLoading(false)
      } catch {
        if (!mountedRef.current) return
        setInvalid(true)
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [code])

  // ── Wheel: Ctrl/pinch → zoom toward cursor; plain scroll → pan ─────────────
  const onWheel = useCallback((e) => {
    e.preventDefault()
    const body = bodyRef.current
    if (!body) return
    const rect = body.getBoundingClientRect()

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom or Ctrl+wheel → zoom toward the cursor
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const { zoom, x, y } = viewRef.current
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor))
      viewRef.current = {
        zoom: newZoom,
        x: mx - (mx - x) * (newZoom / zoom),
        y: my - (my - y) * (newZoom / zoom),
      }
      setZoomPct(Math.round(newZoom * 100))
    } else {
      // Plain trackpad / wheel → pan
      viewRef.current.x -= e.deltaX
      viewRef.current.y -= e.deltaY
    }
    applyTransform()
  }, [applyTransform])

  // Attach wheel listener as non-passive (so we can call preventDefault)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // ── Drag pan ────────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const { x, y } = viewRef.current
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: x, origY: y }

    const onMove = (ev) => {
      if (!dragRef.current) return
      viewRef.current.x = dragRef.current.origX + ev.clientX - dragRef.current.startX
      viewRef.current.y = dragRef.current.origY + ev.clientY - dragRef.current.startY
      applyTransform()
    }
    const onUp = () => {
      dragRef.current = null
      if (bodyRef.current) bodyRef.current.style.cursor = 'grab'
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    if (bodyRef.current) bodyRef.current.style.cursor = 'grabbing'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [applyTransform])

  // ── Zoom button helpers ─────────────────────────────────────────────────────
  const zoomBy = useCallback((delta) => {
    const body = bodyRef.current
    const rect = body?.getBoundingClientRect()
    const cx = rect ? rect.width  / 2 : 0
    const cy = rect ? rect.height / 2 : 0
    const { zoom, x, y } = viewRef.current
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN,
      delta > 0 ? zoom + ZOOM_STEP : zoom - ZOOM_STEP))
    viewRef.current = {
      zoom: newZoom,
      x: cx - (cx - x) * (newZoom / zoom),
      y: cy - (cy - y) * (newZoom / zoom),
    }
    applyTransform()
    setZoomPct(Math.round(newZoom * 100))
  }, [applyTransform])

  // ── Focus-sync: zoom in on (and pan to) the SVG element matching the line ──
  // Bumps zoom up to FOCUS_ZOOM_MIN if the user is zoomed out further,
  // never zooms back out — so manual zooming wins.
  const FOCUS_ZOOM_MIN = 1.6
  const focusOnElement = useCallback((el) => {
    if (!bodyRef.current || !el) return
    const bodyRect = bodyRef.current.getBoundingClientRect()
    const elemRect = el.getBoundingClientRect()

    // Element centre, in viewport-local coords
    const elemCX = elemRect.left + elemRect.width  / 2 - bodyRect.left
    const elemCY = elemRect.top  + elemRect.height / 2 - bodyRect.top

    // Convert to canvas-space ("world") so we can re-position after zoom
    const { zoom, x, y } = viewRef.current
    const worldX = (elemCX - x) / zoom
    const worldY = (elemCY - y) / zoom

    // Zoom up to the focus level, but don't shrink existing zoom
    const newZoom = Math.min(ZOOM_MAX, Math.max(zoom, FOCUS_ZOOM_MIN))
    viewRef.current = {
      zoom: newZoom,
      x: bodyRect.width  / 2 - worldX * newZoom,
      y: bodyRect.height / 2 - worldY * newZoom,
    }
    applyTransform()
    setZoomPct(Math.round(newZoom * 100))
  }, [applyTransform])

  useEffect(() => {
    if (!focusText || !bodyRef.current) return
    const svg = bodyRef.current.querySelector('svg')
    if (!svg) return

    // Extract search terms in priority order
    const terms = []
    // 1. Text after ':'  (sequence diagram messages)
    const afterColon = focusText.match(/:\s*(.+)/)
    if (afterColon) terms.push(afterColon[1].trim())
    // 2. Text inside brackets (flowchart labels)
    const inBrackets = focusText.match(/[\[{(]([^\]})]+)[\]})]/g)
    if (inBrackets) inBrackets.forEach(m => terms.push(m.slice(1, -1).trim()))
    // 3. Participant / node names around arrows
    const arrowParts = focusText.split(/-->|->|==>|--/)
    arrowParts.forEach(p => { const t = p.trim(); if (t) terms.push(t) })
    // 4. Fallback: the whole trimmed line
    const trimmed = focusText.trim()
    if (trimmed) terms.push(trimmed)

    const nodes = Array.from(svg.querySelectorAll('text, tspan'))
    let matched = null
    for (const term of terms) {
      if (!term) continue
      const lower = term.toLowerCase()
      matched = nodes.find(n => n.textContent.toLowerCase().includes(lower))
      if (matched) break
    }
    if (!matched) return

    focusOnElement(matched)
    matched.style.outline = '2px solid rgba(0,122,204,0.8)'
    setTimeout(() => { matched.style.outline = '' }, 1200)
  }, [focusText, focusOnElement])

  const dotColor = loading ? '#555' : invalid ? '#e5c07b' : '#4ec9a2'

  // ── Collapsed strip (horizontal bar across the top) ────────────────────────
  if (collapsed) {
    return (
      <div style={{ height: '24px', flexShrink: 0, display: 'flex', flexDirection: 'row',
                    alignItems: 'center', background: '#1a1a1a',
                    borderBottom: '1px solid #2e2e2e', overflow: 'hidden',
                    padding: '0 10px', gap: '8px' }}>
        <button onClick={onToggleCollapse} title="Expand diagram preview"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555',
                   padding: '0 4px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#999' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555' }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,4 6,8 10,4" />
          </svg>
        </button>
        <div onClick={onToggleCollapse}
          style={{ fontSize: '10px', fontWeight: 700, color: '#444', letterSpacing: '0.1em',
                   textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#888' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#444' }}>
          Diagram preview
        </div>
        <span style={s.dot(dotColor)} />
      </div>
    )
  }

  // ── Expanded ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...s.panel, height: `${height}px`, minHeight: '120px', width: '100%' }}>

      {/* Header */}
      <div style={s.header}>
        <span style={s.dot(dotColor)} />
        <span style={{ flex: 1 }}>Diagram preview</span>

        {/* Zoom controls */}
        <ZoomBtn onClick={() => zoomBy(-1)} title="Zoom out (−)">−</ZoomBtn>
        <span style={s.zoomLabel}>{zoomPct}%</span>
        <ZoomBtn onClick={() => zoomBy(+1)} title="Zoom in (+)">+</ZoomBtn>
        <ZoomBtn onClick={resetView} title="Reset zoom to 100%">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </ZoomBtn>

        {/* Collapse */}
        {onToggleCollapse && (
          <button onClick={onToggleCollapse} title="Collapse diagram preview"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555',
                     padding: '2px 0 2px 4px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#999' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#555' }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2,8 6,4 10,8" />
            </svg>
          </button>
        )}
      </div>

      {/* Viewport */}
      <div ref={bodyRef} style={s.body} onMouseDown={onMouseDown}>
        {/* Transformed canvas — zoom & pan applied here via ref mutation */}
        <div ref={canvasRef} style={{ display: 'inline-block', transformOrigin: '0 0' }}>
          {lastValidSvg && (
            <div
              dangerouslySetInnerHTML={{ __html: lastValidSvg }}
              style={{ opacity: invalid ? 0.4 : 1, transition: 'opacity 0.15s', display: 'block' }}
            />
          )}
        </div>

        {/* Error hint */}
        {invalid && (
          <div style={s.invalidHint}>
            {lastValidSvg ? 'Diagram not yet valid — showing last valid state' : 'Diagram not yet valid'}
          </div>
        )}

        {/* Initial loading */}
        {loading && !lastValidSvg && <div style={s.loading}>Rendering…</div>}
      </div>
    </div>
  )
}
