import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { CompletionContext } from '@codemirror/autocomplete'
import { livePreviewPlugin } from '../components/livePreviewPlugin.js'

// Import the internals we want to test by re-exporting via a test helper approach.
// We test the completion logic indirectly by constructing a real EditorState and
// calling the source through a CompletionContext.


/** Build a minimal EditorState with the mermaid extensions and given doc.
 *  cursorPos defaults to end of doc. */
function makeCtx(doc, cursorPos = null, explicit = false) {
  const state = EditorState.create({ doc, extensions: [livePreviewPlugin] })
  const pos = cursorPos ?? doc.length
  return new CompletionContext(state, pos, explicit)
}

/** Wrap content in a complete mermaid fence so parseFenceBlocks finds the block.
 *  The cursor sits right after `inner` (before the closing fence). */
function mermaidCtx(inner, explicit = false) {
  const doc = '```mermaid\n' + inner + '\n```'
  // cursor = just before the closing fence (end of inner content)
  const cursorPos = ('```mermaid\n' + inner).length
  return makeCtx(doc, cursorPos, explicit)
}

import { mermaidCompletionSource } from '../components/mermaidCompletion.js'

describe('mermaidCompletionSource', () => {
  describe('outside a mermaid block', () => {
    it('returns null in normal markdown text', () => {
      const context = makeCtx('Hello world')
      expect(mermaidCompletionSource(context)).toBeNull()
    })

    it('returns null when cursor is on the fence delimiter line', () => {
      // cursor on the ``` line itself — outside the block content
      const doc = '```mermaid\nsequenceDiagram\n```'
      const context = makeCtx(doc, 0) // cursor at very start (on the fence)
      expect(mermaidCompletionSource(context)).toBeNull()
    })
  })

  describe('first content line — diagram type', () => {
    it('offers diagram types on the first line inside the block', () => {
      const context = mermaidCtx('', true)
      const result = mermaidCompletionSource(context)
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('sequenceDiagram')
      expect(labels).toContain('graph TD')
      expect(labels).toContain('erDiagram')
    })
  })

  describe('sequence diagram', () => {
    const seq = (inner, explicit = false) =>
      mermaidCtx('sequenceDiagram\n' + inner, explicit)

    it('offers top-level keywords at start of a new line (explicit)', () => {
      const result = mermaidCompletionSource(seq('participant Alice\n', true))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('participant')
      expect(labels).toContain('actor')
      expect(labels).toContain('note')
      expect(labels).toContain('loop')
      expect(labels).toContain('alt')
    })

    it('offers known participants as message sources (explicit)', () => {
      const result = mermaidCompletionSource(seq('participant Alice\nparticipant Bob\n', true))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('Alice')
      expect(labels).toContain('Bob')
    })

    it('offers arrow types while typing after participant name', () => {
      const result = mermaidCompletionSource(seq('participant Alice\nparticipant Bob\nAlice -'))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('->>')
      expect(labels).toContain('-->>')
      expect(labels).toContain('->')
      expect(labels).toContain('-->')
    })

    it('offers participant names as targets after an arrow + space', () => {
      const result = mermaidCompletionSource(seq('participant Alice\nparticipant Bob\nAlice ->> '))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('Alice')
      expect(labels).toContain('Bob')
    })

    it('offers note positions after "note "', () => {
      const result = mermaidCompletionSource(seq('note '))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('over')
      expect(labels).toContain('left of')
      expect(labels).toContain('right of')
    })

    it('offers participant names after "note over "', () => {
      const result = mermaidCompletionSource(seq('participant Alice\nnote over '))
      expect(result).not.toBeNull()
      expect(result.options.map(o => o.label)).toContain('Alice')
    })

    it('offers participant names after "activate "', () => {
      const result = mermaidCompletionSource(seq('participant Alice\nactivate '))
      expect(result).not.toBeNull()
      expect(result.options.map(o => o.label)).toContain('Alice')
    })
  })

  describe('flowchart diagram', () => {
    it('offers full diagram type completions (including graph variants) on the first line', () => {
      // The first content line of any mermaid block always offers diagram type declarations.
      // Typing "graph " shows "graph TD", "graph LR", etc. as full completions.
      const context = mermaidCtx('graph ')
      const result = mermaidCompletionSource(context)
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('graph TD')
      expect(labels).toContain('graph LR')
      expect(labels).toContain('sequenceDiagram')
    })

    it('offers keywords at the start of a line (explicit)', () => {
      const context = mermaidCtx('graph TD\n', true)
      const result = mermaidCompletionSource(context)
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('subgraph')
      expect(labels).toContain('end')
    })

    it('offers node IDs from existing definitions as targets after an arrow', () => {
      // A[Start] --> B[Middle] defines nodes A and B
      // On a new line after "C --> " we should get A and B as completion targets
      const context = mermaidCtx('graph TD\nA[Start]\nB[Middle]\nC --> ')
      const result = mermaidCompletionSource(context)
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('A')
      expect(labels).toContain('B')
    })

    it('offers existing node IDs at start of a new line (explicit)', () => {
      const context = mermaidCtx('graph TD\nA[Start]\nB[End]\n', true)
      const result = mermaidCompletionSource(context)
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('A')
      expect(labels).toContain('B')
    })
  })

  describe('sequence diagram — implicit participants', () => {
    const seq = (inner, explicit = false) =>
      mermaidCtx('sequenceDiagram\n' + inner, explicit)

    it('collects participants implied by message lines', () => {
      // Alice and Bob appear only in a message line, not declared with "participant"
      const result = mermaidCompletionSource(seq('Alice ->> Bob: hello\n', true))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('Alice')
      expect(labels).toContain('Bob')
    })

    it('collects participants from note lines', () => {
      const result = mermaidCompletionSource(seq('note over Carol: thinking\n', true))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('Carol')
    })

    it('collects participants from activate lines', () => {
      const result = mermaidCompletionSource(seq('activate Dave\n', true))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain('Dave')
    })
  })

  describe('sequence diagram — full-line message snippets', () => {
    const seq = (inner, explicit = false) =>
      mermaidCtx('sequenceDiagram\n' + inner, explicit)

    it('offers full-line message snippets for known participants (explicit)', () => {
      const result = mermaidCompletionSource(seq('participant Alice\nparticipant Bob\n', true))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      // Should include full-line snippets like "Alice ->>"
      expect(labels).toContain('Alice ->>')
      expect(labels).toContain('Bob ->>')
    })
  })

  describe('sequence diagram — colon suggestion', () => {
    const seq = (inner, explicit = false) =>
      mermaidCtx('sequenceDiagram\n' + inner, explicit)

    it('suggests ": " after "Sender Arrow Target" with no colon', () => {
      // "Alice ->> Bob" — the message separator colon is missing
      const result = mermaidCompletionSource(seq('participant Alice\nparticipant Bob\nAlice ->> Bob'))
      expect(result).not.toBeNull()
      const labels = result.options.map(o => o.label)
      expect(labels).toContain(': ')
    })

    it('does not suggest colon when colon is already present', () => {
      // "Alice ->> Bob: message" — already has a colon, should offer targets not ':'
      const result = mermaidCompletionSource(seq('participant Alice\nparticipant Bob\nAlice ->> Bob: hi'))
      // This line doesn't match the colon-suggestion branch — result may be null or offer something else
      if (result !== null) {
        const labels = result.options.map(o => o.label)
        expect(labels).not.toContain(': ')
      }
    })
  })
})
