import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OutlinePanel from '../components/OutlinePanel';

describe('OutlinePanel', () => {
  describe('visibility', () => {
    it('renders the panel shell (with empty state) when content has no headings', () => {
      render(<OutlinePanel content="" onScrollTo={vi.fn()} />);
      expect(screen.getByText('Outline')).toBeInTheDocument();
      expect(screen.getByText(/No headings/i)).toBeInTheDocument();
    });

    it('renders the panel shell (with empty state) with only one heading', () => {
      render(<OutlinePanel content="# Only Heading" onScrollTo={vi.fn()} />);
      expect(screen.getByText('Outline')).toBeInTheDocument();
      // Single heading still shows in outline (no min-heading threshold any more)
      expect(screen.getByText('Only Heading')).toBeInTheDocument();
    });

    it('renders with two or more headings', () => {
      const content = '# Heading One\n## Heading Two';
      render(<OutlinePanel content={content} onScrollTo={vi.fn()} />);
      expect(screen.getByText('Outline')).toBeInTheDocument();
    });

    it('renders with multiple heading levels', () => {
      const content = '# H1\n## H2\n### H3\n#### H4';
      render(<OutlinePanel content={content} onScrollTo={vi.fn()} />);
      expect(screen.getByText('Outline')).toBeInTheDocument();
      expect(screen.getByText('H1')).toBeInTheDocument();
      expect(screen.getByText('H2')).toBeInTheDocument();
      expect(screen.getByText('H3')).toBeInTheDocument();
      expect(screen.getByText('H4')).toBeInTheDocument();
    });
  });

  describe('heading parsing', () => {
    it('strips YAML frontmatter before parsing headings', () => {
      const content = '---\ntitle: My Note\ntags: [test]\n---\n\n# Real Heading\n## Sub Heading';
      render(<OutlinePanel content={content} onScrollTo={vi.fn()} />);
      expect(screen.getByText('Real Heading')).toBeInTheDocument();
      expect(screen.getByText('Sub Heading')).toBeInTheDocument();
      // Frontmatter keys should not appear as headings
      expect(screen.queryByText('title: My Note')).not.toBeInTheDocument();
    });

    it('parses all heading levels 1–6', () => {
      const content = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
      render(<OutlinePanel content={content} onScrollTo={vi.fn()} />);
      for (let i = 1; i <= 6; i++) {
        expect(screen.getByText(`H${i}`)).toBeInTheDocument();
      }
    });

    it('ignores lines that are not headings', () => {
      const content = '# Real\n## Second\nsome paragraph text\n- list item';
      render(<OutlinePanel content={content} onScrollTo={vi.fn()} />);
      expect(screen.queryByText('some paragraph text')).not.toBeInTheDocument();
      expect(screen.queryByText('- list item')).not.toBeInTheDocument();
    });
  });

  describe('click interaction', () => {
    it('calls onScrollTo with heading text when clicked', () => {
      const onScrollTo = vi.fn();
      const content = '# Introduction\n## Getting Started\n### Details';
      render(<OutlinePanel content={content} onScrollTo={onScrollTo} />);

      fireEvent.click(screen.getByText('Getting Started'));
      expect(onScrollTo).toHaveBeenCalledWith('Getting Started');
    });

    it('calls onScrollTo for each heading independently', () => {
      const onScrollTo = vi.fn();
      const content = '# Alpha\n## Beta\n### Gamma';
      render(<OutlinePanel content={content} onScrollTo={onScrollTo} />);

      fireEvent.click(screen.getByText('Alpha'));
      fireEvent.click(screen.getByText('Gamma'));

      expect(onScrollTo).toHaveBeenCalledTimes(2);
      expect(onScrollTo).toHaveBeenNthCalledWith(1, 'Alpha');
      expect(onScrollTo).toHaveBeenNthCalledWith(2, 'Gamma');
    });

    it('does not throw when onScrollTo is not provided', () => {
      const content = '# H1\n## H2\n### H3';
      render(<OutlinePanel content={content} />);
      expect(() => fireEvent.click(screen.getByText('H1'))).not.toThrow();
    });
  });

  describe('indentation', () => {
    it('shows headings with "Outline" label', () => {
      const content = '# Main\n## Section\n### Sub-section';
      render(<OutlinePanel content={content} onScrollTo={vi.fn()} />);
      expect(screen.getByText('Outline')).toBeInTheDocument();
      expect(screen.getByText('Main')).toBeInTheDocument();
      expect(screen.getByText('Section')).toBeInTheDocument();
      expect(screen.getByText('Sub-section')).toBeInTheDocument();
    });
  });
});
