import { useState, useCallback, useMemo } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { columns, showCreateModal, selectedItem, groupBy, rootItems, items, owners, labels as labelsStore, viewMode, setViewMode, allDoneItems, hasArchivedItems, showArchiveDialog, boards, showCreateBoardModal, showShareModal, boardItems, userBoardRole, accessibleBoards, switchBoard } from '../../state/board-store';
import { moveItem } from '../../state/actions';
import { useKeyboardShortcuts } from '../../hooks/use-keyboard-shortcuts';
import type { Shortcut } from '../../hooks/use-keyboard-shortcuts';
import { Column } from './column';
import { ListView } from './list-view';
import { CardDetail } from './card-detail';
import { CreateItemModal } from '../forms/create-item-modal';
import { CreateBoardModal } from './create-board-modal';
import { ShareModal } from './share-modal';
import { ShortcutsHelp } from './shortcuts-help';
import { BoardSwitcher } from './board-switcher';
import { ProfileDialog } from '../profile/profile-dialog';
import { ArchiveDialog } from '../archive/archive-dialog';
import { FilterBar } from '../filters/filter-bar';
import type { ItemStatus, ItemWithRow } from '../../api/types';

export function KanbanBoard() {
  const { user, logout, token, updateUserName } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const statuses: ItemStatus[] = ['To Do', 'In Progress', 'Done'];

  // Derive display name from Owners sheet (source of truth), falling back to Google account name
  const displayName = user
    ? (owners.value.find(o => o.google_account.toLowerCase() === user.email.toLowerCase())?.name || user.name)
    : '';

  /** True when no modal or overlay is open — shortcuts should be active. */
  const noModalOpen = () =>
    !showShareModal.value &&
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
    // #90 AC2/AC3: Ctrl+Shift+S opens share modal — only for board owners
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

  const handleDrop = (itemId: string, newStatus: ItemStatus) => {
    if (token) {
      moveItem(itemId, newStatus, user?.name || 'web', token);
    }
  };

  const handleMoveStatus = (itemId: string, newStatus: ItemStatus) => {
    if (token) {
      moveItem(itemId, newStatus, user?.name || 'web', token);
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
              onMoveStatus={handleMoveStatus}
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
      <header class="board-header">
        <div class="board-header-left">
          <h1>Hive</h1>
        </div>
        <div class="board-header-right">
          {user && (
            <button
              class="user-info"
              onClick={() => setShowProfile(true)}
              aria-haspopup="dialog"
            >
              {user.picture && <img src={user.picture} alt="" class="user-avatar" />}
              <span class="user-name">{displayName}</span>
            </button>
          )}
          <button class="btn btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <BoardSwitcher />

      <FilterBar />

      <div class="view-toggle-bar" data-testid="view-toggle-bar">
        <button
          class={`view-toggle-btn ${viewMode.value === 'board' ? 'view-toggle-active' : ''}`}
          onClick={() => setViewMode('board')}
          aria-pressed={viewMode.value === 'board'}
          data-testid="view-toggle-board"
        >
          Board
        </button>
        <button
          class={`view-toggle-btn ${viewMode.value === 'list' ? 'view-toggle-active' : ''}`}
          onClick={() => setViewMode('list')}
          aria-pressed={viewMode.value === 'list'}
          data-testid="view-toggle-list"
        >
          List
        </button>
      </div>

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
      {showArchiveDialog.value && <ArchiveDialog onClose={handleCloseArchive} />}
      {showShortcutsHelp && <ShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />}
      {showProfile && user && token && (
        <ProfileDialog
          user={user}
          currentName={displayName}
          token={token}
          onClose={() => {
            setShowProfile(false);
          }}
          onNameUpdated={updateUserName}
        />
      )}
    </div>
  );
}
