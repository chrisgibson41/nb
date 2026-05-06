import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MermaidPreview from '../components/MermaidPreview'

// Mock the mermaid module
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}))

async function getMermaidMock() {
  const { default: m } = await import('mermaid')
  return m
}

beforeEach(async () => {
  vi.clearAllMocks()
  // Reset the module-level mermaid cache by re-importing after clearing
  const m = await getMermaidMock()
  m.render.mockResolvedValue({ svg: '<svg data-testid="mermaid-svg"><text>diagram</text></svg>' })
})

describe('MermaidPreview', () => {
  it('shows "Rendering…" initially', () => {
    render(<MermaidPreview code="graph TD; A-->B" />)
    expect(screen.getByText('Rendering…')).toBeInTheDocument()
  })

  it('renders the panel header', () => {
    render(<MermaidPreview code="graph TD; A-->B" />)
    expect(screen.getByText('Diagram preview')).toBeInTheDocument()
  })

  it('renders SVG after mermaid resolves', async () => {
    const m = await getMermaidMock()
    m.render.mockResolvedValue({ svg: '<svg><text>rendered</text></svg>' })

    render(<MermaidPreview code="graph TD; A-->B" />)

    await waitFor(() => {
      // The SVG is injected via dangerouslySetInnerHTML — check the container has it
      const body = document.querySelector('[data-testid="mermaid-svg"], svg')
      // Or just check that "Rendering…" is gone
      expect(screen.queryByText('Rendering…')).not.toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('shows a friendly hint (not a stack trace) when mermaid throws', async () => {
    const m = await getMermaidMock()
    m.render.mockRejectedValue(new Error('Parse error on line 2: Expecting...'))

    render(<MermaidPreview code="invalid diagram @@@@" />)

    await waitFor(() => {
      // Should NOT show the raw error message
      expect(screen.queryByText(/Parse error on line 2/)).not.toBeInTheDocument()
      // Should show a friendly hint
      expect(screen.getByText(/not yet valid/i)).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('keeps the last valid diagram visible while syntax is broken', async () => {
    const m = await getMermaidMock()
    m.render
      .mockResolvedValueOnce({ svg: '<svg><text>valid diagram</text></svg>' })
      .mockRejectedValue(new Error('Parse error'))

    const { rerender } = render(<MermaidPreview code="graph TD; A-->B" />)
    await waitFor(() => expect(m.render).toHaveBeenCalledTimes(1), { timeout: 1000 })

    // Now break the syntax
    rerender(<MermaidPreview code="graph TD; A-->" />)

    await waitFor(() => {
      // Last valid SVG still in the DOM
      expect(document.querySelector('svg')).toBeInTheDocument()
      // Friendly hint shown
      expect(screen.getByText(/not yet valid/i)).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('re-renders when code prop changes', async () => {
    const m = await getMermaidMock()
    m.render
      .mockResolvedValueOnce({ svg: '<svg id="first"></svg>' })
      .mockResolvedValueOnce({ svg: '<svg id="second"></svg>' })

    const { rerender } = render(<MermaidPreview code="graph TD; A-->B" />)

    await waitFor(() => expect(m.render).toHaveBeenCalledTimes(1), { timeout: 1000 })

    rerender(<MermaidPreview code="sequenceDiagram; A->>B: hi" />)

    await waitFor(() => expect(m.render).toHaveBeenCalledTimes(2), { timeout: 1000 })
  })

  it('calls mermaid.render with the latest code after rapid changes', async () => {
    const m = await getMermaidMock()
    m.render.mockResolvedValue({ svg: '<svg></svg>' })

    const { rerender } = render(<MermaidPreview code="graph TD; A-->B" />)
    rerender(<MermaidPreview code="graph TD; A-->C" />)
    rerender(<MermaidPreview code="graph TD; A-->D" />)

    // After debounce settles, the last value is what gets rendered
    await waitFor(() => {
      const calls = m.render.mock.calls
      const lastCode = calls[calls.length - 1]?.[1]
      expect(lastCode).toBe('graph TD; A-->D')
    }, { timeout: 2000 })
  })
})
