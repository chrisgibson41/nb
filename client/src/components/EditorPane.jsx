import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { EditorState, Prec, StateEffect, StateField } from '@codemirror/state'
import { EditorView, keymap, highlightActiveLine, Decoration } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { acceptCompletion, nextSnippetField, prevSnippetField, completionStatus } from '@codemirror/autocomplete'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { livePreviewPlugin, activeMermaidField, findActiveEditBlock, parseFenceBlocks } from './livePreviewPlugin.js'
import { mermaidCompletion } from './mermaidCompletion.js'
import MermaidPreview from './MermaidPreview.jsx'
import DrawioEditModal from './DrawioEditModal.jsx'
import './editor.css'

const baseTheme = EditorView.theme({
  '&': {
    flex: '1',
    minHeight: '0',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '15px',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    background: '#1e1e1e',
  },
  '.cm-scroller': {
    flex: '1',
    minHeight: '0',
    padding: '32px 0',
    lineHeight: '1.75',
    overflowY: 'auto',
  },
  '.cm-content': {
    padding: '0 48px',
    caretColor: '#aeafad',
  },
  '.cm-focused':  { outline: 'none' },
  '.cm-line':     { padding: '0' },
  '.cm-cursor':   { borderLeftColor: '#aeafad', borderLeftWidth: '2px' },
  '.cm-selectionBackground':          { background: '#264f78 !important' },
  '&.cm-focused .cm-selectionBackground': { background: '#264f78 !important' },
  '.cm-gutters':      { display: 'none' },
  '.cm-activeLineGutter': { background: 'transparent' },
  '.cm-activeLine':   { background: 'rgba(255,255,255,0.03)' },
})

// ── Line highlight (used when navigating from TasksPanel) ─────────────────
// Adds the `.cm-task-highlight` class to a single line via a state field,
// so the highlight survives viewport changes (unlike direct DOM manipulation).
const setHighlightLineEffect   = StateEffect.define()
const clearHighlightLineEffect = StateEffect.define()

const highlightLineField = StateField.define({
  create() { return Decoration.none },
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setHighlightLineEffect)) {
        const lineNum = Math.min(Math.max(1, e.value), tr.state.doc.lines)
        const line = tr.state.doc.line(lineNum)
        deco = Decoration.set([
          Decoration.line({ attributes: { class: 'cm-task-highlight' } }).range(line.from),
        ])
      } else if (e.is(clearHighlightLineEffect)) {
        deco = Decoration.none
      }
    }
    return deco
  },
  provide: f => EditorView.decorations.from(f),
})

// Mod-Shift-D: insert a `` ```drawio ``` `` block at the cursor and open the
// embedded drawio editor. Reliable fallback in case the markdown-typing
// auto-trigger gets confused (e.g. inline `` ```drawio``` `` on one line).
function insertDrawioBlock(view) {
  const state = view.state
  const head  = state.selection.main.head
  const line  = state.doc.lineAt(head)
  const onEmptyLine = line.text === ''
  // Where to insert: end of current line (so we never break mid-word).
  const insertPos = line.to
  const prefix = onEmptyLine ? '' : '\n'
  const insert = `${prefix}\`\`\`drawio\n\n\`\`\``
  const blockFrom = insertPos + prefix.length           // start of the new ```drawio line
  const cursorPos = blockFrom + '```drawio\n'.length    // start of the empty body line
  view.dispatch({
    changes:   { from: insertPos, insert },
    selection: { anchor: cursorPos },
    userEvent: 'drawio.autocomplete',
  })
  requestAnimationFrame(() => {
    view.contentDOM.dispatchEvent(new CustomEvent('nb:drawio-edit', {
      detail: { xml: '', blockFrom },
      bubbles: true,
    }))
  })
  return true
}

// Esc:
//   1. If autocomplete is open, let it close the dropdown (return false).
//   2. If the cursor is inside a live-preview block (mermaid/code fence,
//      frontmatter, or a markdown table), jump past the block so its widget
//      re-renders.
//   3. Otherwise, blur the editor — exits markdown edit mode altogether.
function escapeBlockOrBlur(view) {
  if (completionStatus(view.state) === 'active') return false
  const block = findActiveEditBlock(view.state)
  if (block) {
    view.dispatch({
      selection: { anchor: block.exitPos },
      scrollIntoView: true,
      userEvent: 'select.escape-block',
    })
    return true
  }
  view.contentDOM.blur()
  return true
}

function createEditorState(doc, onChange, onMermaidChange, onFocusLine) {
  return EditorState.create({
    doc,
    extensions: [
      history(),
      // High-priority Tab bindings that run before indentWithTab:
      //   1. Accept the active completion dropdown (if open)
      //   2. Move to the next snippet placeholder (if a snippet is active)
      // Both commands return false when they don't apply, so Tab falls
      // through to indentWithTab for normal indentation.
      Prec.high(keymap.of([
        { key: 'Tab',       run: acceptCompletion },
        { key: 'Tab',       run: nextSnippetField, shift: prevSnippetField },
      ])),
      Prec.high(keymap.of([
        { key: 'Escape',      run: escapeBlockOrBlur },
        { key: 'Mod-Shift-d', run: insertDrawioBlock },
      ])),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      highlightLineField,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      oneDark,
      baseTheme,
      livePreviewPlugin,
      mermaidCompletion,
      EditorView.lineWrapping,
      highlightActiveLine(),
      // Enable native OS spellcheck on the contenteditable div
      EditorView.contentAttributes.of({ spellcheck: 'true' }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChange(update.state.doc.toString())
        if (update.docChanged || update.selectionSet) {
          const code = update.state.field(activeMermaidField, false)
          onMermaidChange(code ?? null)
          if (code !== null) {
            onFocusLine(update.state.doc.lineAt(update.state.selection.main.head).text)
          } else {
            onFocusLine(null)
          }
        }
      }),
    ],
  })
}

const PREVIEW_MIN     = 120
const PREVIEW_DEFAULT = 280
const STORAGE_KEY     = 'nb:mermaidPreviewHeight'
const COLLAPSED_KEY   = 'nb:mermaidPreviewCollapsed'

function loadPreviewHeight() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return PREVIEW_DEFAULT
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? Math.max(PREVIEW_MIN, n) : PREVIEW_DEFAULT
  } catch {
    return PREVIEW_DEFAULT
  }
}

function savePreviewHeight(h) {
  try { localStorage.setItem(STORAGE_KEY, String(h)) } catch { /* ignore */ }
}

function loadPreviewCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

const EditorPane = forwardRef(function EditorPane({ content, onChange, filePath, onWikiLink }, ref) {
  const containerRef      = useRef(null)
  const viewRef           = useRef(null)
  const onChangeRef       = useRef(onChange)
  const onWikiLinkRef     = useRef(onWikiLink)
  const [activeMermaid, setActiveMermaid]     = useState(null)
  const [mermaidFocusLine, setMermaidFocusLine] = useState(null)
  const [previewHeight, setPreviewHeight]     = useState(loadPreviewHeight)
  const [previewCollapsed, setPreviewCollapsed] = useState(loadPreviewCollapsed)
  const [drawioEdit, setDrawioEdit]           = useState(null) // { xml, blockFrom } | null
  const setMermaidRef     = useRef(setActiveMermaid)
  const focusLineRef      = useRef(setMermaidFocusLine)
  const dragRef           = useRef(null)  // { startX, startWidth } during resize

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onWikiLinkRef.current = onWikiLink }, [onWikiLink])
  useEffect(() => { setMermaidRef.current = setActiveMermaid }, [])
  useEffect(() => { focusLineRef.current = setMermaidFocusLine }, [])

  // Listen for wiki-link click events dispatched by WikiLinkWidget
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => onWikiLinkRef.current?.(e.detail.noteName)
    el.addEventListener('nb:wiki-link', handler)
    return () => el.removeEventListener('nb:wiki-link', handler)
  }, [])

  // Listen for `nb:drawio-edit` events dispatched by DrawioWidget or the
  // auto-open listener and pop the embedded editor modal.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      const { xml, blockFrom } = e.detail || {}
      setDrawioEdit({ xml: xml ?? '', blockFrom: blockFrom ?? null })
    }
    el.addEventListener('nb:drawio-edit', handler)
    return () => el.removeEventListener('nb:drawio-edit', handler)
  }, [])

  // Save callback for the drawio modal — replace the body of the ```drawio
  // fence (identified by blockFrom) with the new XML, then close the modal.
  // The cursor is moved just past the closing fence so the diagram widget
  // renders immediately (otherwise the user sees raw XML until they click
  // outside the block).
  const handleDrawioSave = (newXml) => {
    const view = viewRef.current
    if (!view || !drawioEdit) { setDrawioEdit(null); return }
    const { blockFrom } = drawioEdit
    const blocks = parseFenceBlocks(view.state)
    const block  = blocks.find(b =>
      b.lang === 'drawio' &&
      view.state.doc.line(b.start).from === blockFrom,
    )
    if (!block) { setDrawioEdit(null); return }
    const openLine  = view.state.doc.line(block.start)
    const closeLine = view.state.doc.line(block.end)
    const bodyFrom = openLine.to + 1     // start of the line after ```drawio
    const bodyTo   = closeLine.from      // start of the closing ```
    view.dispatch({
      changes: { from: bodyFrom, to: bodyTo, insert: (newXml || '').trimEnd() + '\n' },
      userEvent: 'drawio.save',
    })
    // Move cursor outside the (now updated) block in a follow-up tick.
    requestAnimationFrame(() => {
      const v = viewRef.current
      if (!v) return
      const nb = parseFenceBlocks(v.state).find(b =>
        b.lang === 'drawio' && v.state.doc.line(b.start).from === blockFrom,
      )
      if (!nb) return
      let anchor
      if (nb.end < v.state.doc.lines) anchor = v.state.doc.line(nb.end + 1).from
      else if (nb.start > 1)          anchor = v.state.doc.line(nb.start - 1).to
      else                            anchor = 0
      v.dispatch({ selection: { anchor } })
    })
    setDrawioEdit(null)
  }

  // Expose imperative actions to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToText(searchText) {
      const view = viewRef.current
      if (!view) return
      const doc  = view.state.doc.toString()
      const idx  = doc.indexOf(searchText)
      if (idx === -1) return
      view.dispatch({
        selection:     { anchor: idx },
        scrollIntoView: true,
        effects: EditorView.scrollIntoView(idx, { y: 'center' }),
      })
      view.focus()
    },
    scrollToLine(lineNumber, { highlight = false } = {}) {
      const view = viewRef.current
      if (!view || !Number.isFinite(lineNumber)) return
      const total = view.state.doc.lines
      const clamped = Math.min(Math.max(1, lineNumber), total)
      const line = view.state.doc.line(clamped)
      const effects = [EditorView.scrollIntoView(line.from, { y: 'center' })]
      if (highlight) effects.push(setHighlightLineEffect.of(clamped))
      view.dispatch({
        selection:      { anchor: line.from },
        scrollIntoView: true,
        effects,
      })
      view.focus()
      if (highlight) {
        setTimeout(() => {
          if (viewRef.current) {
            viewRef.current.dispatch({ effects: clearHighlightLineEffect.of(null) })
          }
        }, 1800)
      }
    },
  }))

  // Mount editor once
  useEffect(() => {
    if (!containerRef.current) return
    const view = new EditorView({
      state: createEditorState(
        content ?? '',
        val  => onChangeRef.current(val),
        code => setMermaidRef.current(code),
        code => focusLineRef.current(code),
      ),
      parent: containerRef.current,
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // File switch: replace entire doc and scroll to top
  useEffect(() => {
    const view = viewRef.current
    if (!view || !filePath) return
    view.dispatch({
      changes:        { from: 0, to: view.state.doc.length, insert: content ?? '' },
      selection:      { anchor: 0 },
      scrollIntoView: true,
    })
  }, [filePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // External content update (e.g. MeetingsPanel inserting a section)
  // Guard: only dispatch when editor is out of sync with React state
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content ?? '' },
      })
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Preview resize drag handlers (vertical drag — preview sits on top) ─────
  const onResizeMouseDown = (e) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startHeight: previewHeight }

    const onMouseMove = (ev) => {
      const delta = ev.clientY - dragRef.current.startY  // dragging down grows the panel
      const next = Math.max(PREVIEW_MIN, dragRef.current.startHeight + delta)
      setPreviewHeight(next)
      dragRef.current.lastHeight = next
    }

    const onMouseUp = () => {
      if (dragRef.current?.lastHeight !== undefined) {
        savePreviewHeight(dragRef.current.lastHeight)
      }
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor    = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {activeMermaid !== null && (
        <>
          <MermaidPreview
            code={activeMermaid}
            height={previewHeight}
            collapsed={previewCollapsed}
            focusText={mermaidFocusLine}
            onToggleCollapse={() => {
              setPreviewCollapsed(c => {
                const next = !c
                try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /* ignore */ }
                return next
              })
            }}
          />
          {/* Drag handle — only visible when preview is expanded */}
          {!previewCollapsed && (
            <div
              onMouseDown={onResizeMouseDown}
              style={{
                height: '5px',
                flexShrink: 0,
                cursor: 'row-resize',
                background: 'transparent',
                borderTop: '1px solid #2e2e2e',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#3a3a3a' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              title="Drag to resize preview"
            />
          )}
        </>
      )}
      <div ref={containerRef} className="cm-host" style={{ flex: 1, minHeight: 0 }} />
      {drawioEdit && (
        <DrawioEditModal
          xml={drawioEdit.xml}
          onSave={handleDrawioSave}
          onCancel={() => setDrawioEdit(null)}
        />
      )}
    </div>
  )
})

export default EditorPane
