import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  NodeResizer,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const API = 'http://localhost:3001'

// ── Styles ────────────────────────────────────────────────────────────────────

const HANDLE_STYLE = {
  width: 9, height: 9,
  background: '#007acc',
  border: '2px solid #1e1e1e',
  borderRadius: '50%',
  opacity: 0,
  transition: 'opacity 0.15s',
}

const CARD_COLORS = {
  default: { bg: '#1e2030', border: '#3a3a4a', borderSel: '#007acc' },
  yellow:  { bg: '#2a2200', border: '#4a3a00', borderSel: '#e5c07b' },
  green:   { bg: '#0d2010', border: '#1a4020', borderSel: '#98c379' },
  red:     { bg: '#2a0d0d', border: '#4a1a1a', borderSel: '#e06c75' },
  purple:  { bg: '#1a0d2a', border: '#3a1a4a', borderSel: '#c678dd' },
  blue:    { bg: '#0d1a2d', border: '#1a3050', borderSel: '#61afef' },
}

// ── Text card node ────────────────────────────────────────────────────────────

function TextNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const col = CARD_COLORS[data.color] || CARD_COLORS.default

  return (
    <div
      style={{
        background: col.bg,
        border: `1px solid ${selected ? col.borderSel : col.border}`,
        borderRadius: 8,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        boxShadow: selected ? `0 0 0 2px ${col.borderSel}44` : '0 2px 8px rgba(0,0,0,0.5)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.querySelectorAll('.react-flow__handle').forEach(h => h.style.opacity = '1')
      }}
      onMouseLeave={e => {
        e.currentTarget.querySelectorAll('.react-flow__handle').forEach(h => h.style.opacity = '0')
      }}
    >
      <NodeResizer
        color={col.borderSel}
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        lineStyle={{ borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8 }}
      />
      <Handle type="target"  position={Position.Top}    style={HANDLE_STYLE} />
      <Handle type="target"  position={Position.Left}   style={HANDLE_STYLE} />
      <Handle type="source"  position={Position.Right}  style={HANDLE_STYLE} />
      <Handle type="source"  position={Position.Bottom} style={HANDLE_STYLE} />

      {/* Color picker — only when selected */}
      {selected && (
        <div style={{
          position: 'absolute', top: -28, left: 0,
          display: 'flex', gap: 4, zIndex: 10,
        }}>
          {Object.keys(CARD_COLORS).map(c => (
            <div
              key={c}
              title={c}
              onClick={() => updateNodeData(id, { color: c })}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: CARD_COLORS[c].bg,
                border: `2px solid ${CARD_COLORS[c].borderSel}`,
                cursor: 'pointer',
                boxShadow: data.color === c ? `0 0 0 2px #fff4` : 'none',
              }}
            />
          ))}
        </div>
      )}

      <textarea
        value={data.text || ''}
        onChange={e => updateNodeData(id, { text: e.target.value })}
        placeholder="Type here…"
        className="nodrag"
        style={{
          width: '100%', height: '100%',
          background: 'transparent', border: 'none', outline: 'none',
          color: '#cccccc', fontSize: 14,
          fontFamily: "'Inter', -apple-system, sans-serif",
          resize: 'none', padding: 12, boxSizing: 'border-box', lineHeight: 1.6,
        }}
      />
    </div>
  )
}

// ── Note reference card ───────────────────────────────────────────────────────

function NoteNode({ id, data, selected }) {
  const name = data.path ? data.path.split('/').pop().replace(/\.md$/, '') : 'Unknown'

  return (
    <div
      style={{
        background: '#1a2030',
        border: `1px solid ${selected ? '#007acc' : '#2a3a4a'}`,
        borderRadius: 8,
        width: '100%',
        height: '100%',
        padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: selected ? '0 0 0 2px rgba(0,122,204,0.3)' : '0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.querySelectorAll('.react-flow__handle').forEach(h => h.style.opacity = '1')
      }}
      onMouseLeave={e => {
        e.currentTarget.querySelectorAll('.react-flow__handle').forEach(h => h.style.opacity = '0')
      }}
    >
      <NodeResizer color="#007acc" isVisible={selected} minWidth={140} minHeight={60} />
      <Handle type="target"  position={Position.Top}    style={HANDLE_STYLE} />
      <Handle type="target"  position={Position.Left}   style={HANDLE_STYLE} />
      <Handle type="source"  position={Position.Right}  style={HANDLE_STYLE} />
      <Handle type="source"  position={Position.Bottom} style={HANDLE_STYLE} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007acc" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#4fc1ff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </span>
      </div>

      <button
        className="nodrag"
        onClick={e => { e.stopPropagation(); data.onOpen?.(data.path) }}
        title="Open this note in the editor"
        style={{
          marginTop: 'auto', padding: '4px 8px', width: '100%',
          background: 'rgba(0,122,204,0.12)', border: '1px solid rgba(0,122,204,0.25)',
          borderRadius: 4, color: '#4fc1ff', fontSize: 11, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,122,204,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,122,204,0.12)'}
      >
        Open note →
      </button>
    </div>
  )
}

const NODE_TYPES = { text: TextNode, note: NoteNode }

// ── Serialize / deserialize ───────────────────────────────────────────────────

function deserializeNodes(data, onOpen) {
  return (data.nodes || []).map(n => ({
    id: n.id,
    type: n.type || 'text',
    position: { x: n.x || 0, y: n.y || 0 },
    style: { width: n.width || 250, height: n.height || 150 },
    data: {
      text:  n.text  || '',
      path:  n.path  || null,
      color: n.color || 'default',
      width: n.width || 250,
      height: n.height || 150,
      onOpen,
    },
  }))
}

function deserializeEdges(data) {
  return (data.edges || []).map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || '',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#4a4a5a', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4a4a5a', width: 14, height: 14 },
  }))
}

function serializeCanvas(nodes, edges) {
  return JSON.stringify({
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      width:  Math.round(n.measured?.width  || n.style?.width  || n.data.width  || 250),
      height: Math.round(n.measured?.height || n.style?.height || n.data.height || 150),
      ...(n.data.text  !== undefined ? { text:  n.data.text  } : {}),
      ...(n.data.path               ? { path:  n.data.path  } : {}),
      ...(n.data.color && n.data.color !== 'default' ? { color: n.data.color } : {}),
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.label ? { label: e.label } : {}),
    })),
  }, null, 2)
}

// ── Note picker modal ─────────────────────────────────────────────────────────

function NotePickerModal({ onSelect, onClose }) {
  const [notes, setNotes] = useState([])
  const [query, setQuery]  = useState('')

  useEffect(() => {
    fetch(`${API}/api/tree`)
      .then(r => r.json())
      .then(tree => {
        const flat = []
        const walk = (node) => {
          if (node.type === 'file' && node.name.endsWith('.md')) flat.push(node)
          node.children?.forEach(walk)
        }
        walk(tree)
        setNotes(flat)
      })
      .catch(() => {})
  }, [])

  const filtered = useMemo(() =>
    notes.filter(n => n.name.toLowerCase().includes(query.toLowerCase())),
    [notes, query]
  )

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
    }}
    onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#1e1e1e', border: '1px solid #444', borderRadius: 10,
        padding: 20, width: 380, maxHeight: 420,
        display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, color: '#ccc', fontWeight: 600 }}>Add Note Card</h3>
          <button onClick={onClose} title="Close" style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search notes…"
          onKeyDown={e => e.key === 'Escape' && onClose()}
          style={{
            background: '#2d2d2d', border: '1px solid #555', borderRadius: 6,
            color: '#ccc', padding: '8px 12px', fontSize: 13, outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = '#007acc'}
          onBlur={e => e.target.style.borderColor = '#555'}
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(n => (
            <div
              key={n.path}
              onClick={() => onSelect(n.path)}
              style={{ padding: '8px 12px', borderRadius: 5, cursor: 'pointer', color: '#aaa', fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {n.name.replace(/\.md$/, '')}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 12, color: '#555', fontSize: 12, textAlign: 'center' }}>No notes found</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Canvas inner (must be inside ReactFlowProvider) ───────────────────────────

function CanvasInner({ content, onChange, filePath, onOpenNote }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showNotePicker, setShowNotePicker] = useState(false)
  const saveTimer  = useRef(null)
  const readyToSave = useRef(false)
  const { fitView, screenToFlowPosition } = useReactFlow()

  // Parse JSON content whenever the file changes
  useEffect(() => {
    readyToSave.current = false
    try {
      const data = content ? JSON.parse(content) : { nodes: [], edges: [] }
      setNodes(deserializeNodes(data, onOpenNote))
      setEdges(deserializeEdges(data))
    } catch {
      setNodes([])
      setEdges([])
    }
    const t = setTimeout(() => {
      fitView({ padding: 0.15, duration: 400 })
      readyToSave.current = true
    }, 150)
    return () => clearTimeout(t)
  }, [filePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save whenever nodes or edges change
  useEffect(() => {
    if (!readyToSave.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onChange(serializeCanvas(nodes, edges))
    }, 700)
    return () => clearTimeout(saveTimer.current)
  }, [nodes, edges]) // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback((params) =>
    setEdges(eds => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#4a4a5a', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#4a4a5a', width: 14, height: 14 },
    }, eds)), [setEdges])

  // Double-click on pane → add text card
  const onPaneDoubleClick = useCallback((e) => {
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const id  = `node-${Date.now()}`
    setNodes(nds => [...nds, {
      id,
      type: 'text',
      position: { x: pos.x - 125, y: pos.y - 75 },
      style: { width: 250, height: 150 },
      data: { text: '', color: 'default', width: 250, height: 150, onOpen: onOpenNote },
    }])
  }, [screenToFlowPosition, setNodes, onOpenNote])

  const addTextCard = useCallback(() => {
    const id = `node-${Date.now()}`
    setNodes(nds => [...nds, {
      id,
      type: 'text',
      position: { x: 80 + Math.random() * 200, y: 80 + Math.random() * 200 },
      style: { width: 250, height: 150 },
      data: { text: '', color: 'default', width: 250, height: 150, onOpen: onOpenNote },
    }])
  }, [setNodes, onOpenNote])

  const addNoteCard = useCallback((path) => {
    const id = `node-${Date.now()}`
    setNodes(nds => [...nds, {
      id,
      type: 'note',
      position: { x: 80 + Math.random() * 200, y: 80 + Math.random() * 200 },
      style: { width: 200, height: 100 },
      data: { path, width: 200, height: 100, onOpen: onOpenNote },
    }])
    setShowNotePicker(false)
  }, [setNodes, onOpenNote])

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 11px', borderRadius: 6,
    background: '#252530', border: '1px solid #3a3a4a',
    color: '#bbb', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.15s, color 0.15s',
  }

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#16161e' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        onPaneClick={() => {}}
        onPaneDoubleClick={onPaneDoubleClick}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        style={{ background: '#16161e', position: 'absolute', inset: 0 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#2a2a3a" gap={24} size={1.2} />
        <Controls
          style={{
            background: '#252530', border: '1px solid #3a3a4a', borderRadius: 8,
            overflow: 'hidden',
          }}
        />

        {/* Top toolbar */}
        <Panel position="top-left" style={{ display: 'flex', gap: 6, margin: 10 }}>
          <button style={btnStyle} onClick={addTextCard} title="Add text card (or double-click canvas)"
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#007acc'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a4a'; e.currentTarget.style.color = '#bbb' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Text card
          </button>

          <button style={btnStyle} onClick={() => setShowNotePicker(true)} title="Add note reference card"
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#007acc'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a4a'; e.currentTarget.style.color = '#bbb' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Note card
          </button>

          <button style={btnStyle} onClick={() => fitView({ padding: 0.15, duration: 400 })} title="Fit all cards in view"
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#007acc'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a4a'; e.currentTarget.style.color = '#bbb' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            Fit view
          </button>
        </Panel>

        <Panel position="bottom-center" style={{
          fontSize: 11, color: '#3a3a5a', margin: '0 0 6px',
          fontFamily: 'Inter, sans-serif', userSelect: 'none',
        }}>
          Double-click to add card · Drag edge handle to connect · Delete/Backspace to remove
        </Panel>
      </ReactFlow>

      {showNotePicker && (
        <NotePickerModal onSelect={addNoteCard} onClose={() => setShowNotePicker(false)} />
      )}
    </div>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────

export default function Canvas({ content, onChange, filePath, onOpenNote }) {
  return (
    <ReactFlowProvider>
      <CanvasInner
        content={content}
        onChange={onChange}
        filePath={filePath}
        onOpenNote={onOpenNote}
      />
    </ReactFlowProvider>
  )
}
