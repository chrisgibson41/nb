/**
 * Tooltip (title attribute) coverage for every interactive button in the app.
 *
 * Each describe block covers one component. Tests confirm that every button
 * which is not labelled by visible text alone carries a meaningful title so
 * users can hover to understand it.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Toolbar from '../components/Toolbar';
import TagBar from '../components/TagBar';
import ShortcutsPanel from '../components/ShortcutsPanel';
import HistoryModal from '../components/HistoryModal';
import SettingsModal from '../components/SettingsModal';

// ─── Toolbar ──────────────────────────────────────────────────────────────────

describe('Toolbar tooltips', () => {
  const noop = vi.fn();
  const baseProps = {
    isUnsaved: false,
    onSave: noop,
    onNewTemplate: noop,
    onSettings: noop,
    onHistory: noop,
    searchQuery: '',
    setSearchQuery: noop,
    currentFile: null,
  };

  it('Settings button has title', () => {
    render(<Toolbar {...baseProps} />);
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('New note from template button has title', () => {
    render(<Toolbar {...baseProps} />);
    expect(screen.getByTitle('New note from template (Ctrl+T)')).toBeInTheDocument();
  });

  it('History button has title when a file is open', () => {
    render(<Toolbar {...baseProps} currentFile="/notes/foo.md" />);
    expect(screen.getByTitle('File history')).toBeInTheDocument();
  });

  it('Clear search button has title when search is active', async () => {
    const user = userEvent.setup();
    const setSearchQuery = vi.fn();
    render(<Toolbar {...baseProps} searchQuery="hello" setSearchQuery={setSearchQuery} />);
    expect(screen.getByTitle('Clear search')).toBeInTheDocument();
  });
});

// ─── TagBar ───────────────────────────────────────────────────────────────────

describe('TagBar tooltips', () => {
  // TagBar needs YAML frontmatter content
  const content = '---\ntags: [work, urgent]\n---\n# Note\n';
  const noop = vi.fn();

  it('Add tag button has title', () => {
    render(<TagBar content={content} setContent={noop} />);
    expect(screen.getByTitle('Add tag')).toBeInTheDocument();
  });

  it('Remove tag buttons have descriptive titles', () => {
    render(<TagBar content={content} setContent={noop} />);
    expect(screen.getByTitle('Remove tag "work"')).toBeInTheDocument();
    expect(screen.getByTitle('Remove tag "urgent"')).toBeInTheDocument();
  });
});

// ─── ShortcutsPanel ───────────────────────────────────────────────────────────

describe('ShortcutsPanel tooltips', () => {
  const templates = [{
    name: 'daily-note',
    filename: 'daily.md',
    tags: ['daily'],
    shortcuts: [{
      label: 'Meetings', singularLabel: 'Meeting',
      section: 'Meetings', heading: '{{title}}', body: '',
    }],
  }];
  const matchingContent = '---\ntags: [daily]\n---\n# Daily\n\n## Meetings\n\n';
  const noop = vi.fn();

  it('Add shortcut button has descriptive title', () => {
    render(
      <ShortcutsPanel
        content={matchingContent}
        setContent={noop}
        filePath="/notes/Daily/2024-01-01.md"
        templates={templates}
      />
    );
    expect(screen.getByTitle('Add a new Meeting')).toBeInTheDocument();
  });

  it('ShortcutModal close button has title="Close"', async () => {
    const user = userEvent.setup();
    render(
      <ShortcutsPanel
        content={matchingContent}
        setContent={noop}
        filePath="/notes/Daily/2024-01-01.md"
        templates={templates}
      />
    );
    await user.click(screen.getByTitle('Add a new Meeting'));
    await waitFor(() => screen.getByText('Add Meeting'));
    // The × close button in the modal
    expect(screen.getByTitle('Close')).toBeInTheDocument();
  });
});

// ─── HistoryModal ─────────────────────────────────────────────────────────────

describe('HistoryModal tooltips', () => {
  beforeEach(() => {
    fetch.mockImplementation((url) => {
      if (url.includes('/api/git/log')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('Close button has title="Close"', async () => {
    render(
      <HistoryModal
        filePath="/notes/foo.md"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    await waitFor(() => screen.getByText(/History/));
    expect(screen.getByTitle('Close')).toBeInTheDocument();
  });
});

// ─── SettingsModal ────────────────────────────────────────────────────────────

describe('SettingsModal tooltips', () => {
  beforeEach(() => {
    fetch.mockImplementation((url) => {
      if (url.includes('/api/config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ notesDir: '~/notes', templatesDir: '~/templates' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('Cancel button has title', async () => {
    render(<SettingsModal onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Cancel'));
    expect(screen.getByTitle('Discard changes and close')).toBeInTheDocument();
  });

  it('Save button has title', async () => {
    render(<SettingsModal onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Save'));
    expect(screen.getByTitle('Save settings')).toBeInTheDocument();
  });
});
