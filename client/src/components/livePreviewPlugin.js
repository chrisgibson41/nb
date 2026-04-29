import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// ─── Widgets ─────────────────────────────────────────────────────────────────

class HRWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('div')
    el.className = 'cm-md-hr'
    return el
  }
  ignoreEvent() { return false }
}

class CheckboxWidget extends WidgetType {
  constructor(checked) { super(); this.checked = checked }
  eq(other) { return other.checked === this.checked }
  toDOM() {
    const el = document.createElement('input')
    el.type = 'checkbox'
    el.checked = this.checked
    el.disabled = true
    el.className = 'cm-md-checkbox'
    return el
  }
  ignoreEvent() { return false }
}

class BulletWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('span')
    el.textContent = '•'
    el.className = 'cm-md-bullet'
    return el
  }
  ignoreEvent() { return false }
}

// ─── Inline decoration parser ─────────────────────────────────────────────────
// Returns [{from, to, mark}] sorted by `from`, non-overlapping.
// `offset` is the absolute document position of `text[0]`.

function parseInline(text, offset) {
  const results = []
  const len = text.length
  let i = 0

  while (i < len) {
    const ch = text[i]

    // Bold+italic  ***text***
    if (ch === '*' && text[i+1] === '*' && text[i+2] === '*') {
      const end = text.indexOf('***', i + 3)
      if (end !== -1) {
        push(results, offset + i,     offset + i + 3, 'hide')
        push(results, offset + i + 3, offset + end,   'bold italic')
        push(results, offset + end,   offset + end + 3, 'hide')
        i = end + 3; continue
      }
    }
    // Bold  **text**
    if (ch === '*' && text[i+1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end !== -1 && end > i + 2) {
        push(results, offset + i,     offset + i + 2, 'hide')
        push(results, offset + i + 2, offset + end,   'bold')
        push(results, offset + end,   offset + end + 2, 'hide')
        i = end + 2; continue
      }
    }
    // Italic  *text*
    if (ch === '*' && text[i+1] !== '*') {
      const end = text.indexOf('*', i + 1)
      if (end !== -1 && end > i + 1) {
        push(results, offset + i,     offset + i + 1, 'hide')
        push(results, offset + i + 1, offset + end,   'italic')
        push(results, offset + end,   offset + end + 1, 'hide')
        i = end + 1; continue
      }
    }
    // Bold  __text__
    if (ch === '_' && text[i+1] === '_') {
      const end = text.indexOf('__', i + 2)
      if (end !== -1 && end > i + 2) {
        push(results, offset + i,     offset + i + 2, 'hide')
        push(results, offset + i + 2, offset + end,   'bold')
        push(results, offset + end,   offset + end + 2, 'hide')
        i = end + 2; continue
      }
    }
    // Italic  _text_
    if (ch === '_' && text[i+1] !== '_') {
      const end = text.indexOf('_', i + 1)
      if (end !== -1 && end > i + 1) {
        push(results, offset + i,     offset + i + 1, 'hide')
        push(results, offset + i + 1, offset + end,   'italic')
        push(results, offset + end,   offset + end + 1, 'hide')
        i = end + 1; continue
      }
    }
    // Strikethrough  ~~text~~
    if (ch === '~' && text[i+1] === '~') {
      const end = text.indexOf('~~', i + 2)
      if (end !== -1 && end > i + 2) {
        push(results, offset + i,     offset + i + 2, 'hide')
        push(results, offset + i + 2, offset + end,   'strike')
        push(results, offset + end,   offset + end + 2, 'hide')
        i = end + 2; continue
      }
    }
    // Inline code  `text`
    if (ch === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1 && end > i + 1) {
        push(results, offset + i,     offset + i + 1, 'hide')
        push(results, offset + i + 1, offset + end,   'code-span')
        push(results, offset + end,   offset + end + 1, 'hide')
        i = end + 1; continue
      }
    }
    // Link  [text](url)
    if (ch === '[') {
      const cb = text.indexOf(']', i + 1)
      if (cb !== -1 && text[cb + 1] === '(') {
        const cp = text.indexOf(')', cb + 2)
        if (cp !== -1) {
          push(results, offset + i,      offset + i + 1, 'hide')       // [
          push(results, offset + i + 1,  offset + cb,    'link')        // text
          push(results, offset + cb,     offset + cp + 1,'hide')        // ](url)
          i = cp + 1; continue
        }
      }
    }
    // Image  ![alt](url)  — show placeholder icon
    if (ch === '!' && text[i+1] === '[') {
      const cb = text.indexOf(']', i + 2)
      if (cb !== -1 && text[cb + 1] === '(') {
        const cp = text.indexOf(')', cb + 2)
        if (cp !== -1) {
          push(results, offset + i, offset + cp + 1, 'hide')
          i = cp + 1; continue
        }
      }
    }
    i++
  }

  // Filter overlapping ranges (keep first encountered, left-to-right)
  const out = []
  let lastEnd = -1
  for (const r of results) {
    if (r.from >= lastEnd) {
      out.push(r)
      lastEnd = r.to
    }
  }
  return out
}

function push(arr, from, to, type) {
  if (from < to) arr.push({ from, to, type })
}

function markForType(type) {
  switch (type) {
    case 'bold':        return Decoration.mark({ class: 'cm-md-bold' })
    case 'italic':      return Decoration.mark({ class: 'cm-md-italic' })
    case 'bold italic': return Decoration.mark({ class: 'cm-md-bold cm-md-italic' })
    case 'strike':      return Decoration.mark({ class: 'cm-md-strike' })
    case 'code-span':   return Decoration.mark({ class: 'cm-md-code-span' })
    case 'link':        return Decoration.mark({ class: 'cm-md-link' })
    case 'hide':        return Decoration.replace({})
    default:            return null
  }
}

// ─── Block decoration builder ─────────────────────────────────────────────────

function buildDecorations(view) {
  const { state } = view
  const builder = new RangeSetBuilder()

  // Which line numbers contain the cursor (1-indexed)
  const cursorLines = new Set()
  for (const range of state.selection.ranges) {
    const a = state.doc.lineAt(range.from).number
    const b = state.doc.lineAt(range.to).number
    for (let n = a; n <= b; n++) cursorLines.add(n)
  }

  // First pass: identify code-fence line ranges so we can handle them as blocks.
  // If cursor is anywhere inside a fence block, the whole block is "active" (raw).
  const fenceBlocks = []   // [{start, end}]  line numbers, inclusive
  let fenceStart = -1
  for (let n = 1; n <= state.doc.lines; n++) {
    const txt = state.doc.line(n).text
    if (/^(`{3,}|~{3,})/.test(txt)) {
      if (fenceStart === -1) { fenceStart = n }
      else { fenceBlocks.push({ start: fenceStart, end: n }); fenceStart = -1 }
    }
  }

  // Expand cursorLines to cover any fence block the cursor touches
  for (const block of fenceBlocks) {
    let touches = false
    for (let n = block.start; n <= block.end; n++) {
      if (cursorLines.has(n)) { touches = true; break }
    }
    if (touches) {
      for (let n = block.start; n <= block.end; n++) cursorLines.add(n)
    }
  }

  // Build a quick lookup for fence membership
  const inFenceContent = new Set()   // body lines (not the ``` markers)
  const isFenceMarker  = new Set()   // the ``` lines themselves
  for (const block of fenceBlocks) {
    isFenceMarker.add(block.start)
    isFenceMarker.add(block.end)
    for (let n = block.start + 1; n < block.end; n++) inFenceContent.add(n)
  }

  // Second pass: build decorations line by line
  for (let n = 1; n <= state.doc.lines; n++) {
    const line   = state.doc.line(n)
    const { text, from, to } = line
    const active = cursorLines.has(n)

    // ── Code fence markers (``` lang / ```)
    if (isFenceMarker.has(n)) {
      if (!active) {
        builder.add(from, from, Decoration.line({ class: 'cm-md-fence-marker' }))
      }
      continue
    }

    // ── Code fence body
    if (inFenceContent.has(n)) {
      if (!active) {
        builder.add(from, from, Decoration.line({ class: 'cm-md-fence-body' }))
      }
      continue
    }

    if (active) continue  // raw mode for cursor line

    // ── Horizontal rule  ---  ***  ___
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(text)) {
      builder.add(from, to, Decoration.replace({ widget: new HRWidget() }))
      continue
    }

    // ── Headings  # … ######
    const hm = text.match(/^(#{1,6}) (.*)$/)
    if (hm) {
      const level  = hm[1].length
      const prefix = level + 1           // '## '.length
      builder.add(from, from, Decoration.line({ class: `cm-md-h${level}` }))
      builder.add(from, from + prefix, Decoration.replace({}))  // hide '## '
      addInline(builder, text.slice(prefix), from + prefix)
      continue
    }

    // ── Blockquote  > …
    const bq = text.match(/^(> ?)/)
    if (bq) {
      builder.add(from, from, Decoration.line({ class: 'cm-md-blockquote' }))
      builder.add(from, from + bq[1].length, Decoration.replace({}))
      addInline(builder, text.slice(bq[1].length), from + bq[1].length)
      continue
    }

    // ── Task list  - [ ] / - [x]
    const tm = text.match(/^(\s*)([-*+] \[[ x]\] )/)
    if (tm) {
      const checked  = tm[2].includes('[x]')
      const indent   = tm[1].length
      const markEnd  = from + indent + tm[2].length
      builder.add(from + indent, markEnd, Decoration.replace({ widget: new CheckboxWidget(checked) }))
      addInline(builder, text.slice(indent + tm[2].length), markEnd)
      continue
    }

    // ── Unordered list  - / * / +
    const ul = text.match(/^(\s*)([-*+] )/)
    if (ul) {
      const indent  = ul[1].length
      const markEnd = from + indent + ul[2].length
      builder.add(from + indent, markEnd, Decoration.replace({ widget: new BulletWidget() }))
      addInline(builder, text.slice(indent + ul[2].length), markEnd)
      continue
    }

    // ── Ordered list  1. / 2. etc — keep number, just style content
    const ol = text.match(/^(\s*\d+\. )/)
    if (ol) {
      addInline(builder, text.slice(ol[1].length), from + ol[1].length)
      continue
    }

    // ── Regular line
    if (text.trim()) {
      addInline(builder, text, from)
    }
  }

  return builder.finish()
}

function addInline(builder, text, offset) {
  const decs = parseInline(text, offset)
  for (const { from, to, type } of decs) {
    const mark = markForType(type)
    if (mark) builder.add(from, to, mark)
  }
}

// ─── Export plugin ────────────────────────────────────────────────────────────

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) { this.decorations = buildDecorations(view) }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: v => v.decorations }
)
