import React, { useState, useMemo } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDailyNote(content, filePath) {
  // Check frontmatter tags
  const tagMatch = content.match(/^---[\s\S]*?^tags:\s*\[([^\]]*)\]/m)
  if (tagMatch) {
    const tags = tagMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''))
    if (tags.includes('daily') || tags.includes('journal')) return true
  }
  // Check file path
  if (filePath && /\/Daily\//i.test(filePath)) return true
  // Check filename looks like a date (YYYY-MM-DD)
  if (filePath && /\d{4}-\d{2}-\d{2}\.md$/.test(filePath)) return true
  return false
}

function parseMeetings(content) {
  const lines = content.split('\n')
  let inMeetings = false
  const meetings = []

  for (const line of lines) {
    if (/^## Meetings\s*$/i.test(line)) { inMeetings = true; continue }
    if (inMeetings && /^## /.test(line)) break  // next h2 = end of section
    if (inMeetings) {
      const m = line.match(/^### (.+)/)
      if (m) meetings.push(m[1].trim())
    }
  }
  return meetings
}

function now() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function insertMeeting(content, title, time) {
  const block =
    `\n### ${time} — ${title}\n\n` +
    `**Attendees:** \n\n` +
    `**Notes:**\n\n\n` +
    `**Action Items:**\n- [ ] \n`

  const lines = content.split('\n')
  let meetingsIdx = -1
  let nextSectionIdx = -1

  for (let i = 0; i < lines.length; i++) {
    if (/^## Meetings\s*$/i.test(lines[i])) { meetingsIdx = i; continue }
    if (meetingsIdx !== -1 && /^## /.test(lines[i])) { nextSectionIdx = i; break }
  }

  if (meetingsIdx === -1) {
    // No Meetings section — append one at the end
    return content.trimEnd() + '\n\n## Meetings\n' + block
  }

  // Insert before the next h2, or at end of file
  const insertAt = nextSectionIdx !== -1 ? nextSectionIdx : lines.length
  // Remove any trailing blank lines before insertion point to avoid double blanks
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
  timeInput: {
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#ccc',
    fontSize: '12px',
    padding: '3px 6px',
    outline: 'none',
    height: '26px',
    width: '82px',
    colorScheme: 'dark',
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function MeetingsPanel({ content, setContent, filePath, onScrollTo }) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle]       = useState('')
  const [time, setTime]         = useState(now)

  const visible  = useMemo(() => isDailyNote(content, filePath), [content, filePath])
  const meetings = useMemo(() => parseMeetings(content), [content])

  if (!visible) return null

  function handleAdd() {
    const t = title.trim()
    if (!t) return
    const newContent = insertMeeting(content, t, time)
    setContent(newContent)
    setTitle('')
    setTime(now())
    setShowForm(false)
    // Scroll to the newly added meeting
    setTimeout(() => onScrollTo?.(`${time} — ${t}`), 80)
  }

  function handleChipHover(e, enter) {
    e.currentTarget.style.background = enter ? '#4a4a52' : '#37373d'
    e.currentTarget.style.borderColor = enter ? '#666' : '#4a4a4a'
  }

  function handleAddBtnHover(e, enter) {
    e.currentTarget.style.background = enter ? '#007acc22' : 'transparent'
  }

  return (
    <div style={S.bar}>
      <span style={S.label}>Meetings</span>

      {meetings.length === 0 && !showForm && (
        <span style={{ fontSize: '12px', color: '#444', fontStyle: 'italic' }}>No meetings yet</span>
      )}

      {meetings.map((m, i) => (
        <span
          key={i}
          style={S.chip}
          title={m}
          onClick={() => onScrollTo?.(m)}
          onMouseEnter={e => handleChipHover(e, true)}
          onMouseLeave={e => handleChipHover(e, false)}
        >
          {m}
        </span>
      ))}

      {!showForm ? (
        <button
          style={S.addBtn}
          onClick={() => { setTime(now()); setShowForm(true) }}
          onMouseEnter={e => handleAddBtnHover(e, true)}
          onMouseLeave={e => handleAddBtnHover(e, false)}
        >
          + Add Meeting
        </button>
      ) : (
        <div style={S.form}>
          <input
            style={{ ...S.input, width: '200px' }}
            placeholder="Meeting title…"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowForm(false) }}
            autoFocus
          />
          <input
            style={S.timeInput}
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
          />
          <button style={S.confirmBtn} onClick={handleAdd}>Add</button>
          <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}
