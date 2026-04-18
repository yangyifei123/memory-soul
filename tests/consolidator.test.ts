import { consolidate } from '../src/memory/consolidator';
import { MemoryEntry } from '../src/memory/interfaces';

describe('MemoryConsolidator', () => {
  const createEntry = (type: MemoryEntry['type'], confidence: number, content: string): Omit<MemoryEntry, 'id' | 'timestamp'> => ({
    agentId: 'sisyphus',
    scope: 'persistent',
    type,
    content,
    confidence,
    source: 'agent',
    tags: []
  });

  const toMemoryEntry = (partial: Omit<MemoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): MemoryEntry => ({
    ...partial,
    id: partial.id || 'default-id',
    timestamp: partial.timestamp || Date.now()
  });

  it('empty new entries → empty result', () => {
    const result = consolidate([], []);

    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.updated).toEqual([]);
  });

  it('new entry added to empty existing → added', () => {
    const newEntries = [createEntry('learnings', 0.8, 'New learning content')];

    const result = consolidate(newEntries, []);

    expect(result.added).toHaveLength(1);
    expect(result.added[0].content).toBe('New learning content');
    expect(result.skipped).toEqual([]);
    expect(result.updated).toEqual([]);
  });

  it('duplicate entry → skipped', () => {
    const existing: MemoryEntry[] = [
      { id: 'e1', agentId: 'sisyphus', scope: 'persistent', type: 'learnings', content: 'Same content', timestamp: Date.now(), confidence: 0.9, source: 'agent', tags: [] }
    ];
    const newEntries = [createEntry('learnings', 0.8, 'Same content')];

    const result = consolidate(newEntries, existing);

    expect(result.added).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('Duplicate of e1');
  });

  it('same type/agent/scope → updated (preferences type)', () => {
    const existing: MemoryEntry[] = [
      { id: 'e1', agentId: 'sisyphus', scope: 'persistent', type: 'preferences', content: 'Old preference', timestamp: Date.now() - 1000, confidence: 0.8, source: 'agent', tags: [] }
    ];
    const newEntries = [createEntry('preferences', 0.9, 'New preference')];

    const result = consolidate(newEntries, existing);

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].content).toBe('New preference');
    expect(result.added).toEqual([]);
  });

  it('higher confidence → updated', () => {
    const existing: MemoryEntry[] = [
      { id: 'e1', agentId: 'sisyphus', scope: 'persistent', type: 'learnings', content: 'Old learning', timestamp: Date.now() - 1000, confidence: 0.5, source: 'agent', tags: [] }
    ];
    const newEntries = [createEntry('learnings', 0.9, 'New learning with higher confidence')];

    const result = consolidate(newEntries, existing);

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].confidence).toBe(0.9);
  });

  it('lower confidence → added (not updated)', () => {
    const existing: MemoryEntry[] = [
      { id: 'e1', agentId: 'sisyphus', scope: 'persistent', type: 'learnings', content: 'High confidence existing', timestamp: Date.now() - 1000, confidence: 0.9, source: 'agent', tags: [] }
    ];
    const newEntries = [createEntry('learnings', 0.3, 'Lower confidence new learning')];

    const result = consolidate(newEntries, existing);

    expect(result.added).toHaveLength(1);
    expect(result.added[0].content).toBe('Lower confidence new learning');
    expect(result.updated).toEqual([]);
  });
});