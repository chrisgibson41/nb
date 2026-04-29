import React, { useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

// Configure marked with syntax highlighting
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);

marked.setOptions({
  breaks: true,
  gfm: true,
});

const previewStyles = `
  .preview-content {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: #cccccc;
    padding: 32px 40px;
    max-width: 800px;
    margin: 0 auto;
  }

  .preview-content h1,
  .preview-content h2,
  .preview-content h3,
  .preview-content h4,
  .preview-content h5,
  .preview-content h6 {
    color: #e8e8e8;
    font-weight: 600;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  .preview-content h1 {
    font-size: 2em;
    border-bottom: 1px solid #3c3c3c;
    padding-bottom: 0.3em;
    margin-top: 0;
  }

  .preview-content h2 {
    font-size: 1.5em;
    border-bottom: 1px solid #3c3c3c;
    padding-bottom: 0.2em;
  }

  .preview-content h3 { font-size: 1.25em; }
  .preview-content h4 { font-size: 1.1em; }
  .preview-content h5 { font-size: 1em; }
  .preview-content h6 { font-size: 0.9em; color: #999; }

  .preview-content p {
    margin-bottom: 1em;
  }

  .preview-content a {
    color: #4fc1ff;
    text-decoration: none;
  }
  .preview-content a:hover {
    text-decoration: underline;
  }

  .preview-content strong {
    color: #e8e8e8;
    font-weight: 600;
  }

  .preview-content em {
    color: #c8c8c8;
    font-style: italic;
  }

  .preview-content code {
    font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    font-size: 0.875em;
    background: #2d2d2d;
    color: #ce9178;
    padding: 2px 5px;
    border-radius: 3px;
    border: 1px solid #3c3c3c;
  }

  .preview-content pre {
    background: #1a1a1a;
    border: 1px solid #3c3c3c;
    border-radius: 6px;
    padding: 16px;
    overflow-x: auto;
    margin: 1em 0;
    position: relative;
  }

  .preview-content pre code {
    background: none;
    color: #d4d4d4;
    padding: 0;
    border: none;
    border-radius: 0;
    font-size: 13px;
    line-height: 1.6;
  }

  .preview-content blockquote {
    border-left: 3px solid #007acc;
    padding: 2px 16px;
    margin: 1em 0;
    color: #999;
    background: #1a2a3a;
    border-radius: 0 4px 4px 0;
  }

  .preview-content blockquote p {
    margin: 8px 0;
  }

  .preview-content ul,
  .preview-content ol {
    padding-left: 1.5em;
    margin-bottom: 1em;
  }

  .preview-content li {
    margin-bottom: 0.3em;
  }

  .preview-content li input[type="checkbox"] {
    margin-right: 6px;
    accent-color: #007acc;
    cursor: default;
  }

  .preview-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 14px;
  }

  .preview-content table th {
    background: #2d2d2d;
    color: #e8e8e8;
    font-weight: 600;
    padding: 8px 12px;
    text-align: left;
    border: 1px solid #3c3c3c;
  }

  .preview-content table td {
    padding: 7px 12px;
    border: 1px solid #3c3c3c;
    color: #cccccc;
  }

  .preview-content table tr:nth-child(even) {
    background: #252526;
  }

  .preview-content table tr:hover {
    background: #2a2d2e;
  }

  .preview-content hr {
    border: none;
    border-top: 1px solid #3c3c3c;
    margin: 2em 0;
  }

  .preview-content img {
    max-width: 100%;
    border-radius: 4px;
  }

  /* Frontmatter block */
  .preview-content .frontmatter {
    background: #252526;
    border: 1px solid #3c3c3c;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 1.5em;
    font-size: 12px;
    color: #888;
    font-family: 'Fira Code', monospace;
  }

  /* Highlight.js theme overrides */
  .hljs-keyword { color: #569cd6; }
  .hljs-string { color: #ce9178; }
  .hljs-comment { color: #6a9955; }
  .hljs-number { color: #b5cea8; }
  .hljs-function { color: #dcdcaa; }
  .hljs-variable { color: #9cdcfe; }
  .hljs-type { color: #4ec9b0; }
  .hljs-class { color: #4ec9b0; }
  .hljs-tag { color: #569cd6; }
  .hljs-attr { color: #9cdcfe; }
  .hljs-built_in { color: #4ec9b0; }
  .hljs-literal { color: #569cd6; }
  .hljs-title { color: #dcdcaa; }
  .hljs-params { color: #9cdcfe; }
  .hljs-meta { color: #c586c0; }
  .hljs-operator { color: #d4d4d4; }
  .hljs-punctuation { color: #d4d4d4; }
  .hljs-property { color: #9cdcfe; }
  .hljs-selector-tag { color: #d7ba7d; }
  .hljs-selector-class { color: #d7ba7d; }
  .hljs-selector-id { color: #d7ba7d; }
  .hljs-regexp { color: #d16969; }
  .hljs-symbol { color: #b5cea8; }
  .hljs-deletion { color: #f44747; }
  .hljs-addition { color: #b5cea8; }
  .hljs-section { color: #569cd6; font-weight: bold; }
  .hljs-bullet { color: #6a9955; }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: bold; }
`;

export default function Preview({ content }) {
  const containerRef = useRef(null);

  // Strip frontmatter before rendering and show it separately
  const { frontmatterText, bodyContent } = useMemo(() => {
    const fm = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (fm) {
      return {
        frontmatterText: fm[1],
        bodyContent: content.slice(fm[0].length),
      };
    }
    return { frontmatterText: null, bodyContent: content };
  }, [content]);

  const renderedHTML = useMemo(() => {
    return marked.parse(bodyContent || '');
  }, [bodyContent]);

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: '#1e1e1e',
      }}
      ref={containerRef}
    >
      <style>{previewStyles}</style>
      <div className="preview-content">
        {frontmatterText && (
          <div className="frontmatter">{frontmatterText}</div>
        )}
        <div dangerouslySetInnerHTML={{ __html: renderedHTML }} />
      </div>
    </div>
  );
}
