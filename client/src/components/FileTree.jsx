import React, { useState, useEffect, useRef, useCallback, useReducer, createContext, useContext } from 'react';
import ReactDOM from 'react-dom';

const API = '';
const NOTES_DIR_FALLBACK = 'notes';

// ── Folder color helpers ──────────────────────────────────────────────────────

function loadFolderColors() {
  try { return JSON.parse(localStorage.getItem('nb:folder-colors') || '{}'); } catch { return {}; }
}
function saveFolderColors(map) {
  try { localStorage.setItem('nb:folder-colors', JSON.stringify(map)); } catch {}
}

const FOLDER_COLORS = [
  '#e06c75', // red
  '#e5c07b', // yellow
  '#98c379', // green
  '#56b6c2', // cyan
  '#61afef', // blue
  '#c678dd', // purple
  '#d19a66', // orange
  '#abb2bf', // grey
];

// ── PDF export helper ─────────────────────────────────────────────────────────

async function exportToPdf(filePath) {
  try {
    const res = await fetch(`/api/export/html?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error('Export failed');
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.print();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      });
    }
  } catch (err) {
    console.error('PDF export failed:', err);
  }
}

// ── Folder color context ──────────────────────────────────────────────────────

const FolderColorContext = createContext(null);

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 10px 6px',
    borderBottom: '1px solid #3c3c3c',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flexShrink: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#bbbbbb',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '4px',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'transparent',
    border: 'none',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: '#3a3a3a',
    border: '1px solid #484848',
    borderRadius: '4px',
    padding: '3px 7px',
    gap: '5px',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#cccccc',
    fontSize: '12px',
    flex: 1,
    minWidth: 0,
  },
  treeScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  item: (depth, active, isHovered, isDragOver) => ({
    display: 'flex',
    alignItems: 'center',
    padding: `3px 8px 3px ${12 + depth * 14}px`,
    cursor: 'pointer',
    color: active ? '#ffffff' : '#cccccc',
    background: isDragOver ? '#1c3a5c' : active ? '#37373d' : isHovered ? '#2a2d2e' : 'transparent',
    outline: isDragOver ? '1px dashed #007acc' : 'none',
    outlineOffset: '-1px',
    userSelect: 'none',
    position: 'relative',
    minHeight: '24px',
    borderRadius: '3px',
    margin: '0 4px',
    transition: 'background 0.1s',
  }),
  itemName: {
    flex: 1,
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  extDimmed: {
    color: '#666',
    fontSize: '12px',
  },
  chevron: (open) => ({
    display: 'flex',
    alignItems: 'center',
    marginRight: '4px',
    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    transition: 'transform 0.15s',
    color: '#888',
    flexShrink: 0,
  }),
  actions: {
    display: 'flex',
    gap: '2px',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '3px',
    color: '#888',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    transition: 'all 0.1s',
    padding: 0,
    fontSize: '13px',
  },
  renameInput: {
    background: '#3c3c3c',
    border: '1px solid #007acc',
    borderRadius: '3px',
    color: '#cccccc',
    fontSize: '13px',
    padding: '1px 4px',
    outline: 'none',
    width: '100%',
  },
  contextMenu: {
    position: 'fixed',
    background: '#252526',
    border: '1px solid #454545',
    borderRadius: '6px',
    padding: '4px',
    zIndex: 9999,
    minWidth: '160px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  contextItem: {
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    borderRadius: '4px',
    color: '#cccccc',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  emptyMsg: {
    padding: '16px 12px',
    fontSize: '12px',
    color: '#666',
    textAlign: 'center',
  },
  templateItem: (active, hovered) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '3px 8px 3px 18px',
    cursor: 'pointer',
    color: active ? '#ffffff' : '#b0b0b0',
    background: active ? '#37373d' : hovered ? '#2a2d2e' : 'transparent',
    userSelect: 'none',
    minHeight: '24px',
    borderRadius: '3px',
    margin: '0 4px',
    fontSize: '13px',
    gap: '5px',
  }),
};

function FolderIcon({ open }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#dcb67a" style={{ flexShrink: 0, marginRight: '5px' }}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#dcb67a" style={{ flexShrink: 0, marginRight: '5px' }}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#89d4f5" strokeWidth="1.5" style={{ flexShrink: 0, marginRight: '5px' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// ── Prompt context (replaces window.prompt which is disabled in Electron) ────

const PromptContext = createContext(null);

function InputModal({ message, defaultValue = '', onSubmit, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => { const v = value.trim(); if (v) onSubmit(v); else onCancel(); };

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: '#1e1e1e', border: '1px solid #444', borderRadius: 10,
        padding: 24, width: 340, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        fontFamily: 'Inter, -apple-system, sans-serif',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#ccc' }}>{message}</p>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
          style={{
            background: '#2d2d2d', border: '1px solid #555', borderRadius: 6,
            color: '#ccc', padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = '#007acc'}
          onBlur={e => e.target.style.borderColor = '#555'}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{
            padding: '6px 14px', borderRadius: 6, background: 'transparent',
            border: '1px solid #444', color: '#999', fontSize: 12, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={submit} style={{
            padding: '6px 14px', borderRadius: 6, background: '#007acc',
            border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}>OK</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tree node ─────────────────────────────────────────────────────────────────

function TreeNode({ node, depth, currentFile, onFileSelect, onRefresh, filterQuery }) {
  const [open, setOpen] = useState(depth < 1);
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [contextMenu, setContextMenu] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const renameRef = useRef(null);
  const dragCounterRef = useRef(0);
  const isDir = node.type === 'dir';
  const isActive = currentFile === node.path;

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
    // Slight delay so the drag ghost renders before we visually alter the node
    setTimeout(() => {}, 0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (isDir) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const draggedPath = e.dataTransfer.getData('text/plain');
    if (!draggedPath) return;

    // Determine drop target directory
    const targetDir = isDir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
    const fileName = draggedPath.split('/').pop();
    const newPath = `${targetDir}/${fileName}`;

    // Guards: same location, dropping folder into itself or descendant
    const oldDir = draggedPath.substring(0, draggedPath.lastIndexOf('/'));
    if (oldDir === targetDir) return;                            // already there
    if (newPath === draggedPath) return;                         // same path
    if (targetDir === draggedPath || targetDir.startsWith(draggedPath + '/')) return; // into self

    try {
      await fetch(`${API}/api/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: draggedPath, newPath }),
      });
      onRefresh();
      if (isDir) setOpen(true);
    } catch (err) {
      console.error('Drop move failed:', err);
    }
  };

  // ── All hooks must come before any early return (Rules of Hooks) ────────────
  const showPrompt = useContext(PromptContext);
  const { folderColors, setFolderColor } = useContext(FolderColorContext);

  // Filter logic — defined before any conditional returns so hook order is stable
  const matchesFilter = useCallback((n, q) => {
    if (!q) return true;
    const lower = q.toLowerCase();
    if (n.name.toLowerCase().includes(lower)) return true;
    if (n.children) return n.children.some((c) => matchesFilter(c, q));
    return false;
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (filterQuery) setOpen(true);
  }, [filterQuery]);

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (contextMenu) {
      window.addEventListener('click', closeContextMenu);
      return () => window.removeEventListener('click', closeContextMenu);
    }
  }, [contextMenu, closeContextMenu]);

  if (!matchesFilter(node, filterQuery)) return null;

  const handleRename = async () => {
    const newName = renameValue.trim();
    if (!newName || newName === node.name) {
      setRenaming(false);
      return;
    }
    const dir = node.path.substring(0, node.path.lastIndexOf('/'));
    const newPath = `${dir}/${newName}`;
    try {
      await fetch(`${API}/api/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: node.path, newPath }),
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${node.name}"?`)) return;
    try {
      await fetch(`${API}/api/file?path=${encodeURIComponent(node.path)}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewFile = async () => {
    const basePath = isDir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
    const name = await showPrompt('New file name:', 'untitled.md');
    if (!name) return;
    const filePath = `${basePath}/${name.endsWith('.md') ? name : name + '.md'}`;
    try {
      await fetch(`${API}/api/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: `# ${name.replace(/\.md$/, '')}\n\n` }),
      });
      onRefresh();
      if (isDir) setOpen(true);
      onFileSelect(filePath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewFolder = async () => {
    const basePath = isDir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
    const name = await showPrompt('New folder name:');
    if (!name) return;
    const dirPath = `${basePath}/${name}`;
    try {
      await fetch(`${API}/api/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dirPath }),
      });
      onRefresh();
      if (isDir) setOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const ext = !isDir && node.name.includes('.') ? '.' + node.name.split('.').pop() : '';
  const nameWithoutExt = !isDir && ext ? node.name.slice(0, -ext.length) : node.name;

  const folderColor = isDir ? folderColors[node.path] : null;
  const folderColorStyle = folderColor
    ? { borderLeft: `3px solid ${folderColor}`, paddingLeft: `${9 + depth * 14}px`, background: isDragOver ? '#1c3a5c' : isActive ? '#37373d' : hovered ? '#2a2d2e' : `${folderColor}0f` }
    : {};

  return (
    <div>
      <div
        style={{ ...styles.item(depth, isActive, hovered, isDragOver), ...folderColorStyle }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (renaming) return;
          if (isDir) {
            setOpen((o) => !o);
          } else {
            onFileSelect(node.path);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {isDir && (
          <span style={styles.chevron(open)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        )}
        {isDir ? <FolderIcon open={open} /> : <FileIcon />}

        {renaming ? (
          <input
            ref={renameRef}
            style={styles.renameInput}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setRenaming(false); setRenameValue(node.name); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span style={styles.itemName}>
            {nameWithoutExt}
            {ext && <span style={styles.extDimmed}>{ext}</span>}
          </span>
        )}

        {hovered && !renaming && (
          <div style={styles.actions} onClick={(e) => e.stopPropagation()}>
            {isDir && (
              <>
                <button style={styles.actionBtn} title="New file" onClick={handleNewFile}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="12" x2="12" y2="18" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </button>
                <button style={styles.actionBtn} title="New folder" onClick={handleNewFolder}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                </button>
              </>
            )}
            <button style={styles.actionBtn} title="Rename" onClick={() => { setRenaming(true); setRenameValue(node.name); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button style={{ ...styles.actionBtn, color: '#f44747' }} title="Delete" onClick={handleDelete}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          style={{ ...styles.contextMenu, left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {isDir && (
            <>
              <div
                style={styles.contextItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { handleNewFile(); closeContextMenu(); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/></svg>
                New File
              </div>
              <div
                style={styles.contextItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { handleNewFolder(); closeContextMenu(); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                New Folder
              </div>
              <div style={{ height: '1px', background: '#3c3c3c', margin: '3px 8px' }} />
            </>
          )}
          <div
            style={styles.contextItem}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { setRenaming(true); setRenameValue(node.name); closeContextMenu(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Rename
          </div>
          <div
            style={{ ...styles.contextItem, color: '#f44747' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { handleDelete(); closeContextMenu(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Delete
          </div>
          {!isDir && node.name.endsWith('.md') && (
            <>
              <div style={{ height: '1px', background: '#3c3c3c', margin: '3px 8px' }} />
              <div
                style={styles.contextItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#37373d')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { exportToPdf(node.path); closeContextMenu(); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                Export to PDF
              </div>
            </>
          )}
          {isDir && (
            <div style={{ padding: '6px 8px 4px', borderTop: '1px solid #3c3c3c' }}>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Folder colour
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {FOLDER_COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => { setFolderColor(node.path, c); closeContextMenu(); }}
                    style={{
                      width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer',
                      outline: folderColor === c ? '2px solid #fff' : 'none', outlineOffset: '1px',
                    }}
                  />
                ))}
                <div
                  onClick={() => { setFolderColor(node.path, null); closeContextMenu(); }}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#333', border: '1px solid #555',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#888',
                  }}
                >
                  ✕
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isDir && open && node.children && (
        <div>
          {node.children
            .filter((child) => !filterQuery || matchesFilter(child, filterQuery))
            .map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                currentFile={currentFile}
                onFileSelect={onFileSelect}
                onRefresh={onRefresh}
                filterQuery={filterQuery}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Templates section ─────────────────────────────────────────────────────────

function TemplateFileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c586c0" strokeWidth="1.5" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  );
}

function TemplatesSection({ onFileSelect, currentFile, refreshTick }) {
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/templates`)
      .then(r => r.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [refreshTick]);

  if (templates.length === 0) return null;

  return (
    <div style={{ borderTop: '1px solid #2e2e2e', flexShrink: 0, paddingBottom: '6px' }}>
      {/* Section header */}
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 4px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', marginRight: '4px',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', color: '#888',
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Templates
        </span>
      </div>
      {open && templates.map(t => {
        const active = currentFile === t.path;
        return (
          <TemplateRow key={t.name} template={t} active={active} onFileSelect={onFileSelect} />
        );
      })}
    </div>
  );
}

function TemplateRow({ template, active, onFileSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={styles.templateItem(active, hovered)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onFileSelect(template.path)}
      title={template.path}
    >
      <TemplateFileIcon />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {template.filename}
      </span>
    </div>
  );
}

// ── Main FileTree component ───────────────────────────────────────────────────

export default function FileTree({ onFileSelect, currentFile, refreshKey, onRefresh, onNewTemplate, searchQuery, collapseButton }) {
  const [tree, setTree] = useState(null);
  const [localFilter, setLocalFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [promptState, setPromptState] = useState(null);
  const [folderColors, setFolderColorsState] = useState(loadFolderColors);

  const setFolderColor = useCallback((folderPath, color) => {
    setFolderColorsState(prev => {
      const next = { ...prev };
      if (color == null) {
        delete next[folderPath];
      } else {
        next[folderPath] = color;
      }
      saveFolderColors(next);
      return next;
    });
  }, []);

  const showPrompt = useCallback((message, defaultValue = '') => {
    return new Promise(resolve => setPromptState({ message, defaultValue, resolve }));
  }, []);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/tree`);
      const data = await res.json();
      setTree(data);
    } catch (err) {
      console.error('Failed to load tree:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree, refreshKey]);

  const effectiveFilter = searchQuery || localFilter;

  const rootPath = tree?.path || NOTES_DIR_FALLBACK;

  const handleNewFile = async () => {
    const name = await showPrompt('New file name:', 'untitled.md');
    if (!name) return;
    const fname = name.endsWith('.md') ? name : name + '.md';
    const filePath = `${rootPath}/${fname}`;
    try {
      await fetch(`${API}/api/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: `# ${name.replace(/\.md$/, '')}\n\n` }),
      });
      onRefresh();
      onFileSelect(filePath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewFolder = async () => {
    const name = await showPrompt('New folder name:');
    if (!name) return;
    const dirPath = `${rootPath}/${name}`;
    try {
      await fetch(`${API}/api/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dirPath }),
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromptSubmit = (value) => {
    if (promptState) { promptState.resolve(value); setPromptState(null); }
  };
  const handlePromptCancel = () => {
    if (promptState) { promptState.resolve(null); setPromptState(null); }
  };

  return (
    <FolderColorContext.Provider value={{ folderColors, setFolderColor }}>
    <PromptContext.Provider value={showPrompt}>
    {promptState && (
      <InputModal
        message={promptState.message}
        defaultValue={promptState.defaultValue}
        onSubmit={handlePromptSubmit}
        onCancel={handlePromptCancel}
      />
    )}
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerRow}>
          <span style={styles.sectionTitle}>Explorer</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {collapseButton}
            {/* New file */}
            <button style={styles.iconBtn} title="New note" onClick={handleNewFile}
              onMouseEnter={e => { e.currentTarget.style.background = '#3c3c3c'; e.currentTarget.style.color = '#cccccc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="13" x2="12" y2="19"/>
                <line x1="9" y1="16" x2="15" y2="16"/>
              </svg>
            </button>
            {/* New folder */}
            <button style={styles.iconBtn} title="New folder" onClick={handleNewFolder}
              onMouseEnter={e => { e.currentTarget.style.background = '#3c3c3c'; e.currentTarget.style.color = '#cccccc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </button>
            {/* New from template */}
            <button style={styles.iconBtn} title="New from template (Ctrl+T)" onClick={onNewTemplate}
              onMouseEnter={e => { e.currentTarget.style.background = '#3c3c3c'; e.currentTarget.style.color = '#cccccc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>
            {/* Refresh */}
            <button style={styles.iconBtn} title="Refresh" onClick={onRefresh}
              onMouseEnter={e => { e.currentTarget.style.background = '#3c3c3c'; e.currentTarget.style.color = '#cccccc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>
        {!searchQuery && (
          <div style={styles.searchBox}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              style={styles.searchInput}
              placeholder="Filter files..."
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
            />
            {localFilter && (
              <button onClick={() => setLocalFilter('')} title="Clear filter" style={{ color: '#777', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>
        )}
      </div>

      <div style={styles.treeScroll}>
        {tree ? (
          tree.children && tree.children.length > 0 ? (
            tree.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={0}
                currentFile={currentFile}
                onFileSelect={onFileSelect}
                onRefresh={onRefresh}
                filterQuery={effectiveFilter}
              />
            ))
          ) : (
            <div style={styles.emptyMsg}>No notes yet. Create your first note!</div>
          )
        ) : loading ? (
          <div style={styles.emptyMsg}>Loading...</div>
        ) : (
          <div style={styles.emptyMsg}>Failed to load files</div>
        )}
      </div>

      <TemplatesSection
        onFileSelect={onFileSelect}
        currentFile={currentFile}
        refreshTick={refreshKey}
      />
    </div>
    </PromptContext.Provider>
    </FolderColorContext.Provider>
  );
}
