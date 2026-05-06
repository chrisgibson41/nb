import React, { useState, useEffect, useRef } from 'react'

const API = ''

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    background: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    padding: '24px',
    width: '500px',
    maxWidth: '92vw',
    fontFamily: 'Inter, -apple-system, sans-serif',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  title: {
    color: '#cccccc',
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 0 20px',
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '6px',
  },
  fieldHint: {
    fontSize: '11px',
    color: '#555',
    marginTop: '4px',
    lineHeight: 1.4,
  },
  input: {
    width: '100%',
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#cccccc',
    fontSize: '12px',
    padding: '7px 10px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  row: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '24px',
  },
  cancelBtn: {
    padding: '6px 16px',
    fontSize: '12px',
    color: '#999',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: (saved) => ({
    padding: '6px 16px',
    fontSize: '12px',
    color: '#fff',
    background: saved ? '#2d9e5f' : '#007acc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s',
    minWidth: '70px',
  }),
  divider: {
    height: '1px',
    background: '#3c3c3c',
    margin: '20px 0',
  },
  sectionTitle: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '12px',
    fontWeight: 500,
  },
  codeBlock: {
    background: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '12px',
    fontSize: '11px',
    color: '#9cdcfe',
    fontFamily: 'monospace',
    lineHeight: 1.6,
    whiteSpace: 'pre',
    overflowX: 'auto',
  },
}

export default function SettingsModal({ onClose }) {
  const [notesDir, setNotesDir] = useState('')
  const [templatesDir, setTemplatesDir] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const notesDirRef = useRef(null)

  useEffect(() => {
    fetch(`${API}/api/config`)
      .then(r => r.json())
      .then(cfg => {
        setNotesDir(cfg.notesDir || '')
        setTemplatesDir(cfg.templatesDir || '')
      })
      .catch(() => setError('Could not load config'))
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notesDir, templatesDir }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <div
      style={S.overlay}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={S.panel}>
        <h2 style={S.title}>Settings</h2>

        {/* Notes directory */}
        <div style={{ marginBottom: '16px' }}>
          <div style={S.fieldLabel}>Notes folder</div>
          <input
            ref={notesDirRef}
            style={S.input}
            value={notesDir}
            onChange={e => { setNotesDir(e.target.value); setSaved(false) }}
            placeholder="~/notes  or  /absolute/path/to/notes"
            spellCheck={false}
          />
          <div style={S.fieldHint}>
            Use <code style={{ color: '#ce9178' }}>~</code> for your home directory. Changes apply immediately — no restart needed.
          </div>
        </div>

        {/* Templates directory */}
        <div style={{ marginBottom: '4px' }}>
          <div style={S.fieldLabel}>Templates folder</div>
          <input
            style={S.input}
            value={templatesDir}
            onChange={e => { setTemplatesDir(e.target.value); setSaved(false) }}
            placeholder="~/notes/templates  or  /absolute/path/to/templates"
            spellCheck={false}
          />
          <div style={S.fieldHint}>
            Markdown files here appear in the New note modal. Each file can define shortcuts via <code style={{ color: '#ce9178' }}>_shortcuts</code> in its frontmatter.
          </div>
        </div>

        {/* Shortcut config reference */}
        <div style={S.divider} />
        <div style={S.sectionTitle}>Adding shortcuts to a template</div>
        <div style={S.codeBlock}>{`---
_shortcuts:
  - label: Meetings          # button label → "+ Add Meeting"
    section: Meetings        # the ## heading to insert under
    heading: "{{title}}"    # the ### heading ({{title}} = your input)
    body: |
      **Attendees:**
      **Notes:**
  - label: Decisions
    singularLabel: Decision  # override auto-singularization
    section: Decisions
    heading: "{{title}}"
    body: ""
---`}</div>

        {error && (
          <div style={{ color: '#f47c7c', fontSize: '12px', marginTop: '10px' }}>{error}</div>
        )}

        <div style={S.row}>
          <button style={S.cancelBtn} onClick={onClose} title="Discard changes and close"
            onMouseEnter={e => e.currentTarget.style.borderColor = '#666'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#444'}
          >Cancel</button>
          <button style={S.saveBtn(saved)} onClick={handleSave} disabled={saving} title="Save settings">
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
