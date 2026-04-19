import * as fs from 'fs';
import * as path from 'path';
import { createAgentMemory } from '../src/memory/agent-memory';

describe('AgentMemory Extended Features', () => {
  const testDir = path.join(__dirname, 'test-data', 'extended');
  const agentId = 'sisyphus';
  let memory: ReturnType<typeof createAgentMemory>;

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    memory = createAgentMemory({ agentId, basePath: testDir });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it('deleteMemory removes entry and updates index', async () => {
    const entry = await memory.addMemory({
      agentId,
      scope: 'persistent',
      type: 'learnings',
      content: 'Test learning to delete',
      confidence: 0.8,
      source: 'agent',
      tags: []
    });
    
    expect(await memory.getMemoryCount()).toBe(1);
    
    const deleted = await memory.deleteMemory(entry.id);
    expect(deleted).toBe(true);
    expect(await memory.getMemoryCount()).toBe(0);
  });

  it('deleteMemory returns false for non-existent', async () => {
    const deleted = await memory.deleteMemory('non-existent-id');
    expect(deleted).toBe(false);
  });

  it('searchMemories finds matching entries', async () => {
    await memory.addMemory({
      agentId, scope: 'persistent', type: 'learnings',
      content: 'User prefers TypeScript over JavaScript',
      confidence: 0.8, source: 'agent', tags: ['lang']
    });
    await memory.addMemory({
      agentId, scope: 'persistent', type: 'learnings',
      content: 'Always use strict mode in Python',
      confidence: 0.7, source: 'agent', tags: ['lang']
    });
    await memory.addMemory({
      agentId, scope: 'persistent', type: 'learnings',
      content: 'Test with no match here',
      confidence: 0.6, source: 'agent', tags: []
    });

    const results = await memory.searchMemories('TypeScript');
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('TypeScript');

    const results2 = await memory.searchMemories('');
    expect(results2).toHaveLength(0);

    const results3 = await memory.searchMemories('python');
    expect(results3).toHaveLength(1);
  });

  it('getMemoryCount returns correct count', async () => {
    expect(await memory.getMemoryCount()).toBe(0);

    await memory.addMemory({
      agentId, scope: 'persistent', type: 'learnings',
      content: 'Learning 1', confidence: 0.8, source: 'agent', tags: []
    });
    await memory.addMemory({
      agentId, scope: 'persistent', type: 'learnings',
      content: 'Learning 2', confidence: 0.8, source: 'agent', tags: []
    });

    expect(await memory.getMemoryCount()).toBe(2);
  });
});
