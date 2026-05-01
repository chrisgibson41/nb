import React, { useState, useMemo } from 'react'

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
// Template can override with `singularLabel`; otherwise we strip a trailing 's'.
function singularize(shortcut) {
  if (shortcut.singularLabel) return shortcut.singularLabel
  const base = shortcut.label || shortcut.section
  return base.replace(/ies$/, 'y').replace(/ses$/, 'se').replace(/s$/, '')
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
    padding: '0 16px',
    minHeight: '36px',
    background: '#252526',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
  },
  divider: {
    width: '1px',
    height: '16px',
    background: '#3c3c3c',
    flexShrink: 0,
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

function ShortcutGroup({ shortcut, content, setContent, onScrollTo, isFirst }) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')

  const btnLabel = singularize(shortcut)

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

  return (
    <>
      {!isFirst && <div style={S.divider} />}

      {!showForm ? (
        <button
          style={S.addBtn}
          onClick={() => { setTitle(''); setShowForm(true) }}
          onMouseEnter={e => { e.currentTarget.style.background = '#007acc22' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          + Add {btnLabel}
        </button>
      ) : (
        <div style={S.form}>
          <input
            style={{ ...S.input, width: '200px' }}
            placeholder={`${btnLabel} title…`}
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
    <div style={S.bar}>
      {shortcuts.map((shortcut, i) => (
        <ShortcutGroup
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
