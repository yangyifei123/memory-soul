import * as crypto from 'crypto';
import { MemoryEntry } from './interfaces';
import { checkDuplicate } from './dedup';

export interface ConsolidationResult {
  added: MemoryEntry[];
  skipped: { entry: MemoryEntry; reason: string }[];
  updated: MemoryEntry[];
}

/**
 * Consolidate new learnings into existing memories.
 * - learnings: append (additive, dedup checked)
 * - preferences: replace (latest wins)
 * - patterns: update frequency (merge by content hash)
 * - context: replace if older, keep newer
 */
export function consolidate(
  newEntries: Omit<MemoryEntry, 'id' | 'timestamp'>[],
  existingEntries: MemoryEntry[]
): ConsolidationResult {
  const result: ConsolidationResult = { added: [], skipped: [], updated: [] };

  for (const entry of newEntries) {
    const dup = checkDuplicate(entry as MemoryEntry, existingEntries);

    if (dup.isDuplicate) {
      result.skipped.push({
        entry: entry as MemoryEntry,
        reason: `Duplicate of ${dup.similarTo}`
      });
      continue;
    }

    // Check if we should update an existing entry of same type+agent
    const existing = findMergeCandidate(entry, existingEntries);
    if (existing && shouldReplace(entry, existing)) {
      // Update existing
      const updated: MemoryEntry = {
        ...existing,
        content: entry.content,
        confidence: Math.max(existing.confidence, entry.confidence),
        timestamp: Date.now()
      };
      result.updated.push(updated);
    } else {
      // Add new
      const full: MemoryEntry = {
        ...entry,
        id: crypto.randomUUID().slice(0, 12),
        timestamp: Date.now()
      };
      result.added.push(full);
    }
  }

  return result;
}

function findMergeCandidate(
  entry: Omit<MemoryEntry, 'id' | 'timestamp'>,
  existing: MemoryEntry[]
): MemoryEntry | undefined {
  return existing.find(e =>
    e.agentId === entry.agentId &&
    e.type === entry.type &&
    e.scope === entry.scope
  );
}

function shouldReplace(
  newEntry: Omit<MemoryEntry, 'id' | 'timestamp'>,
  existing: MemoryEntry
): boolean {
  // Replace preferences and context with newer
  if (newEntry.type === 'preferences' || newEntry.type === 'context') {
    return true;
  }
  // Keep higher confidence
  return newEntry.confidence > existing.confidence;
}