import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { acceptCompletion, nextSnippetField, prevSnippetField } from '@codemirror/autocomplete'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { livePreviewPlugin, activeMermaidField } from './livePreviewPlugin.js'
import { mermaidCompletion } from './mermaidCompletion.js'
import MermaidPreview from './MermaidPreview.jsx'
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
    maxWidth: '760px',
    margin: '0 auto',
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

function createEditorState(doc, onChange, onMermaidChange) {
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
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
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
        }
      }),
    ],
  })
}

const PREVIEW_MIN     = 200
const PREVIEW_DEFAULT = 400
const STORAGE_KEY     = 'nb:mermaidPreviewWidth'

function loadPreviewWidth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return PREVIEW_DEFAULT
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? Math.max(PREVIEW_MIN, n) : PREVIEW_DEFAULT
  } catch {
    return PREVIEW_DEFAULT
  }
}

function savePreviewWidth(w) {
  try { localStorage.setItem(STORAGE_KEY, String(w)) } catch { /* ignore */ }
}

const EditorPane = forwardRef(function EditorPane({ content, onChange, filePath, onWikiLink }, ref) {
  const containerRef      = useRef(null)
  const viewRef           = useRef(null)
  const onChangeRef       = useRef(onChange)
  const onWikiLinkRef     = useRef(onWikiLink)
  const [activeMermaid, setActiveMermaid] = useState(null)
  const [previewWidth, setPreviewWidth]   = useState(loadPreviewWidth)
  const setMermaidRef     = useRef(setActiveMermaid)
  const dragRef           = useRef(null)  // { startX, startWidth } during resize

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onWikiLinkRef.current = onWikiLink }, [onWikiLink])
  useEffect(() => { setMermaidRef.current = setActiveMermaid }, [])

  // Listen for wiki-link click events dispatched by WikiLinkWidget
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => onWikiLinkRef.current?.(e.detail.noteName)
    el.addEventListener('nb:wiki-link', handler)
    return () => el.removeEventListener('nb:wiki-link', handler)
  }, [])

  // Expose scrollToText to parent via ref
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
  }))

  // Mount editor once
  useEffect(() => {
    if (!containerRef.current) return
    const view = new EditorView({
      state: createEditorState(
        content ?? '',
        val  => onChangeRef.current(val),
        code => setMermaidRef.current(code),
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

  // ── Preview resize drag handlers ───────────────────────────────────────────
  const onResizeMouseDown = (e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: previewWidth }

    const onMouseMove = (ev) => {
      const delta = dragRef.current.startX - ev.clientX  // dragging left grows the panel
      const next = Math.max(PREVIEW_MIN, dragRef.current.startWidth + delta)
      setPreviewWidth(next)
      dragRef.current.lastWidth = next
    }

    const onMouseUp = () => {
      if (dragRef.current?.lastWidth !== undefined) savePreviewWidth(dragRef.current.lastWidth)
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div ref={containerRef} className="cm-host" style={{ flex: 1, minWidth: 0 }} />
      {activeMermaid !== null && (
        <>
          {/* Drag handle */}
          <div
            onMouseDown={onResizeMouseDown}
            style={{
              width: '5px',
              flexShrink: 0,
              cursor: 'col-resize',
              background: 'transparent',
              borderLeft: '1px solid #2e2e2e',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#3a3a3a' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            title="Drag to resize preview"
          />
          <MermaidPreview code={activeMermaid} width={previewWidth} />
        </>
      )}
    </div>
  )
})

export default EditorPane
