import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Toolbar from '../components/Toolbar';

const defaultProps = {
  isUnsaved: false,
  onSave: vi.fn(),
  onNewTemplate: vi.fn(),
  onSettings: vi.fn(),
  onHistory: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  currentFile: null,
};

describe('Toolbar', () => {
  describe('rendering', () => {
    it('renders search input', () => {
      render(<Toolbar {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });

    it('renders New button', () => {
      render(<Toolbar {...defaultProps} />);
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('renders Settings button', () => {
      render(<Toolbar {...defaultProps} />);
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });

    it('shows "Saved" when isUnsaved is false', () => {
      render(<Toolbar {...defaultProps} isUnsaved={false} />);
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('shows "Unsaved" when isUnsaved is true', () => {
      render(<Toolbar {...defaultProps} isUnsaved={true} />);
      expect(screen.getByText('Unsaved')).toBeInTheDocument();
    });

    it('does not render History button when no file is open', () => {
      render(<Toolbar {...defaultProps} currentFile={null} />);
      expect(screen.queryByText('History')).not.toBeInTheDocument();
    });

    it('renders History button when a file is open', () => {
      render(<Toolbar {...defaultProps} currentFile="/notes/test.md" />);
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    it('shows current filename in toolbar', () => {
      render(<Toolbar {...defaultProps} currentFile="/notes/my-note.md" />);
      expect(screen.getByText('my-note.md')).toBeInTheDocument();
    });

    it('does not show filename when no file is open', () => {
      render(<Toolbar {...defaultProps} currentFile={null} />);
      // No filename text should be present
      expect(screen.queryByText(/\.md$/)).not.toBeInTheDocument();
    });
  });

  describe('search', () => {
    it('displays current searchQuery value', () => {
      render(<Toolbar {...defaultProps} searchQuery="hello" />);
      const input = screen.getByPlaceholderText('Search notes...');
      expect(input).toHaveValue('hello');
    });

    it('calls setSearchQuery on input change', async () => {
      const user = userEvent.setup();
      const setSearchQuery = vi.fn();
      render(<Toolbar {...defaultProps} setSearchQuery={setSearchQuery} />);
      await user.type(screen.getByPlaceholderText('Search notes...'), 'abc');
      expect(setSearchQuery).toHaveBeenCalled();
    });

    it('shows clear button when search has a query', () => {
      render(<Toolbar {...defaultProps} searchQuery="something" />);
      expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument();
    });

    it('does not show clear button when search is empty', () => {
      render(<Toolbar {...defaultProps} searchQuery="" />);
      // The × button in the search box should not be present
      const xBtns = screen.queryAllByRole('button', { name: '×' });
      expect(xBtns).toHaveLength(0);
    });

    it('calls setSearchQuery with empty string when clear button clicked', async () => {
      const user = userEvent.setup();
      const setSearchQuery = vi.fn();
      render(<Toolbar {...defaultProps} searchQuery="test" setSearchQuery={setSearchQuery} />);
      await user.click(screen.getByRole('button', { name: '×' }));
      expect(setSearchQuery).toHaveBeenCalledWith('');
    });
  });

  describe('button interactions', () => {
    it('calls onNewTemplate when New button is clicked', async () => {
      const user = userEvent.setup();
      const onNewTemplate = vi.fn();
      render(<Toolbar {...defaultProps} onNewTemplate={onNewTemplate} />);
      await user.click(screen.getByText('New'));
      expect(onNewTemplate).toHaveBeenCalled();
    });

    it('calls onSettings when Settings button is clicked', async () => {
      const user = userEvent.setup();
      const onSettings = vi.fn();
      render(<Toolbar {...defaultProps} onSettings={onSettings} />);
      await user.click(screen.getByTitle('Settings'));
      expect(onSettings).toHaveBeenCalled();
    });

    it('calls onHistory when History button is clicked', async () => {
      const user = userEvent.setup();
      const onHistory = vi.fn();
      render(<Toolbar {...defaultProps} currentFile="/notes/test.md" onHistory={onHistory} />);
      await user.click(screen.getByText('History'));
      expect(onHistory).toHaveBeenCalled();
    });
  });
});
