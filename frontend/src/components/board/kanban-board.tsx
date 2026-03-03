import { useAuth } from '../../auth/auth-context';
import { columns, showCreateModal, selectedItem, groupBy, rootItems, items, owners, labels as labelsStore, viewMode, setViewMode } from '../../state/board-store';
import { moveItem } from '../../state/actions';
import { Column } from './column';
import { ListView } from './list-view';
import { CardDetail } from './card-detail';
import { CreateItemModal } from '../forms/create-item-modal';
import { FilterBar } from '../filters/filter-bar';
import type { ItemStatus, ItemWithRow } from '../../api/types';

export function KanbanBoard() {
  const { user, logout, token } = useAuth();
  const statuses: ItemStatus[] = ['To Do', 'In Progress', 'Done'];

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

  // Check if the entire board is empty (zero items total, ignoring filters)
  const isBoardEmpty = items.value.length === 0;

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
            <div class="user-info">
              {user.picture && <img src={user.picture} alt="" class="user-avatar" />}
              <span>{user.name}</span>
            </div>
          )}
          <button class="btn btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

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
    </div>
  );
}
