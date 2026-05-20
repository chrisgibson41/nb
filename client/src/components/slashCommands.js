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
  {
    label:  '/drawio',
    detail: 'diagram',
    info:   'Insert a drawio diagram and open the editor',
    apply:  applyDrawio,
  },
  snippetCompletion('```mermaid\n${0}\n```', {
    label:  '/mermaid',
    detail: 'diagram',
    info:   'Insert a mermaid diagram',
  }),
  snippetCompletion('## [] Tasks\n- ${0}', {
    label:  '/tasks',
    detail: 'section',
    info:   'Insert a tasks section (bullets below become checkboxes)',
  }),
  snippetCompletion(
    '| ${1:Header 1} | ${2:Header 2} |\n| --- | --- |\n| ${0:Cell 1} | Cell 2 |',
    { label: '/table', detail: 'table', info: 'Insert a markdown table' },
  ),
]

export function slashCommandSource(context) {
  const slash = context.matchBefore(/\/\w*/)
  if (!slash || slash.from === slash.to) return null
  // Only at the start of a line (allowing leading whitespace). Avoids triggering
  // inside URLs, paths, or random text like `1/2`.
  const line   = context.state.doc.lineAt(slash.from)
  const prefix = line.text.slice(0, slash.from - line.from)
  if (!/^\s*$/.test(prefix)) return null
  return {
    from: slash.from,
    options: COMMANDS,
    validFor: /^\/\w*$/,
  }
}
