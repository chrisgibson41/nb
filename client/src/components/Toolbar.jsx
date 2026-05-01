import React from 'react';

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    height: '40px',
    background: '#323233',
    borderBottom: '1px solid #3c3c3c',
    padding: '0 12px',
    gap: '8px',
    flexShrink: 0,
    userSelect: 'none',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 600,
    fontSize: '13px',
    color: '#cccccc',
    letterSpacing: '0.02em',
    marginRight: '8px',
  },
  logoIcon: {
    width: '18px',
    height: '18px',
    background: '#007acc',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: '1px',
    height: '20px',
    background: '#3c3c3c',
    margin: '0 4px',
  },
  fileName: {
    fontSize: '12px',
    color: '#999',
    maxWidth: '260px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  spacer: { flex: 1 },
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
    width: '140px',
  },
};

export default function Toolbar({ isUnsaved, onSave, onNewTemplate, onSettings, searchQuery, setSearchQuery, currentFile }) {
  const fileName = currentFile ? currentFile.split('/').pop() : null;

  return (
    <div style={styles.toolbar}>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" fill="white" />
          </svg>
        </div>
        Notes
      </div>

      {fileName && (
        <>
          <div style={styles.divider} />
          <span style={styles.fileName}>{fileName}</span>
        </>
      )}

      <div style={styles.spacer} />

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
            style={{ color: '#888', padding: 0, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >×</button>
        )}
      </div>

      <button
        style={styles.btn}
        onClick={onNewTemplate}
        title="New note from template (Ctrl+T)"
        onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2d2e'; e.currentTarget.style.borderColor = '#555'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#3c3c3c'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New
      </button>

      <div style={styles.saveIndicator(isUnsaved)}>
        <div style={styles.dot(isUnsaved)} />
        {isUnsaved ? 'Unsaved' : 'Saved'}
      </div>

      <button
        style={{ ...styles.btn, padding: '4px 8px', borderColor: 'transparent' }}
        onClick={onSettings}
        title="Settings"
        onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2d2e'; e.currentTarget.style.borderColor = '#555'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
