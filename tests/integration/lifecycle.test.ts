import * as fs from 'fs';
import * as path from 'path';
import { MemoryHookRegistry, createMemoryHookRegistry } from '../../src/hooks/registry';

describe('Full Lifecycle Integration', () => {
  const testDir = path.join(__dirname, '..', 'test-data', 'integration');
  const agentId = 'sisyphus';
  const userId = 'test-user-int';
  const sessionId = 'integration-session-1';

  let registry: MemoryHookRegistry;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    registry = createMemoryHookRegistry({
      userId,
      basePath: testDir
    });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should complete full session lifecycle', async () => {
    // 1. Session start
    await registry.onSessionStart(agentId, sessionId);

    // 2. Agent context contains identity
    const context = await registry.getAgentContext(agentId);
    expect(context).toContain('Sisyphus');
    expect(context).toContain('Builder');
    expect(context).toContain('Talents');
    expect(context).toContain('git-master');
    expect(context).toContain('(required)');

    // 3. Chat message with tool execution
    await registry.postChatMessage(agentId, sessionId, 'Fix the bug in auth.ts', 'I found the issue...');
    await registry.postToolExecution(agentId, sessionId, 'read', {}, 'file content', true, 50);
    await registry.postToolExecution(agentId, sessionId, 'edit', {}, 'saved', true, 100);

    // 4. Session end with summarization
    await registry.onSessionEnd(agentId, sessionId);

    // 5. Verify learnings persisted
    const memory = registry.getAgentMemory(agentId);
    const learnings = await memory.getLearnings();
    expect(learnings.length).toBeGreaterThan(0);

    // 6. Context now includes recent learnings
    const contextAfter = await registry.getAgentContext(agentId);
    expect(contextAfter).toContain('Recent Learnings');

    // 7. Context includes user preferences section
    expect(contextAfter).toContain('User Preferences');
  });

  it('should add learning via convenience method', async () => {
    await registry.addLearning(agentId, 'Always check for null pointers', 0.9, ['coding', 'safety']);

    const memory = registry.getAgentMemory(agentId);
    const learnings = await memory.getLearnings();
    expect(learnings.some(l => l.content.includes('null pointers'))).toBe(true);
  });

  it('should return memory stats', async () => {
    // Add a learning first so stats are non-zero
    await registry.addLearning(agentId, 'Test learning for stats', 0.8);
    
    const stats = await registry.getMemoryStats(agentId);
    expect(stats).toHaveProperty('totalMemories');
    expect(stats).toHaveProperty('learningsCount');
    expect(stats).toHaveProperty('patternsCount');
    expect(stats).toHaveProperty('sessionsCount');
    expect(stats.totalMemories).toBeGreaterThan(0);
    expect(stats.learningsCount).toBeGreaterThan(0);
  });

  it('should load default identity for unknown agent', async () => {
    const context = await registry.getAgentContext('unknown-agent-xyz');
    expect(context).toContain('unknown-agent-xyz');
  });

  it('should load default talents for sisyphus', async () => {
    const context = await registry.getAgentContext('sisyphus');
    expect(context).toContain('git-master');
    expect(context).toContain('bug-fixing');
  });
});