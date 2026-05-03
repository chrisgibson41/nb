import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TabBar from '../components/TabBar';

const makeTabs = (overrides = []) => [
  { path: '/notes/alpha.md', pinned: false, preview: false },
  { path: '/notes/beta.md',  pinned: false, preview: true  },
  { path: '/notes/gamma.md', pinned: true,  preview: false },
  ...overrides,
];

describe('TabBar', () => {
  describe('rendering', () => {
    it('renders nothing when tabs array is empty', () => {
      const { container } = render(
        <TabBar tabs={[]} activeTab={null} unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders all tab filenames', () => {
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/alpha.md" unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      expect(screen.getByText('alpha.md')).toBeInTheDocument();
      expect(screen.getByText('beta.md')).toBeInTheDocument();
      expect(screen.getByText('gamma.md')).toBeInTheDocument();
    });

    it('renders pin indicator for pinned tabs', () => {
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/alpha.md" unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      expect(screen.getByTitle('Pinned')).toBeInTheDocument();
    });

    it('shows unsaved dot for tabs with unsaved changes', () => {
      const unsavedPaths = new Set(['/notes/alpha.md']);
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/alpha.md" unsavedPaths={unsavedPaths} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      expect(screen.getByTitle('Unsaved changes')).toBeInTheDocument();
    });

    it('shows close button on non-pinned tabs', () => {
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/alpha.md" unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      // alpha.md and beta.md are non-pinned, gamma.md is pinned
      const closeBtns = screen.getAllByTitle('Close tab');
      expect(closeBtns).toHaveLength(2);
    });

    it('does not show close button on pinned tabs', () => {
      const tabs = [{ path: '/notes/pinned.md', pinned: true, preview: false }];
      render(
        <TabBar tabs={tabs} activeTab="/notes/pinned.md" unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      expect(screen.queryByTitle('Close tab')).not.toBeInTheDocument();
    });

    it('renders preview tabs with italic filename', () => {
      const tabs = [{ path: '/notes/preview.md', pinned: false, preview: true }];
      render(
        <TabBar tabs={tabs} activeTab={null} unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      const nameEl = screen.getByText('preview.md');
      expect(nameEl).toHaveStyle({ fontStyle: 'italic' });
    });
  });

  describe('click interactions', () => {
    it('calls onSwitch when a tab is clicked', async () => {
      const user = userEvent.setup();
      const onSwitch = vi.fn();
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/alpha.md" unsavedPaths={new Set()} onSwitch={onSwitch} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      await user.pointer({ target: screen.getByText('beta.md'), keys: '[MouseLeft]' });
      expect(onSwitch).toHaveBeenCalledWith('/notes/beta.md');
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/alpha.md" unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={onClose} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      // Click the first close button (alpha.md)
      const closeBtns = screen.getAllByTitle('Close tab');
      fireEvent.mouseDown(closeBtns[0]);
      expect(onClose).toHaveBeenCalled();
    });

    it('shows context menu on right-click', async () => {
      const user = userEvent.setup();
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/alpha.md" unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      await user.pointer({ target: screen.getByText('alpha.md'), keys: '[MouseRight]' });
      expect(screen.getByText('Pin tab')).toBeInTheDocument();
      expect(screen.getByText('Close tab')).toBeInTheDocument();
      expect(screen.getByText('Close other tabs')).toBeInTheDocument();
      expect(screen.getByText('Close all tabs')).toBeInTheDocument();
    });

    it('shows "Unpin tab" for pinned tabs in context menu', async () => {
      const user = userEvent.setup();
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/gamma.md" unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={vi.fn()} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      await user.pointer({ target: screen.getByText('gamma.md'), keys: '[MouseRight]' });
      expect(screen.getByText('Unpin tab')).toBeInTheDocument();
    });

    it('calls onPin from context menu', async () => {
      const user = userEvent.setup();
      const onPin = vi.fn();
      render(
        <TabBar tabs={makeTabs()} activeTab="/notes/alpha.md" unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={onPin} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      await user.pointer({ target: screen.getByText('alpha.md'), keys: '[MouseRight]' });
      fireEvent.mouseDown(screen.getByText('Pin tab'));
      expect(onPin).toHaveBeenCalledWith('/notes/alpha.md');
    });

    it('calls onPin when preview tab is double-clicked', async () => {
      const user = userEvent.setup();
      const onPin = vi.fn();
      render(
        <TabBar tabs={makeTabs()} activeTab={null} unsavedPaths={new Set()} onSwitch={vi.fn()} onClose={vi.fn()} onPin={onPin} onCloseOthers={vi.fn()} onCloseAll={vi.fn()} />
      );
      await user.dblClick(screen.getByText('beta.md'));
      expect(onPin).toHaveBeenCalledWith('/notes/beta.md');
    });
  });
});
