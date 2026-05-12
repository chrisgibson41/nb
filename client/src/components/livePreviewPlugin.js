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
      if (window.electronAPI) {
        // Electron: show native Save dialog so the user picks the location
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1]
          await window.electronAPI.savePNG(base64, 'diagram.png')
        }
        reader.readAsDataURL(blob)
      } else {
        // Browser fallback
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href     = url
        a.download = 'diagram.png'
        a.click()
        URL.revokeObjectURL(url)
      }
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

    // Left-click only: move cursor inside block to edit
    const editHandler = (event) => {
      if (event.button !== 0) return  // ignore right-click / middle-click
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
  constructor(checked, from) { super(); this.checked = checked; this.from = from }
  eq(other) { return other.checked === this.checked && other.from === this.from }

  toDOM(view) {
    const el = document.createElement('input')
    el.type = 'checkbox'
    el.checked = this.checked
    el.className = 'cm-md-checkbox'
    el.addEventListener('mousedown', (e) => {
      e.preventDefault() // prevent editor focus steal
      e.stopPropagation()
    })
    el.addEventListener('change', () => {
      // Toggle [ ] ↔ [x] in the source at the known offset
      const doc   = view.state.doc.toString()
      const tick  = el.checked ? 'x' : ' '
      // find [x] or [ ] starting from this.from
      const re    = /\[[ x]\]/
      const slice = doc.slice(this.from, this.from + 5)
      const m     = re.exec(slice)
      if (m === null) return
      const pos = this.from + m.index + 1   // position of the space/x
      view.dispatch({
        changes: { from: pos, to: pos + 1, insert: tick },
        userEvent: 'input',
      })
    })
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

// ─── YAML frontmatter ────────────────────────────────────────────────────────

// Detect frontmatter block (must start at line 1 with '---')
function parseFrontmatter(state) {
  if (state.doc.lines < 2) return null
  if (state.doc.line(1).text.trim() !== '---') return null
  for (let n = 2; n <= Math.min(state.doc.lines, 60); n++) {
    if (state.doc.line(n).text.trim() === '---') return { start: 1, end: n }
  }
  return null
}

// Minimal YAML parser — handles the subset used in note frontmatter
function parseSimpleYaml(text) {
  const result = {}
  const lines = text.split('\n')
  let currentKey = null

  for (const line of lines) {
    if (!line.trim()) continue
    // List item under the current key
    if (/^[ \t]+-/.test(line) && currentKey) {
      const val = line.replace(/^[ \t]+-\s*/, '').trim().replace(/^['"]|['"]$/g, '')
      if (!Array.isArray(result[currentKey])) result[currentKey] = []
      result[currentKey].push(val)
      continue
    }
    // key: value  |  key: [a, b]  |  key:
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/)
    if (!m) continue
    currentKey = m[1]
    const raw = m[2].trim()
    if (!raw) {
      result[currentKey] = []
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      result[currentKey] = raw.slice(1, -1)
        .split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    } else {
      result[currentKey] = raw.replace(/^['"]|['"]$/g, '')
    }
  }
  return result
}

function formatDate(str) {
  try {
    const d = new Date(str + 'T00:00:00')
    if (isNaN(d)) return str
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return str }
}

class FrontmatterWidget extends WidgetType {
  constructor(yamlText, blockFrom) {
    super()
    this.yamlText = yamlText
    this.blockFrom = blockFrom
  }
  eq(other) { return other.yamlText === this.yamlText }

  toDOM(view) {
    const fields = parseSimpleYaml(this.yamlText)

    const bar = document.createElement('div')
    bar.className = 'cm-md-fm-bar'
    bar.title = 'Click to edit'

    // Left-click on the bar → move cursor into frontmatter for editing
    bar.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return  // ignore right-click / middle-click
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.blockFrom + 4 }, userEvent: 'select' })
      view.focus()
    })

    // Date
    if (fields.date) {
      const el = document.createElement('span')
      el.className = 'cm-fm-date'
      el.textContent = formatDate(fields.date)
      bar.appendChild(el)
    }

    // Tags as pills
    const tags = fields.tags
    if (tags && (Array.isArray(tags) ? tags.length : true)) {
      const list = Array.isArray(tags) ? tags : [tags]
      const wrap = document.createElement('span')
      wrap.className = 'cm-fm-tags'
      list.forEach(tag => {
        const pill = document.createElement('span')
        pill.className = 'cm-fm-tag'
        pill.textContent = '#' + tag
        wrap.appendChild(pill)
      })
      bar.appendChild(wrap)
    }

    // All other fields (skip private _keys, date, tags already rendered)
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'date' || k === 'tags' || k.startsWith('_')) continue
      const el = document.createElement('span')
      el.className = 'cm-fm-field'
      const kEl = document.createElement('span')
      kEl.className = 'cm-fm-key'
      kEl.textContent = k
      const vEl = document.createElement('span')
      vEl.className = 'cm-fm-val'
      vEl.textContent = Array.isArray(v) ? v.join(', ') : String(v)
      el.appendChild(kEl)
      el.appendChild(vEl)
      bar.appendChild(el)
    }

    // If frontmatter has no displayable fields at all, show a placeholder
    if (!bar.children.length) {
      const ph = document.createElement('span')
      ph.className = 'cm-fm-empty'
      ph.textContent = 'Properties'
      bar.appendChild(ph)
    }

    return bar
  }

  ignoreEvent() { return true }
}

function buildFrontmatterDecoration(state) {
  try {
    const fm = parseFrontmatter(state)
    if (!fm) return new RangeSetBuilder().finish()

    // Show raw YAML only when cursor is between the two --- delimiters.
    // Cursor on the opening --- line (line 1 / fm.start) does NOT count —
    // that's where it lands on file-open, and we still want to show the widget.
    for (const range of state.selection.ranges) {
      const a = state.doc.lineAt(range.from).number
      const b = state.doc.lineAt(range.to).number
      if (a <= fm.end && b > fm.start) return new RangeSetBuilder().finish()
    }

    let yamlText = ''
    for (let n = fm.start + 1; n < fm.end; n++) {
      yamlText += state.doc.line(n).text + '\n'
    }

    const blockFrom = state.doc.line(fm.start).from
    const lastLine  = state.doc.line(fm.end)
    const blockTo   = fm.end < state.doc.lines ? lastLine.to + 1 : lastLine.to

    const builder = new RangeSetBuilder()
    builder.add(blockFrom, blockTo, Decoration.replace({
      widget: new FrontmatterWidget(yamlText.trim(), blockFrom),
      block: true,
    }))
    return builder.finish()
  } catch {
    return new RangeSetBuilder().finish()
  }
}

const frontmatterBlockField = StateField.define({
  create(state) { return buildFrontmatterDecoration(state) },
  update(deco, tr) {
    if (tr.docChanged || tr.selection) return buildFrontmatterDecoration(tr.state)
    return deco
  },
  provide: f => EditorView.decorations.from(f),
})

// ─── Wiki link widget ─────────────────────────────────────────────────────────

class WikiLinkWidget extends WidgetType {
  constructor(noteName) { super(); this.noteName = noteName }
  eq(other) { return other.noteName === this.noteName }

  toDOM(view) {
    const el = document.createElement('span')
    el.className = 'cm-md-wiki-link'
    el.textContent = this.noteName
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      view.dom.dispatchEvent(new CustomEvent('nb:wiki-link', {
        bubbles: true,
        composed: true,
        detail: { noteName: this.noteName },
      }))
    })
    return el
  }

  ignoreEvent() { return false }
}

// ─── Table widget ─────────────────────────────────────────────────────────────

function parseTableRow(text) {
  const stripped = text.replace(/^\||\|$/g, '')
  const cells = stripped.split('|').map(c => c.trim())
  const isSeparator = cells.every(c => /^[-: ]+$/.test(c) && c.includes('-'))
  return { cells, isSeparator }
}

function detectTables(state) {
  const tables = []
  let tableStart = -1
  let tableLines = []

  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n)
    const text = line.text
    // A table line must contain at least one pipe and start/end with pipe or space-pipe
    const isTableLine = /^\s*\|/.test(text) && text.includes('|')
    if (isTableLine) {
      if (tableStart === -1) tableStart = n
      tableLines.push({ lineNum: n, from: line.from, to: line.to, text, row: parseTableRow(text) })
    } else {
      if (tableStart !== -1 && tableLines.length >= 2) {
        tables.push({ start: tableStart, end: tableLines[tableLines.length - 1].lineNum, lines: tableLines })
      }
      tableStart = -1
      tableLines = []
    }
  }
  if (tableStart !== -1 && tableLines.length >= 2) {
    tables.push({ start: tableStart, end: tableLines[tableLines.length - 1].lineNum, lines: tableLines })
  }
  return tables
}

function simpleInlineHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '<span class="cm-md-link">$1</span>')
}

class TableWidget extends WidgetType {
  constructor(tableLines, blockFrom) {
    super()
    this.tableLines = tableLines
    this.blockFrom = blockFrom
    this._key = tableLines.map(l => l.row.cells.join('|')).join('\n')
  }
  eq(other) { return other._key === this._key }

  toDOM(view) {
    const tableLines = this.tableLines
    const numCols = tableLines.find(l => !l.row.isSeparator)?.row.cells.length ?? 1

    // Compute absolute positions of each cell's content start within a line
    const cellPositions = (line) => {
      const t = line.text
      const starts = []
      for (let i = 0; i < t.length; i++) {
        if (t[i] === '|') {
          starts.push(line.from + i + 1 + (t[i + 1] === ' ' ? 1 : 0))
        }
      }
      return starts.slice(0, -1) // drop trailing pipe
    }

    // Insert a new empty row before tableLines[lineIdx]
    const insertRowBefore = (lineIdx) => {
      const newRow = '| ' + Array(numCols).fill('   ').join(' | ') + ' |'
      const pos = tableLines[lineIdx].from
      view.dispatch({
        changes: { from: pos, to: pos, insert: newRow + '\n' },
        selection: { anchor: pos + 2 },
        userEvent: 'input',
      })
      view.focus()
    }

    // Append an empty row at the end of the table
    const appendRow = () => {
      const last = tableLines[tableLines.length - 1]
      const newRow = '| ' + Array(numCols).fill('   ').join(' | ') + ' |'
      view.dispatch({
        changes: { from: last.to, to: last.to, insert: '\n' + newRow },
        selection: { anchor: last.to + 3 },
        userEvent: 'input',
      })
      view.focus()
    }

    // Insert an empty column before colIdx (0-based)
    const insertColumnBefore = (colIdx) => {
      const changes = tableLines.map(line => {
        const cells = [...line.row.cells]
        cells.splice(colIdx, 0, line.row.isSeparator ? '---' : '   ')
        return { from: line.from, to: line.to, insert: '| ' + cells.join(' | ') + ' |' }
      })
      view.dispatch({ changes, userEvent: 'input' })
      view.focus()
    }

    // ── DOM ────────────────────────────────────────────────────
    const wrap = document.createElement('div')
    wrap.className = 'cm-md-table-wrap'

    const table = document.createElement('table')
    table.className = 'cm-md-table'
    const thead = document.createElement('thead')
    const tbody = document.createElement('tbody')
    table.appendChild(thead)
    table.appendChild(tbody)

    // ── Column-insert button row (top of thead) ────────────────
    const colBtnRow = document.createElement('tr')
    colBtnRow.className = 'cm-md-col-btn-row'
    // Corner cell aligns with the row-button column
    const corner = document.createElement('th')
    corner.className = 'cm-md-ctrl-cell'
    colBtnRow.appendChild(corner)
    for (let c = 0; c < numCols; c++) {
      const th = document.createElement('th')
      th.className = 'cm-md-ctrl-cell cm-md-col-btn-cell'
      const btn = document.createElement('button')
      btn.className = 'cm-md-insert-btn'
      btn.title = 'Insert column here'
      btn.textContent = '+'
      const ci = c
      btn.addEventListener('mousedown', e => e.preventDefault())
      btn.addEventListener('click', e => { e.stopPropagation(); insertColumnBefore(ci) })
      th.appendChild(btn)
      colBtnRow.appendChild(th)
    }
    // "Add column at end" button
    const addColEndTh = document.createElement('th')
    addColEndTh.className = 'cm-md-ctrl-cell cm-md-col-btn-cell'
    const addColEndBtn = document.createElement('button')
    addColEndBtn.className = 'cm-md-insert-btn cm-md-insert-btn-end'
    addColEndBtn.title = 'Add column'
    addColEndBtn.textContent = '+'
    addColEndBtn.addEventListener('mousedown', e => e.preventDefault())
    addColEndBtn.addEventListener('click', e => { e.stopPropagation(); insertColumnBefore(numCols) })
    addColEndTh.appendChild(addColEndBtn)
    colBtnRow.appendChild(addColEndTh)
    thead.appendChild(colBtnRow)

    // ── Data rows ─────────────────────────────────────────────
    let headerDone = false
    tableLines.forEach((line, lineIdx) => {
      if (line.row.isSeparator) { headerDone = true; return }
      const tr = document.createElement('tr')
      const tag = !headerDone ? 'th' : 'td'

      // Row-insert button cell (first column)
      const rowBtnCell = document.createElement(tag)
      rowBtnCell.className = 'cm-md-ctrl-cell cm-md-row-btn-cell'
      if (headerDone) {
        const btn = document.createElement('button')
        btn.className = 'cm-md-insert-btn'
        btn.title = 'Insert row here'
        btn.textContent = '+'
        const li = lineIdx
        btn.addEventListener('mousedown', e => e.preventDefault())
        btn.addEventListener('click', e => { e.stopPropagation(); insertRowBefore(li) })
        rowBtnCell.appendChild(btn)
      }
      tr.appendChild(rowBtnCell)

      // Data cells
      const positions = cellPositions(line)
      line.row.cells.forEach((cell, ci) => {
        const td = document.createElement(tag)
        td.innerHTML = simpleInlineHtml(cell)
        if (positions[ci] != null) td.dataset.srcPos = positions[ci]
        tr.appendChild(td)
      })

      // Trailing cell aligns with add-column-end column
      const endCell = document.createElement(tag)
      endCell.className = 'cm-md-ctrl-cell'
      tr.appendChild(endCell)

      if (!headerDone) { thead.appendChild(tr); headerDone = true }
      else tbody.appendChild(tr)
    })

    // ── Add-row button row (bottom of tbody) ─────────────────
    const addRowTr = document.createElement('tr')
    addRowTr.className = 'cm-md-add-row-row'
    const addRowBtnTd = document.createElement('td')
    addRowBtnTd.className = 'cm-md-ctrl-cell cm-md-row-btn-cell'
    const addRowBtn = document.createElement('button')
    addRowBtn.className = 'cm-md-insert-btn cm-md-insert-btn-end'
    addRowBtn.title = 'Add row'
    addRowBtn.textContent = '+'
    addRowBtn.addEventListener('mousedown', e => e.preventDefault())
    addRowBtn.addEventListener('click', e => { e.stopPropagation(); appendRow() })
    addRowBtnTd.appendChild(addRowBtn)
    addRowTr.appendChild(addRowBtnTd)
    const addRowSpan = document.createElement('td')
    addRowSpan.colSpan = numCols + 1
    addRowSpan.className = 'cm-md-ctrl-cell'
    addRowTr.appendChild(addRowSpan)
    tbody.appendChild(addRowTr)

    // ── Click on cell → place cursor there ───────────────────
    wrap.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return
      const cell = e.target.closest('[data-src-pos]')
      e.preventDefault()
      const pos = cell ? parseInt(cell.dataset.srcPos) : this.blockFrom
      view.dispatch({ selection: { anchor: pos }, userEvent: 'select' })
      view.focus()
    })

    wrap.appendChild(table)
    return wrap
  }

  ignoreEvent() { return true }
}

function buildTableDecorationsFromState(state) {
  try {
    const builder = new RangeSetBuilder()
    const tables = detectTables(state)
    const cursorLines = new Set()
    for (const r of state.selection.ranges) {
      const a = state.doc.lineAt(r.from).number
      const b = state.doc.lineAt(r.to).number
      for (let n = a; n <= b; n++) cursorLines.add(n)
    }

    for (const tbl of tables) {
      // If cursor is inside, show raw markdown
      let active = false
      for (let n = tbl.start; n <= tbl.end; n++) {
        if (cursorLines.has(n)) { active = true; break }
      }
      if (active) continue

      const blockFrom = tbl.lines[0].from
      const lastLine  = state.doc.line(tbl.end)
      const blockTo   = tbl.end < state.doc.lines ? lastLine.to + 1 : lastLine.to

      builder.add(blockFrom, blockTo, Decoration.replace({
        widget: new TableWidget(tbl.lines, blockFrom),
        block: true,
      }))
    }
    return builder.finish()
  } catch {
    return new RangeSetBuilder().finish()
  }
}

const tableBlockField = StateField.define({
  create(state) { return buildTableDecorationsFromState(state) },
  update(deco, tr) {
    if (tr.docChanged || tr.selection) return buildTableDecorationsFromState(tr.state)
    return deco
  },
  provide: f => EditorView.decorations.from(f),
})

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
    // Wiki link  [[Note Name]]
    if (ch === '[' && text[i+1] === '[') {
      const end = text.indexOf(']]', i + 2)
      if (end !== -1) {
        push(results, offset + i, offset + end + 2, 'wiki:' + text.slice(i + 2, end))
        i = end + 2; continue
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

    // ── Frontmatter ranges
    const fm = parseFrontmatter(state)
    const inFrontmatter   = new Set()
    const isFrontmatterDelim = new Set()
    if (fm) {
      isFrontmatterDelim.add(fm.start)
      isFrontmatterDelim.add(fm.end)
      for (let n = fm.start + 1; n < fm.end; n++) inFrontmatter.add(n)
    }

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

    // ── Entry-block state: tracks h3 entries nested inside h2 sections
    // Used to apply alternating shaded backgrounds so each shortcut-added
    // entry is visually distinct from its neighbours.
    let inH2Section  = false
    let entryCount   = 0         // how many h3 entries we've seen in this h2
    let entryClass   = null      // 'cm-md-entry-a' | 'cm-md-entry-b' | null

    // Build decorations line by line
    for (let n = 1; n <= state.doc.lines; n++) {
      const line   = state.doc.line(n)
      const { text, from, to } = line
      const active = cursorLines.has(n)

        // ── YAML frontmatter — handled entirely by frontmatterBlockField; skip here
      if (isFrontmatterDelim.has(n) || inFrontmatter.has(n)) continue

      // ── Code fence markers (``` lang / ```)
      if (isFenceMarker.has(n)) {
        const block = fenceByStart.get(n)  // only set on opening marker

        // Mermaid block (cursor outside): skip — mermaidBlockPlugin replaces it
        if (block && block.lang === 'mermaid' && !active) {
          n = block.end  // skip to closing marker (loop will n++ past it)
          continue
        }

        if (!active) {
          const cls = 'cm-md-fence-marker' + (entryClass ? ` ${entryClass}` : '')
          builder.add(from, from, Decoration.line({ class: cls }))
        }
        continue
      }

      // ── Code fence body
      if (inFenceContent.has(n)) {
        if (!active) {
          const cls = 'cm-md-fence-body' + (entryClass ? ` ${entryClass}` : '')
          builder.add(from, from, Decoration.line({ class: cls }))
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

        // Update entry-block tracking
        if (level === 1) {
          inH2Section = false; entryCount = 0; entryClass = null
        } else if (level === 2) {
          inH2Section = true; entryCount = 0; entryClass = null
        } else if (level === 3 && inH2Section) {
          entryCount++
          entryClass = entryCount % 2 === 1 ? 'cm-md-entry-a' : 'cm-md-entry-b'
        }

        // Build line class — h3 entries get the block colour + optional separator
        let lineClass = `cm-md-h${level}`
        if (level === 3 && inH2Section && entryClass) {
          lineClass += ` ${entryClass}`
          if (entryCount > 1) lineClass += ' cm-md-entry-sep'
        }

        builder.add(from, from, Decoration.line({ class: lineClass }))
        builder.add(from, from + prefix, Decoration.replace({}))  // hide '## '
        addInline(builder, text.slice(prefix), from + prefix)
        continue
      }

      // ── Apply entry block background to all body lines within an h3 entry
      if (entryClass) {
        builder.add(from, from, Decoration.line({ class: entryClass }))
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
        // Pass `from + indent` so the widget can find [ ] / [x] in the doc
        builder.add(from + indent, markEnd, Decoration.replace({ widget: new CheckboxWidget(checked, from + indent) }))
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
    if (type.startsWith('wiki:')) {
      const noteName = type.slice(5)
      builder.add(from, to, Decoration.replace({ widget: new WikiLinkWidget(noteName) }))
    } else {
      const mark = markForType(type)
      if (mark) builder.add(from, to, mark)
    }
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

// Enter while on a table row → move cursor below the table (exit edit mode)
export function tableEnterExit(view) {
  const state = view.state
  const cursor = state.selection.main.head
  const line   = state.doc.lineAt(cursor)
  const text   = line.text
  if (!(/^\s*\|/.test(text) && (text.match(/\|/g) || []).length >= 2)) return false

  // Find the last line of this table block
  let lastNum = line.number
  for (let n = line.number + 1; n <= state.doc.lines; n++) {
    const t = state.doc.line(n).text
    if (/^\s*\|/.test(t) && t.includes('|')) lastNum = n
    else break
  }
  const lastLine = state.doc.line(lastNum)

  if (lastNum < state.doc.lines) {
    // Move to the line after the table
    view.dispatch({ selection: { anchor: state.doc.line(lastNum + 1).from }, userEvent: 'select' })
  } else {
    // Table ends the document — insert a blank line
    view.dispatch({
      changes: { from: lastLine.to, to: lastLine.to, insert: '\n' },
      selection: { anchor: lastLine.to + 1 },
      userEvent: 'input',
    })
  }
  return true
}

// Tab / Shift+Tab navigation between table cells while editing
export function tableTabMove(view, backward = false) {
  const state = view.state
  const cursor = state.selection.main.head
  const line   = state.doc.lineAt(cursor)
  const text   = line.text

  // Only act when this line looks like a table row (starts with | and has at least 2 pipes)
  if (!(/^\s*\|/.test(text) && (text.match(/\|/g) || []).length >= 2)) return false

  // Skip separator lines like |---|---|
  const cells = text.replace(/^\||\|$/g, '').split('|')
  if (cells.every(c => /^[-: ]+$/.test(c) && c.includes('-'))) return false

  // Build absolute positions of the content start of each cell
  function cellStartsInLine(lineObj) {
    const t = lineObj.text
    const starts = []
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '|') {
        const afterPipe = lineObj.from + i + 1
        const spaceOff  = t[i + 1] === ' ' ? 1 : 0
        starts.push(afterPipe + spaceOff)
      }
    }
    return starts.slice(0, -1) // drop spurious position after trailing |
  }

  const realCells = cellStartsInLine(line)
  if (realCells.length === 0) return false

  // Find which cell the cursor is in
  let currentIdx = realCells.length - 1
  for (let i = 0; i < realCells.length; i++) {
    if (cursor < realCells[i]) { currentIdx = i - 1; break }
  }

  let targetPos

  if (!backward) {
    // Tab forward
    if (currentIdx < realCells.length - 1) {
      // Next cell on same row
      targetPos = realCells[currentIdx + 1]
    } else {
      // Last cell — move to first cell of next non-separator row
      let nextLineNum = line.number + 1
      while (nextLineNum <= state.doc.lines) {
        const nextLine = state.doc.line(nextLineNum)
        const t = nextLine.text
        if (/^\s*\|/.test(t) && (t.match(/\|/g) || []).length >= 2) {
          const isSep = t.replace(/^\||\|$/g, '').split('|').every(c => /^[-: ]+$/.test(c) && c.includes('-'))
          if (!isSep) {
            const realNext = cellStartsInLine(nextLine)
            if (realNext.length > 0) { targetPos = realNext[0]; break }
          }
        } else {
          break
        }
        nextLineNum++
      }
    }
  } else {
    // Shift+Tab backward
    if (currentIdx > 0) {
      // Previous cell on same row
      targetPos = realCells[currentIdx - 1]
    } else {
      // First cell — move to last cell of previous non-separator row
      let prevLineNum = line.number - 1
      while (prevLineNum >= 1) {
        const prevLine = state.doc.line(prevLineNum)
        const t = prevLine.text
        if (/^\s*\|/.test(t) && (t.match(/\|/g) || []).length >= 2) {
          const isSep = t.replace(/^\||\|$/g, '').split('|').every(c => /^[-: ]+$/.test(c) && c.includes('-'))
          if (!isSep) {
            const realPrev = cellStartsInLine(prevLine)
            if (realPrev.length > 0) { targetPos = realPrev[realPrev.length - 1]; break }
          }
        } else {
          break
        }
        prevLineNum--
      }
    }
  }

  if (targetPos == null) return false
  view.dispatch({ selection: { anchor: targetPos }, userEvent: 'select' })
  return true
}

export const livePreviewPlugin = [
  frontmatterBlockField,
  mermaidBlockField,
  tableBlockField,
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
