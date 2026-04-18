import { contentHash, jaccardSimilarity, checkDuplicate } from '../src/memory/dedup';
import { MemoryEntry } from '../src/memory/interfaces';

describe('MemoryDedup', () => {
  describe('contentHash', () => {
    it('produces consistent hash', () => {
      const text = 'Hello World';
      const hash1 = contentHash(text);
      const hash2 = contentHash(text);

      expect(hash1).toBe(hash2);
    });

    it('normalizes whitespace', () => {
      const hash1 = contentHash('Hello   World');
      const hash2 = contentHash('Hello World');

      expect(hash1).toBe(hash2);
    });

    it('normalizes case', () => {
      const hash1 = contentHash('Hello World');
      const hash2 = contentHash('hello world');

      expect(hash1).toBe(hash2);
    });
  });

  describe('jaccardSimilarity', () => {
    it('identical texts → 1.0', () => {
      const similarity = jaccardSimilarity('Hello World', 'Hello World');

      expect(similarity).toBe(1.0);
    });

    it('completely different → ~0', () => {
      const similarity = jaccardSimilarity('cat dog bird', 'zebra elephant lion');

      expect(similarity).toBeLessThan(0.1);
    });

    it('partial overlap → 0 < x < 1', () => {
      const similarity = jaccardSimilarity('Hello World testing', 'Hello World example');

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('checkDuplicate', () => {
    const createEntry = (id: string, content: string): MemoryEntry => ({
      id,
      agentId: 'sisyphus',
      scope: 'persistent',
      type: 'learnings',
      content,
      timestamp: Date.now(),
      confidence: 0.9,
      source: 'agent',
      tags: []
    });

    it('exact match → isDuplicate true', () => {
      const existing = [createEntry('e1', 'Same content')];
      const newEntry = createEntry('n1', 'Same content');

      const result = checkDuplicate(newEntry, existing);

      expect(result.isDuplicate).toBe(true);
      expect(result.similarTo).toBe('e1');
    });

    it('near-duplicate (Jaccard > 0.7) → isDuplicate true', () => {
      const existing = [createEntry('e1', 'The quick brown fox jumps over the lazy dog')];
      const newEntry = createEntry('n1', 'The quick brown fox jumps over the lazy cat');

      const result = checkDuplicate(newEntry, existing);

      expect(result.isDuplicate).toBe(true);
    });

    it('unique content → isDuplicate false', () => {
      const existing = [createEntry('e1', 'Completely different content here')];
      const newEntry = createEntry('n1', 'Another totally unrelated piece of information');

      const result = checkDuplicate(newEntry, existing);

      expect(result.isDuplicate).toBe(false);
    });
  });
});