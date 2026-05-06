import { autocompletion, snippetCompletion } from '@codemirror/autocomplete'
import { parseFenceBlocks } from './livePreviewPlugin.js'

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

// ─── Sequence: participant collection ────────────────────────────────────────
// Gathers names from explicit declarations AND implicit usage in message lines,
// note lines, activate/deactivate lines, and box blocks.

const SEQ_ARROW_RE = /(?:--?>>?|--?x|--?\)|->)/

function collectParticipants(state, block) {
  const seen = new Set()
  const add   = (name) => { const n = name?.trim(); if (n && n.length > 0) seen.add(n) }

  for (let i = block.start + 1; i < block.end; i++) {
    const text = state.doc.line(i).text.trim()
    if (!text || text.startsWith('%%')) continue

    // participant Alice  /  participant Alice as A
    const decl = text.match(/^(?:participant|actor)\s+(.+?)(?:\s+as\s+\S+)?$/)
    if (decl) { add(decl[1]); continue }

    // Alice ->> Bob: message
    const msg = text.match(/^(.+?)\s+(?:--?>>?|--?x|--?\)|->)\s+(.+?)(?:\s*:.*)?$/)
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
  { label: '->>', info: 'Solid line, filled arrowhead' },
  { label: '-->>', info: 'Dotted line, filled arrowhead' },
  { label: '->', info: 'Solid line, open arrow' },
  { label: '-->', info: 'Dotted line, open arrow' },
  { label: '-x', info: 'Solid line, cross (destroy)' },
  { label: '--x', info: 'Dotted line, cross (destroy)' },
  { label: '-)', info: 'Solid line, async' },
  { label: '--)', info: 'Dotted line, async' },
]

const SEQ_ACTIVATING_ARROWS = [
  { label: '->>+', info: 'Solid arrow + activate target' },
  { label: '-->>', info: 'Dotted line, filled arrowhead' },
  { label: '->>-', info: 'Solid arrow + deactivate target' },
]

const SEQ_NOTE_POSITIONS = [
  { label: 'over',     detail: 'position', info: 'note over Alice'         },
  { label: 'left of',  detail: 'position', info: 'note left of Alice'       },
  { label: 'right of', detail: 'position', info: 'note right of Alice'      },
]

const SEQ_BLOCK_SNIPPETS = [
  snippetCompletion('loop ${condition}\n    ${}\nend', {
    label: 'loop', detail: 'block', info: 'Repeat while condition is true',
  }),
  snippetCompletion('alt ${condition}\n    ${}\nelse ${alternative}\n    ${}\nend', {
    label: 'alt', detail: 'block', info: 'Conditional branch (if/else)',
  }),
  snippetCompletion('opt ${condition}\n    ${}\nend', {
    label: 'opt', detail: 'block', info: 'Optional interaction',
  }),
  snippetCompletion('par ${label}\n    ${}\nand ${label2}\n    ${}\nend', {
    label: 'par', detail: 'block', info: 'Parallel interactions',
  }),
  snippetCompletion('rect ${color}\n    ${}\nend', {
    label: 'rect', detail: 'block', info: 'Coloured highlight region',
  }),
  snippetCompletion('critical ${resource}\n    ${}\noption ${alternative}\n    ${}\nend', {
    label: 'critical', detail: 'block', info: 'Critical section with fallback',
  }),
  snippetCompletion('box ${title}\n    participant ${}\nend', {
    label: 'box', detail: 'block', info: 'Group participants in a labelled box',
  }),
]

const SEQ_KEYWORDS = [
  { label: 'participant', detail: 'keyword', info: 'Declare a participant (rectangle)'   },
  { label: 'actor',       detail: 'keyword', info: 'Declare a participant (stick person)' },
  { label: 'activate',    detail: 'keyword', info: 'Show activation bar on a participant' },
  { label: 'deactivate',  detail: 'keyword', info: 'Remove activation bar'               },
  { label: 'note',        detail: 'keyword', info: 'Add a note: note over A: text'       },
  { label: 'autonumber',  detail: 'keyword', info: 'Auto-number each arrow'              },
  { label: 'end',         detail: 'keyword', info: 'Close a block (loop/alt/opt/par/rect)' },
  ...SEQ_BLOCK_SNIPPETS,
]

/** Message-line snippets for a known sender: "Alice ->> ${Bob}: ${msg}" */
function participantMessageSnippets(sender, allParticipants) {
  const others = allParticipants.filter(p => p !== sender)
  const target = others.length ? others[0] : 'Receiver'
  return [
    snippetCompletion(`${sender} ->> \${${target}}: \${message}`, {
      label:  `${sender} ->>`,
      detail: 'message',
      info:   'Solid arrow to another participant',
    }),
    snippetCompletion(`${sender} -->> \${${target}}: \${message}`, {
      label:  `${sender} -->>`,
      detail: 'message (dotted)',
      info:   'Dotted reply arrow',
    }),
    snippetCompletion(`${sender} ->> \${${target}}: \${message}\nactivate \${${target}}\n\${}\ndeactivate \${${target}}`, {
      label:  `${sender} ->> … activate`,
      detail: 'message + activate',
      info:   'Send message and show activation bar on target',
    }),
  ]
}

// ─── Sequence completion source ───────────────────────────────────────────────

function sequenceSource(context, state, block) {
  const { pos } = context
  const line    = state.doc.lineAt(pos)
  const before  = line.text.slice(0, pos - line.from)
  const trimmed = before.trimStart()

  const participants = collectParticipants(state, block)

  // ── "note " → position keywords ──────────────────────────────────────────
  if (/^note\s+$/i.test(trimmed)) {
    return { from: pos, options: SEQ_NOTE_POSITIONS }
  }

  // ── "note over|left of|right of " → participant names ────────────────────
  if (/^note\s+(?:over|left of|right of)\s+/i.test(trimmed)) {
    const partial = trimmed.match(/[\w]*$/)?.[0] ?? ''
    return {
      from: pos - partial.length,
      options: participants.map(p => ({ label: p, detail: 'participant' })),
    }
  }

  // ── "participant|actor " → participant names (for re-ordering / aliasing) ─
  if (/^(?:participant|actor)\s+[\w]*$/i.test(trimmed) && participants.length) {
    const partial = trimmed.match(/[\w]*$/)?.[0] ?? ''
    const nameOpts = participants.map(p => ({ label: p, detail: 'participant' }))
    const aliasSnippet = participants.map(p =>
      snippetCompletion(`${p} as \${alias}`, { label: `${p} as`, detail: 'alias', info: 'Declare with display alias' })
    )
    return { from: pos - partial.length, options: [...nameOpts, ...aliasSnippet] }
  }

  // ── "activate|deactivate " → participant names ────────────────────────────
  if (/^(?:activate|deactivate)\s+[\w]*$/i.test(trimmed) && participants.length) {
    const partial = trimmed.match(/[\w]*$/)?.[0] ?? ''
    return {
      from: pos - partial.length,
      options: participants.map(p => ({ label: p, detail: 'participant' })),
    }
  }

  // ── "Sender Arrow Target" (no colon yet) → suggest ": message" ───────────
  // e.g. "Alice ->> Bob" — offer colon to complete the message separator
  const noColon = trimmed.match(/^(\S+)\s+(?:--?>>?|--?x|--?\)|->[\+\-]?)\s+(\S+)$/)
  if (noColon) {
    return {
      from: pos,
      options: [{ label: ': ', detail: 'message separator', info: 'Add message text after the colon' }],
    }
  }

  // ── "Sender Arrow " → suggest target participant names ───────────────────
  const afterArrow = trimmed.match(/^(\S+)\s+(?:--?>>?|--?x|--?\)|->[\+\-]?)\s+([\w]*)$/)
  if (afterArrow) {
    const partial = afterArrow[2]
    return {
      from: pos - partial.length,
      options: participants.map(p => ({ label: p, detail: 'participant' })),
    }
  }

  // ── "Sender " → suggest arrow types ──────────────────────────────────────
  const beforeArrow = trimmed.match(/^(\S+)\s+(-{0,2}[>x)\+]*)$/)
  if (beforeArrow) {
    const partial = beforeArrow[2]
    return {
      from: pos - partial.length,
      options: [...SEQ_ARROWS, ...SEQ_ACTIVATING_ARROWS].map(a => ({ ...a, type: 'keyword' })),
    }
  }

  // ── Start of line / partial keyword or participant name ───────────────────
  if (!context.explicit && !trimmed) return null

  const wordMatch = trimmed.match(/^([\w][\w ]*)$/)
  if (wordMatch || context.explicit) {
    const partial  = wordMatch ? wordMatch[1] : ''
    // Full-line snippets for each known participant
    const msgSnippets = participants.flatMap(p => participantMessageSnippets(p, participants))
    return {
      from: pos - partial.length,
      options: [
        ...SEQ_KEYWORDS,
        ...participants.map(p => ({ label: p, detail: 'participant', info: 'Start a message line from this participant' })),
        ...msgSnippets,
      ],
    }
  }

  return null
}

// ─── Flowchart ────────────────────────────────────────────────────────────────

const FLOW_DIRECTIONS = [
  { label: 'TD', detail: 'direction', info: 'Top → Down'   },
  { label: 'LR', detail: 'direction', info: 'Left → Right' },
  { label: 'BT', detail: 'direction', info: 'Bottom → Top' },
  { label: 'RL', detail: 'direction', info: 'Right → Left' },
]

const FLOW_ARROWS = [
  { label: '-->',   info: 'Solid arrow'                           },
  { label: '---',   info: 'Solid line, no arrowhead'              },
  { label: '-.',     info: 'Dotted line'                          },
  { label: '-.->',  info: 'Dotted arrow'                          },
  { label: '==>',   info: 'Thick arrow'                           },
  { label: '--o',   info: 'Circle endpoint'                       },
  { label: '--x',   info: 'Cross endpoint'                        },
  { label: '<-->',  info: 'Bidirectional arrow'                   },
  { label: '-- label -->', detail: 'labelled', info: 'Arrow with edge label' },
  { label: '|label|',       detail: 'labelled', info: 'Alternate edge label syntax' },
]

/** Node shape completions inserted after a node ID: A[text], A(text), etc. */
const FLOW_NODE_SHAPES = [
  snippetCompletion('[${label}]',    { label: '[label]',    detail: 'rectangle',        info: 'A[Rectangle]'       }),
  snippetCompletion('(${label})',    { label: '(label)',    detail: 'rounded',          info: 'A(Rounded)'         }),
  snippetCompletion('{${label}}',    { label: '{label}',    detail: 'diamond/decision', info: 'A{Diamond}'         }),
  snippetCompletion('((${label}))',  { label: '((label))',  detail: 'circle',           info: 'A((Circle))'        }),
  snippetCompletion('([${label}])',  { label: '([label])',  detail: 'stadium',          info: 'A([Stadium])'       }),
  snippetCompletion('[[${label}]]',  { label: '[[label]]',  detail: 'subroutine',       info: 'A[[Subroutine]]'    }),
  snippetCompletion('[(${label})]',  { label: '[(label)]',  detail: 'cylinder',         info: 'A[(Cylinder/DB)]'   }),
  snippetCompletion('>${label}]',    { label: '>label]',    detail: 'asymmetric',       info: 'A>Asymmetric]'      }),
]

const FLOW_KEYWORDS = [
  snippetCompletion('subgraph ${title}\n    ${}\nend', {
    label: 'subgraph', detail: 'block', info: 'Grouped subgraph',
  }),
  { label: 'end',       detail: 'keyword'                                        },
  { label: 'direction', detail: 'keyword', info: 'direction LR  (inside subgraph)' },
  { label: 'click',     detail: 'keyword', info: 'click NodeId callback "tooltip"' },
  { label: 'style',     detail: 'keyword', info: 'style NodeId fill:#f9f,stroke:#333' },
  { label: 'classDef',  detail: 'keyword', info: 'classDef myClass fill:#f9f'        },
  { label: 'class',     detail: 'keyword', info: 'class NodeA,NodeB myClass'          },
  { label: 'linkStyle', detail: 'keyword', info: 'linkStyle 0 stroke:#ff3'            },
]

/** Extract node IDs from flowchart lines like "A[label]", "B --> C", "B(label)" */
function collectFlowNodes(state, block) {
  const seen = new Set()
  const nodeIdRe = /\b([A-Za-z_][\w]*)\s*(?:\[|\(|\{|>|\[\[|\(\()/g

  for (let i = block.start + 2; i < block.end; i++) {
    const text = state.doc.line(i).text.trim()
    if (!text || text.startsWith('%%')) continue
    // Skip pure keyword lines
    if (/^(?:subgraph|end|classDef|class|style|click|direction|linkStyle)\b/.test(text)) continue

    let m
    while ((m = nodeIdRe.exec(text)) !== null) seen.add(m[1])
    // Also pick up bare IDs in edge lines: "A --> B"
    const edgeMatch = text.match(/^([A-Za-z_][\w]*)\s+(?:-->|---|==>|-\.|--o|--x)/)
    if (edgeMatch) seen.add(edgeMatch[1])
    const edgeTarget = text.match(/(?:-->|---|==>|-\.|--o|--x)\s+([A-Za-z_][\w]*)/)
    if (edgeTarget) seen.add(edgeTarget[1])
  }

  return [...seen]
}

function flowchartSource(context, state, block) {
  const { pos }  = context
  const line     = state.doc.lineAt(pos)
  const before   = line.text.slice(0, pos - line.from).trimStart()
  const nodes    = collectFlowNodes(state, block)

  // First content line: direction after "graph|flowchart "
  if (line.number === block.start + 1) {
    const m = before.match(/^(?:graph|flowchart)\s+([\w]*)$/)
    if (m) return { from: pos - m[1].length, options: FLOW_DIRECTIONS }
  }

  // After "NodeId " → offer arrows and node shape definitions
  const afterNode = before.match(/^([A-Za-z_][\w]*)\s+([-=.<>|]*)$/)
  if (afterNode) {
    const partial = afterNode[2]
    const nodeOpts = nodes
      .filter(n => n !== afterNode[1])
      .map(n => ({ label: n, detail: 'node', info: `Connect to existing node ${n}` }))
    return {
      from: pos - partial.length,
      options: [
        ...FLOW_ARROWS.map(a => ({ ...a, type: 'keyword' })),
        ...FLOW_NODE_SHAPES,
        ...nodeOpts,
      ],
    }
  }

  // After "NodeId --> " → suggest target node IDs
  const afterArrow = before.match(/^.+?\s+(?:-->|---|==>|-\.->|--o|--x|<-->)\s+([\w]*)$/)
  if (afterArrow) {
    const partial = afterArrow[1]
    return {
      from: pos - partial.length,
      options: nodes.map(n => ({ label: n, detail: 'node' })),
    }
  }

  // Keyword / node ID at start of line
  const wordMatch = before.match(/^([\w]*)$/)
  if (wordMatch || context.explicit) {
    const partial = wordMatch ? wordMatch[1] : ''
    const nodeOpts = nodes.map(n => ({ label: n, detail: 'node', info: 'Existing node ID' }))
    return {
      from: pos - partial.length,
      options: [...FLOW_KEYWORDS, ...nodeOpts],
    }
  }

  return null
}

// ─── Top-level completion source ──────────────────────────────────────────────

const DIAGRAM_TYPES = [
  { label: 'sequenceDiagram',  detail: 'diagram type'                           },
  { label: 'graph TD',         detail: 'diagram type', info: 'Flowchart top→down'   },
  { label: 'graph LR',         detail: 'diagram type', info: 'Flowchart left→right' },
  { label: 'flowchart TD',     detail: 'diagram type'                           },
  { label: 'classDiagram',     detail: 'diagram type'                           },
  { label: 'stateDiagram-v2',  detail: 'diagram type'                           },
  { label: 'erDiagram',        detail: 'diagram type'                           },
  { label: 'gantt',            detail: 'diagram type'                           },
  { label: 'pie',              detail: 'diagram type'                           },
  { label: 'mindmap',          detail: 'diagram type'                           },
  { label: 'timeline',         detail: 'diagram type'                           },
  { label: 'quadrantChart',    detail: 'diagram type'                           },
]

export function mermaidCompletionSource(context) {
  const { state, pos } = context
  const block = getActiveMermaidBlock(state, pos)
  if (!block) return null

  const curLine = state.doc.lineAt(pos)
  const partial = curLine.text.slice(0, pos - curLine.from).trimStart()

  // First content line of block → diagram type declarations
  if (curLine.number === block.start + 1) {
    return { from: pos - partial.length, options: DIAGRAM_TYPES }
  }

  const type = getDiagramType(state, block)
  if (type === 'sequence')  return sequenceSource(context, state, block)
  if (type === 'flowchart') return flowchartSource(context, state, block)

  return null
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const mermaidCompletion = autocompletion({
  override: [mermaidCompletionSource],
  activateOnTyping: true,
  maxRenderedOptions: 25,
  icons: false,
})
