import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
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

const EditorPane = forwardRef(function EditorPane({ content, onChange, filePath, onWikiLink }, ref) {
  const containerRef      = useRef(null)
  const viewRef           = useRef(null)
  const onChangeRef       = useRef(onChange)
  const onWikiLinkRef     = useRef(onWikiLink)
  const [activeMermaid, setActiveMermaid] = useState(null)
  const setMermaidRef     = useRef(setActiveMermaid)

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

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div ref={containerRef} className="cm-host" style={{ flex: 1, minWidth: 0 }} />
      {activeMermaid !== null && <MermaidPreview code={activeMermaid} />}
    </div>
  )
})

export default EditorPane
