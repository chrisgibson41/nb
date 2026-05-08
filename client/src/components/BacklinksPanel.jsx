import React, { useState, useEffect } from 'react';

const API = '';

const S = {
  panel: {
    width: '100%',
    flex: 1,
    borderLeft: '1px solid #2e2e2e',
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1e1e',
    fontSize: '12px',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
  },
  header: {
    padding: '6px 8px 6px 10px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#555',
    borderBottom: '1px solid #2e2e2e',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  count: {
    background: '#2d2d2d',
    color: '#666',
    borderRadius: '8px',
    padding: '1px 6px',
    fontSize: '10px',
    fontWeight: 600,
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 0',
  },
  item: {
    padding: '5px 10px',
    cursor: 'pointer',
    borderRadius: '4px',
    margin: '1px 4px',
  },
  itemName: {
    color: '#9cdcfe',
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemExcerpt: {
    color: '#555',
    fontSize: '10px',
    marginTop: '2px',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
  },
  empty: {
    color: '#444',
    fontSize: '11px',
    padding: '12px 10px',
    lineHeight: 1.5,
  },
};

export default function BacklinksPanel({ currentFile, onFileSelect, collapseButton, collapsed }) {
  const [links, setLinks]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentFile) { setLinks([]); return; }
    const name = currentFile.split('/').pop().replace(/\.md$/, '');
    setLoading(true);
    fetch(`${API}/api/backlinks?name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => { setLinks(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setLinks([]); setLoading(false); });
  }, [currentFile]);

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        Backlinks
        {links.length > 0 && <span style={S.count}>{links.length}</span>}
        <div style={{ flex: 1 }} />
        {collapseButton}
      </div>

      {!collapsed && (
        <div style={S.scroll}>
          {!currentFile && <div style={S.empty}>Open a note to see backlinks.</div>}
          {currentFile && loading && <div style={S.empty}>Scanning…</div>}
          {currentFile && !loading && links.length === 0 && (
            <div style={S.empty}>No notes link to this one yet.</div>
          )}
          {!loading && links.map(link => (
            <div
              key={link.path}
              style={S.item}
              onClick={() => onFileSelect(link.path)}
              onMouseEnter={e => { e.currentTarget.style.background = '#2a2d2e'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={S.itemName} title={link.name}>{link.name}</div>
              {link.excerpt && <div style={S.itemExcerpt}>{link.excerpt}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
