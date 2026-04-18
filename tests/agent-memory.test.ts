/**
 * Memory-Soul: Agent Memory Tests
 * TDD approach - tests written first
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentMemory } from '../src/memory/agent-memory';

describe('AgentMemory', () => {
  const testDir = path.join(__dirname, 'test-data', 'agent-memory');
  const agentId = 'sisyphus';
  
  let memory: AgentMemory;

  beforeEach(() => {
    // Clean and create fresh directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    memory = new AgentMemory({
      agentId,
      basePath: testDir,
      maxSessions: 5
    });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('Session Management', () => {
    it('should save and retrieve a session', async () => {
      const session = {
        sessionId: 'test-session-1',
        agentId,
        startTime: Date.now(),
        interactions: [],
        learnings: [],
        preferences: {}
      };

      await memory.saveSession(session);
      const result = await memory.getSession('test-session-1');

      expect(result).toEqual(session);
    });

    it('should return recent sessions in order', async () => {
      for (let i = 1; i <= 3; i++) {
        await memory.saveSession({
          sessionId: `session-${i}`,
          agentId,
          startTime: Date.now() - i * 1000,
          interactions: [],
          learnings: [],
          preferences: {}
        });
      }

      const recent = await memory.getRecentSessions(2);
      expect(recent.length).toBe(2);
      // Most recent first
      expect(recent[0].sessionId).toBe('session-3');
      expect(recent[1].sessionId).toBe('session-2');
    });

    it('should limit stored sessions to maxSessions', async () => {
      for (let i = 1; i <= 10; i++) {
        await memory.saveSession({
          sessionId: `session-${i}`,
          agentId,
          startTime: Date.now() - i * 1000,
          interactions: [],
          learnings: [],
          preferences: {}
        });
      }

      const recent = await memory.getRecentSessions(10);
      // Should only have 5 (maxSessions)
      expect(recent.length).toBe(5);
    });
  });

  describe('Memory Entry Management', () => {
    it('should add and retrieve memories', async () => {
      const entry = await memory.addMemory({
        agentId,
        scope: 'persistent',
        type: 'learnings',
        content: 'User prefers concise responses',
        confidence: 0.8,
        source: 'agent',
        tags: ['preference']
      });

      const memories = await memory.getMemories();
      expect(memories.length).toBe(1);
      expect(memories[0].content).toBe('User prefers concise responses');
    });

    it('should filter memories by scope', async () => {
      await memory.addMemory({
        agentId,
        scope: 'persistent',
        type: 'learnings',
        content: 'Persistent memory',
        confidence: 0.8,
        source: 'agent',
        tags: []
      });

      await memory.addMemory({
        agentId,
        scope: 'ephemeral',
        type: 'context',
        content: 'Ephemeral memory',
        confidence: 0.5,
        source: 'agent',
        tags: []
      });

      const persistentMemories = await memory.getMemories('persistent');
      expect(persistentMemories.length).toBe(1);
      expect(persistentMemories[0].content).toBe('Persistent memory');
    });

    it('should filter memories by type', async () => {
      await memory.addMemory({
        agentId,
        scope: 'persistent',
        type: 'learnings',
        content: 'Learning 1',
        confidence: 0.8,
        source: 'agent',
        tags: []
      });

      await memory.addMemory({
        agentId,
        scope: 'persistent',
        type: 'patterns',
        content: 'Pattern 1',
        confidence: 0.7,
        source: 'agent',
        tags: []
      });

      const learnings = await memory.getLearnings();
      const patterns = await memory.getPatterns();

      expect(learnings.length).toBe(1);
      expect(learnings[0].content).toBe('Learning 1');
      expect(patterns.length).toBe(1);
      expect(patterns[0].content).toBe('Pattern 1');
    });
  });

  describe('Interaction Tracking', () => {
    it('should add and retrieve interactions', async () => {
      const interaction = await memory.addInteraction({
        type: 'tool-execution',
        content: 'Executed bash command',
        toolName: 'bash',
        success: true,
        duration: 100
      });

      const recent = await memory.getRecentInteractions();
      expect(recent.length).toBe(1);
      expect(recent[0].toolName).toBe('bash');
    });

    it('should limit recent interactions', async () => {
      for (let i = 0; i < 20; i++) {
        await memory.addInteraction({
          type: 'user-message',
          content: `Message ${i}`,
          success: true
        });
      }

      const recent = await memory.getRecentInteractions(10);
      expect(recent.length).toBe(10);
    });
  });

  describe('Pattern Detection', () => {
    it('should detect frequent tool usage patterns', async () => {
      // Add multiple uses of same tool
      for (let i = 0; i < 5; i++) {
        await memory.addInteraction({
          type: 'tool-execution',
          content: 'Read file',
          toolName: 'read',
          success: true
        });
      }

      const patterns = await memory.detectPatterns(
        await memory.getRecentInteractions(20)
      );

      expect(patterns.length).toBeGreaterThan(0);
      const readPattern = patterns.find(p => p.description.includes('read'));
      expect(readPattern).toBeDefined();
      expect(readPattern!.frequency).toBe(5);
    });

    it('should calculate success rate correctly', async () => {
      // 3 successful, 1 failed
      for (let i = 0; i < 3; i++) {
        await memory.addInteraction({
          type: 'tool-execution',
          content: 'Command',
          toolName: 'bash',
          success: true
        });
      }
      await memory.addInteraction({
        type: 'tool-execution',
        content: 'Command',
        toolName: 'bash',
        success: false
      });

      const patterns = await memory.detectPatterns(
        await memory.getRecentInteractions(10)
      );

      const bashPattern = patterns.find(p => p.description.includes('bash'));
      expect(bashPattern!.success).toBe(0.75);
    });
  });

  describe('Learnings Extraction', () => {
    it('should extract learnings from successful session', async () => {
      const session = {
        sessionId: 'learning-session',
        agentId,
        startTime: Date.now() - 60000,
        interactions: [
          {
            id: '1',
            type: 'tool-execution' as const,
            content: 'Created file',
            toolName: 'write',
            success: true,
            timestamp: Date.now() - 30000
          },
          {
            id: '2',
            type: 'tool-execution' as const,
            content: 'Read file',
            toolName: 'read',
            success: true,
            timestamp: Date.now() - 20000
          }
        ],
        learnings: [],
        preferences: {}
      };

      await memory.saveSession(session);
      const learnings = await memory.extractLearnings(session);

      expect(learnings.length).toBeGreaterThan(0);
      expect(learnings.some(l => l.includes('successfully executed'))).toBe(true);
    });
  });
});
