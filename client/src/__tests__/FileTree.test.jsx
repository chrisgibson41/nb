import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileTree from '../components/FileTree';

const mockTree = {
  name: 'notes',
  path: 'notes',
  type: 'dir',
  children: [
    { name: 'alpha.md', path: 'notes/alpha.md', type: 'file', children: null },
    { name: 'beta.md',  path: 'notes/beta.md',  type: 'file', children: null },
    {
      name: 'projects',
      path: 'notes/projects',
      type: 'dir',
      children: [
        { name: 'project-a.md', path: 'notes/projects/project-a.md', type: 'file', children: null },
      ],
    },
  ],
};

const emptyTree = { name: 'notes', path: 'notes', type: 'dir', children: [] };

const defaultProps = {
  onFileSelect: vi.fn(),
  currentFile: null,
  refreshKey: 0,
  onRefresh: vi.fn(),
  onNewTemplate: vi.fn(),
  searchQuery: '',
};

// Route fetch by URL
function mockFetch(treeData = mockTree) {
  fetch.mockImplementation((url) => {
    if (url.includes('/api/templates')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    if (url.includes('/api/tree')) {
      return Promise.resolve({ ok: true, json: async () => treeData });
    }
    return Promise.resolve({ ok: true, json: async () => ({}), text: async () => '' });
  });
}

beforeEach(() => {
  mockFetch();
});

describe('FileTree', () => {
  describe('loading and rendering', () => {
    it('renders the Explorer section title', async () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByText('Explorer')).toBeInTheDocument();
    });

    it('loads and displays files from API', async () => {
      render(<FileTree {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('alpha')).toBeInTheDocument();
        expect(screen.getByText('beta')).toBeInTheDocument();
      });
    });

    it('renders folder names', async () => {
      render(<FileTree {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('projects')).toBeInTheDocument();
      });
    });

    it('shows empty message when tree has no children', async () => {
      mockFetch(emptyTree);
      render(<FileTree {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('No notes yet. Create your first note!')).toBeInTheDocument();
      });
    });

    it('shows file extensions dimmed', async () => {
      render(<FileTree {...defaultProps} />);
      await waitFor(() => {
        // Multiple .md extensions should be present (one per file)
        const exts = screen.getAllByText('.md');
        expect(exts.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('shows canvas files with correct extension', async () => {
      mockFetch({
        ...mockTree,
        children: [{ name: 'board.canvas', path: 'notes/board.canvas', type: 'file', children: null }],
      });
      render(<FileTree {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('board')).toBeInTheDocument();
        expect(screen.getByText('.canvas')).toBeInTheDocument();
      });
    });
  });

  describe('toolbar buttons', () => {
    it('renders New note button', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('New note')).toBeInTheDocument();
    });

    it('renders New folder button', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('New folder')).toBeInTheDocument();
    });

    it('renders New canvas button', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('New canvas')).toBeInTheDocument();
    });

    it('renders New from template button', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('New from template (Ctrl+T)')).toBeInTheDocument();
    });

    it('renders Refresh button', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('Refresh')).toBeInTheDocument();
    });

    it('calls onRefresh when Refresh is clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();
      render(<FileTree {...defaultProps} onRefresh={onRefresh} />);
      await user.click(screen.getByTitle('Refresh'));
      expect(onRefresh).toHaveBeenCalled();
    });

    it('calls onNewTemplate when template button is clicked', async () => {
      const user = userEvent.setup();
      const onNewTemplate = vi.fn();
      render(<FileTree {...defaultProps} onNewTemplate={onNewTemplate} />);
      await user.click(screen.getByTitle('New from template (Ctrl+T)'));
      expect(onNewTemplate).toHaveBeenCalled();
    });
  });

  describe('InputModal for new file/folder/canvas', () => {
    it('shows InputModal when New note button is clicked', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);
      await user.click(screen.getByTitle('New note'));
      await waitFor(() => {
        expect(screen.getByText('New file name:')).toBeInTheDocument();
      });
    });

    it('shows InputModal when New folder button is clicked', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);
      await user.click(screen.getByTitle('New folder'));
      await waitFor(() => {
        expect(screen.getByText('New folder name:')).toBeInTheDocument();
      });
    });

    it('shows InputModal when New canvas button is clicked', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);
      await user.click(screen.getByTitle('New canvas'));
      await waitFor(() => {
        expect(screen.getByText('Canvas name:')).toBeInTheDocument();
      });
    });

    it('dismisses InputModal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);
      await user.click(screen.getByTitle('New note'));
      await waitFor(() => expect(screen.getByText('New file name:')).toBeInTheDocument());
      await user.click(screen.getByText('Cancel'));
      await waitFor(() => {
        expect(screen.queryByText('New file name:')).not.toBeInTheDocument();
      });
    });

    it('dismisses InputModal when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);
      await user.click(screen.getByTitle('New note'));
      await waitFor(() => expect(screen.getByText('New file name:')).toBeInTheDocument());
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByText('New file name:')).not.toBeInTheDocument();
      });
    });

    it('creates a new .md file when InputModal is submitted', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      fetch.mockImplementation((url, opts) => {
        if (url.includes('/api/templates')) return Promise.resolve({ ok: true, json: async () => [] });
        if (url.includes('/api/tree')) return Promise.resolve({ ok: true, json: async () => mockTree });
        if (opts?.method === 'PUT') return Promise.resolve({ ok: true, json: async () => ({}) });
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<FileTree {...defaultProps} onFileSelect={onFileSelect} />);
      await user.click(screen.getByTitle('New note'));
      await waitFor(() => expect(screen.getByText('New file name:')).toBeInTheDocument());

      // The modal input is inside the portal; find it by its proximity to the modal message
      const modalMsg = screen.getByText('New file name:');
      const modal = modalMsg.closest('div[style*="flex-direction: column"]');
      const input = modal ? modal.querySelector('input') : screen.getAllByRole('textbox').at(-1);
      await user.clear(input);
      await user.type(input, 'my-new-note');
      await user.click(screen.getByText('OK'));

      await waitFor(() => {
        const putCalls = fetch.mock.calls.filter(c => c[1]?.method === 'PUT');
        expect(putCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(putCalls[0][1].body);
        expect(body.path).toContain('my-new-note');
        expect(body.path).toContain('.md');
      });
    });

    it('creates a canvas file with JSON content when submitted', async () => {
      const user = userEvent.setup();
      fetch.mockImplementation((url, opts) => {
        if (url.includes('/api/templates')) return Promise.resolve({ ok: true, json: async () => [] });
        if (url.includes('/api/tree')) return Promise.resolve({ ok: true, json: async () => mockTree });
        if (opts?.method === 'PUT') return Promise.resolve({ ok: true, json: async () => ({}) });
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<FileTree {...defaultProps} />);
      await user.click(screen.getByTitle('New canvas'));
      await waitFor(() => expect(screen.getByText('Canvas name:')).toBeInTheDocument());

      const modalMsg = screen.getByText('Canvas name:');
      const modal = modalMsg.closest('div[style*="flex-direction: column"]');
      const input = modal ? modal.querySelector('input') : screen.getAllByRole('textbox').at(-1);
      await user.clear(input);
      await user.type(input, 'my-board');
      await user.click(screen.getByText('OK'));

      await waitFor(() => {
        const putCalls = fetch.mock.calls.filter(c => c[1]?.method === 'PUT');
        expect(putCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(putCalls[0][1].body);
        expect(body.path).toContain('.canvas');
        expect(body.content).toBe('{"nodes":[],"edges":[]}');
      });
    });
  });

  describe('file selection', () => {
    it('calls onFileSelect when a file is clicked', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      render(<FileTree {...defaultProps} onFileSelect={onFileSelect} />);

      await waitFor(() => screen.getByText('alpha'));
      await user.click(screen.getByText('alpha'));
      expect(onFileSelect).toHaveBeenCalledWith('notes/alpha.md');
    });

    it('does not call onFileSelect when a folder is clicked', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      render(<FileTree {...defaultProps} onFileSelect={onFileSelect} />);

      await waitFor(() => screen.getByText('projects'));
      await user.click(screen.getByText('projects'));
      expect(onFileSelect).not.toHaveBeenCalled();
    });

    it('shows nested files when parent folder is already open (depth 0)', async () => {
      // depth-0 folders open by default; project-a should already be visible
      render(<FileTree {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('project-a')).toBeInTheDocument();
      });
    });

    it('closes a folder when clicked (toggles from open)', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);

      await waitFor(() => screen.getByText('projects'));
      // depth-0 folder is open, project-a visible
      await waitFor(() => screen.getByText('project-a'));

      // Click to close
      await user.click(screen.getByText('projects'));
      await waitFor(() => {
        expect(screen.queryByText('project-a')).not.toBeInTheDocument();
      });
    });
  });

  describe('search / filter', () => {
    it('shows filter input when searchQuery prop is empty', () => {
      render(<FileTree {...defaultProps} searchQuery="" />);
      expect(screen.getByPlaceholderText('Filter files...')).toBeInTheDocument();
    });

    it('hides local filter when searchQuery prop is non-empty', () => {
      render(<FileTree {...defaultProps} searchQuery="test" />);
      expect(screen.queryByPlaceholderText('Filter files...')).not.toBeInTheDocument();
    });

    it('filters files when local filter is typed', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);

      await waitFor(() => screen.getByText('alpha'));

      await user.type(screen.getByPlaceholderText('Filter files...'), 'alpha');

      await waitFor(() => {
        expect(screen.queryByText('beta')).not.toBeInTheDocument();
        expect(screen.getByText('alpha')).toBeInTheDocument();
      });
    });

    it('filters by external searchQuery prop', async () => {
      render(<FileTree {...defaultProps} searchQuery="beta" />);

      await waitFor(() => {
        expect(screen.queryByText('alpha')).not.toBeInTheDocument();
        expect(screen.getByText('beta')).toBeInTheDocument();
      });
    });
  });

  describe('rename', () => {
    it('shows rename input on hover → rename button click', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);

      await waitFor(() => screen.getByText('alpha'));

      const row = screen.getByText('alpha').closest('[draggable]');
      fireEvent.mouseEnter(row);

      const renameBtn = screen.getByTitle('Rename');
      await user.click(renameBtn);

      const input = row.querySelector('input');
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('alpha.md');
    });

    it('calls rename API when rename input is committed', async () => {
      const user = userEvent.setup();
      fetch.mockImplementation((url, opts) => {
        if (url.includes('/api/templates')) return Promise.resolve({ ok: true, json: async () => [] });
        if (url.includes('/api/tree')) return Promise.resolve({ ok: true, json: async () => mockTree });
        if (url.includes('/api/rename')) return Promise.resolve({ ok: true, json: async () => ({}) });
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<FileTree {...defaultProps} />);
      await waitFor(() => screen.getByText('alpha'));

      const row = screen.getByText('alpha').closest('[draggable]');
      fireEvent.mouseEnter(row);
      await user.click(screen.getByTitle('Rename'));

      const input = row.querySelector('input');
      await user.clear(input);
      await user.type(input, 'renamed.md{Enter}');

      await waitFor(() => {
        const renameCalls = fetch.mock.calls.filter(c => c[0].includes('/api/rename'));
        expect(renameCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(renameCalls[0][1].body);
        expect(body.newPath).toContain('renamed.md');
      });
    });
  });

  describe('canvas creation — tree refresh', () => {
    it('re-fetches /api/tree after canvas creation so the file appears immediately', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      let treeCallCount = 0;

      fetch.mockImplementation((url, opts) => {
        if (url.includes('/api/templates')) return Promise.resolve({ ok: true, json: async () => [] });
        if (url.includes('/api/tree')) {
          treeCallCount++;
          return Promise.resolve({ ok: true, json: async () => mockTree });
        }
        if (opts?.method === 'PUT') return Promise.resolve({ ok: true, json: async () => ({}) });
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<FileTree {...defaultProps} onFileSelect={onFileSelect} />);

      // Wait for initial load (first /api/tree call)
      await waitFor(() => screen.getByText('alpha'));
      const initialCalls = treeCallCount;

      // Create a canvas
      await user.click(screen.getByTitle('New canvas'));
      await waitFor(() => expect(screen.getByText('Canvas name:')).toBeInTheDocument());
      const modalMsg = screen.getByText('Canvas name:');
      const modal = modalMsg.closest('div[style*="flex-direction: column"]');
      const input = modal ? modal.querySelector('input') : screen.getAllByRole('textbox').at(-1);
      await user.clear(input);
      await user.type(input, 'my-board');
      await user.click(screen.getByText('OK'));

      // Tree should have been re-fetched (loadTree called directly)
      await waitFor(() => {
        expect(treeCallCount).toBeGreaterThan(initialCalls);
      });
    });

    it('calls onFileSelect with canvas path after creation', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();

      fetch.mockImplementation((url, opts) => {
        if (url.includes('/api/templates')) return Promise.resolve({ ok: true, json: async () => [] });
        if (url.includes('/api/tree')) return Promise.resolve({ ok: true, json: async () => mockTree });
        if (opts?.method === 'PUT') return Promise.resolve({ ok: true, json: async () => ({}) });
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<FileTree {...defaultProps} onFileSelect={onFileSelect} />);
      await waitFor(() => screen.getByText('alpha'));

      await user.click(screen.getByTitle('New canvas'));
      await waitFor(() => expect(screen.getByText('Canvas name:')).toBeInTheDocument());
      const modalMsg = screen.getByText('Canvas name:');
      const modal = modalMsg.closest('div[style*="flex-direction: column"]');
      const input = modal ? modal.querySelector('input') : screen.getAllByRole('textbox').at(-1);
      await user.clear(input);
      await user.type(input, 'board');
      await user.click(screen.getByText('OK'));

      await waitFor(() => {
        expect(onFileSelect).toHaveBeenCalledWith(expect.stringContaining('.canvas'));
      });
    });
  });

  describe('tooltips', () => {
    it('New note button has correct title', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('New note')).toBeInTheDocument();
    });

    it('New folder button has correct title', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('New folder')).toBeInTheDocument();
    });

    it('New canvas button has correct title', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('New canvas')).toBeInTheDocument();
    });

    it('New from template button has correct title', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('New from template (Ctrl+T)')).toBeInTheDocument();
    });

    it('Refresh button has correct title', () => {
      render(<FileTree {...defaultProps} />);
      expect(screen.getByTitle('Refresh')).toBeInTheDocument();
    });

    it('Clear filter button has correct title when filter is active', async () => {
      const user = userEvent.setup();
      render(<FileTree {...defaultProps} />);
      await waitFor(() => screen.getByPlaceholderText('Filter files...'));
      await user.type(screen.getByPlaceholderText('Filter files...'), 'x');
      await waitFor(() => {
        expect(screen.getByTitle('Clear filter')).toBeInTheDocument();
      });
    });

    it('Rename action button has correct title', async () => {
      render(<FileTree {...defaultProps} />);
      await waitFor(() => screen.getByText('alpha'));
      const row = screen.getByText('alpha').closest('[draggable]');
      fireEvent.mouseEnter(row);
      expect(screen.getByTitle('Rename')).toBeInTheDocument();
    });

    it('Delete action button has correct title', async () => {
      render(<FileTree {...defaultProps} />);
      await waitFor(() => screen.getByText('alpha'));
      const row = screen.getByText('alpha').closest('[draggable]');
      fireEvent.mouseEnter(row);
      expect(screen.getByTitle('Delete')).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('calls delete API when delete button clicked and confirmed', async () => {
      const user = userEvent.setup();
      window.confirm.mockReturnValue(true);
      fetch.mockImplementation((url, opts) => {
        if (url.includes('/api/templates')) return Promise.resolve({ ok: true, json: async () => [] });
        if (url.includes('/api/tree')) return Promise.resolve({ ok: true, json: async () => mockTree });
        if (opts?.method === 'DELETE') return Promise.resolve({ ok: true });
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<FileTree {...defaultProps} />);
      await waitFor(() => screen.getByText('alpha'));

      const row = screen.getByText('alpha').closest('[draggable]');
      fireEvent.mouseEnter(row);

      await user.click(screen.getByTitle('Delete'));

      await waitFor(() => {
        const deleteCalls = fetch.mock.calls.filter(c => c[1]?.method === 'DELETE');
        expect(deleteCalls.length).toBeGreaterThan(0);
      });
    });

    it('does not call delete API when delete is cancelled', async () => {
      const user = userEvent.setup();
      window.confirm.mockReturnValue(false);

      render(<FileTree {...defaultProps} />);
      await waitFor(() => screen.getByText('alpha'));

      const row = screen.getByText('alpha').closest('[draggable]');
      fireEvent.mouseEnter(row);
      await user.click(screen.getByTitle('Delete'));

      const deleteCalls = fetch.mock.calls.filter(c => c[1]?.method === 'DELETE');
      expect(deleteCalls).toHaveLength(0);
    });
  });
});
