import React, { useState, useMemo, useRef, useEffect } from 'react';

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    background: '#252526',
    borderTop: '1px solid #3c3c3c',
    minHeight: '34px',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  label: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    flexShrink: 0,
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: '#3a3d3e',
    color: '#9cdcfe',
    borderRadius: '100px',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: 500,
    border: '1px solid #4a4d4e',
    cursor: 'pointer',
    transition: 'all 0.15s',
    userSelect: 'none',
    lineHeight: 1.5,
  },
  removeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: 'transparent',
    border: 'none',
    color: '#9cdcfe',
    cursor: 'pointer',
    padding: 0,
    fontSize: '13px',
    lineHeight: 1,
    opacity: 0.6,
    transition: 'opacity 0.15s',
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    background: 'transparent',
    border: '1px dashed #444',
    color: '#666',
    borderRadius: '100px',
    padding: '2px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  addInput: {
    background: '#3a3d3e',
    border: '1px solid #007acc',
    borderRadius: '100px',
    padding: '2px 10px',
    fontSize: '12px',
    color: '#cccccc',
    outline: 'none',
    width: '100px',
  },
};

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { tags: [], hasFrontmatter: false, fmContent: '' };

  const fmContent = match[1];
  const tagsMatch = fmContent.match(/^tags:\s*\[([^\]]*)\]/m) ||
                    fmContent.match(/^tags:\s*\n((?:\s+-\s+\S+\n?)*)/m);

  let tags = [];
  if (tagsMatch) {
    if (tagsMatch[0].includes('[')) {
      // Array format: tags: [a, b, c]
      tags = tagsMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      // List format:
      // tags:
      //   - a
      tags = tagsMatch[1]
        .split('\n')
        .map((t) => t.replace(/^\s+-\s+/, '').trim())
        .filter(Boolean);
    }
  }

  return { tags, hasFrontmatter: true, fmContent };
}

function setTagsInContent(content, newTags) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  const tagsStr = `tags: [${newTags.join(', ')}]`;

  if (match) {
    const fmContent = match[1];
    // Replace existing tags line
    const hasTags = fmContent.match(/^tags:.*$/m);
    let newFm;
    if (hasTags) {
      newFm = fmContent.replace(/^tags:.*$/m, tagsStr);
    } else {
      newFm = fmContent + '\n' + tagsStr;
    }
    return content.replace(match[0], `---\n${newFm}\n---`);
  } else {
    // Add frontmatter
    const fm = `---\n${tagsStr}\n---\n`;
    return fm + content;
  }
}

export default function TagBar({ content, setContent }) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef(null);

  const { tags } = useMemo(() => parseFrontmatter(content), [content]);

  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [adding]);

  const addTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !tags.includes(tag)) {
      const updated = setTagsInContent(content, [...tags, tag]);
      setContent(updated);
    }
    setNewTag('');
    setAdding(false);
  };

  const removeTag = (tagToRemove) => {
    const updated = setTagsInContent(content, tags.filter((t) => t !== tagToRemove));
    setContent(updated);
  };

  return (
    <div style={styles.bar}>
      <span style={styles.label}>Tags</span>

      {tags.length === 0 && !adding && (
        <span style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>none</span>
      )}

      {tags.map((tag) => (
        <span
          key={tag}
          style={styles.tag}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#4a4d4e'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#3a3d3e'; }}
        >
          #{tag}
          <button
            style={styles.removeBtn}
            onClick={() => removeTag(tag)}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
            title={`Remove tag "${tag}"`}
          >
            ×
          </button>
        </span>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          style={styles.addInput}
          value={newTag}
          placeholder="tag-name"
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addTag();
            if (e.key === 'Escape') { setAdding(false); setNewTag(''); }
          }}
          onBlur={addTag}
        />
      ) : (
        <button
          style={styles.addBtn}
          onClick={() => setAdding(true)}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#999'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#666'; }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add tag
        </button>
      )}
    </div>
  );
}
