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

/** Parse a unified diff string into an array of line objects */
function parseDiff(text) {
  return text.split('\n').map(line => {
    if (line.startsWith('+++') || line.startsWith('---')) return { type: 'meta', text: line };
    if (line.startsWith('@@')) return { type: 'hunk', text: line };
    if (line.startsWith('+')) return { type: 'add', text: line.slice(1) };
    if (line.startsWith('-')) return { type: 'del', text: line.slice(1) };
    return { type: 'ctx', text: line.startsWith(' ') ? line.slice(1) : line };
  });
}

function DiffView({ lines }) {
  if (!lines.length) return (
    <div style={{ color: '#555', fontSize: '12px', padding: '24px', textAlign: 'center' }}>
      No changes in this commit
    </div>
  );

  return (
    <div style={{ fontFamily: "'Fira Code','Consolas',monospace", fontSize: '12px', lineHeight: 1.6 }}>
      {lines.map((l, i) => {
        const bg = l.type === 'add' ? 'rgba(80,200,120,0.12)'
          : l.type === 'del' ? 'rgba(220,80,80,0.12)'
          : l.type === 'hunk' ? 'rgba(100,160,255,0.08)'
          : 'transparent';
        const color = l.type === 'add' ? '#4ec9a2'
          : l.type === 'del' ? '#f47c7c'
          : l.type === 'hunk' ? '#7caff4'
          : l.type === 'meta' ? '#666'
          : '#abb2bf';
        const prefix = l.type === 'add' ? '+' : l.type === 'del' ? '−' : l.type === 'hunk' ? '' : ' ';
        return (
          <div key={i} style={{ background: bg, color, padding: '0 16px',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'flex', gap: '8px' }}>
            <span style={{ opacity: 0.5, userSelect: 'none', width: '10px', flexShrink: 0 }}>{prefix}</span>
            <span>{l.text}</span>
          </div>
        );
      })}
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: '8px',
    width: '900px', maxWidth: '95vw', height: '640px', maxHeight: '90vh',
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
    width: '260px', flexShrink: 0, borderRight: '1px solid #3c3c3c',
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
  right: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  tabs: {
    display: 'flex', borderBottom: '1px solid #3c3c3c', flexShrink: 0,
  },
  tab: (active) => ({
    padding: '8px 18px', fontSize: '12px', cursor: 'pointer', border: 'none',
    background: 'none', color: active ? '#cccccc' : '#666',
    borderBottom: active ? '2px solid #007acc' : '2px solid transparent',
    marginBottom: '-1px',
  }),
  pane: {
    flex: 1, overflow: 'auto',
  },
  previewPre: {
    margin: 0, padding: '16px',
    fontFamily: "'Fira Code', 'Consolas', monospace",
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
  const [commits, setCommits]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selected, setSelected]       = useState(null);
  const [source, setSource]           = useState(null);   // raw file content at commit
  const [diff, setDiff]               = useState(null);   // unified diff lines
  const [paneLoading, setPaneLoading] = useState(false);
  const [activeTab, setActiveTab]     = useState('source'); // 'source' | 'diff'

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
    setSource(null);
    setDiff(null);
    setPaneLoading(true);
    try {
      // Fetch source and diff in parallel
      const [srcRes, diffRes] = await Promise.all([
        fetch(`${API}/api/git/show?path=${encodeURIComponent(filePath)}&hash=${commit.hash}`),
        fetch(`${API}/api/git/diff?path=${encodeURIComponent(filePath)}&hash=${commit.hash}`),
      ]);
      const srcText  = srcRes.ok  ? await srcRes.text()  : null;
      const diffText = diffRes.ok ? await diffRes.text() : null;
      setSource(srcText  ?? 'Unable to load version');
      setDiff(diffText != null ? parseDiff(diffText) : []);
    } catch (err) {
      setSource(`Error: ${err.message}`);
      setDiff([]);
    }
    setPaneLoading(false);
  }, [filePath]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
            {error && <div style={{ padding: '16px', fontSize: '12px', color: '#f44747' }}>{error}</div>}
            {!loading && !error && commits.length === 0 && (
              <div style={S.empty}>No commits yet.</div>
            )}
            {commits.map((c, i) => (
              <div
                key={c.hash}
                style={S.commit(selected?.hash === c.hash)}
                onClick={() => selectCommit(c)}
                onMouseEnter={(e) => { if (selected?.hash !== c.hash) e.currentTarget.style.background = '#252526'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = selected?.hash === c.hash ? '#2d2d2d' : 'transparent'; }}
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

          {/* Right pane */}
          <div style={S.right}>
            {!selected && (
              <div style={{ ...S.empty, flex: 1 }}>← Select a commit to preview</div>
            )}
            {selected && (
              <>
                <div style={S.tabs}>
                  <button style={S.tab(activeTab === 'source')} onClick={() => setActiveTab('source')}>Source</button>
                  <button style={S.tab(activeTab === 'diff')} onClick={() => setActiveTab('diff')}>Diff</button>
                </div>
                <div style={S.pane}>
                  {paneLoading && <div style={{ ...S.empty, paddingTop: '32px' }}>Loading…</div>}
                  {!paneLoading && activeTab === 'source' && source != null && (
                    <pre style={S.previewPre}>{source}</pre>
                  )}
                  {!paneLoading && activeTab === 'diff' && diff != null && (
                    <DiffView lines={diff} />
                  )}
                </div>
              </>
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
            <button style={S.btn(true)} onClick={() => { if (source) { onRestore(source); onClose(); } }}
              disabled={paneLoading} title="Restore file to this version">
              Restore this version
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
