import { autocompletion, snippetCompletion } from '@codemirror/autocomplete'
import { parseFenceBlocks } from './livePreviewPlugin.js'
import { wikiLinkCompletionSource } from './wikiLinkCompletion.js'

// ─── Block helpers ────────────────────────────────────────────────────────────

function getActiveMermaidBlock(state, pos) {
  const cursorLine = state.doc.lineAt(pos).number
  for (const block of parseFenceBlocks(state)) {
    if (block.lang === 'mermaid' && cursorLine > block.start && cursorLine < block.end) {
      return block
    }
  }
  return null
}

function getDiagramType(state, block) {
  for (let i = block.start + 1; i < block.end; i++) {
    const t = state.doc.line(i).text.trim().toLowerCase()
    if (!t) continue
    if (t.startsWith('sequencediagram'))                    return 'sequence'
    if (t.startsWith('graph') || t.startsWith('flowchart')) return 'flowchart'
    if (t.startsWith('erdiagram'))                          return 'er'
    if (t.startsWith('classdiagram'))                       return 'class'
    if (t.startsWith('statediagram'))                       return 'state'
    if (t.startsWith('gantt'))                              return 'gantt'
    if (t.startsWith('pie'))                                return 'pie'
    return 'unknown'
  }
  return 'unknown'
}

// ─── Current-word helper ──────────────────────────────────────────────────────
// Returns { from, text } describing the word the cursor is inside, or null.
// We allow word chars plus hyphens so "left-of" etc work too.
function currentWord(context) {
  return context.matchBefore(/[\w-]+/)
}

// ─── Sequence: participant collection ─────────────────────────────────────────
// Names from explicit declarations AND implicit usage in message, note,
// activate, deactivate lines — so you get completion for every name seen
// anywhere in the diagram, not just formally declared ones.

function collectParticipants(state, block) {
  const seen = new Set()
  const add   = (name) => { const n = name?.trim(); if (n && n.length > 0) seen.add(n) }

  for (let i = block.start + 1; i < block.end; i++) {
    const text = state.doc.line(i).text.trim()
    if (!text || text.startsWith('%%')) continue

    // participant Alice  /  participant Alice as A  /  actor Bob
    const decl = text.match(/^(?:participant|actor)\s+(.+?)(?:\s+as\s+\S+)?$/)
    if (decl) { add(decl[1]); continue }

    // Alice->>Bob: / Alice ->> Bob: / Alice-->Bob (any arrow, spaces optional)
    const msg = text.match(/^(.+?)\s*(?:--?>>?|--?x|--?\)|->[\+\-]?)\s*(.+?)(?:\s*:.*)?$/)
    if (msg) { add(msg[1]); add(msg[2]); continue }

    // note over Alice, Bob
    const note = text.match(/^note\s+(?:over|left of|right of)\s+(.+?)(?:\s*:.*)?$/)
    if (note) { note[1].split(',').forEach(n => add(n)); continue }

    // activate / deactivate Alice
    const act = text.match(/^(?:activate|deactivate)\s+(.+)$/)
    if (act) { add(act[1]); continue }
  }

  return [...seen]
}

// ─── Sequence: static options ─────────────────────────────────────────────────

const SEQ_ARROWS = [
  { label: '->>',  info: 'Solid line, filled arrowhead' },
  { label: '-->>',  info: 'Dotted line, filled arrowhead' },
  { label: '->',   info: 'Solid line, open arrow' },
  { label: '-->',  info: 'Dotted line, open arrow' },
  { label: '-x',   info: 'Solid line, cross (destroy)' },
  { label: '--x',  info: 'Dotted line, cross (destroy)' },
  { label: '-)',   info: 'Solid line, async' },
  { label: '--)',  info: 'Dotted line, async' },
  { label: '->>+', info: 'Solid arrow + activate target' },
  { label: '->>-', info: 'Solid arrow + deactivate target' },
]

const SEQ_NOTE_POSITIONS = [
  { label: 'over',     detail: 'position' },
  { label: 'left of',  detail: 'position' },
  { label: 'right of', detail: 'position' },
]

const SEQ_BLOCK_SNIPPETS = [
  snippetCompletion('loop ${condition}\n    ${}\nend', {
    label: 'loop', detail: 'block',
  }),
  snippetCompletion('alt ${condition}\n    ${}\nelse ${alternative}\n    ${}\nend', {
    label: 'alt', detail: 'block',
  }),
  snippetCompletion('opt ${condition}\n    ${}\nend', {
    label: 'opt', detail: 'block',
  }),
  snippetCompletion('par ${label}\n    ${}\nand ${label2}\n    ${}\nend', {
    label: 'par', detail: 'block',
  }),
  snippetCompletion('rect ${color}\n    ${}\nend', {
    label: 'rect', detail: 'block',
  }),
  snippetCompletion('critical ${resource}\n    ${}\noption ${alternative}\n    ${}\nend', {
    label: 'critical', detail: 'block',
  }),
  snippetCompletion('box ${title}\n    participant ${}\nend', {
    label: 'box', detail: 'block',
  }),
]

const SEQ_KEYWORDS = [
  { label: 'participant', detail: 'keyword' },
  { label: 'actor',       detail: 'keyword' },
  { label: 'activate',    detail: 'keyword' },
  { label: 'deactivate',  detail: 'keyword' },
  { label: 'note',        detail: 'keyword' },
  { label: 'autonumber',  detail: 'keyword' },
  { label: 'end',         detail: 'keyword' },
  ...SEQ_BLOCK_SNIPPETS,
]

/** Full message-line snippets for a known sender with tab stops */
function participantMessageSnippets(sender, allParticipants) {
  const others = allParticipants.filter(p => p !== sender)
  const target = others.length ? others[0] : 'Receiver'
  return [
    snippetCompletion(`${sender} ->> \${${target}}: \${message}`, {
      label:  `${sender} ->>`,
      detail: 'message',
    }),
    snippetCompletion(`${sender} -->> \${${target}}: \${message}`, {
      label:  `${sender} -->>`,
      detail: 'reply (dotted)',
    }),
    snippetCompletion(
      `${sender} ->> \${${target}}: \${message}\nactivate \${${target}}\n\${}\ndeactivate \${${target}}`,
      { label: `${sender} ->> … activate`, detail: 'message + activate' }
    ),
  ]
}

// ─── Sequence completion source ───────────────────────────────────────────────

function sequenceSource(context, state, block) {
  const { pos } = context
  const line    = state.doc.lineAt(pos)
  // Text on the current line from column 0 up to the cursor
  const lineText = line.text.slice(0, pos - line.from)
  const trimmed  = lineText.trimStart()

  const participants = collectParticipants(state, block)

  // ── "note " → position keywords ─────────────────────────────────────────
  if (/^note\s+$/i.test(trimmed)) {
    return { from: pos, options: SEQ_NOTE_POSITIONS }
  }

  // ── "note over|left of|right of " → participant names ───────────────────
  if (/^note\s+(?:over|left\s+of|right\s+of)\s+/i.test(trimmed)) {
    const word = currentWord(context)
    return {
      from: word ? word.from : pos,
      options: participants.map(p => ({ label: p, detail: 'participant' })),
    }
  }

  // ── "activate|deactivate " → participant names ───────────────────────────
  if (/^(?:activate|deactivate)\s+/i.test(trimmed)) {
    const word = currentWord(context)
    return {
      from: word ? word.from : pos,
      options: participants.map(p => ({ label: p, detail: 'participant' })),
    }
  }

  // ── "participant|actor " → names (for aliasing / reordering) ────────────
  if (/^(?:participant|actor)\s+/i.test(trimmed)) {
    const word = currentWord(context)
    const from = word ? word.from : pos
    const nameOpts = participants.map(p => ({ label: p, detail: 'participant' }))
    const aliasSnippets = participants.map(p =>
      snippetCompletion(`${p} as \${alias}`, { label: `${p} as`, detail: 'alias' })
    )
    return { from, options: [...nameOpts, ...aliasSnippets] }
  }

  // Common arrow pattern used in the branches below
  const ARROW_RE = /(?:--?>>?|--?x|--?\)|->[\+\-]?)/

  // ── "Sender Arrow Target" (no colon) → suggest ": " ─────────────────────
  // Handles both spaced (Alice ->> Bob) and compact (Alice->>Bob) forms
  const noColon = trimmed.match(new RegExp(
    '^(\\S+?)\\s*' + ARROW_RE.source + '\\s*(\\S+)$'
  ))
  if (noColon) {
    return {
      from: pos,
      options: [{ label: ': ', detail: 'message', info: 'Add the message text after the colon' }],
    }
  }

  // ── "Sender Arrow[space]" → participant names as targets ─────────────────
  // The trailing space after the arrow tells us the user wants a target
  const afterArrow = trimmed.match(new RegExp(
    '^(\\S+?)\\s*' + ARROW_RE.source + '\\s+([\\w]*)$'
  ))
  if (afterArrow) {
    const partial = afterArrow[2]
    return {
      from: pos - partial.length,
      options: participants.map(p => ({ label: p, detail: 'participant' })),
    }
  }

  // ── "Sender[-partial-arrow]" → arrow types ────────────────────────────────
  // Fires when the line starts with a known participant name followed by
  // optional whitespace and 0–4 arrow chars (e.g. "Alice " or "Alice -")
  const beforeArrow = trimmed.match(/^(\S+?)(\s+[-<>x)]*|[-<>x)]{0,4})$/)
  if (beforeArrow && participants.includes(beforeArrow[1])) {
    const partial = beforeArrow[2].replace(/^\s+/, '')  // strip leading spaces from partial
    return {
      from: pos - partial.length,
      options: SEQ_ARROWS.map(a => ({ ...a, type: 'keyword' })),
    }
  }

  // ── Start of line: keywords + participant names + full-line snippets ──────
  // Fire when:
  //   a) User explicitly opened the popup (Ctrl+Space), OR
  //   b) There is at least one word character typed on this line (to avoid
  //      showing on every blank line without an explicit trigger)
  const word = currentWord(context)
  if (!context.explicit && !word) return null

  const from = word ? word.from : pos
  const msgSnippets = participants.flatMap(p => participantMessageSnippets(p, participants))

  return {
    from,
    options: [
      ...SEQ_KEYWORDS,
      ...participants.map(p => ({ label: p, detail: 'participant', info: 'Start a message line from this participant' })),
      ...msgSnippets,
    ],
  }
}

// ─── Flowchart ────────────────────────────────────────────────────────────────

const FLOW_DIRECTIONS = [
  { label: 'TD', detail: 'direction', info: 'Top → Down'   },
  { label: 'LR', detail: 'direction', info: 'Left → Right' },
  { label: 'BT', detail: 'direction', info: 'Bottom → Top' },
  { label: 'RL', detail: 'direction', info: 'Right → Left' },
]

const FLOW_ARROWS = [
  { label: '-->',       info: 'Solid arrow'              },
  { label: '---',       info: 'Solid line, no arrowhead' },
  { label: '-.',        info: 'Dotted line'              },
  { label: '-.->',      info: 'Dotted arrow'             },
  { label: '==>',       info: 'Thick arrow'              },
  { label: '--o',       info: 'Circle endpoint'          },
  { label: '--x',       info: 'Cross endpoint'           },
  { label: '<-->',      info: 'Bidirectional arrow'      },
  { label: '-- label -->', detail: 'labelled', info: 'Arrow with edge label' },
]

const FLOW_NODE_SHAPES = [
  snippetCompletion('[${label}]',   { label: '[label]',   detail: 'rectangle'  }),
  snippetCompletion('(${label})',   { label: '(label)',   detail: 'rounded'    }),
  snippetCompletion('{${label}}',   { label: '{label}',   detail: 'diamond'    }),
  snippetCompletion('((${label}))', { label: '((label))', detail: 'circle'     }),
  snippetCompletion('([${label}])', { label: '([label])', detail: 'stadium'    }),
  snippetCompletion('[[${label}]]', { label: '[[label]]', detail: 'subroutine' }),
  snippetCompletion('[(${label})]', { label: '[(label)]', detail: 'cylinder'   }),
  snippetCompletion('>${label}]',   { label: '>label]',   detail: 'asymmetric' }),
]

const FLOW_KEYWORDS = [
  snippetCompletion('subgraph ${title}\n    ${}\nend', {
    label: 'subgraph', detail: 'block',
  }),
  { label: 'end',       detail: 'keyword' },
  { label: 'direction', detail: 'keyword' },
  { label: 'click',     detail: 'keyword' },
  { label: 'style',     detail: 'keyword' },
  { label: 'classDef',  detail: 'keyword' },
  { label: 'class',     detail: 'keyword' },
  { label: 'linkStyle', detail: 'keyword' },
]

/** Collect node IDs from flowchart lines: A[label], A(label), A --> B, etc. */
function collectFlowNodes(state, block) {
  const seen = new Set()
  const shapeRe = /\b([A-Za-z_][\w]*)\s*(?:\[|\(|\{|>|\[\[|\(\()/g

  for (let i = block.start + 2; i < block.end; i++) {
    const text = state.doc.line(i).text.trim()
    if (!text || text.startsWith('%%')) continue
    if (/^(?:subgraph|end|classDef|class|style|click|direction|linkStyle)\b/.test(text)) continue

    let m
    while ((m = shapeRe.exec(text)) !== null) seen.add(m[1])
    // Bare IDs on edge lines: "A --> B"
    const edgeL = text.match(/^([A-Za-z_][\w]*)\s+(?:-->|---|==>|-\.|--o|--x)/)
    if (edgeL) seen.add(edgeL[1])
    const edgeR = text.match(/(?:-->|---|==>|-\.|--o|--x)\s+([A-Za-z_][\w]*)/)
    if (edgeR) seen.add(edgeR[1])
  }

  return [...seen]
}

function flowchartSource(context, state, block) {
  const { pos } = context
  const line    = state.doc.lineAt(pos)
  const before  = line.text.slice(0, pos - line.from).trimStart()
  const nodes   = collectFlowNodes(state, block)

  // First content line → direction after "graph|flowchart "
  if (line.number === block.start + 1) {
    const m = before.match(/^(?:graph|flowchart)\s+([\w]*)$/)
    if (m) {
      return { from: pos - m[1].length, options: FLOW_DIRECTIONS }
    }
  }

  // After "NodeId --> " → suggest existing node IDs as targets
  const afterArrow = before.match(/^.+?\s+(?:-->|---|==>|-\.->|--o|--x|<-->)\s+([\w]*)$/)
  if (afterArrow) {
    const partial = afterArrow[1]
    return {
      from: pos - partial.length,
      options: nodes.map(n => ({ label: n, detail: 'node' })),
    }
  }

  // After "NodeId " (before arrow) → offer arrows + shape brackets + existing nodes
  const afterNode = before.match(/^([A-Za-z_][\w]*)\s+([-=.<>|]*)$/)
  if (afterNode) {
    const partial = afterNode[2]
    const nodeOpts = nodes
      .filter(n => n !== afterNode[1])
      .map(n => ({ label: n, detail: 'node' }))
    return {
      from: pos - partial.length,
      options: [
        ...FLOW_ARROWS.map(a => ({ ...a, type: 'keyword' })),
        ...FLOW_NODE_SHAPES,
        ...nodeOpts,
      ],
    }
  }

  // Start of line / typing a word → keywords + existing node IDs
  const word = currentWord(context)
  if (!context.explicit && !word) return null

  const from = word ? word.from : pos
  return {
    from,
    options: [
      ...FLOW_KEYWORDS,
      ...nodes.map(n => ({ label: n, detail: 'node', info: 'Existing node ID' })),
    ],
  }
}

// ─── Top-level completion source ──────────────────────────────────────────────

const DIAGRAM_TYPES = [
  { label: 'sequenceDiagram', detail: 'diagram type' },
  { label: 'graph TD',        detail: 'diagram type', info: 'Flowchart top→down'   },
  { label: 'graph LR',        detail: 'diagram type', info: 'Flowchart left→right' },
  { label: 'flowchart TD',    detail: 'diagram type' },
  { label: 'classDiagram',    detail: 'diagram type' },
  { label: 'stateDiagram-v2', detail: 'diagram type' },
  { label: 'erDiagram',       detail: 'diagram type' },
  { label: 'gantt',           detail: 'diagram type' },
  { label: 'pie',             detail: 'diagram type' },
  { label: 'mindmap',         detail: 'diagram type' },
  { label: 'timeline',        detail: 'diagram type' },
  { label: 'quadrantChart',   detail: 'diagram type' },
]

export function mermaidCompletionSource(context) {
  const { state, pos } = context
  const block = getActiveMermaidBlock(state, pos)
  if (!block) return null

  const curLine = state.doc.lineAt(pos)

  // First content line → diagram type declarations
  if (curLine.number === block.start + 1) {
    const typedSoFar = curLine.text.slice(0, pos - curLine.from).trimStart()
    // Fire when the user has typed something on this line, or explicitly requested
    if (!context.explicit && !typedSoFar) return null
    const word = currentWord(context)
    const from = word ? word.from : pos
    return { from, options: DIAGRAM_TYPES }
  }

  const type = getDiagramType(state, block)
  if (type === 'sequence')  return sequenceSource(context, state, block)
  if (type === 'flowchart') return flowchartSource(context, state, block)

  return null
}

// ─── Extension export ─────────────────────────────────────────────────────────

export const mermaidCompletion = autocompletion({
  override: [mermaidCompletionSource, wikiLinkCompletionSource],
  activateOnTyping: true,
  activateOnTypingDelay: 50,
  maxRenderedOptions: 30,
  icons: false,
})
