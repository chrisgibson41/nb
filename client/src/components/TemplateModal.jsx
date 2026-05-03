import React, { useState, useEffect, useCallback } from 'react';

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '10px',
    width: '500px',
    maxWidth: '95vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #3c3c3c',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#cccccc',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    borderRadius: '5px',
    color: '#888',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    fontSize: '18px',
    lineHeight: 1,
    transition: 'all 0.15s',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '8px',
  },
  templateCard: (selected) => ({
    padding: '12px 14px',
    background: selected ? '#1a3a5c' : '#2d2d2d',
    border: `1px solid ${selected ? '#007acc' : '#3c3c3c'}`,
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  }),
  templateName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#cccccc',
    textTransform: 'capitalize',
  },
  templateDesc: {
    fontSize: '11px',
    color: '#888',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  inputLabel: {
    fontSize: '12px',
    color: '#999',
    fontWeight: 500,
  },
  input: {
    background: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '5px',
    padding: '8px 10px',
    color: '#cccccc',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '100%',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 20px',
    borderTop: '1px solid #3c3c3c',
  },
  btn: (primary) => ({
    padding: '7px 18px',
    borderRadius: '5px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s',
    background: primary ? '#007acc' : '#3a3a3a',
    color: primary ? '#ffffff' : '#cccccc',
  }),
  error: {
    fontSize: '12px',
    color: '#f44747',
    padding: '6px 10px',
    background: 'rgba(244,71,71,0.1)',
    borderRadius: '4px',
    border: '1px solid rgba(244,71,71,0.3)',
  },
};

const TEMPLATE_DESCRIPTIONS = {
  'daily-note': 'Journal & tasks for a day',
  'meeting-note': 'Meeting agenda & notes',
  'blank': 'Empty note with frontmatter',
};

function getDefaultPath(template, title) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  if (template === 'daily-note') {
    return `notes/Daily/${date}.md`;
  }
  if (template === 'meeting-note') {
    const slug = (title || 'meeting').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `notes/Meetings/${date}-${slug}.md`;
  }
  const slug = (title || 'untitled').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `notes/${slug}.md`;
}

export default function TemplateModal({ onClose, onCreated, api }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [title, setTitle] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingPath, setExistingPath] = useState(null); // set when 409 received

  useEffect(() => {
    fetch(`${api}/api/templates`)
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0].name);
          setOutputPath(getDefaultPath(data[0].name, ''));
        }
      })
      .catch(() => setError('Failed to load templates'));
  }, [api]);

  useEffect(() => {
    if (selectedTemplate) {
      setOutputPath(getDefaultPath(selectedTemplate, title));
    }
  }, [selectedTemplate, title]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleCreate = async (overwrite = false) => {
    if (!selectedTemplate) { setError('Please select a template'); return; }
    if (!outputPath.trim()) { setError('Please enter an output path'); return; }

    setLoading(true);
    setError('');
    setExistingPath(null);

    try {
      const res = await fetch(`${api}/api/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: selectedTemplate,
          outputPath: outputPath.trim(),
          vars: { title: title || 'Untitled' },
          overwrite,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setExistingPath(data.path);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create note');
      }

      const data = await res.json();
      onCreated(data.path, data.content);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>New note from template</span>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            title="Close"
            onMouseEnter={(e) => { e.currentTarget.style.background = '#3c3c3c'; e.currentTarget.style.color = '#cccccc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
          >
            ×
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.section}>
            <span style={styles.sectionLabel}>Template</span>
            {templates.length === 0 ? (
              <div style={{ color: '#666', fontSize: '13px' }}>Loading templates...</div>
            ) : (
              <div style={styles.templateGrid}>
                {templates.map((t) => (
                  <div
                    key={t.name}
                    style={styles.templateCard(selectedTemplate === t.name)}
                    onClick={() => setSelectedTemplate(t.name)}
                    onMouseEnter={(e) => {
                      if (selectedTemplate !== t.name) {
                        e.currentTarget.style.borderColor = '#555';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTemplate !== t.name) {
                        e.currentTarget.style.borderColor = '#3c3c3c';
                      }
                    }}
                  >
                    <div style={{ fontSize: '20px' }}>
                      {t.name === 'daily-note' ? '📅' : t.name === 'meeting-note' ? '👥' : '📄'}
                    </div>
                    <div style={styles.templateName}>
                      {t.name.replace(/-/g, ' ')}
                    </div>
                    <div style={styles.templateDesc}>
                      {TEMPLATE_DESCRIPTIONS[t.name] || 'Markdown template'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Note Title</label>
            <input
              style={styles.input}
              placeholder="Untitled"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#007acc'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#3c3c3c'; }}
              autoFocus
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Save Path</label>
            <input
              style={styles.input}
              placeholder="notes/my-note.md"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#007acc'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#3c3c3c'; }}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {existingPath && (
            <div style={{
              background: 'rgba(229,192,123,0.08)',
              border: '1px solid rgba(229,192,123,0.35)',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#e5c07b',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>A note already exists at this path.</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  style={{ ...styles.btn(false), fontSize: '12px', padding: '5px 12px' }}
                  title="Open the existing note at this path"
                  onClick={async () => {
                    try {
                      const r = await fetch(`${api}/api/file?path=${encodeURIComponent(existingPath)}`);
                      const text = await r.text();
                      onCreated(existingPath, text);
                    } catch { onCreated(existingPath, ''); }
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#444'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#3a3a3a'; }}
                >
                  Open existing
                </button>
                <button
                  style={{ ...styles.btn(false), fontSize: '12px', padding: '5px 12px', color: '#f44747', borderColor: 'rgba(244,71,71,0.4)' }}
                  title="Overwrite the existing note with the new template"
                  onClick={() => handleCreate(true)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,71,71,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#3a3a3a'; }}
                >
                  Overwrite
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button
            style={styles.btn(false)}
            onClick={onClose}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#3a3a3a'; }}
          >
            Cancel
          </button>
          <button
            style={{ ...styles.btn(true), opacity: loading ? 0.7 : 1 }}
            onClick={() => handleCreate(false)}
            disabled={loading}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0086dc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#007acc'; }}
          >
            {loading ? 'Creating...' : 'Create Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
