import { useAuth } from '../../auth/auth-context';
import { columns, showCreateModal, selectedItem, groupBy, rootItems, owners, labels as labelsStore } from '../../state/board-store';
import { moveItem } from '../../state/actions';
import { Column } from './column';
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

      <main class="board-main">
        {renderSwimlanes()}
      </main>

      <button
        class="fab"
        onClick={() => { showCreateModal.value = true; }}
        title="Create new item"
      >
        +
      </button>

      {selectedItem.value && <CardDetail />}
      {showCreateModal.value && <CreateItemModal />}
    </div>
  );
}
