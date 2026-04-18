import * as fs from 'fs';
import * as path from 'path';
import { IMemoryStore, MemoryFilter } from '../memory/interfaces';
import { ensureDir, isPathSafe } from '../shared/utils';

export interface JsonStoreConfig {
  basePath: string;
  prettyPrint: boolean;
  createDirIfNotExist: boolean;
}

const DEFAULT_CONFIG: JsonStoreConfig = {
  basePath: '.opencode/memory-soul',
  prettyPrint: true,
  createDirIfNotExist: true
};

export class JsonStore implements IMemoryStore {
  private basePath: string;
  private prettyPrint: boolean;
  private locks: Map<string, Promise<void>>;
  private createDirIfNotExist: boolean;

  constructor(config: Partial<JsonStoreConfig> = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    this.basePath = merged.basePath;
    this.prettyPrint = merged.prettyPrint;
    this.createDirIfNotExist = merged.createDirIfNotExist;
    this.locks = new Map();

    if (this.createDirIfNotExist) {
      ensureDir(this.basePath);
    }
  }

  private getFilePath(key: string): string {
    const sanitized = key.replace(/^\/+|\/+$/g, '');
    if (!isPathSafe(sanitized)) {
      throw new Error(`Invalid key contains path traversal attempt: ${key}`);
    }
    return path.join(this.basePath, sanitized + '.json');
  }

  private safeJsonParse<T>(content: string, filePath: string, defaultValue: T): T {
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      console.warn(`[json-store] Corrupted JSON at ${filePath}, returning null`);
      return defaultValue;
    }
  }

  private async acquireLock(key: string): Promise<() => void> {
    const lockKey = 'lock_' + key;
    while (this.locks.has(lockKey)) {
      await this.locks.get(lockKey);
    }
    
    let release: () => void;
    const lockPromise = new Promise<void>(resolve => {
      release = resolve;
    });
    this.locks.set(lockKey, lockPromise);
    
    return () => {
      this.locks.delete(lockKey);
      release!();
    };
  }

  async read(key: string): Promise<unknown> {
    const release = await this.acquireLock(key);
    try {
      const filePath = this.getFilePath(key);
      if (!fs.existsSync(filePath)) {
        return undefined;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.safeJsonParse<unknown>(content, filePath, undefined);
    } finally {
      release();
    }
  }

  async write(key: string, value: unknown): Promise<void> {
    const release = await this.acquireLock(key);
    try {
      const filePath = this.getFilePath(key);
      const dir = path.dirname(filePath);
      ensureDir(dir);
      
      const content = this.prettyPrint
        ? JSON.stringify(value, null, 2)
        : JSON.stringify(value);
      
      fs.writeFileSync(filePath, content, 'utf-8');
    } finally {
      release();
    }
  }

  async delete(key: string): Promise<void> {
    const release = await this.acquireLock(key);
    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } finally {
      release();
    }
  }

  async query(filter: MemoryFilter): Promise<unknown[]> {
    const index = await this.getIndex();
    return this.filterEntries(index, filter);
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    return fs.existsSync(filePath);
  }

  private async getIndex(): Promise<Record<string, unknown>> {
    const indexPath = path.join(this.basePath, '_index.json');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return this.safeJsonParse<Record<string, unknown>>(content, indexPath, {});
    }
    return {};
  }

  private filterEntries(
    entries: Record<string, unknown>,
    filter: MemoryFilter
  ): unknown[] {
    const results: unknown[] = [];
    for (const [key, meta] of Object.entries(entries)) {
      const m = meta as Record<string, unknown>;
      if (filter.agentId && m['agentId'] !== filter.agentId) continue;
      if (filter.type && m['type'] !== filter.type) continue;
      
      const lastUpdated = m['lastUpdated'] as number | undefined;
      if (filter.since && lastUpdated && lastUpdated < filter.since) continue;
      
      results.push({ key, ...m });
    }
    if (filter.limit) {
      return results.slice(0, filter.limit);
    }
    return results;
  }
}

export function createStore(config?: Partial<JsonStoreConfig>): JsonStore {
  return new JsonStore(config);
}
