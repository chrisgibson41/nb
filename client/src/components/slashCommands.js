// Slash commands — `/<name>` at the start of a line pops a type-ahead list of
// quick inserts. Selecting one replaces the slash command with the snippet
// (and for `/drawio` also opens the embedded editor).

import { snippetCompletion } from '@codemirror/autocomplete'

// Custom apply for /drawio: insert the fence + dispatch the edit event so the
// editor pops immediately on selection.
function applyDrawio(view, _completion, from, to) {
  const insert = '```drawio\n\n```'
  view.dispatch({
    changes:   { from, to, insert },
    selection: { anchor: from + '```drawio\n'.length },  // cursor on empty body line
    userEvent: 'drawio.autocomplete',
  })
  requestAnimationFrame(() => {
    view.contentDOM.dispatchEvent(new CustomEvent('nb:drawio-edit', {
      detail: { xml: '', blockFrom: from },
      bubbles: true,
    }))
  })
}

// Each command is a CompletionOption. Most use snippetCompletion for static
// inserts (with ${0} marking the final cursor position); /drawio uses a
// custom apply because it has a side effect (open the editor).
const COMMANDS = [
  // ── Headings ──────────────────────────────────────────────────────────────
  snippetCompletion('# ${0}',     { label: '/h1', detail: 'heading',   info: 'Heading 1' }),
  snippetCompletion('## ${0}',    { label: '/h2', detail: 'heading',   info: 'Heading 2' }),
  snippetCompletion('### ${0}',   { label: '/h3', detail: 'heading',   info: 'Heading 3' }),
  snippetCompletion('#### ${0}',  { label: '/h4', detail: 'heading',   info: 'Heading 4' }),

  // ── Inline formatting (cursor-around-placeholder) ─────────────────────────
  snippetCompletion('**${1:text}**${0}',
    { label: '/bold',   detail: 'inline', info: 'Bold (also: Mod-B)' }),
  snippetCompletion('_${1:text}_${0}',
    { label: '/italic', detail: 'inline', info: 'Italic (also: Mod-I)' }),
  snippetCompletion('~~${1:text}~~${0}',
    { label: '/strike', detail: 'inline', info: 'Strikethrough (also: Mod-Shift-X)' }),
  snippetCompletion('`${1:code}`${0}',
    { label: '/code-inline', detail: 'inline', info: 'Inline code (also: Mod-E)' }),
  snippetCompletion('[${1:text}](${2:url})${0}',
    { label: '/link', detail: 'inline', info: 'Link (also: Mod-K)' }),

  // ── Block-level inserts ───────────────────────────────────────────────────
  snippetCompletion('> ${0}',
    { label: '/quote', detail: 'block', info: 'Blockquote' }),
  snippetCompletion('---\n${0}',
    { label: '/divider', detail: 'block', info: 'Horizontal rule' }),
  snippetCompletion('- ${0}',
    { label: '/bullet', detail: 'list', info: 'Bullet list item' }),
  snippetCompletion('1. ${0}',
    { label: '/numbered', detail: 'list', info: 'Numbered list item' }),
  snippetCompletion('- [ ] ${0}',
    { label: '/checkbox', detail: 'list', info: 'Task / checkbox item' }),
  snippetCompletion('```${1:language}\n${0}\n```',
    { label: '/code', detail: 'block', info: 'Fenced code block' }),

  // ── Larger structures ─────────────────────────────────────────────────────
  snippetCompletion('## [] Tasks\n- ${0}', {
    label:  '/tasks',
    detail: 'section',
    info:   'Insert a tasks section (bullets below become checkboxes)',
  }),
  snippetCompletion(
    '| ${1:Header 1} | ${2:Header 2} |\n| --- | --- |\n| ${0:Cell 1} | Cell 2 |',
    { label: '/table', detail: 'table', info: 'Insert a markdown table' },
  ),
  snippetCompletion('```mermaid\n${0}\n```', {
    label:  '/mermaid',
    detail: 'diagram',
    info:   'Insert a mermaid diagram',
  }),
  {
    label:  '/drawio',
    detail: 'diagram',
    info:   'Insert a drawio diagram and open the editor',
    apply:  applyDrawio,
  },
]

export function slashCommandSource(context) {
  const slash = context.matchBefore(/\/[\w-]*/)
  if (!slash || slash.from === slash.to) return null
  // Only at the start of a line (allowing leading whitespace). Avoids triggering
  // inside URLs, paths, or random text like `1/2`.
  const line   = context.state.doc.lineAt(slash.from)
  const prefix = line.text.slice(0, slash.from - line.from)
  if (!/^\s*$/.test(prefix)) return null
  return {
    from: slash.from,
    options: COMMANDS,
    validFor: /^\/[\w-]*$/,
  }
}
