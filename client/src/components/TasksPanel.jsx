import React, { useState, useEffect, useCallback } from 'react';

const API = '';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    zIndex: 900,
  },
  panel: {
    width: '380px', height: '100%',
    background: '#1e1e1e', borderLeft: '1px solid #3c3c3c',
    display: 'flex', flexDirection: 'column',
    boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 16px', borderBottom: '1px solid #3c3c3c', flexShrink: 0,
  },
  title: { fontSize: '14px', fontWeight: 600, color: '#cccccc', flex: 1 },
  closeBtn: {
    background: 'none', border: 'none', color: '#888', cursor: 'pointer',
    fontSize: '18px', lineHeight: 1, padding: '2px 6px', borderRadius: '4px',
  },
  filterBar: {
    display: 'flex', gap: '6px', padding: '10px 12px',
    borderBottom: '1px solid #2e2e2e', flexShrink: 0,
  },
  filterBtn: (active) => ({
    padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 500,
    cursor: 'pointer', border: 'none',
    background: active ? '#007acc' : '#2d2d2d',
    color: active ? '#fff' : '#888',
  }),
  scroll: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  group: { marginBottom: '8px' },
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 14px 4px',
    fontSize: '11px', fontWeight: 700, color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    cursor: 'pointer',
    userSelect: 'none',
  },
  groupPath: {
    fontSize: '10px', color: '#444', fontWeight: 400,
    textTransform: 'none', letterSpacing: 0, marginLeft: 2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  task: (done) => ({
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    padding: '5px 14px 5px 24px',
    cursor: 'pointer',
    opacity: done ? 0.45 : 1,
  }),
  checkbox: (done) => ({
    width: '13px', height: '13px', borderRadius: '3px', flexShrink: 0, marginTop: '2px',
    border: done ? 'none' : '1.5px solid #555',
    background: done ? '#4ec9a2' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  taskText: (done) => ({
    fontSize: '12px', color: '#cccccc', lineHeight: 1.5,
    textDecoration: done ? 'line-through' : 'none',
    wordBreak: 'break-word',
  }),
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1, color: '#444', fontSize: '13px', gap: '8px',
    padding: '40px',
  },
  stats: {
    padding: '10px 14px', borderTop: '1px solid #2e2e2e',
    fontSize: '11px', color: '#555', flexShrink: 0,
    display: 'flex', gap: '12px',
  },
};

const TICK = (
  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
    <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function groupByFile(tasks) {
  const map = new Map();
  for (const t of tasks) {
    if (!map.has(t.path)) map.set(t.path, { name: t.name, path: t.path, tasks: [] });
    map.get(t.path).tasks.push(t);
  }
  return [...map.values()];
}

export default function TasksPanel({ onClose, onFileSelect }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('open');   // 'all' | 'open' | 'done'
  const [collapsed, setCollapsed] = useState(new Set());

  const reload = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/tasks`)
      .then(r => r.json())
      .then(data => { setTasks(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setTasks([]); setLoading(false); });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const visible = tasks.filter(t =>
    filter === 'all' ? true : filter === 'open' ? !t.done : t.done
  );
  const groups = groupByFile(visible);

  const open = tasks.filter(t => !t.done).length;
  const done = tasks.filter(t => t.done).length;

  const toggleGroup = (path) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.panel}>

        <div style={S.header}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <polyline points="9 11 12 14 22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <span style={S.title}>All Tasks</span>
          <button style={{ ...S.closeBtn, fontSize: '14px', padding: '4px 8px' }} onClick={reload} title="Refresh">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <button style={S.closeBtn} onClick={onClose} title="Close">×</button>
        </div>

        <div style={S.filterBar}>
          {['open', 'done', 'all'].map(f => (
            <button key={f} style={S.filterBtn(filter === f)} onClick={() => setFilter(f)}>
              {f === 'open' ? `Open (${open})` : f === 'done' ? `Done (${done})` : `All (${tasks.length})`}
            </button>
          ))}
        </div>

        <div style={S.scroll}>
          {loading && <div style={{ ...S.empty, paddingTop: '60px' }}>Loading tasks…</div>}

          {!loading && visible.length === 0 && (
            <div style={S.empty}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              {filter === 'open' ? 'No open tasks — nice work!' : filter === 'done' ? 'No completed tasks yet.' : 'No tasks found across your notes.'}
            </div>
          )}

          {!loading && groups.map(group => {
            const isCollapsed = collapsed.has(group.path);
            return (
              <div key={group.path} style={S.group}>
                <div
                  style={S.groupHeader}
                  onClick={() => toggleGroup(group.path)}
                  onMouseEnter={e => { e.currentTarget.style.color = '#999'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#666'; }}
                >
                  <svg
                    width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
                  >
                    <polyline points="2,3 5,7 8,3"/>
                  </svg>
                  {group.name}
                  <span style={S.groupPath}>({group.tasks.length})</span>
                </div>

                {!isCollapsed && group.tasks.map((task, i) => (
                  <div
                    key={i}
                    style={S.task(task.done)}
                    onClick={() => { onFileSelect(task.path); }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#252526'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    title={`Line ${task.lineNumber} — click to open note`}
                  >
                    <div style={S.checkbox(task.done)}>{task.done && TICK}</div>
                    <span style={S.taskText(task.done)}>{task.text}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div style={S.stats}>
          <span>{open} open</span>
          <span>·</span>
          <span>{done} done</span>
          <span>·</span>
          <span>{tasks.length} total</span>
        </div>

      </div>
    </div>
  );
}
