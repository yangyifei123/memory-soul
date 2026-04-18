/**
 * Memory-Soul: Shared Utilities
 * Common utilities used across the codebase
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** Ensure directory exists */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** Generate collision-safe ID */
export function generateId(prefix?: string): string {
  return (prefix ? prefix + '-' : '') + crypto.randomUUID().slice(0, 8);
}

/** Validate path safety - reject traversal attempts */
export function isPathSafe(input: string): boolean {
  const normalized = path.normalize(input).replace(/\\/g, '/');
  return !normalized.includes('..') && !path.isAbsolute(input);
}

/** Sanitize agentId for use in paths */
export function sanitizeAgentId(agentId: string): string {
  // First check if the original input is safe (reject traversal)
  if (!isPathSafe(agentId)) {
    throw new Error(`Invalid agentId: ${agentId}`);
  }
  const safe = agentId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (safe.length === 0) {
    throw new Error(`Invalid agentId: ${agentId}`);
  }
  return safe;
}