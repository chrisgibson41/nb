import React, { useState, useEffect, useCallback } from 'react';

const API = '';

function formatDate(str) {
  try {
    return new Date(str).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return str; }
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: '8px',
    width: '860px', maxWidth: '95vw', height: '600px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex', alignItems: 'center', padding: '14px 16px',
    borderBottom: '1px solid #3c3c3c', gap: '10px', flexShrink: 0,
  },
  title: { fontSize: '14px', fontWeight: 600, color: '#cccccc', flex: 1 },
  closeBtn: {
    background: 'none', border: 'none', color: '#888', cursor: 'pointer',
    fontSize: '18px', lineHeight: 1, padding: '2px 6px', borderRadius: '4px',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  list: {
    width: '280px', flexShrink: 0, borderRight: '1px solid #3c3c3c',
    overflowY: 'auto', display: 'flex', flexDirection: 'column',
  },
  commit: (active) => ({
    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #2a2a2a',
    background: active ? '#2d2d2d' : 'transparent',
    borderLeft: active ? '2px solid #007acc' : '2px solid transparent',
  }),
  commitMsg: {
    fontSize: '12px', color: '#cccccc', marginBottom: '4px',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  commitMeta: { fontSize: '11px', color: '#666' },
  commitHash: { fontFamily: 'monospace', fontSize: '10px', color: '#555', marginTop: '2px' },
  preview: {
    flex: 1, overflow: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column',
  },
  previewPre: {
    margin: 0, fontFamily: "'Fira Code', 'Consolas', monospace",
    fontSize: '12px', color: '#abb2bf', lineHeight: 1.6,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  empty: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#555', fontSize: '13px',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    padding: '10px 16px', borderTop: '1px solid #3c3c3c', gap: '8px', flexShrink: 0,
  },
  btn: (primary) => ({
    padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', border: primary ? 'none' : '1px solid #555',
    background: primary ? '#007acc' : 'transparent',
    color: primary ? '#fff' : '#cccccc',
  }),
};

export default function HistoryModal({ filePath, onClose, onRestore }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fileName = filePath.split('/').pop();

  useEffect(() => {
    fetch(`${API}/api/git/log?path=${encodeURIComponent(filePath)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setCommits(data);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [filePath]);

  const selectCommit = useCallback(async (commit) => {
    setSelected(commit);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API}/api/git/show?path=${encodeURIComponent(filePath)}&hash=${commit.hash}`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const text = await res.text();
      setPreview(text);
    } catch (err) {
      setPreview(`Error loading version: ${err.message}`);
    }
    setPreviewLoading(false);
  }, [filePath]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleRestore = () => {
    if (preview != null) { onRestore(preview); onClose(); }
  };

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>

        <div style={S.header}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={S.title}>History — {fileName}</span>
          <button style={S.closeBtn} onClick={onClose} title="Close">×</button>
        </div>

        <div style={S.body}>
          {/* Commit list */}
          <div style={S.list}>
            {loading && <div style={S.empty}>Loading history…</div>}
            {error && (
              <div style={{ padding: '16px', fontSize: '12px', color: '#f44747' }}>{error}</div>
            )}
            {!loading && !error && commits.length === 0 && (
              <div style={S.empty}>No commits yet for this file.</div>
            )}
            {commits.map((c, i) => (
              <div
                key={c.hash}
                style={S.commit(selected?.hash === c.hash)}
                onClick={() => selectCommit(c)}
                onMouseEnter={(e) => { if (selected?.hash !== c.hash) e.currentTarget.style.background = '#252526'; }}
                onMouseLeave={(e) => { if (selected?.hash !== c.hash) e.currentTarget.style.background = selected?.hash === c.hash ? '#2d2d2d' : 'transparent'; }}
              >
                <div style={S.commitMsg} title={c.message}>{c.message}</div>
                <div style={S.commitMeta}>{formatDate(c.date)}</div>
                <div style={S.commitHash}>
                  {c.hash.slice(0, 7)}
                  {i === 0 && <span style={{ color: '#007acc', marginLeft: 6 }}>· latest</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Preview pane */}
          <div style={S.preview}>
            {!selected && <div style={S.empty}>← Select a commit to preview</div>}
            {selected && previewLoading && <div style={S.empty}>Loading…</div>}
            {selected && !previewLoading && preview != null && (
              <pre style={S.previewPre}>{preview}</pre>
            )}
          </div>
        </div>

        <div style={S.footer}>
          {selected && (
            <span style={{ fontSize: '11px', color: '#666', marginRight: 'auto' }}>
              {formatDate(selected.date)} · {selected.hash.slice(0, 7)}
            </span>
          )}
          <button style={S.btn(false)} onClick={onClose}>Cancel</button>
          {selected && (
            <button style={S.btn(true)} onClick={handleRestore} disabled={previewLoading}
              title="Restore the file to this historical version">
              Restore this version
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
