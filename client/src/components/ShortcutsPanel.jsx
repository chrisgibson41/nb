import React, { useState, useEffect, useMemo } from 'react'

const API = 'http://localhost:3001'

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesTemplate(content, filePath, template) {
  const tags = template.tags || []
  if (tags.length > 0) {
    const tagMatch = content.match(/^---[\s\S]*?^tags:\s*\[([^\]]*)\]/m)
    if (tagMatch) {
      const noteTags = tagMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''))
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

function parseSection(content, sectionHeading) {
  const lines = content.split('\n')
  const re = new RegExp(`^## ${sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
  let inSection = false
  const entries = []

  for (const line of lines) {
    if (re.test(line)) { inSection = true; continue }
    if (inSection && /^## /.test(line)) break
    if (inSection) {
      const m = line.match(/^### (.+)/)
      if (m) {
        // Strip legacy "HH:MM — " prefix if present
        const title = m[1].replace(/^\d{2}:\d{2}\s*—\s*/, '').trim()
        entries.push(title)
      }
    }
  }
  return entries
}

function insertEntry(content, shortcut, title) {
  const heading = shortcut.heading
    ? shortcut.heading.replace(/\{\{title\}\}/g, title)
    : title
  const body = shortcut.body || ''
  const block = `\n### ${heading}\n\n${body}`

  const lines = content.split('\n')
  const re = new RegExp(`^## ${shortcut.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
  let sectionIdx = -1
  let nextSectionIdx = -1

  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) { sectionIdx = i; continue }
    if (sectionIdx !== -1 && /^## /.test(lines[i])) { nextSectionIdx = i; break }
  }

  if (sectionIdx === -1) {
    return content.trimEnd() + `\n\n## ${shortcut.section}\n` + block
  }

  const insertAt = nextSectionIdx !== -1 ? nextSectionIdx : lines.length
  const newLines = [...lines]
  newLines.splice(insertAt, 0, ...block.split('\n'))
  return newLines.join('\n')
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '0 24px',
    minHeight: '38px',
    background: '#252526',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
  },
  divider: {
    width: '1px',
    height: '18px',
    background: '#3c3c3c',
    flexShrink: 0,
    margin: '0 4px',
  },
  label: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#555',
    textTransform: 'uppercase',
    marginRight: '2px',
    flexShrink: 0,
  },
  chip: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#c8c8c8',
    background: '#37373d',
    border: '1px solid #4a4a4a',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
    maxWidth: '220px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  addBtn: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#007acc',
    background: 'transparent',
    border: '1px solid #007acc',
    cursor: 'pointer',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  input: {
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#ccc',
    fontSize: '12px',
    padding: '3px 8px',
    outline: 'none',
    height: '26px',
  },
  confirmBtn: {
    padding: '3px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#fff',
    background: '#007acc',
    border: 'none',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '3px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#999',
    background: 'transparent',
    border: '1px solid #444',
    cursor: 'pointer',
  },
}

// ── Per-shortcut group ────────────────────────────────────────────────────────

function ShortcutGroup({ shortcut, entries, content, setContent, onScrollTo, isFirst }) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')

  function handleAdd() {
    const t = title.trim()
    if (!t) return
    const newContent = insertEntry(content, shortcut, t)
    setContent(newContent)
    setTitle('')
    setShowForm(false)
    const heading = shortcut.heading
      ? shortcut.heading.replace(/\{\{title\}\}/g, t)
      : t
    setTimeout(() => onScrollTo?.(heading), 80)
  }

  function handleChipHover(e, enter) {
    e.currentTarget.style.background = enter ? '#4a4a52' : '#37373d'
    e.currentTarget.style.borderColor = enter ? '#666' : '#4a4a4a'
  }

  function handleAddBtnHover(e, enter) {
    e.currentTarget.style.background = enter ? '#007acc22' : 'transparent'
  }

  return (
    <>
      {!isFirst && <div style={S.divider} />}
      <span style={S.label}>{shortcut.label}</span>

      {entries.length === 0 && !showForm && (
        <span style={{ fontSize: '12px', color: '#444', fontStyle: 'italic' }}>
          None yet
        </span>
      )}

      {entries.map((e, i) => (
        <span
          key={i}
          style={S.chip}
          title={e}
          onClick={() => onScrollTo?.(e)}
          onMouseEnter={ev => handleChipHover(ev, true)}
          onMouseLeave={ev => handleChipHover(ev, false)}
        >
          {e}
        </span>
      ))}

      {!showForm ? (
        <button
          style={S.addBtn}
          onClick={() => { setTitle(''); setShowForm(true) }}
          onMouseEnter={e => handleAddBtnHover(e, true)}
          onMouseLeave={e => handleAddBtnHover(e, false)}
        >
          + Add {shortcut.label.replace(/s$/, '')}
        </button>
      ) : (
        <div style={S.form}>
          <input
            style={{ ...S.input, width: '200px' }}
            placeholder={`${shortcut.label.replace(/s$/, '')} title…`}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') setShowForm(false)
            }}
            autoFocus
          />
          <button style={S.confirmBtn} onClick={handleAdd}>Add</button>
          <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ShortcutsPanel({ content, setContent, filePath, onScrollTo }) {
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    fetch(`${API}/api/templates`)
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => {})
  }, [])

  const matchedTemplate = useMemo(() => {
    if (!content && !filePath) return null
    return templates.find(t => matchesTemplate(content, filePath, t)) || null
  }, [templates, content, filePath])

  const shortcuts = matchedTemplate?.shortcuts || []

  if (shortcuts.length === 0) return null

  return (
    <div style={S.bar}>
      {shortcuts.map((shortcut, i) => {
        const entries = parseSection(content, shortcut.section)
        return (
          <ShortcutGroup
            key={i}
            shortcut={shortcut}
            entries={entries}
            content={content}
            setContent={setContent}
            onScrollTo={onScrollTo}
            isFirst={i === 0}
          />
        )
      })}
    </div>
  )
}
