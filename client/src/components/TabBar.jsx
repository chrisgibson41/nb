import React, { useState, useEffect, useRef } from 'react'

function basename(p) {
  return p ? p.split('/').pop() : ''
}

// ── Context menu ──────────────────────────────────────────────────────────────

function ContextMenu({ x, y, tab, onPin, onClose, onCloseOthers, onCloseAll, onClose2 }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose2()
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [onClose2])

  // Adjust position after mount
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth)  menuRef.current.style.left = `${x - rect.width}px`
    if (rect.bottom > window.innerHeight) menuRef.current.style.top = `${y - rect.height}px`
  }, [x, y])

  const item = (label, onClick, disabled = false) => (
    <div
      style={{
        padding: '7px 16px',
        color: disabled ? '#555' : '#ccc',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '12px',
        userSelect: 'none',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#3e3e3e' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}
      onMouseDown={e => { e.stopPropagation(); if (!disabled) { onClick(); onClose2() } }}
    >
      {label}
    </div>
  )

  const divider = <div style={{ height: '1px', background: '#3c3c3c', margin: '3px 0' }} />

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#2d2d2d',
        border: '1px solid #444',
        borderRadius: '6px',
        padding: '4px 0',
        zIndex: 99999,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        minWidth: '170px',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      {item(tab.pinned ? 'Unpin tab' : 'Pin tab', () => onPin(tab.path))}
      {tab.preview && item('Keep tab open', () => onPin(tab.path))}
      {divider}
      {item('Close tab', () => onClose(tab.path), tab.pinned)}
      {item('Close other tabs', onCloseOthers)}
      {item('Close all tabs', onCloseAll)}
    </div>
  )
}

// ── TabBar ────────────────────────────────────────────────────────────────────

export default function TabBar({ tabs, activeTab, unsavedPaths, onSwitch, onClose, onPin, onCloseOthers, onCloseAll }) {
  const [ctx, setCtx] = useState(null)  // { x, y, tab }

  if (tabs.length === 0) return null

  function handleContextMenu(e, tab) {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, tab })
  }

  function handleMiddleClick(e, tab) {
    if (e.button === 1 && !tab.pinned) {
      e.preventDefault()
      onClose(tab.path)
    }
  }

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        background: '#1e1e1e',
        borderBottom: '1px solid #3c3c3c',
        height: '34px',
        flexShrink: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
      }}>
        {tabs.map(tab => {
          const active = tab.path === activeTab
          const unsaved = unsavedPaths.has(tab.path)
          const name = basename(tab.path)

          return (
            <div
              key={tab.path}
              title={tab.preview ? `${tab.path} (preview — edit or pin to keep)` : tab.path}
              onMouseDown={e => { if (e.button === 0) onSwitch(tab.path) }}
              onDoubleClick={() => { if (tab.preview) onPin(tab.path) }}
              onAuxClick={e => handleMiddleClick(e, tab)}
              onContextMenu={e => handleContextMenu(e, tab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0 12px 0 14px',
                height: '100%',
                cursor: 'pointer',
                userSelect: 'none',
                flexShrink: 0,
                maxWidth: '180px',
                minWidth: '80px',
                borderRight: '1px solid #2e2e2e',
                background: active ? '#252526' : 'transparent',
                borderTop: active ? '1px solid #007acc' : '1px solid transparent',
                position: 'relative',
                whiteSpace: 'nowrap',
                fontSize: '12px',
                color: active ? '#ccc' : '#888',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#2a2a2a' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Pin indicator */}
              {tab.pinned && (
                <span style={{ fontSize: '9px', opacity: 0.5, flexShrink: 0 }} title="Pinned">📌</span>
              )}

              {/* Unsaved dot */}
              {unsaved && (
                <span style={{
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: '#e0c46a',
                  flexShrink: 0,
                  display: 'inline-block',
                }} title="Unsaved changes" />
              )}

              {/* Filename — always shown */}
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
                fontStyle: tab.preview ? 'italic' : 'normal',
                opacity: tab.preview ? 0.75 : 1,
              }}>
                {name}
              </span>

              {/* Close button — only on non-pinned tabs */}
              {!tab.pinned && (
                <span
                  title="Close tab"
                  onMouseDown={e => { e.stopPropagation(); onClose(tab.path) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    flexShrink: 0,
                    fontSize: '12px',
                    color: '#666',
                    lineHeight: 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.background = '#444' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = '' }}
                >
                  ×
                </span>
              )}
            </div>
          )
        })}
      </div>

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          tab={ctx.tab}
          onPin={onPin}
          onClose={onClose}
          onCloseOthers={() => onCloseOthers(ctx.tab.path)}
          onCloseAll={onCloseAll}
          onClose2={() => setCtx(null)}
        />
      )}
    </>
  )
}
