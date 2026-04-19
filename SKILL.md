---
name: memory-soul
description: Persistent memory, identity, and talents system for opencode agents. Gives each agent self-awareness (identity), auto-loaded skills (talents), and cross-session memory. Triggers on session start/end, memory queries, and agent activation.
---

# Memory-Soul: Agent Memory Hook System for OpenCode

## Overview

- **Identity**: Each agent has self-awareness (name, role, personality, capabilities, constraints)
- **Talents**: Default skills auto-loaded per agent type (e.g., sisyphus gets git-master, bug-fixing)
- **Memory**: Persistent learnings, preferences, and patterns across sessions with deduplication

## Quick Reference

| Command | Usage |
|---------|-------|
| `createMemoryHookRegistry({userId})` | Initialize registry |
| `registry.onSessionStart(agentId, sessionId)` | Start session |
| `registry.onSessionEnd(agentId, sessionId)` | End session, save learnings |
| `registry.getAgentContext(agentId)` | Get identity + talents + memories for context |
| `registry.addLearning(agentId, content, confidence)` | Add learning |
| `createIdentityStore({basePath})` | Create identity store |
| `createTalentsStore({basePath})` | Create talents store |
| `createAgentMemory({agentId, basePath})` | Create memory instance |

**Memory Scopes**: `persistent` (forever) | `session` (until end) | `ephemeral` (temp)
**Memory Types**: `learnings` | `preferences` | `patterns` | `context`
**Hook Types**: `session.start` | `session.end` | `chat.message.pre` | `chat.message.post` | `tool.execute.before` | `tool.execute.after`

## When to Activate

Triggers for loading this skill:

- `session.start` — Initialize agent identity and load talents
- `session.end` — Summarize session, extract learnings, consolidate memories
- `memory query` — Search/query agent memories
- `identity query` — Read or update agent identity
- `talent management` — Add/remove/display agent default skills
- Agent activation or context injection

## Quick Start

```typescript
import { createMemoryHookRegistry } from 'memory-soul';

const registry = createMemoryHookRegistry({
  userId: 'default',
  basePath: '.opencode/memory-soul'
});

// Session start
await registry.onSessionStart('sisyphus', sessionId);

// Get agent identity context for injection
const context = await registry.getAgentContext('sisyphus');

// Session end
await registry.onSessionEnd('sisyphus', sessionId);
```

## Core Concepts

### Identity

Who the agent is. Stored in `.opencode/memory-soul/identities/{agentId}.json`.

```typescript
interface AgentIdentity {
  agentId: AgentId;
  name: string;
  role: string;
  personality: string;
  capabilities: string[];
  constraints: string[];
  createdAt: number;
  updatedAt: number;
}
```

### Talents

Default skills auto-loaded per agent. Stored in `.opencode/memory-soul/talents/{agentId}.json`.

```typescript
interface TalentSkill {
  name: string;      // Skill name (e.g., 'git-master')
  reason: string;   // Why this skill is assigned
  priority: number;  // Higher = loaded first
  required: boolean;
}
```

### Memory

Persistent learnings and patterns. Three scopes:

| Scope | Lifetime | Use Case |
|-------|----------|----------|
| `persistent` | Forever (until deleted) | User preferences, important learnings |
| `session` | Until session ends | Temporary context for current task |
| `ephemeral` | Until memory cleanup | Short-lived scratchpad data |

**Memory Types**: `learnings` | `preferences` | `patterns` | `context`

```typescript
interface MemoryEntry {
  id: string;
  agentId: AgentId;
  scope: 'persistent' | 'session' | 'ephemeral';
  type: 'learnings' | 'preferences' | 'patterns' | 'context';
  content: string;
  timestamp: number;
  confidence: number;      // 0.0-1.0, higher = more confident
  source: 'user' | 'agent' | 'evolution' | 'system';
  tags: string[];
}
```

## Agent Activation Flow

```
1. Load identity from .opencode/memory-soul/identities/{agentId}.json
   - If not exists, use defaults from identity/defaults.ts
   - Serialize to markdown context via toContext() (<400 tokens)
2. Load talents from .opencode/memory-soul/talents/{agentId}.json
   - If not exists, use defaults from talents/defaults.ts
   - Sort skills by priority (highest first)
   - Display skill names with required flag and reason
3. Load recent learnings (top 10, most recent first)
   - Inject into agent context as "Recent Learnings" section
4. Load user preferences (communication style, technical level, patterns)
   - Inject into agent context as "User Preferences" section
5. On session end:
    a. Summarize session (user goal, tools used, changes made, decisions, next steps)
    b. Consolidate memories (learnings=additive, preferences=replace)
    c. Deduplicate (hash + Jaccard similarity with stop words)
```

## Memory Commands

```typescript
import { createAgentMemory } from 'memory-soul';

// Create agent memory instance
const agentMemory = createAgentMemory({
  agentId: 'sisyphus',
  basePath: '.opencode/memory-soul'
});

// Add a memory
await agentMemory.addMemory({
  agentId: 'sisyphus',
  scope: 'persistent',
  type: 'learnings',
  content: 'User prefers concise responses',
  confidence: 0.8,
  source: 'agent',
  tags: ['preference']
});

// Query memories
const memories = await agentMemory.getMemories('persistent');

// Get learnings
const learnings = await agentMemory.getLearnings();

// Extract learnings from session
const sessionLearnings = await agentMemory.extractLearnings(session);

// Search memories by content
const results = await agentMemory.searchMemories('user preference');

// Get memory count
const count = await agentMemory.getMemoryCount();

// Delete a memory
await agentMemory.deleteMemory(memoryId);

// Cleanup expired memories
const cleaned = await agentMemory.cleanupExpired();
```

## Advanced Memory API

```typescript
// Get memory statistics
const stats = await agentMemory.getMemoryStats();
// Returns: { totalMemories, byScope, byType, oldestMemory, newestMemory }

// Add learning via convenience method (preferred approach)
await registry.addLearning('sisyphus', 'User prefers TypeScript over JavaScript', 0.9);

// Get recent sessions
const sessions = await agentMemory.getRecentSessions(5);

// Detect frequent patterns
const patterns = await agentMemory.detectPatterns();
// Returns: { toolUsage: {...}, successRate: {...}, ... }

// Get success rate for a tool
const rate = await agentMemory.getSuccessRate('bash');
```

## Identity Commands

```typescript
import { createIdentityStore } from 'memory-soul';

const store = createIdentityStore({ basePath: '.opencode/memory-soul' });

// Load identity
const identity = await store.load('sisyphus');

// Update identity
identity.capabilities.push('new-capability');
await store.save(identity);

// Get context for injection (<400 tokens, ~200 words)
const context = store.toContext(identity);
```

## Talent Commands

```typescript
import { createTalentsStore } from 'memory-soul';

const store = createTalentsStore({ basePath: '.opencode/memory-soul' });

// Load talents
const talents = await store.load('sisyphus');

// Get skill names sorted by priority
const skills = store.getSkillNames(talents);
// ['git-master', 'bug-fixing', 'testing-strategies']

// Add skill
await store.addSkill('sisyphus', {
  name: 'refactoring-safely',
  reason: 'Needed for code quality',
  priority: 7,
  required: false
});

// Remove skill
await store.removeSkill('sisyphus', 'refactoring-safely');
```

## Default Agent Identities

| Agent | Role | Key Talents |
|-------|------|-------------|
| sisyphus | Builder & Orchestrator | git-master, bug-fixing, testing-strategies |
| atlas | Strategic Planner | writing-plans, architecture-designer |
| oracle | Architecture Reviewer | security-auditor, performance-optimization |
| explore | Code Scout | context7, find-skills |
| librarian | Researcher | context7 |
| prometheus | Creative Strategist | brainstorming, architecture-designer |
| metis | Pre-planning Analyst | (custom) |
| momus | Plan Critic | (custom) |

## Hooks

**Hook Types**: `session.start` | `session.end` | `chat.message.pre` | `chat.message.post` | `tool.execute.before` | `tool.execute.after`

**HookResult**: `{ success: boolean, data?: unknown }`

```typescript
// Pre-chat message (inject context)
const result = await registry.preChatMessage('sisyphus', sessionId, userMessage);
// Returns: { message, context }

// Post-chat message (save interaction)
await registry.postChatMessage('sisyphus', sessionId, userMessage, response);

// Tool execution hooks
await registry.postToolExecution('sisyphus', sessionId, 'bash', params, result, true, 150);

// Pre-tool execution (can modify params or block)
const toolCheck = await registry.preToolExecution('sisyphus', sessionId, 'bash', params);
// Returns: { allowed: boolean, modifiedParams?: Record<string, unknown> }
```

## Installation

### Prerequisites

- Node.js 18+ (required for the library)
- Git (required for cloning)
- npm (comes with Node.js)
- **Offline-ready**: No network required after installation — all data stored locally

### Option A: Local Development (Recommended)

```bash
# 1. Clone and build the project
git clone <repo-url> memory-soul
cd memory-soul
npm install
npm run build

# 2. Install SKILL.md to opencode skills folder
mkdir -p ~/.agents/skills/memory-soul-1.0.0
cp SKILL.md ~/.agents/skills/memory-soul-1.0.0/SKILL.md

# 3. Link the library so 'import from memory-soul' works
npm link

# 4. Verify installation
node -e "const ms = require('memory-soul'); console.log('memory-soul v' + ms.VERSION + ' installed')"

# To undo npm link (if needed later):
npm unlink memory-soul
```

### Option B: Package Published to npm (Future)

```bash
# Once memory-soul is published to npm, use:
npm install -g memory-soul
mkdir -p ~/.agents/skills/memory-soul-1.0.0
cp node_modules/memory-soul/SKILL.md ~/.agents/skills/memory-soul-1.0.0/SKILL.md
```

> **Note**: Option B will work after memory-soul is published to npm registry. Check npm for availability.

### What Gets Installed

| Component | Location |
|-----------|----------|
| SKILL.md | `~/.agents/skills/memory-soul-1.0.0/SKILL.md` |
| Library (npm) | `node_modules/memory-soul/` |
| Memory data | `.opencode/memory-soul/` (per-project) |
| Identity files | `.opencode/memory-soul/identities/{agentId}.json` |
| Talent files | `.opencode/memory-soul/talents/{agentId}.json` |

## Uninstall

```bash
# 1. Remove SKILL.md (Unix/Mac)
rm -rf ~/.agents/skills/memory-soul-1.0.0

# 1. Remove SKILL.md (Windows)
rmdir /s /q "%USERPROFILE%\.agents\skills\memory-soul-1.0.0"

# 2. Unlink npm package (if using npm link)
npm unlink memory-soul

# 3. Remove npm package (if installed via npm install -g)
npm uninstall -g memory-soul

# 4. Remove memory data (OPTIONAL - keeps user data if skipped)
rm -rf .opencode/memory-soul/

# 5. Remove node_modules if you want clean slate
rm -rf node_modules/
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| userId | 'default' | User identifier |
| basePath | '.opencode/memory-soul' | Root path for all data |
| maxSessions | 100 | Max sessions to retain per agent |

## Performance Considerations

**Token Budget**:
- `toContext()` outputs <400 tokens (~200 words)
- `getAgentContext()` injects identity + talents + top 10 learnings + user prefs
- For very long conversations, context may approach token limits

**Memory Limits**:
- `maxSessions` (default: 100) caps stored sessions per agent
- `cleanupExpired()` runs on session end or can be called manually
- Consider periodic cleanup for memory-constrained environments

**Deduplication Performance**:
- Jaccard similarity is O(n²) for n memories — consider limiting memory count
- SHA256 hashing is fast (~1ms per item)
- For >1000 memories, batch dedup operations

**File I/O**:
- Each operation (read/write) is atomic per JSON file
- Concurrent writes to different files are handled safely
- Session files grow with interactions — prune old sessions regularly

**Context Injection Frequency**:
- `getAgentContext()` called on each `preChatMessage`
- Results can be cached if agent context hasn't changed
- Consider invalidating cache on talent/identity changes

## Security & Safety

**Data Storage**:
- All memory data stored as plaintext JSON in `.opencode/memory-soul/`
- No encryption at rest — sensitive data should not be stored in memories
- File permissions depend on filesystem settings

**Input Validation**:
- `sanitizeAgentId()` prevents path traversal attacks
- All JSON parsed with try/catch — corrupted files return defaults, never crash
- Memory content is stored as-is — sanitize before storing sensitive data

**Multi-User Isolation**:
- `userId` parameter isolates data between users
- Each user has separate preferences and agent usage tracking
- Agent memories are isolated by agentId within each user

**Path Traversal Protection**:
- All file paths validated via `isPathSafe()` — blocks `../` and absolute paths
- Agent IDs sanitized to prevent filesystem attacks
- Base path is configurable but defaults to `.opencode/memory-soul/`

**Recommended .gitignore** (add to project):
```
# Memory-Soul data
.opencode/memory-soul/
```

**Backup**: Copy `.opencode/memory-soul/` directory for backup. Data is portable JSON.

## Error Handling & Edge Cases

**Missing Sessions**:
- `onSessionEnd()` with non-existent session → creates session with endTime, saves it
- `getSession()` for non-existent session → returns null
- Sessionless operations are safe — auto-create sessions as needed

**Idempotent Operations**:
- `onSessionStart()` for existing session → updates startTime (idempotent)
- `deleteMemory()` for non-existent ID → returns false, no exception
- `addSkill()` for duplicate skill → no-op, returns early

**Input Validation**:
- Empty agentId → throws Error (sanitized via `sanitizeAgentId()`)
- Path traversal attempts → throws Error, blocked at sanitizeAgentId/isPathSafe
- Malformed agentId → invalid chars replaced with `_`

**Large Content**:
- Memory content size → no hard limit, but consider token limits in context
- Session with many interactions → pruned by maxSessions limit
- Long user messages → stored as-is, summarization extracts key facts

**Concurrent Access**:
- Concurrent writes to same file → atomic writes prevent corruption
- Concurrent writes to different files → handled independently, no locks needed

**Storage Errors**:
- Disk full → JSON write fails, throws error from filesystem
- File deleted mid-read → returns null, next write recreates
- Base path doesn't exist → auto-created on first write

**Special Characters**:
- Unicode/emoji in content → stored as-is in JSON
- AgentId with special chars → sanitized before filesystem access

**Corrupted Data**:
- Corrupted JSON file → returns default/empty value, logs warning
- Never crashes on corrupted data — graceful degradation

## Troubleshooting

**Identity not loading**: Check `.opencode/memory-soul/identities/{agentId}.json` exists

**Talents not auto-loaded**: Ensure agent ID matches default identity keys

**Memory deduplication not working**: Check that memories have unique content hashes

**Session summarization empty**: Ensure interactions were recorded via `postChatMessage`

**Import error "memory-soul"**: Run `npm link` from project root OR ensure package.json has memory-soul as dependency

**npm link fails**: Try `npm install` first, then `npm link`. If issues persist, use Option B after package is published.

**Windows path issues**: Replace `~/.agents/` with `%USERPROFILE%\.agents\` on Windows. Use `dir` instead of `ls`.

## Migration & Compatibility

**Version 1.0.0**:
- Initial stable release
- No breaking changes from v0.x (if you were using pre-1.0 versions)

**TypeScript Support**:
- Full TypeScript support with `dist/index.d.ts` type definitions
- All interfaces exported from `memory-soul/interfaces`
- Compatible with TypeScript 5.x+

**Environment Variables**:
```typescript
// Configure via code (no env vars currently)
const registry = createMemoryHookRegistry({
  userId: process.env.MEMORY_SOUL_USER_ID || 'default',
  basePath: process.env.MEMORY_SOUL_BASE_PATH || '.opencode/memory-soul'
});
```

**Docker/Container Environments**:
- Data persists in `.opencode/memory-soul/` — mount as volume
- Ensure write permissions for the user running opencode
- Example: `docker run -v $(pwd)/.opencode:/app/.opencode ...`

**CI/CD Testing**:
- Tests can run with temporary basePath (e.g., `/tmp/memory-soul-test`)
- Auto-cleanup on test completion
- No network required — fully offline

**Multi-Project Shared Memory**:
- Use same `basePath` across projects for shared memory
- Different `userId` for different users within shared memory
- Not recommended — memory-soul is designed per-project

## Verification Steps

After installation, verify everything works:

```bash
# 1. Verify library loads
node -e "const ms = require('memory-soul'); console.log('Version:', ms.VERSION)"

# 2. Verify createMemoryHookRegistry exists
node -e "const {createMemoryHookRegistry} = require('memory-soul'); console.log('Registry function:', typeof createMemoryHookRegistry)"

# 3. Verify exports
node -e "const ms = require('memory-soul'); console.log('Exports:', Object.keys(ms).join(', '))"

# 4. Run tests
npm test

# 5. Verify skill file installed (Unix/Mac)
ls ~/.agents/skills/memory-soul-1.0.0/

# 5. Verify skill file installed (Windows)
dir %USERPROFILE%\.agents\ skills\memory-soul-1.0.0\

# 6. OpenCode integration: Start a new session and check if skill appears
# In opencode, run: /skills list
# You should see memory-soul in the list
```

## Architecture

```
.opencode/memory-soul/
├── identities/
│   └── {agentId}.json      # Agent identity files
├── talents/
│   └── {agentId}.json      # Agent talents configs
├── agents/
│   └── {agentId}/
│       ├── sessions/       # Session history (sessionId.json)
│       ├── memories/        # Memory entries (id.json)
│       └── interactions/    # Interaction records (id.json)
└── users/
    └── {userId}/
        └── preferences.json
```

## Key Files

### Core Library
- `src/index.ts` — Main export: createMemoryHookRegistry, VERSION constant
- `src/hooks/registry.ts` — MemoryHookRegistry class with full lifecycle hooks
- `src/identity/identity-store.ts` — IdentityStore class for agent identity management
- `src/talents/talents-store.ts` — TalentsStore class for skill/talent management

### Memory System
- `src/memory/agent-memory.ts` — AgentMemory class for persistent memory storage
- `src/memory/summarizer.ts` — SessionSummarizer for extracting key facts/decisions
- `src/memory/dedup.ts` — MemoryDedup with SHA256 + Jaccard similarity dedup
- `src/memory/consolidator.ts` — MemoryConsolidator for type-aware memory merging
- `src/memory/user-model.ts` — UserModel for preference inference and tracking
- `src/memory/interfaces.ts` — TypeScript interfaces (MemoryEntry, HookContext, etc.)

### Storage & Utilities
- `src/storage/json-store.ts` — JsonStore for atomic JSON file persistence
- `src/shared/utils.ts` — Shared utilities (generateId, sanitizeAgentId, ensureDir)
- `src/shared/constants.ts` — Shared constants (STOP_WORDS for dedup)

### Defaults
- `src/identity/defaults.ts` — Default identities for 8 agent types
- `src/talents/defaults.ts` — Default talents/skills per agent
- `src/engine/evolution-engine.ts` — EvolutionEngine for agent learning