import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { within } from '@testing-library/react';

// Mock CodeMirror-heavy components that fail in jsdom
vi.mock('../components/EditorPane.jsx', () => ({
  default: React.forwardRef(({ content, onChange, filePath }, ref) => (
    <div data-testid="editor-pane" data-filepath={filePath}>
      <textarea value={content} onChange={e => onChange(e.target.value)} />
    </div>
  )),
}));


import App from '../App';

const mockTree = {
  name: 'notes', path: 'notes', type: 'dir',
  children: [
    { name: 'hello.md', path: 'notes/hello.md', type: 'file', children: null },
    { name: 'world.md', path: 'notes/world.md', type: 'file', children: null },
  ],
};

function setupFetchMock(overrides = {}) {
  fetch.mockImplementation((url) => {
    if (url.includes('/api/templates')) {
      return Promise.resolve({ ok: true, json: async () => overrides.templates || [] });
    }
    if (url.includes('/api/tree')) {
      return Promise.resolve({ ok: true, json: async () => overrides.tree || mockTree });
    }
    if (url.includes('/api/file')) {
      return Promise.resolve({ ok: true, text: async () => overrides.content || '# Hello World\n\nThis is a test note.' });
    }
    return Promise.resolve({ ok: true, json: async () => ({}), text: async () => '' });
  });
}

beforeEach(() => {
  setupFetchMock();
  // Dismiss the Getting Started page by default in tests so we see normal UI
  localStorage.getItem.mockImplementation((key) => {
    if (key === 'nb:dismissedGettingStarted') return '1';
    return null;
  });

  // WebSocket mock — must be a real class
  global.WebSocket = class MockWebSocket {
    constructor() {
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
      this.readyState = 1;
    }
    close() {}
    send() {}
  };
});

describe('App', () => {
  describe('initial render', () => {
    it('renders the toolbar', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
      });
    });

    it('renders the file tree Explorer section', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('Explorer')).toBeInTheDocument();
      });
    });

    it('shows "Select a file to start editing" when no file is open and guide dismissed', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('Select a file to start editing')).toBeInTheDocument();
      });
    });

    it('shows Getting Started guide when not dismissed', async () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'nb:dismissedGettingStarted') return null;
        return null;
      });
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('NB — Getting Started')).toBeInTheDocument();
      });
    });

    it('renders toolbar buttons', async () => {
      render(<App />);
      await waitFor(() => {
        // Use title since "New" text can appear in multiple places
        expect(screen.getByTitle('New note from template (Ctrl+T)')).toBeInTheDocument();
        expect(screen.getByTitle('Settings')).toBeInTheDocument();
      });
    });
  });

  describe('file tree', () => {
    it('loads and displays files from API', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('hello')).toBeInTheDocument();
        expect(screen.getByText('world')).toBeInTheDocument();
      });
    });
  });

  describe('file opening', () => {
    it('opens a file and shows it as a tab when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => screen.getByText('hello'));
      await user.click(screen.getByText('hello'));

      await waitFor(() => {
        // hello.md appears in both toolbar filename and tab — at least one should be present
        const matches = screen.getAllByText('hello.md');
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows file content in editor after opening', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => screen.getByText('hello'));
      await user.click(screen.getByText('hello'));

      await waitFor(() => {
        expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
      });
    });

    it('replaces working tab when a second file is opened', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => screen.getByText('hello'));
      await user.click(screen.getByText('hello'));

      // After opening hello, wait for its tab/toolbar presence
      await waitFor(() => screen.getAllByText('hello.md'));
      await user.click(screen.getByText('world'));

      await waitFor(() => {
        // world.md should now be visible in the tab bar
        // The toolbar also shows current filename, so use getAllByText
        expect(screen.getAllByText('world.md').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('restores last active tab from localStorage on mount', async () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'nb:activeTab') return 'notes/hello.md';
        if (key === 'nb:tabs') return '[]';
        return null;
      });

      render(<App />);

      await waitFor(() => {
        const fileFetches = fetch.mock.calls.filter(c => c[0].includes('hello.md'));
        expect(fileFetches.length).toBeGreaterThan(0);
      });
    });

  });

  describe('tabs', () => {
    it('shows save indicator in toolbar', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });
    });

    it('closes tab when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => screen.getByText('hello'));
      await user.click(screen.getByText('hello'));
      await waitFor(() => screen.getAllByText('hello.md'));

      const closeBtn = screen.getByTitle('Close tab');
      fireEvent.mouseDown(closeBtn);

      // After closing the tab, tab bar should have no tabs (it hides when empty)
      await waitFor(() => {
        expect(screen.queryByTitle('Close tab')).not.toBeInTheDocument();
      });
    });
  });

  describe('search', () => {
    it('passes search query to file tree (hides local filter)', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => screen.getByPlaceholderText('Search notes...'));
      await user.type(screen.getByPlaceholderText('Search notes...'), 'hello');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Filter files...')).not.toBeInTheDocument();
      });
    });

    it('clears search query when × button is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => screen.getByPlaceholderText('Search notes...'));
      await user.type(screen.getByPlaceholderText('Search notes...'), 'test');

      // Find the × within the toolbar search box specifically
      const searchInput = screen.getByPlaceholderText('Search notes...');
      const searchBox = searchInput.closest('div');
      const clearBtn = within(searchBox).getByRole('button');
      await user.click(clearBtn);

      expect(screen.getByPlaceholderText('Search notes...')).toHaveValue('');
    });
  });

  describe('keyboard shortcuts', () => {
    it('opens template modal on Ctrl+T', async () => {
      render(<App />);
      await waitFor(() => screen.getByText('Explorer'));

      fireEvent.keyDown(window, { key: 't', ctrlKey: true });

      await waitFor(() => {
        // TemplateModal has an overlay div with high zIndex — look for the close button
        // or a distinctive element inside the modal
        const closeBtn = screen.getAllByRole('button').find(
          b => b.title === 'Close' || b.textContent === '×'
        );
        expect(closeBtn).toBeTruthy();
        // Also check the template modal title appears at least once
        const titles = screen.getAllByText(/new note from template/i);
        expect(titles.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('settings modal', () => {
    it('opens settings modal when Settings button is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => screen.getByTitle('Settings'));
      await user.click(screen.getByTitle('Settings'));

      await waitFor(() => {
        expect(screen.getByText(/settings/i)).toBeInTheDocument();
      });
    });
  });
});
