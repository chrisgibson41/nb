import React, { useState } from 'react';

const s = {
  container: {
    flex: 1,
    overflowY: 'auto',
    background: '#1e1e1e',
    padding: '32px 40px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#cccccc',
    lineHeight: 1.7,
  },
  header: {
    marginBottom: '36px',
    borderBottom: '1px solid #2e2e2e',
    paddingBottom: '24px',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '16px',
    marginBottom: '28px',
  },
  card: (accent) => ({
    background: '#252526',
    border: `1px solid #333`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  }),
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardBody: {
    fontSize: '13px',
    color: '#999',
    lineHeight: 1.65,
  },
  kbd: {
    display: 'inline-block',
    background: '#333',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '1px 6px',
    fontSize: '11px',
    fontFamily: 'ui-monospace, monospace',
    color: '#cccccc',
    verticalAlign: 'middle',
  },
  code: {
    background: '#2d2d2d',
    borderRadius: '3px',
    padding: '1px 5px',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '12px',
    color: '#9cdcfe',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '12px',
    marginTop: '28px',
  },
  tip: {
    background: 'rgba(0,122,204,0.08)',
    border: '1px solid rgba(0,122,204,0.2)',
    borderRadius: '6px',
    padding: '12px 16px',
    fontSize: '13px',
    color: '#8bbfde',
    marginTop: '8px',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '16px',
    background: 'transparent',
    border: 'none',
    color: '#555',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    lineHeight: 1,
  },
};

function Kbd({ children }) {
  return <span style={s.kbd}>{children}</span>;
}

function Code({ children }) {
  return <span style={s.code}>{children}</span>;
}

function FeatureCard({ accent, icon, title, children }) {
  return (
    <div style={s.card(accent)}>
      <div style={s.cardTitle}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        {title}
      </div>
      <div style={s.cardBody}>{children}</div>
    </div>
  );
}

export default function GettingStarted({ onClose }) {
  return (
    <div style={{ ...s.container, position: 'relative' }}>
      {onClose && (
        <button
          style={s.closeBtn}
          onClick={onClose}
          onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#ccc'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#555'; }}
          title="Close"
        >×</button>
      )}

      <div style={s.header}>
        <div style={s.logo}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#007acc" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          NB — Getting Started
        </div>
        <p style={s.subtitle}>A fast, local-first Markdown note-taking app.</p>
      </div>

      {/* ── Core editing ─────────────────────────── */}
      <div style={s.sectionTitle}>Core Editing</div>
      <div style={s.grid}>
        <FeatureCard accent="#4fc1ff" icon="✍️" title="Markdown editor">
          Write notes in Markdown with live preview rendering — headings, bold,
          italic, code blocks, blockquotes, and lists render inline as you type.
          Native OS spellcheck highlights misspellings as you go.
        </FeatureCard>

        <FeatureCard accent="#98c379" icon="✅" title="Interactive checkboxes">
          Use standard Markdown checkboxes&nbsp;
          <Code>- [ ] task</Code> or <Code>- [x] done</Code>.
          Click the rendered checkbox to tick/untick it — no need to edit the raw Markdown.
        </FeatureCard>

        <FeatureCard accent="#e5c07b" icon="📋" title="Markdown tables">
          Create tables with standard pipe syntax:{' '}
          <Code>| Col 1 | Col 2 |</Code> followed by a separator row
          (<Code>| --- | --- |</Code>). They render as formatted tables while you edit.
        </FeatureCard>

        <FeatureCard accent="#c678dd" icon="🏷️" title="Tags">
          Add YAML front-matter tags to any note using the tag bar at the bottom of
          the editor. Click <strong style={{ color: '#ccc' }}>+ Add tag</strong> to
          add a tag, or × to remove one. Tags are stored as{' '}
          <Code>tags: [tag1, tag2]</Code> in the note's front-matter.
        </FeatureCard>
      </div>

      {/* ── Navigation ───────────────────────────── */}
      <div style={s.sectionTitle}>Navigation</div>
      <div style={s.grid}>
        <FeatureCard accent="#007acc" icon="📁" title="File tree">
          The left sidebar shows all your notes and folders. Click a file to open it,
          click a folder to expand/collapse it. Hover a file or folder to reveal{' '}
          <strong style={{ color: '#ccc' }}>rename</strong>,{' '}
          <strong style={{ color: '#ccc' }}>delete</strong>, and
          (for folders) <strong style={{ color: '#ccc' }}>new file</strong> /
          <strong style={{ color: '#ccc' }}>new folder</strong> buttons.
          Drag & drop files between folders.
        </FeatureCard>

        <FeatureCard accent="#56b6c2" icon="📌" title="Tabs">
          Files open in a single working tab. To keep a tab permanently,
          right-click it and choose <strong style={{ color: '#ccc' }}>Pin tab</strong>,
          or double-click the tab. Close a tab with the ×
          button or <Kbd>Ctrl+W</Kbd>. Middle-click also closes unpinned tabs.
        </FeatureCard>

        <FeatureCard accent="#e06c75" icon="🔗" title="Wiki links">
          Link between notes with double-bracket syntax:&nbsp;
          <Code>[[Note Name]]</Code>. The link renders as a clickable pill.
          Clicking it navigates to that note (or creates it if it doesn't exist).
        </FeatureCard>

        <FeatureCard accent="#d19a66" icon="🗂️" title="Outline panel">
          When a note has 2+ headings, an Outline panel appears on the right side
          of the editor. Click any heading to scroll the editor to that section.
        </FeatureCard>
      </div>

      {/* ── Organisation ─────────────────────────── */}
      <div style={s.sectionTitle}>Organisation</div>
      <div style={s.grid}>
        <FeatureCard accent="#61afef" icon="🔍" title="Search">
          Use the search bar in the toolbar to filter files by name across the entire
          file tree. The sidebar's local filter lets you narrow down within the tree
          without affecting the toolbar search.
        </FeatureCard>

        <FeatureCard accent="#98c379" icon="📄" title="Templates">
          Create reusable note templates. Press <Kbd>Ctrl+T</Kbd> (or click{' '}
          <strong style={{ color: '#ccc' }}>New</strong> in the toolbar) to create a
          note from a template. Templates live in the{' '}
          <Code>templates/</Code> directory and are shown at the bottom of the sidebar.
        </FeatureCard>

        <FeatureCard accent="#c678dd" icon="⚡" title="Shortcuts panel">
          Templates can define <em>shortcuts</em> — quick-insert buttons that appear
          in a bar above the editor. Click a shortcut to open a modal where you enter
          a title and body, then the entry is inserted under the matching section
          heading and the editor scrolls to it.
        </FeatureCard>

        <FeatureCard accent="#e5c07b" icon="🕒" title="File history">
          Click <strong style={{ color: '#ccc' }}>History</strong> in the toolbar to
          browse saved snapshots of the current file. Click a snapshot to preview it
          and <strong style={{ color: '#ccc' }}>Restore</strong> to roll back to that
          version.
        </FeatureCard>
      </div>

      {/* ── Keyboard shortcuts ───────────────────── */}
      <div style={s.sectionTitle}>Keyboard shortcuts</div>
      <div style={{
        background: '#252526',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '8px 32px',
        fontSize: '13px',
        marginBottom: '28px',
      }}>
        {[
          ['Ctrl+S / ⌘S', 'Save current file immediately'],
          ['Ctrl+T / ⌘T', 'New note from template'],
          ['Ctrl+W / ⌘W', 'Close current tab'],
          ['Auto-save', 'Saves 800ms after last keystroke'],
        ].map(([key, desc]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
            <Kbd>{key}</Kbd>
            <span style={{ color: '#888' }}>{desc}</span>
          </div>
        ))}
      </div>

      <div style={s.tip}>
        💡 <strong>Tip:</strong> All your notes are plain{' '}
        <Code>.md</Code> files stored locally — you can open them in any text editor,
        back them up with Git, or sync them with any file-sync service.
      </div>

      <div style={{ height: '32px' }} />
    </div>
  );
}
