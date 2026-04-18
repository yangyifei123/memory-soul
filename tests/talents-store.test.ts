/**
 * Memory-Soul: Talents Store Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { TalentsStore, createTalentsStore } from '../src/talents/talents-store';
import { getDefaultTalents } from '../src/talents/defaults';
import { AgentTalents, TalentSkill } from '../src/memory/interfaces';

describe('TalentsStore', () => {
  const testBasePath = `.opencode/test-memory-soul-${Date.now()}/talents`;
  let store: TalentsStore;

  beforeEach(() => {
    // Clean up test directory before each test
    const cleanupPath = testBasePath.split('/talents')[0];
    if (fs.existsSync(cleanupPath)) {
      try {
        fs.rmSync(cleanupPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    store = createTalentsStore({ basePath: testBasePath });
  });

  afterEach(() => {
    // Clean up after tests - use try-catch for robustness
    const cleanupPath = testBasePath.split('/talents')[0];
    if (fs.existsSync(cleanupPath)) {
      try {
        fs.rmSync(cleanupPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors on Windows
      }
    }
  });

  describe('load', () => {
    it('should return default for non-existent agent', async () => {
      const talents = await store.load('unknown-agent');
      expect(talents.agentId).toBe('unknown-agent');
      expect(talents.skills).toEqual([]);
      expect(talents.autoLoad).toBe(true);
    });

    it('should return saved talents for existing agent', async () => {
      const savedTalents: AgentTalents = {
        agentId: 'test-agent',
        skills: [
          { name: 'test-skill', reason: 'Test reason', priority: 5, required: false }
        ],
        autoLoad: true,
        updatedAt: Date.now()
      };
      await store.save(savedTalents);

      const loaded = await store.load('test-agent');
      expect(loaded.agentId).toBe('test-agent');
      expect(loaded.skills).toHaveLength(1);
      expect(loaded.skills[0].name).toBe('test-skill');
    });
  });

  describe('save and reload', () => {
    it('should round-trip correctly', async () => {
      const original: AgentTalents = {
        agentId: 'round-trip-agent',
        skills: [
          { name: 'skill-a', reason: 'Reason A', priority: 10, required: true },
          { name: 'skill-b', reason: 'Reason B', priority: 5, required: false }
        ],
        autoLoad: true,
        updatedAt: Date.now()
      };

      await store.save(original);
      const loaded = await store.load('round-trip-agent');

      expect(loaded.agentId).toBe(original.agentId);
      expect(loaded.skills).toEqual(original.skills);
      expect(loaded.autoLoad).toBe(original.autoLoad);
    });
  });

  describe('getSkillNames', () => {
    it('should return skills ordered by priority (highest first)', () => {
      const talents: AgentTalents = {
        agentId: 'test-agent',
        skills: [
          { name: 'low-priority', reason: 'Low', priority: 2, required: false },
          { name: 'high-priority', reason: 'High', priority: 10, required: true },
          { name: 'medium-priority', reason: 'Med', priority: 5, required: false }
        ],
        autoLoad: true,
        updatedAt: Date.now()
      };

      const skillNames = store.getSkillNames(talents);
      expect(skillNames).toEqual(['high-priority', 'medium-priority', 'low-priority']);
    });

    it('should return empty array for empty talents', () => {
      const talents: AgentTalents = {
        agentId: 'empty-agent',
        skills: [],
        autoLoad: true,
        updatedAt: Date.now()
      };

      const skillNames = store.getSkillNames(talents);
      expect(skillNames).toEqual([]);
    });
  });

  describe('addSkill', () => {
    it('should add skill to existing talents', async () => {
      const skill: TalentSkill = {
        name: 'new-skill',
        reason: 'New skill reason',
        priority: 7,
        required: false
      };

      await store.addSkill('test-agent', skill);
      const talents = await store.load('test-agent');

      expect(talents.skills).toHaveLength(1);
      expect(talents.skills[0].name).toBe('new-skill');
    });

    it('should no-op when adding duplicate skill', async () => {
      const skill: TalentSkill = {
        name: 'duplicate-skill',
        reason: 'Reason',
        priority: 5,
        required: false
      };

      await store.addSkill('test-agent', skill);
      await store.addSkill('test-agent', skill);

      const talents = await store.load('test-agent');
      expect(talents.skills).toHaveLength(1);
    });
  });

  describe('removeSkill', () => {
    it('should remove skill from existing talents', async () => {
      const talent: AgentTalents = {
        agentId: 'remove-test',
        skills: [
          { name: 'skill-to-remove', reason: 'Remove me', priority: 5, required: false },
          { name: 'skill-to-keep', reason: 'Keep me', priority: 3, required: false }
        ],
        autoLoad: true,
        updatedAt: Date.now()
      };
      await store.save(talent);

      await store.removeSkill('remove-test', 'skill-to-remove');
      const talents = await store.load('remove-test');

      expect(talents.skills).toHaveLength(1);
      expect(talents.skills[0].name).toBe('skill-to-keep');
    });

    it('should no-op when removing non-existent skill', async () => {
      const talent: AgentTalents = {
        agentId: 'remove-nonexistent',
        skills: [
          { name: 'existing-skill', reason: 'Exists', priority: 5, required: false }
        ],
        autoLoad: true,
        updatedAt: Date.now()
      };
      await store.save(talent);

      await store.removeSkill('remove-nonexistent', 'non-existent-skill');
      const talents = await store.load('remove-nonexistent');

      expect(talents.skills).toHaveLength(1);
    });
  });

  describe('exists', () => {
    it('should return false for non-existent agent', async () => {
      const exists = await store.exists('non-existent-agent');
      expect(exists).toBe(false);
    });

    it('should return true after save', async () => {
      const talents: AgentTalents = {
        agentId: 'exists-test',
        skills: [],
        autoLoad: true,
        updatedAt: Date.now()
      };
      await store.save(talents);

      const exists = await store.exists('exists-test');
      expect(exists).toBe(true);
    });
  });

  describe('default talents', () => {
    it('should include git-master for sisyphus', () => {
      const defaults = getDefaultTalents();
      const sisyphusSkills = defaults['sisyphus'];
      expect(sisyphusSkills.some(s => s.name === 'git-master')).toBe(true);
    });

    it('should have correct count for sisyphus', () => {
      const defaults = getDefaultTalents();
      const sisyphusSkills = defaults['sisyphus'];
      expect(sisyphusSkills).toHaveLength(4);
    });
  });

  describe('path traversal protection', () => {
    it('should throw Error for path traversal on agentId', async () => {
      await expect(store.load('../hack')).rejects.toThrow(Error);
    });
  });
});