import { useState, useCallback, useMemo, useEffect } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { columns, showCreateModal, selectedItem, groupBy, rootItems, items, owners, labels as labelsStore, viewMode, setViewMode, allDoneItems, hasArchivedItems, showArchiveDialog, boards, showCreateBoardModal, showShareModal, showDeleteBoardModal, showMoveToBoardModal, boardItems, userBoardRole, accessibleBoards, switchBoard, theme, applyTheme, cycleTheme, columnSortModes, setColumnSortMode, columnAnnouncement } from '../../state/board-store';
import type { SortMode } from '../../state/board-store';
import { moveItem, reorderItem } from '../../state/actions';
import { useKeyboardShortcuts } from '../../hooks/use-keyboard-shortcuts';
import type { Shortcut } from '../../hooks/use-keyboard-shortcuts';
import { Column } from './column';
import { ListView } from './list-view';
import { CardDetail } from './card-detail';
import { CreateItemModal } from '../forms/create-item-modal';
import { CreateBoardModal } from './create-board-modal';
import { ShareModal } from './share-modal';
import { DeleteBoardModal } from './delete-board-modal';
import { MoveToBoardModal } from './move-to-board-modal';
import { ShortcutsHelp } from './shortcuts-help';
import { ProfileDialog } from '../profile/profile-dialog';
import { ArchiveDialog } from '../archive/archive-dialog';
import { UserDropdown } from '../header/user-dropdown';
import { ControlBar } from '../header/control-bar';
import { HiveLogo } from '../shared/hive-logo';
import type { ItemStatus, ItemWithRow } from '../../api/types';

export function KanbanBoard() {
  const { user, logout, token, updateUserName } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const statuses: ItemStatus[] = ['To Do', 'In Progress', 'Done'];

  // AC5: Listen for OS prefers-color-scheme changes while System is selected
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme.value === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', handleChange);
    // Apply theme on mount (picks up inline script state or sets initial data-theme)
    applyTheme(theme.value);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Derive display name from Owners sheet (source of truth), falling back to Google account name
  const displayName = user
    ? (owners.value.find(o => o.google_account.toLowerCase() === user.email.toLowerCase())?.name || user.name)
    : '';

  /** True when no modal or overlay is open — shortcuts should be active. */
  const noModalOpen = () =>
    !showShareModal.value &&
    !showDeleteBoardModal.value &&
    !showMoveToBoardModal.value &&
    !showCreateModal.value &&
    !showCreateBoardModal.value &&
    !showArchiveDialog.value &&
    !selectedItem.value &&
    !showShortcutsHelp;

  // Build shortcut definitions
  const shortcuts = useMemo<Shortcut[]>(() => [
    // AC1: Archive shortcut — 'A' toggles archive dialog
    {
      key: 'a',
      action: () => {
        if (showArchiveDialog.value) {
          showArchiveDialog.value = false;
        } else if (noModalOpen()) {
          showArchiveDialog.value = true;
        }
      },
    },
    // AC3: New item shortcut — 'N' opens create modal
    {
      key: 'n',
      action: () => {
        if (noModalOpen()) {
          showCreateModal.value = true;
        }
      },
    },
    // AC4: Shortcuts help overlay — '?' toggles help
    {
      key: '?',
      action: () => {
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else if (noModalOpen()) {
          setShowShortcutsHelp(true);
        }
      },
    },
    // AC7: Theme cycle — 'T' cycles Light → Dark → System → Light
    {
      key: 't',
      action: () => {
        if (noModalOpen()) {
          cycleTheme();
        }
      },
    },
    // #138: Ctrl+Shift+S opens board settings modal — only for board owners
    {
      key: 's',
      ctrl: true,
      shift: true,
      action: () => {
        if (userBoardRole.value === 'owner' && noModalOpen()) {
          showShareModal.value = true;
        }
      },
    },
    // AC2: Board switching — Ctrl+1 through Ctrl+9
    ...Array.from({ length: 9 }, (_, i) => ({
      key: String(i + 1),
      ctrl: true,
      action: () => {
        if (!noModalOpen()) return;
        const boardList = accessibleBoards.value;
        if (i < boardList.length) {
          switchBoard(boardList[i].id);
        }
      },
    })),
  ], [showShortcutsHelp]);

  useKeyboardShortcuts(shortcuts);

  const handleOpenArchive = useCallback(() => {
    showArchiveDialog.value = true;
  }, []);

  const handleCloseArchive = useCallback(() => {
    showArchiveDialog.value = false;
  }, []);

  const handleDrop = (itemId: string, newStatus: ItemStatus, targetIndex?: number) => {
    if (token) {
      moveItem(itemId, newStatus, user?.name || 'web', token, targetIndex);
    }
  };

  const handleMoveStatus = (itemId: string, newStatus: ItemStatus) => {
    if (token) {
      // AC6: Announce placement when keyboard-moving into a date-sorted destination
      const destSortMode = columnSortModes.value[newStatus];
      const isDestDateSorted = (destSortMode && destSortMode !== 'custom') || newStatus === 'Done';
      if (isDestDateSorted) {
        const sortLabel = newStatus === 'Done' ? 'completion date'
          : destSortMode === 'due_date' ? 'due date'
          : 'creation date';
        columnAnnouncement.value = {
          status: newStatus,
          text: `Moving to ${newStatus} — will be added in ${sortLabel} order`,
        };
        // Clear after screen reader has time to read
        setTimeout(() => { columnAnnouncement.value = null; }, 3000);
      }
      moveItem(itemId, newStatus, user?.name || 'web', token);
    }
  };

  const handleReorder = (itemId: string, newIndex: number, columnItems: ItemWithRow[]) => {
    if (token) {
      reorderItem(itemId, newIndex, columnItems, user?.name || 'web', token);
    }
  };

  // Check if the current board is empty (zero items for this board, ignoring filters)
  const isBoardEmpty = boardItems.value.length === 0;

  // Swimlane grouping
  const renderSwimlanes = () => {
    const group = groupBy.value;
    if (group === 'none') {
      return (
        <div class="board-columns">
          {statuses.map(status => (
            <Column
              key={status}
              status={status}
              items={columns.value[status]}
              onDrop={handleDrop}
              onReorder={handleReorder}
              onMoveStatus={handleMoveStatus}
              sortMode={columnSortModes.value[status]}
              onSortChange={(mode: SortMode) => setColumnSortMode(status, mode)}
              {...(status === 'Done' ? {
                allDoneCount: allDoneItems.value.length,
                hasArchived: hasArchivedItems.value,
                onOpenArchive: handleOpenArchive,
              } : {})}
            />
          ))}
        </div>
      );
    }

    const groupValues = group === 'owner'
      ? ['Unassigned', ...owners.value.map(o => o.name)]
      : labelsStore.value.map(l => l.label);

    return (
      <div class="board-swimlanes">
        {groupValues.map(groupValue => {
          const swimlaneItems = rootItems.value.filter(item => {
            if (group === 'owner') {
              return groupValue === 'Unassigned' ? !item.owner : item.owner === groupValue;
            }
            return item.labels.split(',').map(l => l.trim()).includes(groupValue);
          });

          if (swimlaneItems.length === 0) return null;

          return (
            <div key={groupValue} class="swimlane">
              <div class="swimlane-header">{groupValue}</div>
              <div class="board-columns">
                {statuses.map(status => (
                  <Column
                    key={`${groupValue}-${status}`}
                    status={status}
                    items={swimlaneItems.filter(i => i.status === status)}
                    onDrop={handleDrop}
                    onReorder={handleReorder}
                    onMoveStatus={handleMoveStatus}
                    compact
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div class="board-layout">
      {/* AC1: Slim header — logo + title on left, user dropdown on right */}
      <header class="board-header">
        <div class="board-header-left">
          <HiveLogo class="board-header-logo" />
          <h1>Hive</h1>
        </div>
        <div class="board-header-right">
          {user && (
            <UserDropdown
              user={user}
              displayName={displayName}
              onSignOut={logout}
              onOpenProfile={() => setShowProfile(true)}
            />
          )}
        </div>
      </header>

      {/* AC2: Unified control bar */}
      <ControlBar />

      <main class="board-main">
        {isBoardEmpty ? (
          <div class="board-welcome" data-testid="board-welcome">
            <div class="board-welcome-icon">&#128203;</div>
            <h2>No tasks yet</h2>
            <p>Click <strong>+</strong> to create your first one.</p>
          </div>
        ) : viewMode.value === 'list' ? (
          <ListView />
        ) : (
          renderSwimlanes()
        )}
      </main>

      <button
        class="fab"
        onClick={() => { showCreateModal.value = true; }}
        title="Create new item"
        aria-label="Create new item"
      >
        +
      </button>

      {selectedItem.value && <CardDetail />}
      {showCreateModal.value && <CreateItemModal />}
      {showCreateBoardModal.value && <CreateBoardModal />}
      {showShareModal.value && <ShareModal />}
      {showDeleteBoardModal.value && <DeleteBoardModal />}
      {showMoveToBoardModal.value && <MoveToBoardModal />}
      {showArchiveDialog.value && <ArchiveDialog onClose={handleCloseArchive} />}
      {showShortcutsHelp && <ShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />}
      {showProfile && user && token && (
        <ProfileDialog
          user={user}
          currentName={displayName}
          token={token}
          onClose={() => {
            setShowProfile(false);
            // AC6: Return focus to dropdown trigger after dialog closes
            requestAnimationFrame(() => {
              const trigger = document.querySelector<HTMLElement>('[data-testid="user-dropdown-trigger"]');
              trigger?.focus();
            });
          }}
          onNameUpdated={updateUserName}
        />
      )}
    </div>
  );
}
