import React, { useEffect, useRef, useState } from 'react';

// Embedded drawio editor. Communicates with embed.diagrams.net via postMessage:
//   init  → we send 'load' with the existing XML
//   save  → drawio emits this when the user clicks Save; we persist and close
//   exit  → drawio emits this when the user clicks Exit/Cancel; we close
//
// The drawio iframe's built-in Save + Exit buttons act as Save and Cancel,
// matching the requested UX. The frame around the iframe also offers an
// Export button (downloads the current XML so it can be imported into
// Confluence or another drawio host).

// embed=1            : enable embed mode
// proto=json         : JSON message protocol
// ui=atlas&dark=1    : dark Atlas UI to match the editor
// libraries=1        : enable the shape libraries panel
// saveAndExit=1      : show a single "Save & Exit" button (acts as Save)
// noSaveBtn=1        : hide the plain "Save" button so only Save&Exit and
//                      Exit remain — i.e. one save and one cancel control
const EMBED_URL =
  'https://embed.diagrams.net/?embed=1&proto=json&libraries=1&ui=atlas&dark=1&saveAndExit=1&noSaveBtn=1';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', zIndex: 1000,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', background: '#1e1e1e',
    borderBottom: '1px solid #3c3c3c', flexShrink: 0,
    fontFamily: 'system-ui, sans-serif',
  },
  title: { fontSize: 13, fontWeight: 600, color: '#cccccc', flex: 1 },
  btn: {
    background: '#2d2d2d', color: '#ddd', border: '1px solid #3c3c3c',
    borderRadius: 4, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#888', cursor: 'pointer',
    fontSize: 18, lineHeight: 1, padding: '2px 8px',
  },
  iframe: { flex: 1, border: 'none', width: '100%', background: '#1e1e1e' },
  status: { fontSize: 11, color: '#888' },
};

export default function DrawioEditModal({ xml, onSave, onCancel }) {
  const iframeRef = useRef(null);
  // The XML drawio has reported via the most recent autosave event — used by
  // the Export button so it always exports what's currently on the canvas,
  // not the stale prop we mounted with.
  const liveXmlRef = useRef(xml || '');
  const [status, setStatus] = useState('Loading editor…');

  useEffect(() => { liveXmlRef.current = xml || ''; }, [xml]);

  useEffect(() => {
    const onMessage = (event) => {
      // The drawio embed posts JSON-encoded strings as `event.data`.
      if (typeof event.data !== 'string') return;
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;

      switch (msg.event) {
        case 'init':
          setStatus('Ready');
          iframe.contentWindow.postMessage(JSON.stringify({
            action: 'load',
            autosave: 1,
            xml: liveXmlRef.current || '',
          }), '*');
          break;
        case 'autosave':
          if (typeof msg.xml === 'string') liveXmlRef.current = msg.xml;
          break;
        case 'save':
          if (typeof msg.xml === 'string') {
            liveXmlRef.current = msg.xml;
            onSave?.(msg.xml);
          }
          break;
        case 'exit':
          onCancel?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSave, onCancel]);

  // Esc closes (acts as Cancel)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleExport = () => {
    const data = liveXmlRef.current || '';
    if (!data.trim()) return;
    const blob = new Blob([data], { type: 'application/xml' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.drawio`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={S.overlay}>
      <div style={S.header}>
        <span style={S.title}>drawio diagram</span>
        <span style={S.status}>{status}</span>
        <button
          style={S.btn}
          onClick={handleExport}
          title="Download .drawio file (import into Confluence, etc.)"
        >
          Export
        </button>
        <button style={S.closeBtn} onClick={() => onCancel?.()} title="Cancel">×</button>
      </div>
      <iframe
        ref={iframeRef}
        src={EMBED_URL}
        style={S.iframe}
        title="drawio editor"
      />
    </div>
  );
}
