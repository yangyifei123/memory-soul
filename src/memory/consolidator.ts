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

/**
 * Determine whether a new entry should replace an existing one.
 *
 * Merge strategy per memory type:
 * - learnings: NEVER replace (always add new, dedup handles duplicates)
 * - preferences: ALWAYS replace (latest wins)
 * - context: ALWAYS replace (latest wins)
 * - patterns: NEVER replace (additive only)
 * - default: NEVER replace
 *
 * @param newEntry - The candidate new entry
 * @param existing - The existing entry to potentially replace
 * @returns true if the existing entry should be replaced, false otherwise
 */
function shouldReplace(
  newEntry: Omit<MemoryEntry, 'id' | 'timestamp'>,
  existing: MemoryEntry
): boolean {
  // learnings: NEVER replace, always add separately (dedup handles duplicates)
  if (newEntry.type === 'learnings') {
    return false;  // Never replace learnings, always append new
  }

  // preferences and context: replace with newer/higher confidence
  if (newEntry.type === 'preferences' || newEntry.type === 'context') {
    return true;  // Replace with latest
  }

  // patterns: merge by updating frequency (handled separately if needed)
  if (newEntry.type === 'patterns') {
    return false;  // Patterns are additive
  }

  return false;  // Default: don't replace
}