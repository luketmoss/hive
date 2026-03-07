// Static, deterministic mock data for demo mode.
// Covers all board features: multiple statuses, owners, labels,
// subtasks, overdue dates, scheduled dates, long titles, unassigned items.

import type { ItemWithRow, Owner, Label, Board } from '../api/types';

// Helper to produce ISO date strings relative to "now" at module load time.
// Using a fixed reference keeps data deterministic within a single page load.
const NOW = new Date();
function daysFromNow(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

// --- Owners ---
export const MOCK_OWNERS: Owner[] = [
  { name: 'Mom', google_account: 'mom@family.com' },
  { name: 'Dad', google_account: 'dad@family.com' },
  { name: 'Kiddo', google_account: 'kiddo@family.com' },
];

// --- Labels ---
export const MOCK_LABELS: Label[] = [
  { label: 'Errands', color: '#42a5f5' },
  { label: 'Home', color: '#66bb6a' },
  { label: 'School', color: '#ffa726' },
  { label: 'Health', color: '#ef5350' },
  { label: 'Important', color: '#ab47bc' },
  { label: 'Family', color: '#ec407a' },
  { label: 'Fun', color: '#26c6da' },
];

// --- Boards ---
export const MOCK_BOARDS: Board[] = [
  { id: 'board-family', name: 'Family Board', created_at: daysAgo(30), created_by: 'mom@family.com' },
  { id: 'board-work', name: 'Work Projects', created_at: daysAgo(14), created_by: 'dad@family.com' },
];

// --- Items ---
// IDs are static UUIDs for reproducibility.
export const MOCK_ITEMS: ItemWithRow[] = [
  // 1. Grocery shopping — To Do, has 3 subtasks
  {
    id: 'demo-001',
    title: 'Grocery shopping',
    description: 'Weekly grocery run — check the fridge and pantry before leaving.',
    status: 'To Do',
    owner: 'Mom',
    due_date: daysFromNow(1),
    scheduled_date: daysFromNow(0),
    labels: 'Errands',
    parent_id: '',
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
    completed_at: '',
    sort_order: 1,
    created_by: 'mom@family.com',
    board_id: 'board-family',
    sheetRow: 2,
  },
  // Subtask 1a: Buy vegetables — Done
  {
    id: 'demo-001a',
    title: 'Buy vegetables',
    description: '',
    status: 'Done',
    owner: 'Mom',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: 'demo-001',
    created_at: daysAgo(3),
    updated_at: daysAgo(2),
    completed_at: daysAgo(2),
    sort_order: 1,
    created_by: 'mom@family.com',
    board_id: 'board-family',
    sheetRow: 3,
  },
  // Subtask 1b: Buy cleaning supplies — Done
  {
    id: 'demo-001b',
    title: 'Buy cleaning supplies',
    description: '',
    status: 'Done',
    owner: 'Mom',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: 'demo-001',
    created_at: daysAgo(3),
    updated_at: daysAgo(2),
    completed_at: daysAgo(2),
    sort_order: 2,
    created_by: 'mom@family.com',
    board_id: 'board-family',
    sheetRow: 4,
  },
  // Subtask 1c: Pick up prescription — To Do, assigned to Dad
  {
    id: 'demo-001c',
    title: 'Pick up prescription',
    description: '',
    status: 'To Do',
    owner: 'Dad',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: 'demo-001',
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
    completed_at: '',
    sort_order: 3,
    created_by: 'mom@family.com',
    board_id: 'board-family',
    sheetRow: 5,
  },

  // 2. Fix leaky faucet — In Progress
  {
    id: 'demo-002',
    title: 'Fix leaky faucet',
    description: 'Kitchen sink has been dripping. Check the washer first.',
    status: 'In Progress',
    owner: 'Dad',
    due_date: daysFromNow(7),
    scheduled_date: '',
    labels: 'Home',
    parent_id: '',
    created_at: daysAgo(5),
    updated_at: daysAgo(1),
    completed_at: '',
    sort_order: 1,
    created_by: 'dad@family.com',
    board_id: 'board-family',
    sheetRow: 6,
  },

  // 3. Science fair project — In Progress, multi-label
  {
    id: 'demo-003',
    title: 'Science fair project',
    description: 'Build a model volcano. Need baking soda, vinegar, and paint.',
    status: 'In Progress',
    owner: 'Kiddo',
    due_date: daysFromNow(3),
    scheduled_date: daysAgo(1),
    labels: 'School, Important',
    parent_id: '',
    created_at: daysAgo(10),
    updated_at: daysAgo(0),
    completed_at: '',
    sort_order: 2,
    created_by: 'kiddo@family.com',
    board_id: 'board-family',
    sheetRow: 7,
  },

  // 4. Plan birthday party — To Do, long description
  {
    id: 'demo-004',
    title: 'Plan birthday party',
    description: 'Reserve venue, order cake, send invitations to the whole class, buy decorations and party favors, arrange for a bounce house rental, and confirm the magician booking.',
    status: 'To Do',
    owner: 'Mom',
    due_date: daysFromNow(14),
    scheduled_date: '',
    labels: 'Family, Fun',
    parent_id: '',
    created_at: daysAgo(7),
    updated_at: daysAgo(7),
    completed_at: '',
    sort_order: 2,
    created_by: 'mom@family.com',
    board_id: 'board-family',
    sheetRow: 8,
  },

  // 5. Book dentist appointments — Done
  {
    id: 'demo-005',
    title: 'Book dentist appointments',
    description: 'Annual checkup for the whole family.',
    status: 'Done',
    owner: 'Dad',
    due_date: daysAgo(7),
    scheduled_date: '',
    labels: 'Health',
    parent_id: '',
    created_at: daysAgo(14),
    updated_at: daysAgo(7),
    completed_at: daysAgo(7),
    sort_order: 1,
    created_by: 'dad@family.com',
    board_id: 'board-family',
    sheetRow: 9,
  },

  // 6. Weekly meal planning — To Do, unassigned, no labels, no dates
  {
    id: 'demo-006',
    title: 'Weekly meal planning',
    description: '',
    status: 'To Do',
    owner: '',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: '',
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    completed_at: '',
    sort_order: 3,
    created_by: 'mom@family.com',
    board_id: 'board-family',
    sheetRow: 10,
  },

  // 7. Return library books — To Do, OVERDUE
  {
    id: 'demo-007',
    title: 'Return library books',
    description: 'Three books due — check the living room shelf.',
    status: 'To Do',
    owner: 'Kiddo',
    due_date: daysAgo(2),
    scheduled_date: '',
    labels: 'Errands',
    parent_id: '',
    created_at: daysAgo(10),
    updated_at: daysAgo(3),
    completed_at: '',
    sort_order: 4,
    created_by: 'kiddo@family.com',
    board_id: 'board-family',
    sheetRow: 11,
  },

  // 8. Long title edge case — In Progress
  {
    id: 'demo-008',
    title: 'A very long task title that tests how the card handles text wrapping and overflow for wordy items',
    description: '',
    status: 'In Progress',
    owner: 'Mom',
    due_date: '',
    scheduled_date: '',
    labels: 'Home',
    parent_id: '',
    created_at: daysAgo(4),
    updated_at: daysAgo(2),
    completed_at: '',
    sort_order: 3,
    created_by: 'mom@family.com',
    board_id: 'board-work',
    sheetRow: 12,
  },

  // 9. File taxes — Done
  {
    id: 'demo-009',
    title: 'File taxes',
    description: 'Federal and state returns submitted.',
    status: 'Done',
    owner: 'Dad',
    due_date: daysAgo(30),
    scheduled_date: '',
    labels: 'Important',
    parent_id: '',
    created_at: daysAgo(60),
    updated_at: daysAgo(30),
    completed_at: daysAgo(30),
    sort_order: 2,
    created_by: 'dad@family.com',
    board_id: 'board-family',
    sheetRow: 13,
  },

  // 9b. Organize pantry — Done (recently, within 7 days)
  {
    id: 'demo-013',
    title: 'Organize pantry',
    description: 'Sorted canned goods, tossed expired items, added shelf labels.',
    status: 'Done',
    owner: 'Mom',
    due_date: '',
    scheduled_date: '',
    labels: 'Home',
    parent_id: '',
    created_at: daysAgo(5),
    updated_at: daysAgo(2),
    completed_at: daysAgo(2),
    sort_order: 3,
    created_by: 'mom@family.com',
    board_id: 'board-family',
    sheetRow: 17,
  },

  // 10. Clean garage — To Do, scheduled only (no due date)
  {
    id: 'demo-010',
    title: 'Clean garage',
    description: 'Sort out tools, donate old toys, sweep floor.',
    status: 'To Do',
    owner: 'Dad',
    due_date: '',
    scheduled_date: daysFromNow(6),
    labels: 'Home',
    parent_id: '',
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
    completed_at: '',
    sort_order: 5,
    created_by: 'dad@family.com',
    board_id: 'board-family',
    sheetRow: 14,
  },

  // 11. Update family photo album — To Do, unassigned with a label
  {
    id: 'demo-011',
    title: 'Update family photo album',
    description: '',
    status: 'To Do',
    owner: '',
    due_date: '',
    scheduled_date: '',
    labels: 'Fun',
    parent_id: '',
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    completed_at: '',
    sort_order: 6,
    created_by: 'kiddo@family.com',
    board_id: 'board-family',
    sheetRow: 15,
  },

  // 12. Call insurance company — In Progress, due today, no labels
  {
    id: 'demo-012',
    title: 'Call insurance company',
    description: 'Ask about the home policy renewal.',
    status: 'In Progress',
    owner: 'Mom',
    due_date: daysFromNow(0),
    scheduled_date: '',
    labels: '',
    parent_id: '',
    created_at: daysAgo(5),
    updated_at: daysAgo(0),
    completed_at: '',
    sort_order: 4,
    created_by: 'mom@family.com',
    board_id: 'board-work',
    sheetRow: 16,
  },
];
