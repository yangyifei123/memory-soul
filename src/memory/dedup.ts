import * as crypto from 'crypto';
import { MemoryEntry } from './interfaces';
import { STOP_WORDS } from '../shared/constants';

/**
 * Generate content hash for deduplication.
 * Normalizes whitespace and case for comparison.
 */
export function contentHash(text: string): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Calculate Jaccard similarity between two texts.
 * Returns 0.0 (completely different) to 1.0 (identical).
 * Uses stop word filtering to reduce false positives.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const normalize = (s: string) => new Set(
    s.toLowerCase().trim().split(/\s+/)
      .filter(w => w.length > 2)
      .filter(w => !STOP_WORDS.has(w))
  );
  const setA = normalize(a);
  const setB = normalize(b);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Check if a memory entry is duplicate or near-duplicate of existing entries.
 * Returns { isDuplicate: boolean, similarTo?: string }
 */
export function checkDuplicate(
  entry: MemoryEntry,
  existingEntries: MemoryEntry[],
  similarityThreshold: number = 0.7
): { isDuplicate: boolean; similarTo?: string } {
  const hash = contentHash(entry.content);

  for (const existing of existingEntries) {
    // T1: Exact hash match
    if (contentHash(existing.content) === hash) {
      return { isDuplicate: true, similarTo: existing.id };
    }

    // T2: Jaccard similarity
    const similarity = jaccardSimilarity(entry.content, existing.content);
    if (similarity >= similarityThreshold) {
      return { isDuplicate: true, similarTo: existing.id };
    }
  }

  return { isDuplicate: false };
}