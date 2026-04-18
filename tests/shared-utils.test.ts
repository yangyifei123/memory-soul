/**
 * Memory-Soul: Shared Utils Tests
 */

import { generateId, isPathSafe, sanitizeAgentId } from '../src/shared/utils';

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    // All 100 IDs should be unique
    expect(ids.size).toBe(100);
  });

  it('should generate ID with prefix when provided', () => {
    const id = generateId('prefix');
    expect(id.startsWith('prefix-')).toBe(true);
  });

  it('should generate ID without prefix when not provided', () => {
    const id = generateId();
    expect(id.includes('-')).toBe(false);
  });
});

describe('isPathSafe', () => {
  it('should return true for normal relative paths', () => {
    expect(isPathSafe('foo')).toBe(true);
    expect(isPathSafe('foo/bar')).toBe(true);
    expect(isPathSafe('./foo')).toBe(true);
    expect(isPathSafe('foo/../bar')).toBe(true); // After normalization, this is just 'bar'
  });

  it('should return false for path traversal attempts', () => {
    expect(isPathSafe('../etc/passwd')).toBe(false);
    expect(isPathSafe('foo/../../etc/passwd')).toBe(false);
    expect(isPathSafe('..')).toBe(false);
  });

  it('should return false for absolute paths', () => {
    expect(isPathSafe('/absolute/path')).toBe(false);
    expect(isPathSafe('C:/windows')).toBe(false);
  });
});

describe('sanitizeAgentId', () => {
  it('should return safe agentId unchanged', () => {
    expect(sanitizeAgentId('sisyphus')).toBe('sisyphus');
    expect(sanitizeAgentId('my-agent')).toBe('my-agent');
    expect(sanitizeAgentId('agent_123')).toBe('agent_123');
  });

  it('should replace invalid characters with underscores', () => {
    expect(sanitizeAgentId('my agent')).toBe('my_agent');
    expect(sanitizeAgentId('agent@test')).toBe('agent_test');
  });

  it('should throw Error for path traversal attempt', () => {
    expect(() => sanitizeAgentId('../hack')).toThrow(Error);
  });

  it('should throw Error for empty string', () => {
    expect(() => sanitizeAgentId('')).toThrow(Error);
  });

  it('should throw Error for absolute paths', () => {
    expect(() => sanitizeAgentId('/absolute')).toThrow(Error);
  });
});