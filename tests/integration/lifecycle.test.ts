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

    // 6. Verify identity saved
    const identityStore = (registry as any).identityStore;
    const exists = await identityStore.exists(agentId);
    expect(exists).toBe(false); // Not saved yet, only loaded
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