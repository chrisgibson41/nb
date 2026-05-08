import React, { useCallback, useEffect, useRef, useState } from 'react'
import OutlinePanel from './OutlinePanel.jsx'
import BacklinksPanel from './BacklinksPanel.jsx'

function loadBool(key, def) {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return def
    return v === '1'
  } catch { return def }
}

function saveBool(key, val) {
  try { localStorage.setItem(key, val ? '1' : '0') } catch { /* ignore */ }
}

function loadFloat(key, def) {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return def
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : def
  } catch { return def }
}

function saveFloat(key, val) {
  try { localStorage.setItem(key, String(val)) } catch { /* ignore */ }
}

const MIN_PANEL_PX = 60

export default function RightSidebar({ content, currentFile, onScrollTo, onFileSelect }) {
  const [splitPct, setSplitPct] = useState(() => loadFloat('nb:right:split', 0.5))
  const [outlineCollapsed, setOutlineCollapsed]   = useState(() => loadBool('nb:right:outline:c', false))
  const [backlinksCollapsed, setBacklinksCollapsed] = useState(() => loadBool('nb:right:backlinks:c', false))

  const containerRef = useRef(null)
  const dragRef      = useRef(null)

  // Persist when values change
  useEffect(() => { saveFloat('nb:right:split', splitPct) }, [splitPct])
  useEffect(() => { saveBool('nb:right:outline:c', outlineCollapsed) }, [outlineCollapsed])
  useEffect(() => { saveBool('nb:right:backlinks:c', backlinksCollapsed) }, [backlinksCollapsed])

  const toggleOutline   = useCallback(() => setOutlineCollapsed(c => !c), [])
  const toggleBacklinks = useCallback(() => setBacklinksCollapsed(c => !c), [])

  // ── Drag handle ──────────────────────────────────────────────────────────────
  const onDragMouseDown = useCallback((e) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startPct: splitPct }

    const onMove = (ev) => {
      if (!dragRef.current || !containerRef.current) return
      const totalH = containerRef.current.getBoundingClientRect().height
      if (totalH === 0) return
      const delta = ev.clientY - dragRef.current.startY
      const deltaPct = delta / totalH
      const rawPct = dragRef.current.startPct + deltaPct
      // Clamp so each panel is at least MIN_PANEL_PX
      const minPct = MIN_PANEL_PX / totalH
      const maxPct = 1 - MIN_PANEL_PX / totalH
      setSplitPct(Math.min(maxPct, Math.max(minPct, rawPct)))
    }

    const onUp = () => {
      dragRef.current = null
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }

    document.body.style.cursor    = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [splitPct])

  // ── Collapse buttons (rendered inside each panel's header) ───────────────────
  const outlineCollapseBtn = (
    <button
      onClick={toggleOutline}
      title={outlineCollapsed ? 'Expand Outline' : 'Collapse Outline'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#555', padding: '1px 2px', lineHeight: 1,
        display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#999' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {outlineCollapsed
          ? <polyline points="2,4 6,8 10,4" />
          : <polyline points="2,8 6,4 10,8" />}
      </svg>
    </button>
  )

  const backlinksCollapseBtn = (
    <button
      onClick={toggleBacklinks}
      title={backlinksCollapsed ? 'Expand Backlinks' : 'Collapse Backlinks'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#555', padding: '1px 2px', lineHeight: 1,
        display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#999' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {backlinksCollapsed
          ? <polyline points="2,4 6,8 10,4" />
          : <polyline points="2,8 6,4 10,8" />}
      </svg>
    </button>
  )

  // ── Height logic ──────────────────────────────────────────────────────────────
  // Both expanded: Outline = splitPct*100%, Backlinks = flex 1
  // Outline collapsed: Outline = flex 0 0 auto, Backlinks = flex 1
  // Backlinks collapsed: Outline = flex 1, Backlinks = flex 0 0 auto
  // Both collapsed: both flex 0 0 auto
  let outlineStyle, backlinksStyle
  if (!outlineCollapsed && !backlinksCollapsed) {
    outlineStyle   = { height: `${splitPct * 100}%`, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    backlinksStyle = { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
  } else if (outlineCollapsed && !backlinksCollapsed) {
    outlineStyle   = { flex: '0 0 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    backlinksStyle = { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
  } else if (!outlineCollapsed && backlinksCollapsed) {
    outlineStyle   = { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    backlinksStyle = { flex: '0 0 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
  } else {
    outlineStyle   = { flex: '0 0 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    backlinksStyle = { flex: '0 0 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
  }

  const showDragHandle = !outlineCollapsed && !backlinksCollapsed

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', width: '100%' }}
    >
      <div style={outlineStyle}>
        <OutlinePanel
          content={content}
          onScrollTo={onScrollTo}
          collapseButton={outlineCollapseBtn}
          collapsed={outlineCollapsed}
        />
      </div>

      {/* Drag handle — only visible when both panels are expanded */}
      {showDragHandle && (
        <div
          onMouseDown={onDragMouseDown}
          style={{
            height: '4px',
            flexShrink: 0,
            cursor: 'row-resize',
            background: 'transparent',
            borderTop: '1px solid #2e2e2e',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#3a3a3a' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        />
      )}

      <div style={backlinksStyle}>
        <BacklinksPanel
          currentFile={currentFile}
          onFileSelect={onFileSelect}
          collapseButton={backlinksCollapseBtn}
          collapsed={backlinksCollapsed}
        />
      </div>
    </div>
  )
}
