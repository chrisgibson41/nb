import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ShortcutsPanel from '../components/ShortcutsPanel';

// Templates must have 'tags' for matchesTemplate() to fire, and 'shortcuts' for buttons
const matchingTemplates = [
  {
    name: 'daily-note',
    filename: 'daily.md',
    tags: ['daily'],
    shortcuts: [
      {
        label: 'Meetings',
        singularLabel: 'Meeting',
        section: 'Meetings',
        heading: '{{title}}',
        body: '**Attendees:** \n\n**Notes:**\n\n',
      },
      {
        label: 'Tasks',
        singularLabel: 'Task',
        section: 'Tasks',
        heading: '{{title}}',
        body: '',
      },
    ],
  },
];

// Content that has a matching tag
const matchingContent = '---\ntags: [daily]\n---\n\n# Daily Log\n\n## Meetings\n\n## Tasks\n\n';

const defaultProps = {
  content: matchingContent,
  setContent: vi.fn(),
  filePath: '/notes/2024-01-15.md',
  onScrollTo: vi.fn(),
  templates: matchingTemplates,
};

describe('ShortcutsPanel', () => {
  describe('rendering', () => {
    it('renders shortcut buttons for matched template', () => {
      render(<ShortcutsPanel {...defaultProps} />);
      expect(screen.getByText('+ Add Meeting')).toBeInTheDocument();
      expect(screen.getByText('+ Add Task')).toBeInTheDocument();
    });

    it('renders nothing when templates array is empty', () => {
      const { container } = render(
        <ShortcutsPanel {...defaultProps} templates={[]} />
      );
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders nothing when content tags do not match template tags', () => {
      // Use a filePath that doesn't match date pattern or /Daily/ path
      render(
        <ShortcutsPanel
          {...defaultProps}
          filePath="/notes/some-other-note.md"
          content="---\ntags: [other]\n---\n# Note"
        />
      );
      expect(screen.queryByText('+ Add Meeting')).not.toBeInTheDocument();
    });

    it('renders nothing when content has no frontmatter', () => {
      // Use a filePath that doesn't match date pattern or /Daily/ path
      render(
        <ShortcutsPanel
          {...defaultProps}
          filePath="/notes/some-other-note.md"
          content="# No Frontmatter\n\nJust text"
        />
      );
      expect(screen.queryByText('+ Add Meeting')).not.toBeInTheDocument();
    });

    it('matches by date-based filename for daily-note template', () => {
      render(
        <ShortcutsPanel
          {...defaultProps}
          // No tags, but filename looks like a date
          content="# Daily\n\n## Meetings\n"
          filePath="/notes/Daily/2024-01-15.md"
        />
      );
      // daily-note template should match via /\/Daily\//i path pattern
      expect(screen.getByText('+ Add Meeting')).toBeInTheDocument();
    });
  });

  describe('modal', () => {
    it('opens a modal when a shortcut button is clicked', async () => {
      const user = userEvent.setup();
      render(<ShortcutsPanel {...defaultProps} />);

      await user.click(screen.getByText('+ Add Meeting'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Meeting title…')).toBeInTheDocument();
      });
    });

    it('shows modal header with correct label', async () => {
      const user = userEvent.setup();
      render(<ShortcutsPanel {...defaultProps} />);

      await user.click(screen.getByText('+ Add Meeting'));

      await waitFor(() => {
        expect(screen.getByText('Add Meeting')).toBeInTheDocument();
      });
    });

    it('pre-fills body textarea with template body content', async () => {
      const user = userEvent.setup();
      render(<ShortcutsPanel {...defaultProps} />);

      await user.click(screen.getByText('+ Add Meeting'));

      await waitFor(() => {
        // The textarea is the second textbox (first is the title input)
        const textareas = screen.getAllByRole('textbox');
        const bodyTextarea = textareas.find(el => el.tagName === 'TEXTAREA');
        expect(bodyTextarea).toBeTruthy();
        expect(bodyTextarea.value).toContain('Attendees');
      });
    });

    it('disables Save button when title is empty', async () => {
      const user = userEvent.setup();
      render(<ShortcutsPanel {...defaultProps} />);

      await user.click(screen.getByText('+ Add Meeting'));

      await waitFor(() => {
        const saveBtn = screen.getByText('Save');
        expect(saveBtn).toBeDisabled();
      });
    });

    it('enables Save button when title is entered', async () => {
      const user = userEvent.setup();
      render(<ShortcutsPanel {...defaultProps} />);

      await user.click(screen.getByText('+ Add Meeting'));

      await waitFor(() => screen.getByPlaceholderText('Meeting title…'));
      await user.type(screen.getByPlaceholderText('Meeting title…'), 'Team standup');

      const saveBtn = screen.getByText('Save');
      expect(saveBtn).not.toBeDisabled();
    });

    it('closes modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ShortcutsPanel {...defaultProps} />);

      await user.click(screen.getByText('+ Add Meeting'));
      await waitFor(() => screen.getByText('Cancel'));
      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Meeting title…')).not.toBeInTheDocument();
      });
    });

    it('closes modal when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(<ShortcutsPanel {...defaultProps} />);

      await user.click(screen.getByText('+ Add Meeting'));
      await waitFor(() => screen.getByPlaceholderText('Meeting title…'));
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Meeting title…')).not.toBeInTheDocument();
      });
    });

    it('calls setContent when Save is clicked with a title', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      render(<ShortcutsPanel {...defaultProps} setContent={setContent} />);

      await user.click(screen.getByText('+ Add Meeting'));
      await waitFor(() => screen.getByPlaceholderText('Meeting title…'));
      await user.type(screen.getByPlaceholderText('Meeting title…'), 'Sprint planning');
      await user.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(setContent).toHaveBeenCalled();
        const updatedContent = setContent.mock.calls[0][0];
        expect(updatedContent).toContain('Sprint planning');
      });
    });

    it('inserts content under the correct section heading', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      render(<ShortcutsPanel {...defaultProps} setContent={setContent} />);

      await user.click(screen.getByText('+ Add Meeting'));
      await waitFor(() => screen.getByPlaceholderText('Meeting title…'));
      await user.type(screen.getByPlaceholderText('Meeting title…'), 'My Meeting');
      await user.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(setContent).toHaveBeenCalled();
        const updatedContent = setContent.mock.calls[0][0];
        expect(updatedContent).toContain('My Meeting');
        // Should be inserted after the ## Meetings section
        expect(updatedContent.indexOf('## Meetings')).toBeLessThan(
          updatedContent.indexOf('My Meeting')
        );
      });
    });

    it('inserts content before next section when inserting at middle section', async () => {
      const user = userEvent.setup();
      const setContent = vi.fn();
      render(<ShortcutsPanel {...defaultProps} setContent={setContent} />);

      await user.click(screen.getByText('+ Add Meeting'));
      await waitFor(() => screen.getByPlaceholderText('Meeting title…'));
      await user.type(screen.getByPlaceholderText('Meeting title…'), 'New entry');
      await user.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(setContent).toHaveBeenCalled();
        const updatedContent = setContent.mock.calls[0][0];
        // Entry should appear before ## Tasks section
        expect(updatedContent.indexOf('New entry')).toBeLessThan(
          updatedContent.indexOf('## Tasks')
        );
      });
    });
  });
});
