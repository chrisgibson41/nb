import React from 'react';

function parseHeadings(content) {
  if (!content) return [];

  // Strip YAML frontmatter between first --- lines
  let body = content;
  const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fmMatch) {
    body = content.slice(fmMatch[0].length);
  }

  const headings = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }
  return headings;
}

function headingStyle(level) {
  if (level === 1) {
    return { fontSize: '12px', color: '#ddd', fontWeight: 600 };
  }
  if (level === 2) {
    return { fontSize: '12px', color: '#bbb', fontWeight: 500 };
  }
  return { fontSize: '11px', color: '#888', fontWeight: 400 };
}

export default function OutlinePanel({ content, onScrollTo }) {
  const headings = parseHeadings(content);

  if (headings.length < 2) return null;

  return (
    <div
      style={{
        width: '170px',
        flexShrink: 0,
        borderLeft: '1px solid #2a2a2a',
        background: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingTop: '8px',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          color: '#555',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '0 10px 6px',
          flexShrink: 0,
        }}
      >
        Outline
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {headings.map((h, i) => (
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
            onClick={() => onScrollTo && onScrollTo(h.text)}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2d2e'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {h.text}
          </div>
        ))}
      </div>
    </div>
  );
}
