import { ViewPlugin, Decoration, WidgetType, EditorView } from '@codemirror/view'
import { RangeSetBuilder, StateField } from '@codemirror/state'

// ─── Mermaid ──────────────────────────────────────────────────────────────────

let mermaidModule = null  // cached after first import

async function getMermaid() {
  if (!mermaidModule) {
    const { default: m } = await import('mermaid')
    m.initialize({
      startOnLoad: false,
      theme: 'dark',
      darkMode: true,
      themeVariables: {
        background: '#1e1e1e',
        primaryColor: '#2d5986',
        primaryTextColor: '#cccccc',
        lineColor: '#666',
        edgeLabelBackground: '#252526',
        tertiaryColor: '#252526',
      },
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: 13,
    })
    mermaidModule = m
  }
  return mermaidModule
}

let diagramSeq = 0

// ─── Mermaid context menu (copy / download) ───────────────────────────────────

function svgToPngBlob(svgEl) {
  return new Promise((resolve, reject) => {
    const bbox = svgEl.getBoundingClientRect()
    const scale = window.devicePixelRatio || 1
    const w = Math.ceil(bbox.width  * scale) || 800
    const h = Math.ceil(bbox.height * scale) || 600

    const svgClone = svgEl.cloneNode(true)
    svgClone.setAttribute('width',  w)
    svgClone.setAttribute('height', h)
    const svgData = new XMLSerializer().serializeToString(svgClone)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#1e1e1e'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/png')
    }
    img.onerror = reject
    img.src = url
  })
}

function showMermaidContextMenu(event, svgEl) {
  // Remove any existing menu
  document.querySelectorAll('.cm-mermaid-ctx-menu').forEach(el => el.remove())

  const menu = document.createElement('div')
  menu.className = 'cm-mermaid-ctx-menu'
  Object.assign(menu.style, {
    position:     'fixed',
    left:         `${event.clientX}px`,
    top:          `${event.clientY}px`,
    background:   '#2d2d2d',
    border:       '1px solid #444',
    borderRadius: '6px',
    padding:      '4px 0',
    zIndex:       '99999',
    boxShadow:    '0 4px 16px rgba(0,0,0,0.5)',
    minWidth:     '160px',
    fontFamily:   'Inter, -apple-system, sans-serif',
    fontSize:     '13px',
  })

  function menuItem(label, onClick) {
    const item = document.createElement('div')
    item.textContent = label
    Object.assign(item.style, {
      padding:    '7px 16px',
      color:      '#ccc',
      cursor:     'pointer',
      userSelect: 'none',
    })
    item.addEventListener('mouseenter', () => { item.style.background = '#3e3e3e' })
    item.addEventListener('mouseleave', () => { item.style.background = '' })
    item.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); close() })
    menu.appendChild(item)
  }

  function close() {
    menu.remove()
    document.removeEventListener('mousedown', outsideClick, true)
  }

  function outsideClick(e) {
    if (!menu.contains(e.target)) close()
  }

  menuItem('Copy image', async () => {
    try {
      const blob = await svgToPngBlob(svgEl)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch (err) {
      console.error('Mermaid copy failed:', err)
    }
  })

  menuItem('Download PNG', async () => {
    try {
      const blob = await svgToPngBlob(svgEl)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'diagram.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Mermaid download failed:', err)
    }
  })

  menuItem('Copy SVG source', () => {
    const svgData = new XMLSerializer().serializeToString(svgEl)
    navigator.clipboard.writeText(svgData).catch(console.error)
  })

  document.body.appendChild(menu)

  // Adjust position if menu clips viewport
  const rect = menu.getBoundingClientRect()
  if (rect.right  > window.innerWidth)  menu.style.left = `${event.clientX - rect.width}px`
  if (rect.bottom > window.innerHeight) menu.style.top  = `${event.clientY - rect.height}px`

  document.addEventListener('mousedown', outsideClick, true)
}

class MermaidWidget extends WidgetType {
  constructor(code, blockFrom) { super(); this.code = code; this.blockFrom = blockFrom }
  eq(other) { return other.code === this.code }

  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-mermaid'

    // Left-click: move cursor inside block to edit
    const editHandler = (event) => {
      event.preventDefault()
      view.dispatch({ selection: { anchor: this.blockFrom }, userEvent: 'select' })
      view.focus()
    }
    wrap.addEventListener('mousedown', editHandler)

    // Right-click: show copy/download context menu
    wrap.addEventListener('contextmenu', (event) => {
      const svgEl = wrap.querySelector('svg')
      if (!svgEl) return  // error state — allow default
      event.preventDefault()
      showMermaidContextMenu(event, svgEl)
    })

    ;(async () => {
      try {
        const m = await getMermaid()
        const id = `mermaid-cm-${++diagramSeq}`
        const { svg } = await m.render(id, this.code)
        wrap.innerHTML = svg
        const svgEl = wrap.querySelector('svg')
        if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.height = 'auto' }
        // Re-attach handlers after innerHTML wipe removes them
        wrap.addEventListener('mousedown', editHandler)
        wrap.addEventListener('contextmenu', (event) => {
          const s = wrap.querySelector('svg')
          if (!s) return
          event.preventDefault()
          showMermaidContextMenu(event, s)
        })
      } catch (err) {
        wrap.className = 'cm-md-mermaid cm-md-mermaid-error'
        const msg = document.createElement('div')
        msg.className = 'cm-md-mermaid-error-msg'
        msg.textContent = `Mermaid: ${err.message ?? err}`
        wrap.appendChild(msg)
      }
    })()

    return wrap
  }

  ignoreEvent() { return true }
}

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

// ─── Shared fence block parser ────────────────────────────────────────────────

function parseFenceBlocks(state) {
  const blocks = []
  let fenceStart = -1
  let fenceLang = ''
  for (let n = 1; n <= state.doc.lines; n++) {
    const txt = state.doc.line(n).text
    const fm = txt.match(/^(`{3,}|~{3,})(\w*)/)
    if (fm) {
      if (fenceStart === -1) { fenceStart = n; fenceLang = fm[2].toLowerCase() }
      else { blocks.push({ start: fenceStart, end: n, lang: fenceLang }); fenceStart = -1; fenceLang = '' }
    }
  }
  return blocks
}

function getCursorLines(state, fenceBlocks) {
  const cursorLines = new Set()
  for (const range of state.selection.ranges) {
    const a = state.doc.lineAt(range.from).number
    const b = state.doc.lineAt(range.to).number
    for (let n = a; n <= b; n++) cursorLines.add(n)
  }
  // Expand to cover any fence block the cursor touches
  for (const block of fenceBlocks) {
    let touches = false
    for (let n = block.start; n <= block.end; n++) {
      if (cursorLines.has(n)) { touches = true; break }
    }
    if (touches) {
      for (let n = block.start; n <= block.end; n++) cursorLines.add(n)
    }
  }
  return cursorLines
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

// ─── Mermaid block decorations (StateField — only source allowed for block:true)
// ViewPlugin and EditorView.decorations.of() are both "plugin" sources which
// CodeMirror forbids from providing block decorations. StateField is required.

function buildMermaidDecorationsFromState(state) {
  try {
    const builder = new RangeSetBuilder()
    const fenceBlocks = parseFenceBlocks(state)
    const cursorLines = getCursorLines(state, fenceBlocks)

    for (const block of fenceBlocks) {
      if (block.lang !== 'mermaid') continue
      // Show raw when cursor is anywhere inside this block
      let active = false
      for (let n = block.start; n <= block.end; n++) {
        if (cursorLines.has(n)) { active = true; break }
      }
      if (active) continue

      let code = ''
      for (let i = block.start + 1; i < block.end; i++) {
        code += state.doc.line(i).text + '\n'
      }
      const blockFrom = state.doc.line(block.start).from
      const lastLine  = state.doc.line(block.end)
      const blockTo   = block.end < state.doc.lines ? lastLine.to + 1 : lastLine.to
      builder.add(blockFrom, blockTo, Decoration.replace({ widget: new MermaidWidget(code.trim(), blockFrom), block: true }))
    }
    return builder.finish()
  } catch (e) {
    return new RangeSetBuilder().finish()
  }
}

const mermaidBlockField = StateField.define({
  create(state) { return buildMermaidDecorationsFromState(state) },
  update(deco, tr) {
    if (tr.docChanged || tr.selection) return buildMermaidDecorationsFromState(tr.state)
    return deco
  },
  provide: f => EditorView.decorations.from(f),
})

// ─── Inline/block decoration builder (ViewPlugin — no block: true allowed) ───

function buildDecorations(view) {
  try {
    const { state } = view
    const builder = new RangeSetBuilder()
    const fenceBlocks = parseFenceBlocks(state)
    const cursorLines = getCursorLines(state, fenceBlocks)

    // Build a quick lookup for fence membership
    const inFenceContent = new Set()   // body lines (not the ``` markers)
    const isFenceMarker  = new Set()   // the ``` lines themselves
    const fenceByStart   = new Map()   // start line → block info
    for (const block of fenceBlocks) {
      isFenceMarker.add(block.start)
      isFenceMarker.add(block.end)
      fenceByStart.set(block.start, block)
      for (let n = block.start + 1; n < block.end; n++) inFenceContent.add(n)
    }

    // Build decorations line by line
    for (let n = 1; n <= state.doc.lines; n++) {
      const line   = state.doc.line(n)
      const { text, from, to } = line
      const active = cursorLines.has(n)

      // ── Code fence markers (``` lang / ```)
      if (isFenceMarker.has(n)) {
        const block = fenceByStart.get(n)  // only set on opening marker

        // Mermaid block (cursor outside): skip — mermaidBlockPlugin replaces it
        if (block && block.lang === 'mermaid' && !active) {
          n = block.end  // skip to closing marker (loop will n++ past it)
          continue
        }

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
  } catch (e) {
    return new RangeSetBuilder().finish()
  }
}

function addInline(builder, text, offset) {
  const decs = parseInline(text, offset)
  for (const { from, to, type } of decs) {
    const mark = markForType(type)
    if (mark) builder.add(from, to, mark)
  }
}

// ─── Export plugin ────────────────────────────────────────────────────────────
// Exported as an array so both extensions are registered together.

// After a mermaid block re-renders (cursor moved out), the widget gains height
// and pushes the cursor off-screen. Scroll to cursor after layout settles.
const mermaidScrollListener = EditorView.updateListener.of(update => {
  if (!update.selectionSet && !update.docChanged) return
  const before = update.startState.field(mermaidBlockField, false)
  const after  = update.state.field(mermaidBlockField, false)
  if (before === after) return
  requestAnimationFrame(() => {
    const cursor = update.view.state.selection.main.head
    update.view.dispatch({
      effects: EditorView.scrollIntoView(cursor, { y: 'nearest' })
    })
  })
})

export const livePreviewPlugin = [
  mermaidBlockField,
  mermaidScrollListener,
  ViewPlugin.fromClass(
    class {
      constructor(view) { this.decorations = buildDecorations(view) }
      update(update) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: v => v.decorations }
  ),
]
