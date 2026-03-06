import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchLabels,
  createLabelRow,
  updateLabelRow,
  deleteLabelRow,
  fetchLabelsWithRows,
  cascadeLabelUpdate,
  fetchAllItems,
  resetMockState,
} from './mock-api';
import { MOCK_LABELS } from './mock-data';

// Scenario 1: Create a new label (mock API layer)
// Scenario 3: Edit an existing label (mock API layer)
// Scenario 4: Delete a label (mock API layer)

describe('Mock API label CRUD', () => {
  beforeEach(() => {
    resetMockState();
  });

  // AC1: createLabelRow appends a label
  it('createLabelRow adds a label in-memory', async () => {
    const before = await fetchLabels('demo-token');
    await createLabelRow('New Label', '#FF0000', 'demo-token');
    const after = await fetchLabels('demo-token');
    expect(after.length).toBe(before.length + 1);
    expect(after.find(l => l.label === 'New Label')).toBeTruthy();
  });

  // AC3: updateLabelRow modifies an existing label
  it('updateLabelRow modifies a label in-memory', async () => {
    const labelsWithRows = await fetchLabelsWithRows('demo-token');
    const first = labelsWithRows[0];
    await updateLabelRow(first.sheetRow, 'Renamed', '#00FF00', 'demo-token');
    const after = await fetchLabels('demo-token');
    const renamed = after.find(l => l.label === 'Renamed');
    expect(renamed).toBeTruthy();
    expect(renamed!.color).toBe('#00FF00');
    expect(after.find(l => l.label === first.label)).toBeFalsy();
  });

  // AC4: deleteLabelRow removes a label
  it('deleteLabelRow removes a label in-memory', async () => {
    const labelsWithRows = await fetchLabelsWithRows('demo-token');
    const first = labelsWithRows[0];
    await deleteLabelRow(first.sheetRow, 'demo-token');
    const after = await fetchLabels('demo-token');
    expect(after.find(l => l.label === first.label)).toBeUndefined();
    expect(after.length).toBe(labelsWithRows.length - 1);
  });

  // AC3: fetchLabelsWithRows returns row numbers
  it('fetchLabelsWithRows returns labels with sheetRow numbers', async () => {
    const labelsWithRows = await fetchLabelsWithRows('demo-token');
    expect(labelsWithRows.length).toBe(MOCK_LABELS.length);
    labelsWithRows.forEach(l => {
      expect(l.sheetRow).toBeGreaterThanOrEqual(2);
      expect(l.label).toBeTruthy();
      expect(l.color).toBeTruthy();
    });
  });

  // AC3: cascadeLabelUpdate renames a label in items
  it('cascadeLabelUpdate renames a label in all items that reference it', async () => {
    // Find an item with labels
    const items = await fetchAllItems('demo-token');
    const itemWithLabel = items.find(i => i.labels.includes('Errands'));
    expect(itemWithLabel).toBeTruthy();

    await cascadeLabelUpdate('Errands', 'Shopping', 'demo-token');
    const after = await fetchAllItems('demo-token');
    const updatedItem = after.find(i => i.id === itemWithLabel!.id);
    expect(updatedItem!.labels).not.toContain('Errands');
    expect(updatedItem!.labels).toContain('Shopping');
  });

  // AC4: cascadeLabelUpdate removes a label from items when newName is empty
  it('cascadeLabelUpdate removes a label from all items when newName is empty', async () => {
    const items = await fetchAllItems('demo-token');
    const itemWithLabel = items.find(i => i.labels.includes('Errands'));
    expect(itemWithLabel).toBeTruthy();

    await cascadeLabelUpdate('Errands', '', 'demo-token');
    const after = await fetchAllItems('demo-token');
    const updatedItem = after.find(i => i.id === itemWithLabel!.id);
    expect(updatedItem!.labels).not.toContain('Errands');
  });

  // Reset restores labels too
  it('resetMockState restores labels to original', async () => {
    await createLabelRow('Temporary', '#000', 'demo-token');
    const afterCreate = await fetchLabels('demo-token');
    expect(afterCreate.length).toBe(MOCK_LABELS.length + 1);

    resetMockState();
    const afterReset = await fetchLabels('demo-token');
    expect(afterReset.length).toBe(MOCK_LABELS.length);
  });

  // No HTTP requests made
  it('no HTTP requests are made for label operations', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await fetchLabels('demo-token');
    await createLabelRow('Test', '#FFF', 'demo-token');
    await fetchLabelsWithRows('demo-token');
    await updateLabelRow(2, 'Updated', '#000', 'demo-token');
    await deleteLabelRow(2, 'demo-token');
    await cascadeLabelUpdate('Test', 'Test2', 'demo-token');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
