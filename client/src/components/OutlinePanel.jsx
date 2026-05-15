import React from 'react';

function parseHeadings(content) {
  if (!content) return [];

  // Strip YAML frontmatter
  let body = content;
  const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fmMatch) body = content.slice(fmMatch[0].length);

  const headings = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m) {
      const raw = m[2].trim();
      const isTasks = /^\[\](?!\()/.test(raw);
      const display = isTasks ? raw.replace(/^\[\](?!\()\s*/, '') : raw;
      headings.push({ level: m[1].length, text: display, raw, isTasks });
    }
  }
  return headings;
}

function headingStyle(level) {
  if (level === 1) return { fontSize: '12px', color: '#ddd', fontWeight: 600 };
  if (level === 2) return { fontSize: '12px', color: '#bbb', fontWeight: 500 };
  return { fontSize: '11px', color: '#888', fontWeight: 400 };
}

export default function OutlinePanel({ content, onScrollTo, collapseButton, collapsed }) {
  const headings = parseHeadings(content);

  return (
    <div style={{
      width: '100%',
      flex: 1,
      borderLeft: '1px solid #2a2a2a',
      background: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px 6px 10px',
        borderBottom: '1px solid #232323',
        flexShrink: 0,
        gap: '4px',
      }}>
        <span style={{
          fontSize: '10px', color: '#555', textTransform: 'uppercase',
          letterSpacing: '0.1em', fontWeight: 700, flex: 1,
        }}>
          Outline
        </span>
        {collapseButton}
      </div>

      {/* Body — omitted when collapsed */}
      {!collapsed && (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {headings.length === 0 ? (
            <div style={{ padding: '12px 10px', fontSize: '11px', color: '#444', lineHeight: 1.5 }}>
              No headings yet.
            </div>
          ) : headings.map((h, i) => (
            <div
              key={i}
              style={{
                paddingLeft: `${10 + (h.level - 1) * 10}px`,
                paddingRight: '8px',
                paddingTop: '3px',
                paddingBottom: '3px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                borderRadius: '3px',
                margin: '0 4px',
                ...headingStyle(h.level),
              }}
              title={h.text}
              onClick={() => onScrollTo?.(h.raw || h.text)}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2d2e'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {h.isTasks && <span style={{ color: '#5aabde', marginRight: '4px' }}>☐</span>}
              {h.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
