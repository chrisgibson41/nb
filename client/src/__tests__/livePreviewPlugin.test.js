import { describe, it, expect } from 'vitest';

// Test the pure helper functions extracted from livePreviewPlugin
// We can't test the CodeMirror plugin directly (requires a DOM + CM setup),
// but we can unit-test the parsing helpers.

// ── parseHeadings (via OutlinePanel logic — mirrors the same logic) ───────────
function parseHeadings(content) {
  if (!content) return [];
  let body = content;
  const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fmMatch) body = content.slice(fmMatch[0].length);
  const headings = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) headings.push({ level: match[1].length, text: match[2].trim() });
  }
  return headings;
}

// ── parseFrontmatter (same logic as TagBar) ────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { tags: [], hasFrontmatter: false };
  const fmContent = match[1];
  const tagsMatch = fmContent.match(/^tags:\s*\[([^\]]*)\]/m) ||
                    fmContent.match(/^tags:\s*\n((?:\s+-\s+\S+\n?)*)/m);
  let tags = [];
  if (tagsMatch) {
    if (tagsMatch[0].includes('[')) {
      tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else {
      tags = tagsMatch[1].split('\n').map(t => t.replace(/^\s+-\s+/, '').trim()).filter(Boolean);
    }
  }
  return { tags, hasFrontmatter: true };
}

// ── setTagsInContent ──────────────────────────────────────────────────────────
function setTagsInContent(content, newTags) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  const tagsStr = `tags: [${newTags.join(', ')}]`;
  if (match) {
    const fmContent = match[1];
    const hasTags = fmContent.match(/^tags:.*$/m);
    let newFm = hasTags ? fmContent.replace(/^tags:.*$/m, tagsStr) : fmContent + '\n' + tagsStr;
    return content.replace(match[0], `---\n${newFm}\n---`);
  }
  return `---\n${tagsStr}\n---\n` + content;
}

// ── Wiki link detection helper ────────────────────────────────────────────────
function extractWikiLinks(text) {
  const links = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    links.push({ noteName: m[1], from: m.index, to: m.index + m[0].length });
  }
  return links;
}

// ── Checkbox detection helper ─────────────────────────────────────────────────
function extractCheckboxes(text) {
  const checkboxes = [];
  const regex = /^(\s*[-*+]\s+)\[([ xX])\]\s/gm;
  let m;
  while ((m = regex.exec(text)) !== null) {
    checkboxes.push({ checked: m[2].toLowerCase() === 'x', from: m.index });
  }
  return checkboxes;
}

// ── Table detection helper ────────────────────────────────────────────────────
function isTableLine(line) {
  return line.trim().startsWith('|');
}

function detectTableBlocks(lines) {
  const blocks = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isTableLine(lines[i])) {
      if (start === -1) start = i;
    } else {
      if (start !== -1) {
        blocks.push({ start, end: i - 1 });
        start = -1;
      }
    }
  }
  if (start !== -1) blocks.push({ start, end: lines.length - 1 });
  return blocks;
}

describe('Heading parser', () => {
  it('returns empty array for empty content', () => {
    expect(parseHeadings('')).toEqual([]);
  });

  it('parses all heading levels', () => {
    const content = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const headings = parseHeadings(content);
    expect(headings).toHaveLength(6);
    expect(headings[0]).toEqual({ level: 1, text: 'H1' });
    expect(headings[5]).toEqual({ level: 6, text: 'H6' });
  });

  it('strips frontmatter before parsing', () => {
    const content = '---\ntitle: Test\n---\n# Real Heading';
    const headings = parseHeadings(content);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Real Heading');
  });

  it('ignores non-heading lines', () => {
    const content = '# Yes\nNot a heading\n## Also yes\n- list';
    const headings = parseHeadings(content);
    expect(headings).toHaveLength(2);
  });

  it('trims heading text', () => {
    const content = '#   Padded Heading   ';
    // Note: regex captures .+ after whitespace so it might include trailing spaces
    // The .trim() call should handle it
    const headings = parseHeadings(content);
    expect(headings[0].text).toBe('Padded Heading');
  });
});

describe('Frontmatter parser', () => {
  it('returns no tags for content without frontmatter', () => {
    const result = parseFrontmatter('# Hello\n\nSome text');
    expect(result.tags).toEqual([]);
    expect(result.hasFrontmatter).toBe(false);
  });

  it('parses array-style tags', () => {
    const content = '---\ntags: [alpha, beta, gamma]\n---\n\n# Hello';
    const { tags } = parseFrontmatter(content);
    expect(tags).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('parses list-style tags', () => {
    const content = '---\ntags:\n  - one\n  - two\n---\n\n# Hello';
    const { tags } = parseFrontmatter(content);
    expect(tags).toEqual(['one', 'two']);
  });

  it('returns empty tags array when frontmatter has no tags key', () => {
    const content = '---\ntitle: My Note\n---\n\n# Hello';
    const { tags, hasFrontmatter } = parseFrontmatter(content);
    expect(tags).toEqual([]);
    expect(hasFrontmatter).toBe(true);
  });
});

describe('setTagsInContent', () => {
  it('adds frontmatter with tags to content without frontmatter', () => {
    const result = setTagsInContent('# Hello\n\nBody', ['tag1', 'tag2']);
    expect(result).toContain('---');
    expect(result).toContain('tags: [tag1, tag2]');
    expect(result).toContain('# Hello');
  });

  it('replaces existing tags in frontmatter', () => {
    const content = '---\ntags: [old]\n---\n\n# Hello';
    const result = setTagsInContent(content, ['new1', 'new2']);
    expect(result).toContain('tags: [new1, new2]');
    expect(result).not.toContain('tags: [old]');
  });

  it('adds tags line to existing frontmatter without tags', () => {
    const content = '---\ntitle: My Note\n---\n\n# Hello';
    const result = setTagsInContent(content, ['added']);
    expect(result).toContain('tags: [added]');
    expect(result).toContain('title: My Note');
  });

  it('removes all tags when given empty array', () => {
    const content = '---\ntags: [a, b]\n---\n\n# Hello';
    const result = setTagsInContent(content, []);
    expect(result).toContain('tags: []');
  });
});

describe('Wiki link extractor', () => {
  it('extracts single wiki link', () => {
    const links = extractWikiLinks('See [[My Note]] for details');
    expect(links).toHaveLength(1);
    expect(links[0].noteName).toBe('My Note');
  });

  it('extracts multiple wiki links', () => {
    const links = extractWikiLinks('[[Alpha]] and [[Beta]] and [[Gamma]]');
    expect(links).toHaveLength(3);
    expect(links.map(l => l.noteName)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('returns empty array when no wiki links', () => {
    const links = extractWikiLinks('No links here, just regular text');
    expect(links).toHaveLength(0);
  });

  it('handles wiki links with spaces in name', () => {
    const links = extractWikiLinks('[[Meeting Notes for Today]]');
    expect(links[0].noteName).toBe('Meeting Notes for Today');
  });

  it('records correct character positions', () => {
    const text = 'Start [[Link]] end';
    const links = extractWikiLinks(text);
    expect(links[0].from).toBe(6);
    expect(links[0].to).toBe(14);
  });

  it('does not match malformed links', () => {
    const links = extractWikiLinks('[[unclosed] and [single]');
    expect(links).toHaveLength(0);
  });
});

describe('Checkbox extractor', () => {
  it('detects unchecked checkbox', () => {
    const boxes = extractCheckboxes('- [ ] Unchecked item');
    expect(boxes).toHaveLength(1);
    expect(boxes[0].checked).toBe(false);
  });

  it('detects checked checkbox with lowercase x', () => {
    const boxes = extractCheckboxes('- [x] Checked item');
    expect(boxes).toHaveLength(1);
    expect(boxes[0].checked).toBe(true);
  });

  it('detects checked checkbox with uppercase X', () => {
    const boxes = extractCheckboxes('- [X] Checked item');
    expect(boxes).toHaveLength(1);
    expect(boxes[0].checked).toBe(true);
  });

  it('detects multiple checkboxes', () => {
    const content = '- [ ] Task one\n- [x] Task two\n- [ ] Task three';
    const boxes = extractCheckboxes(content);
    expect(boxes).toHaveLength(3);
    expect(boxes[0].checked).toBe(false);
    expect(boxes[1].checked).toBe(true);
    expect(boxes[2].checked).toBe(false);
  });

  it('returns empty array for content without checkboxes', () => {
    const boxes = extractCheckboxes('# Heading\n\nSome text\n- regular list item');
    expect(boxes).toHaveLength(0);
  });

  it('handles asterisk list marker', () => {
    const boxes = extractCheckboxes('* [ ] Asterisk item');
    expect(boxes).toHaveLength(1);
  });

  it('handles plus list marker', () => {
    const boxes = extractCheckboxes('+ [ ] Plus item');
    expect(boxes).toHaveLength(1);
  });
});

describe('Table block detector', () => {
  it('detects a single table block', () => {
    const lines = [
      '| Col 1 | Col 2 |',
      '| ----- | ----- |',
      '| A     | B     |',
    ];
    const blocks = detectTableBlocks(lines);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ start: 0, end: 2 });
  });

  it('detects multiple table blocks', () => {
    const lines = [
      '| H1 | H2 |',
      '| -- | -- |',
      '| a  | b  |',
      '',
      'Some text',
      '',
      '| X  | Y  |',
      '| -- | -- |',
    ];
    const blocks = detectTableBlocks(lines);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ start: 0, end: 2 });
    expect(blocks[1]).toEqual({ start: 6, end: 7 });
  });

  it('returns empty array for non-table content', () => {
    const lines = ['# Heading', 'Paragraph', '- list'];
    expect(detectTableBlocks(lines)).toHaveLength(0);
  });

  it('handles table at end of content without trailing newline', () => {
    const lines = ['text', '| H |', '| - |', '| v |'];
    const blocks = detectTableBlocks(lines);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ start: 1, end: 3 });
  });
});
