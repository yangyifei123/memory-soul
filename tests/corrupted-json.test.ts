import * as fs from 'fs';
import * as path from 'path';
import { createAgentMemory } from '../src/memory/agent-memory';
import { createIdentityStore } from '../src/identity/identity-store';
import { createTalentsStore } from '../src/talents/talents-store';

describe('Corrupted JSON Recovery', () => {
  const testDir = path.join(__dirname, 'test-data', 'corrupted-json');

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it('AgentMemory returns default session for corrupted session JSON', async () => {
    const memory = createAgentMemory({ agentId: 'sisyphus', basePath: testDir });
    // Save a valid session first
    await memory.saveSession({
      sessionId: 's1',
      agentId: 'sisyphus',
      startTime: Date.now(),
      interactions: [],
      learnings: [],
      preferences: {}
    });
    // Corrupt the file
    const sessionPath = path.join(testDir, 'agents', 'sisyphus', 'sessions', 's1.json');
    fs.writeFileSync(sessionPath, '{INVALID JSON', 'utf-8');
    // Should return undefined instead of crashing
    const session = await memory.getSession('s1');
    expect(session).toBeUndefined();
  });

  it('IdentityStore returns default for corrupted identity JSON', async () => {
    const store = createIdentityStore({ basePath: testDir });
    await store.save({
      agentId: 'sisyphus',
      name: 'Sisyphus',
      role: 'Builder',
      personality: 'Direct',
      capabilities: ['code'],
      constraints: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    // Corrupt the file
    const idPath = path.join(testDir, 'identities', 'sisyphus.json');
    fs.writeFileSync(idPath, '{INVALID JSON', 'utf-8');
    // Should return default instead of crashing
    const identity = await store.load('sisyphus');
    expect(identity.name).toBe('Sisyphus');
    expect(identity.role).toBe('Builder');
  });

  it('TalentsStore returns default for corrupted talents JSON', async () => {
    const store = createTalentsStore({ basePath: testDir });
    await store.save({
      agentId: 'sisyphus',
      skills: [{ name: 'git-master', reason: 'test', priority: 10, required: true }],
      autoLoad: true,
      updatedAt: Date.now()
    });
    // Corrupt the file
    const talentPath = path.join(testDir, 'talents', 'sisyphus.json');
    fs.writeFileSync(talentPath, '{INVALID JSON', 'utf-8');
    // Should return default instead of crashing
    const talents = await store.load('sisyphus');
    expect(talents.skills).toHaveLength(4); // Default sisyphus talents
  });
});