/**
 * Memory-Soul: JSON Store Tests
 * TDD approach - tests written first
 */

import * as fs from 'fs';
import * as path from 'path';
import { JsonStore } from '../src/storage/json-store';

describe('JsonStore', () => {
  const testDir = path.join(__dirname, 'test-data', 'json-store');
  const store = new JsonStore({
    basePath: testDir,
    prettyPrint: true,
    createDirIfNotExist: true
  });

  beforeEach(() => {
    // Clean up before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('write and read', () => {
    it('should write and read a simple object', async () => {
      const key = 'test/simple';
      const value = { name: 'test', value: 42 };

      await store.write(key, value);
      const result = await store.read(key);

      expect(result).toEqual(value);
    });

    it('should write and read nested objects', async () => {
      const key = 'test/nested';
      const value = {
        user: {
          name: 'John',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        items: [1, 2, 3]
      };

      await store.write(key, value);
      const result = await store.read(key);

      expect(result).toEqual(value);
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await store.read('non/existent');
      expect(result).toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should return false for non-existent key', async () => {
      const result = await store.exists('non/existent');
      expect(result).toBe(false);
    });

    it('should return true after writing', async () => {
      const key = 'test/exists';
      await store.write(key, { test: true });
      const result = await store.exists(key);
      expect(result).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      const key = 'test/delete';
      await store.write(key, { toDelete: true });
      await store.delete(key);
      const result = await store.exists(key);
      expect(result).toBe(false);
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(store.delete('non/existent')).resolves.not.toThrow();
    });
  });

  describe('concurrent writes', () => {
    it('should handle concurrent writes to different keys', async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        store.write(`concurrent/${i}`, { index: i })
      );

      await Promise.all(writes);

      for (let i = 0; i < 10; i++) {
        const result = await store.read(`concurrent/${i}`) as { index: number };
        expect(result.index).toBe(i);
      }
    });
  });

  describe('file path handling', () => {
    it('should create nested directories', async () => {
      const key = 'deeply/nested/directory/file';
      await store.write(key, { deep: true });

      const result = await store.read(key);
      expect(result).toEqual({ deep: true });
    });

    it('should handle keys with leading/trailing slashes', async () => {
      const key = '/test/slashes/';
      await store.write(key, { trimmed: true });

      const result = await store.read('test/slashes');
      expect(result).toEqual({ trimmed: true });
    });
  });
});
