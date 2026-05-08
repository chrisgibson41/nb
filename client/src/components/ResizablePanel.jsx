/**
 * ResizablePanel — wraps any sidebar/panel with:
 *   • a drag handle on the inner edge (resizes by dragging)
 *   • a collapse / expand button (passed into children as a render prop)
 *   • localStorage persistence for width and collapsed state
 *
 * Usage:
 *   <ResizablePanel storageKey="nb:panel:sidebar" defaultWidth={240}
 *                   minWidth={140} position="left" label="Explorer">
 *     {({ collapseButton }) => <FileTree collapseButton={collapseButton} />}
 *   </ResizablePanel>
 *
 * position="left"  → panel is on the left side; handle on right edge
 * position="right" → panel is on the right side; handle on left edge
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'

const COLLAPSED_W = 24   // px width of the collapsed strip

function loadInt(key, fallback, min) {
  try {
    const v = parseInt(localStorage.getItem(key), 10)
    if (Number.isFinite(v) && v >= min) return v
  } catch { /* ignore */ }
  return fallback
}

function loadBool(key) {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

// Chevron SVG pointing in a given direction
function Chevron({ dir }) {  // dir: 'left' | 'right' | 'up' | 'down'
  const pts = {
    left:  '8,2 4,6 8,10',
    right: '4,2 8,6 4,10',
  }
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={pts[dir]} />
    </svg>
  )
}

export default function ResizablePanel({
  storageKey,
  defaultWidth = 240,
  minWidth     = 120,
  position     = 'left',   // 'left' | 'right'
  label        = 'Panel',
  children,                // (collapseButton: ReactNode) => ReactNode
}) {
  const [width, setWidth] = useState(
    () => loadInt(`${storageKey}:w`, defaultWidth, minWidth)
  )
  const [collapsed, setCollapsed] = useState(
    () => loadBool(`${storageKey}:c`)
  )
  const dragRef = useRef(null)

  // Persist width
  useEffect(() => {
    try { localStorage.setItem(`${storageKey}:w`, String(width)) } catch { /* ignore */ }
  }, [width, storageKey])

  // Persist collapsed
  useEffect(() => {
    try { localStorage.setItem(`${storageKey}:c`, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed, storageKey])

  const startDrag = useCallback((e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: width }

    const onMove = (ev) => {
      const delta = position === 'left'
        ? ev.clientX - dragRef.current.startX   // left panel: drag right = wider
        : dragRef.current.startX - ev.clientX   // right panel: drag left = wider
      setWidth(Math.max(minWidth, dragRef.current.startWidth + delta))
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width, minWidth, position])

  // ── Collapsed strip ─────────────────────────────────────────────────────────
  if (collapsed) {
    const bg     = position === 'left' ? '#252526' : '#1a1a1a'
    const border = position === 'left'
      ? { borderRight: '1px solid #3c3c3c' }
      : { borderLeft:  '1px solid #2e2e2e' }

    return (
      <div style={{ width: COLLAPSED_W, flexShrink: 0, display: 'flex',
                    flexDirection: 'column', alignItems: 'center',
                    background: bg, ...border, overflow: 'hidden' }}>
        {/* Expand button */}
        <button
          onClick={() => setCollapsed(false)}
          title={`Expand ${label}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: '#555', padding: '6px 0', lineHeight: 1,
                   display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#999' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
        >
          <Chevron dir={position === 'left' ? 'right' : 'left'} />
        </button>

        {/* Rotated label */}
        <div
          onClick={() => setCollapsed(false)}
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                   fontSize: '10px', fontWeight: 700, color: '#444',
                   letterSpacing: '0.1em', textTransform: 'uppercase',
                   marginTop: '8px', cursor: 'pointer', userSelect: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#888' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#444' }}
        >
          {label}
        </div>
      </div>
    )
  }

  // ── Drag handle ─────────────────────────────────────────────────────────────
  const handle = (
    <div
      onMouseDown={startDrag}
      style={{ width: '5px', flexShrink: 0, cursor: 'col-resize',
               background: 'transparent', transition: 'background 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#3a3a3a' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      title="Drag to resize"
    />
  )

  // The button injected into the panel's own header to collapse it
  const collapseButton = (
    <button
      onClick={() => setCollapsed(true)}
      title={`Collapse ${label}`}
      style={{ background: 'none', border: 'none', cursor: 'pointer',
               color: '#555', padding: '2px 4px', lineHeight: 1,
               display: 'flex', alignItems: 'center' }}
      onMouseEnter={e => { e.currentTarget.style.color = '#999' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
    >
      <Chevron dir={position === 'left' ? 'left' : 'right'} />
    </button>
  )

  // ── Expanded layout ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexShrink: 0, overflow: 'hidden', height: '100%' }}>
      {position === 'right' && handle}
      <div style={{ width: `${width}px`, flexShrink: 0, display: 'flex',
                    flexDirection: 'column', overflow: 'hidden' }}>
        {typeof children === 'function' ? children({ collapseButton }) : children}
      </div>
      {position === 'left' && handle}
    </div>
  )
}
