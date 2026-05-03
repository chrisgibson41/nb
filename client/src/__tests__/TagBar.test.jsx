import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TagBar from '../components/TagBar';

describe('TagBar', () => {
  describe('rendering', () => {
    it('renders "Tags" label', () => {
      render(<TagBar content="" setContent={vi.fn()} />);
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('shows "none" when no tags exist', () => {
      render(<TagBar content="# Hello" setContent={vi.fn()} />);
      expect(screen.getByText('none')).toBeInTheDocument();
    });

    it('renders tags from array-format frontmatter', () => {
      const content = '---\ntags: [react, testing, vitest]\n---\n\n# Hello';
      render(<TagBar content={content} setContent={vi.fn()} />);
      expect(screen.getByText('#react')).toBeInTheDocument();
      expect(screen.getByText('#testing')).toBeInTheDocument();
      expect(screen.getByText('#vitest')).toBeInTheDocument();
    });

    it('renders tags from list-format frontmatter', () => {
      const content = '---\ntags:\n  - alpha\n  - beta\n---\n\n# Hello';
      render(<TagBar content={content} setContent={vi.fn()} />);
      expect(screen.getByText('#alpha')).toBeInTheDocument();
      expect(screen.getByText('#beta')).toBeInTheDocument();
    });

    it('shows "Add tag" button', () => {
      render(<TagBar content="" setContent={vi.fn()} />);
      expect(screen.getByText('Add tag')).toBeInTheDocument();
    });

    it('does not show "none" when tags exist', () => {
      const content = '---\ntags: [react]\n---\n\n# Hello';
      render(<TagBar content={content} setContent={vi.fn()} />);
      expect(screen.queryByText('none')).not.toBeInTheDocument();
    });
  });

  describe('adding tags', () => {
    it('shows input field when "Add tag" is clicked', async () => {
      const user = userEvent.setup();
      render(<TagBar content="" setContent={vi.fn()} />);
      await user.click(screen.getByText('Add tag'));
      expect(screen.getByPlaceholderText('tag-name')).toBeInTheDocument();
    });

    it('calls setContent with new tag when Enter is pressed', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      render(<TagBar content="# Hello" setContent={setContent} />);

      await user.click(screen.getByText('Add tag'));
      const input = screen.getByPlaceholderText('tag-name');
      await user.type(input, 'newtag{Enter}');

      expect(setContent).toHaveBeenCalledWith(expect.stringContaining('newtag'));
    });

    it('normalises tag to lowercase with hyphens', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      render(<TagBar content="# Hello" setContent={setContent} />);

      await user.click(screen.getByText('Add tag'));
      const input = screen.getByPlaceholderText('tag-name');
      await user.type(input, 'My Tag{Enter}');

      expect(setContent).toHaveBeenCalledWith(expect.stringContaining('my-tag'));
    });

    it('does not add duplicate tags', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      const content = '---\ntags: [react]\n---\n\n# Hello';
      render(<TagBar content={content} setContent={setContent} />);

      await user.click(screen.getByText('Add tag'));
      const input = screen.getByPlaceholderText('tag-name');
      await user.type(input, 'react{Enter}');

      // setContent should not have been called (or called with same tag list)
      if (setContent.mock.calls.length > 0) {
        const updatedContent = setContent.mock.calls[0][0];
        const tagMatches = (updatedContent.match(/react/g) || []).length;
        expect(tagMatches).toBe(1);
      }
    });

    it('cancels adding with Escape key', async () => {
      const user = userEvent.setup();
      render(<TagBar content="" setContent={vi.fn()} />);

      await user.click(screen.getByText('Add tag'));
      expect(screen.getByPlaceholderText('tag-name')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByPlaceholderText('tag-name')).not.toBeInTheDocument();
      expect(screen.getByText('Add tag')).toBeInTheDocument();
    });

    it('adds frontmatter when content has none', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      render(<TagBar content="# Hello\n\nSome text" setContent={setContent} />);

      await user.click(screen.getByText('Add tag'));
      await user.type(screen.getByPlaceholderText('tag-name'), 'newtag{Enter}');

      expect(setContent).toHaveBeenCalledWith(expect.stringContaining('---'));
      expect(setContent).toHaveBeenCalledWith(expect.stringContaining('newtag'));
    });
  });

  describe('removing tags', () => {
    it('removes a tag when × button is clicked', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      const content = '---\ntags: [react, testing]\n---\n\n# Hello';
      render(<TagBar content={content} setContent={setContent} />);

      const removeBtns = screen.getAllByTitle(/Remove tag/);
      await user.click(removeBtns[0]);

      expect(setContent).toHaveBeenCalled();
      const updatedContent = setContent.mock.calls[0][0];
      expect(updatedContent).not.toContain('react');
      expect(updatedContent).toContain('testing');
    });

    it('removes all references of a specific tag', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      const content = '---\ntags: [alpha, beta, gamma]\n---\n\n# Hello';
      render(<TagBar content={content} setContent={setContent} />);

      const removeBtn = screen.getByTitle('Remove tag "beta"');
      await user.click(removeBtn);

      const updatedContent = setContent.mock.calls[0][0];
      expect(updatedContent).not.toContain('beta');
      expect(updatedContent).toContain('alpha');
      expect(updatedContent).toContain('gamma');
    });
  });
});
