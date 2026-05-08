import React, { useState, useEffect, useRef } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function basename(p) {
  return p ? p.split('/').pop() : ''
}

const noDrag = { WebkitAppRegion: 'no-drag' }

// ── Context menu (from TabBar) ────────────────────────────────────────────────

function ContextMenu({ x, y, tab, onPin, onClose, onCloseOthers, onCloseAll, onClose2 }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose2()
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [onClose2])

  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth)   menuRef.current.style.left = `${x - rect.width}px`
    if (rect.bottom > window.innerHeight) menuRef.current.style.top  = `${y - rect.height}px`
  }, [x, y])

  const item = (label, onClick, disabled = false) => (
    <div
      key={label}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: '40px',
    background: '#323233',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
    userSelect: 'none',
    WebkitAppRegion: 'drag',
    overflow: 'hidden',
  },
  // Left spacer — room for macOS traffic-light buttons
  trafficSpacer: {
    width: '80px',
    flexShrink: 0,
  },
  // Scrollable tab strip — takes all flexible space
  tabStrip: {
    display: 'flex',
    alignItems: 'stretch',
    flex: 1,
    height: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
    ...noDrag,
  },
  // Right actions cluster
  rightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 10px 0 8px',
    flexShrink: 0,
    ...noDrag,
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#cccccc',
    background: 'transparent',
    border: '1px solid #3c3c3c',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  saveIndicator: (unsaved) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    color: unsaved ? '#e5c07b' : '#6b6b6b',
    transition: 'color 0.2s',
    whiteSpace: 'nowrap',
  }),
  dot: (unsaved) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: unsaved ? '#e5c07b' : '#555',
    transition: 'background 0.2s',
  }),
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '3px 8px',
    gap: '5px',
    height: '26px',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#cccccc',
    fontSize: '12px',
    width: '120px',
  },
}

// ── CombinedBar ───────────────────────────────────────────────────────────────

export default function CombinedBar({
  // Toolbar props
  isUnsaved,
  onSave,
  onNewTemplate,
  onSettings,
  onHistory,
  onTasks,
  searchQuery,
  setSearchQuery,
  currentFile,
  // TabBar props
  tabs,
  activeTab,
  unsavedPaths,
  onSwitch,
  onClose,
  onPin,
  onCloseOthers,
  onCloseAll,
}) {
  const [ctx, setCtx] = useState(null)  // { x, y, tab }

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

  const btnHover = {
    onMouseEnter: (e) => { e.currentTarget.style.background = '#2a2d2e'; e.currentTarget.style.borderColor = '#555' },
    onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#3c3c3c' },
  }

  return (
    <>
      <div style={styles.bar}>
        {/* macOS traffic-light spacer */}
        <div style={styles.trafficSpacer} />

        {/* Tab strip */}
        <div style={styles.tabStrip}>
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
                  borderTop: active ? '2px solid #007acc' : '2px solid transparent',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                  fontSize: '12px',
                  color: active ? '#ccc' : '#888',
                  transition: 'background 0.1s',
                  boxSizing: 'border-box',
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

                {/* Filename */}
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

        {/* Right actions */}
        <div style={styles.rightActions}>
          {/* Search box */}
          <div style={styles.searchBox}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              style={styles.searchInput}
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Clear search"
                style={{ color: '#888', padding: 0, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
              >×</button>
            )}
          </div>

          {/* History button — only when a file is open */}
          {currentFile && (
            <button
              style={styles.btn}
              onClick={onHistory}
              title="File history"
              {...btnHover}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              History
            </button>
          )}

          {/* Tasks button */}
          <button
            style={styles.btn}
            onClick={onTasks}
            title="All tasks across notes"
            {...btnHover}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Tasks
          </button>

          {/* New button */}
          <button
            style={styles.btn}
            onClick={onNewTemplate}
            title="New note from template (Ctrl+T)"
            {...btnHover}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>

          {/* Save indicator dot */}
          <div style={styles.saveIndicator(isUnsaved)}>
            <div style={styles.dot(isUnsaved)} />
            {isUnsaved ? 'Unsaved' : 'Saved'}
          </div>

          {/* Settings gear */}
          <button
            style={{ ...styles.btn, padding: '4px 8px', borderColor: 'transparent' }}
            onClick={onSettings}
            title="Settings"
            onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2d2e'; e.currentTarget.style.borderColor = '#555' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Context menu portal */}
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
