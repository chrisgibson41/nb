import React, { useState, useEffect, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesTemplate(content, filePath, template) {
  const tags = template.tags || []
  if (tags.length > 0) {
    // Match inline YAML arrays: tags: [daily, journal]
    const inlineMatch = content.match(/^---[\s\S]*?^tags:\s*\[([^\]]*)\]/m)
    if (inlineMatch) {
      const noteTags = inlineMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''))
      if (tags.some(t => noteTags.includes(t))) return true
    }
    // Match block-style YAML arrays (gray-matter stringifies to this):
    //   tags:
    //     - daily
    //     - journal
    const blockMatch = content.match(/^---[\s\S]*?^tags:\s*\n((?:[ \t]*-[ \t]+\S.*\n?)*)/m)
    if (blockMatch) {
      const noteTags = blockMatch[1].split('\n')
        .map(l => l.replace(/^[ \t]*-[ \t]+/, '').trim().replace(/['"]/g, ''))
        .filter(Boolean)
      if (tags.some(t => noteTags.includes(t))) return true
    }
  }
  // Fall back to file path / filename heuristics per template name
  if (template.name === 'daily-note') {
    if (filePath && /\/Daily\//i.test(filePath)) return true
    if (filePath && /\d{4}-\d{2}-\d{2}\.md$/.test(filePath)) return true
  }
  return false
}

// Derive a singular button label from the shortcut definition.
function singularize(shortcut) {
  if (shortcut.singularLabel) return shortcut.singularLabel
  const base = shortcut.label || shortcut.section
  return base.replace(/ies$/, 'y').replace(/ses$/, 'se').replace(/s$/, '')
}

function insertEntry(content, shortcut, title, body) {
  const heading = shortcut.heading
    ? shortcut.heading.replace(/\{\{title\}\}/g, title)
    : title
  // No leading blank line — the document's own blank line after the section
  // heading (or after the previous entry) already provides spacing.
  const block = `### ${heading}\n\n${body ? body.trimEnd() + '\n' : ''}`

  const lines = content.split('\n')
  const re = new RegExp(`^## ${shortcut.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
  let sectionIdx = -1
  let nextSectionIdx = -1

  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) { sectionIdx = i; continue }
    if (sectionIdx !== -1 && /^## /.test(lines[i])) { nextSectionIdx = i; break }
  }

  if (sectionIdx === -1) {
    // Create the section + first entry, separated by a blank line
    return content.trimEnd() + `\n\n## ${shortcut.section}\n\n` + block
  }

  // Find the insertion point — before the next ## section, or at end of doc
  let insertAt = nextSectionIdx !== -1 ? nextSectionIdx : lines.length

  // Ensure exactly one trailing blank line before the new entry
  // (scrub duplicates that accumulate over time)
  const newLines = [...lines]
  while (insertAt > sectionIdx + 1 && newLines[insertAt - 1] === '' && newLines[insertAt - 2] === '') {
    newLines.splice(insertAt - 1, 1)
    insertAt--
  }
  // If there's no blank line yet before the insert point, add one
  if (insertAt > 0 && newLines[insertAt - 1] !== '') {
    newLines.splice(insertAt, 0, '')
    insertAt++
  }

  newLines.splice(insertAt, 0, ...block.split('\n'))
  return newLines.join('\n')
}

// ── Shortcut entry modal ──────────────────────────────────────────────────────

function ShortcutModal({ shortcut, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState(shortcut.body || '')
  const titleRef = useRef(null)
  const hasHeading = !!shortcut.heading

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const btnLabel = singularize(shortcut)

  function handleSave() {
    const t = title.trim()
    if (hasHeading && !t) return
    onSave(t, body)
  }

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: '10px',
        padding: '24px',
        width: '460px',
        maxWidth: '92vw',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        fontFamily: 'Inter, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ccc' }}>
            Add {btnLabel}
          </h3>
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'none', border: 'none', color: '#666',
              fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
              borderRadius: '4px',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.background = '#333' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'none' }}
          >×</button>
        </div>

        {/* Title field */}
        {hasHeading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
              Title
            </label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !shortcut.body) handleSave()
              }}
              placeholder={`${btnLabel} title…`}
              style={{
                background: '#2d2d2d',
                border: '1px solid #555',
                borderRadius: '6px',
                color: '#ccc',
                fontSize: '14px',
                padding: '8px 12px',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#007acc' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#555' }}
            />
          </div>
        )}

        {/* Body field — shown when shortcut has a body template */}
        {shortcut.body !== undefined && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
              Notes
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
              }}
              rows={6}
              style={{
                background: '#2d2d2d',
                border: '1px solid #555',
                borderRadius: '6px',
                color: '#ccc',
                fontSize: '13px',
                fontFamily: 'ui-monospace, "Fira Code", monospace',
                padding: '8px 12px',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                lineHeight: 1.6,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#007acc' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#555' }}
            />
            <span style={{ fontSize: '11px', color: '#555' }}>
              {shortcut.body ? 'Pre-filled from template — edit as needed' : ''}
              {shortcut.body ? '' : ''} Cmd/Ctrl+Enter to save
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#999',
              background: 'transparent',
              border: '1px solid #444',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#999' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={hasHeading && !title.trim()}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              background: hasHeading && !title.trim() ? '#005a99' : '#007acc',
              border: 'none',
              cursor: hasHeading && !title.trim() ? 'not-allowed' : 'pointer',
              opacity: hasHeading && !title.trim() ? 0.5 : 1,
              transition: 'background 0.15s, opacity 0.15s',
            }}
            onMouseEnter={e => { if (!(hasHeading && !title.trim())) e.currentTarget.style.background = '#1a8fe3' }}
            onMouseLeave={e => { if (!(hasHeading && !title.trim())) e.currentTarget.style.background = '#007acc' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(modal, document.body)
}

// ── Per-shortcut button ───────────────────────────────────────────────────────

function ShortcutButton({ shortcut, content, setContent, onScrollTo, isFirst }) {
  const [showModal, setShowModal] = useState(false)

  const btnLabel = singularize(shortcut)

  function handleSave(title, body) {
    const newContent = insertEntry(content, shortcut, title, body)
    setContent(newContent)
    setShowModal(false)
    const heading = shortcut.heading
      ? shortcut.heading.replace(/\{\{title\}\}/g, title)
      : title
    setTimeout(() => onScrollTo?.(heading), 80)
  }

  return (
    <>
      {!isFirst && (
        <div style={{ width: '1px', height: '16px', background: '#3c3c3c', flexShrink: 0 }} />
      )}

      <button
        style={{
          padding: '3px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          color: '#007acc',
          background: 'transparent',
          border: '1px solid #007acc',
          cursor: 'pointer',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        title={`Add a new ${btnLabel}`}
        onClick={() => setShowModal(true)}
        onMouseEnter={e => { e.currentTarget.style.background = '#007acc22' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        + Add {btnLabel}
      </button>

      {showModal && (
        <ShortcutModal
          shortcut={shortcut}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
//
// Shortcuts are driven entirely by template frontmatter. Add or extend shortcut
// groups by editing your template's `_shortcuts` array, e.g.:
//
//   _shortcuts:
//     - label: Meetings          # button says "+ Add Meeting"
//       section: Meetings        # h2 section to insert under
//       heading: "{{title}}"     # h3 heading template ({{title}} = user input)
//       body: |                  # optional body inserted after the heading
//         **Attendees:**
//         **Notes:**
//     - label: Decisions
//       section: Decisions
//       singularLabel: Decision  # override auto-singularization
//       heading: "{{title}}"
//       body: ""
//
export default function ShortcutsPanel({ content, setContent, filePath, onScrollTo, templates = [] }) {
  const matchedTemplate = useMemo(() => {
    if (!filePath) return null
    return templates.find(t => matchesTemplate(content, filePath, t)) || null
  }, [templates, content, filePath])

  const shortcuts = matchedTemplate?.shortcuts || []

  if (shortcuts.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '6px',
      padding: '0 16px',
      minHeight: '36px',
      background: '#252526',
      borderBottom: '1px solid #3c3c3c',
      flexShrink: 0,
    }}>
      {shortcuts.map((shortcut, i) => (
        <ShortcutButton
          key={i}
          shortcut={shortcut}
          content={content}
          setContent={setContent}
          onScrollTo={onScrollTo}
          isFirst={i === 0}
        />
      ))}
    </div>
  )
}
