/**
 * Memory-Soul: Identity Store Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentIdentity } from '../src/memory/interfaces';
import { IdentityStore, createIdentityStore } from '../src/identity/identity-store';
import { getDefaultIdentities } from '../src/identity/defaults';

describe('IdentityStore', () => {
  const testDir = '.opencode/test-memory-soul';
  let store: IdentityStore;

  beforeEach(() => {
    store = createIdentityStore({ basePath: testDir });
  });

  afterEach(() => {
    // Clean up test directory
    const identityDir = path.join(testDir, 'identities');
    if (fs.existsSync(identityDir)) {
      fs.rmSync(identityDir, { recursive: true });
    }
  });

  describe('load', () => {
    it('should load non-existent identity as default', async () => {
      const identity = await store.load('unknown-agent');
      expect(identity.agentId).toBe('unknown-agent');
      expect(identity.name).toBe('unknown-agent');
      expect(identity.role).toBe('Assistant');
      expect(identity.capabilities).toEqual(['general-assistance']);
    });

    it('should load saved identity', async () => {
      const saved: AgentIdentity = {
        agentId: 'test-agent',
        name: 'Test Agent',
        role: 'Tester',
        personality: 'Thorough',
        capabilities: ['testing', 'validation'],
        constraints: ['must test everything'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await store.save(saved);
      const loaded = await store.load('test-agent');
      expect(loaded.name).toBe('Test Agent');
      expect(loaded.role).toBe('Tester');
      expect(loaded.capabilities).toEqual(['testing', 'validation']);
    });
  });

  describe('save and reload', () => {
    it('should round-trip correctly', async () => {
      const original: AgentIdentity = {
        agentId: 'roundtrip-test',
        name: 'Roundtrip Test',
        role: 'Testing Role',
        personality: 'Precise',
        capabilities: ['save', 'load', 'validate'],
        constraints: ['no partial saves'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await store.save(original);
      const loaded = await store.load('roundtrip-test');
      expect(loaded.agentId).toBe(original.agentId);
      expect(loaded.name).toBe(original.name);
      expect(loaded.role).toBe(original.role);
      expect(loaded.capabilities).toEqual(original.capabilities);
      expect(loaded.constraints).toEqual(original.constraints);
    });
  });

  describe('toContext', () => {
    it('should output contains name, role, capabilities', () => {
      const identity: AgentIdentity = {
        agentId: 'test',
        name: 'Test Agent',
        role: 'Tester',
        personality: 'Precise',
        capabilities: ['testing', 'validation'],
        constraints: ['must validate'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const context = store.toContext(identity);
      expect(context).toContain('Test Agent');
      expect(context).toContain('Tester');
      expect(context).toContain('testing');
      expect(context).toContain('validation');
    });

    it('should output be less than 400 words', () => {
      const identity: AgentIdentity = {
        agentId: 'test',
        name: 'Test Agent',
        role: 'Tester',
        personality: 'Precise and thorough. Validates all edge cases.',
        capabilities: ['testing', 'validation', 'analysis', 'review', 'verification', 'quality'],
        constraints: ['must validate', 'never skip tests', 'always verify'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const context = store.toContext(identity);
      const wordCount = context.split(/\s+/).length;
      expect(wordCount).toBeLessThan(400);
    });

    it('should cap capabilities at 5', () => {
      const identity: AgentIdentity = {
        agentId: 'test',
        name: 'Test',
        role: 'Tester',
        personality: 'Test',
        capabilities: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        constraints: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const context = store.toContext(identity);
      expect(context).toContain('- a');
      expect(context).toContain('- b');
      expect(context).toContain('- c');
      expect(context).toContain('- d');
      expect(context).toContain('- e');
      expect(context).not.toContain('- f');
      expect(context).not.toContain('- g');
    });

    it('should cap constraints at 3', () => {
      const identity: AgentIdentity = {
        agentId: 'test',
        name: 'Test',
        role: 'Tester',
        personality: 'Test',
        capabilities: [],
        constraints: ['a', 'b', 'c', 'd', 'e'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const context = store.toContext(identity);
      expect(context).toContain('- a');
      expect(context).toContain('- b');
      expect(context).toContain('- c');
      expect(context).not.toContain('- d');
      expect(context).not.toContain('- e');
    });
  });

  describe('validation', () => {
    it('should reject missing agentId', async () => {
      const identity = {
        agentId: '',
        name: 'Test',
        role: 'Tester',
        personality: 'Test',
        capabilities: [],
        constraints: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as AgentIdentity;
      await expect(store.save(identity)).rejects.toThrow(Error);
    });

    it('should reject missing name', async () => {
      const identity = {
        agentId: 'test',
        name: '',
        role: 'Tester',
        personality: 'Test',
        capabilities: [],
        constraints: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as AgentIdentity;
      await expect(store.save(identity)).rejects.toThrow(Error);
    });

    it('should reject missing role', async () => {
      const identity = {
        agentId: 'test',
        name: 'Test',
        role: '',
        personality: 'Test',
        capabilities: [],
        constraints: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as AgentIdentity;
      await expect(store.save(identity)).rejects.toThrow(Error);
    });
  });

  describe('exists', () => {
    it('should return false for non-existent identity', async () => {
      const exists = await store.exists('non-existent-agent');
      expect(exists).toBe(false);
    });

    it('should return true after save', async () => {
      const identity: AgentIdentity = {
        agentId: 'exists-test',
        name: 'Exists Test',
        role: 'Tester',
        personality: 'Test',
        capabilities: [],
        constraints: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await store.save(identity);
      const exists = await store.exists('exists-test');
      expect(exists).toBe(true);
    });
  });

  describe('path traversal', () => {
    it('should throw on path traversal attempt', async () => {
      await expect(store.load('../hack')).rejects.toThrow(Error);
    });

    it('should throw on absolute path', async () => {
      await expect(store.load('/etc/passwd')).rejects.toThrow(Error);
    });
  });

  describe('default identities', () => {
    it('should have correct name and role for sisyphus', async () => {
      const identity = await store.load('sisyphus');
      expect(identity.name).toBe('Sisyphus');
      expect(identity.role).toBe('Builder & Orchestrator — turns plans into working code through delegation');
      expect(identity.capabilities).toContain('code-implementation');
    });

    it('should have generic values for unknown agent', async () => {
      const identity = await store.load('completely-unknown-agent');
      expect(identity.name).toBe('completely-unknown-agent');
      expect(identity.role).toBe('Assistant');
      expect(identity.capabilities).toEqual(['general-assistance']);
    });

    it('should have correct identity for all 8 known agents', async () => {
      const defaults = getDefaultIdentities();
      const agentIds = ['sisyphus', 'atlas', 'prometheus', 'oracle', 'librarian', 'explore', 'metis', 'momus'];
      for (const agentId of agentIds) {
        const identity = await store.load(agentId);
        expect(identity.name).toBe(defaults[agentId].name);
        expect(identity.role).toBe(defaults[agentId].role);
        expect(identity.capabilities).toEqual(defaults[agentId].capabilities);
      }
    });
  });
});