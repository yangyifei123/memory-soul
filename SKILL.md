---
name: memory-soul
description: Persistent memory, identity, and talents system for opencode agents. Gives each agent self-awareness (identity), auto-loaded skills (talents), and cross-session memory. Triggers on session start/end, memory queries, and agent activation.
---

# Memory-Soul: Agent Memory Hook System for OpenCode

## Overview

- **Identity**: Each agent has self-awareness (name, role, personality, capabilities, constraints)
- **Talents**: Default skills auto-loaded per agent type (e.g., sisyphus gets git-master, bug-fixing)
- **Memory**: Persistent learnings, preferences, and patterns across sessions with deduplication

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

Persistent learnings and patterns. Types: `learnings`, `preferences`, `patterns`, `context`.

```typescript
interface MemoryEntry {
  id: string;
  agentId: AgentId;
  scope: 'persistent' | 'session' | 'ephemeral';
  type: MemoryType;
  content: string;
  timestamp: number;
  confidence: number;
  source: 'user' | 'agent' | 'evolution' | 'system';
  tags: string[];
}
```

## Agent Activation Flow

```
1. Load identity from .opencode/memory-soul/identities/{agentId}.json
   - If not exists, use defaults from identity/defaults.ts
2. Load talents from .opencode/memory-soul/talents/{agentId}.json
   - If not exists, use defaults from talents/defaults.ts
   - Sort skills by priority (highest first)
   - Emit skill load commands for required skills
3. Load recent memories and session history
   - Feed relevant learnings into context
4. On session end:
   a. Summarize session (intent, changes, decisions, next steps)
   b. Consolidate memories (merge similar entries)
   c. Deduplicate (remove redundant memories)
```

## Memory Commands

```typescript
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

// Get context for injection (<200 tokens)
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

```typescript
// Pre-chat message (inject context)
const result = await registry.preChatMessage('sisyphus', sessionId, userMessage);
// Returns: { message, context }

// Post-chat message (save interaction)
await registry.postChatMessage('sisyphus', sessionId, userMessage, response);

// Tool execution hooks
await registry.postToolExecution('sisyphus', sessionId, 'bash', params, result, true, 150);
```

## Installation

```bash
## Install
1. Copy this entire folder to ~/.agents/skills/memory-soul-1.0.0/
2. Memory data stored per-project in .opencode/memory-soul/
3. First activation auto-creates identity and loads defaults

## Uninstall
1. Remove ~/.agents/skills/memory-soul-1.0.0/
2. Optionally remove .opencode/memory-soul/ from projects (keeps user data)
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| userId | 'default' | User identifier |
| basePath | '.opencode/memory-soul' | Root path for all data |
| maxSessions | 100 | Max sessions to retain per agent |

## Troubleshooting

**Identity not loading**: Check `.opencode/memory-soul/identities/{agentId}.json` exists

**Talents not auto-loaded**: Ensure agent ID matches default identity keys

**Memory deduplication not working**: Check that memories have unique content hashes

**Session summarization empty**: Ensure interactions were recorded via `postChatMessage`

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

- `src/index.ts` — Main export: createMemoryHookRegistry
- `src/hooks/registry.ts` — MemoryHookRegistry class
- `src/identity/identity-store.ts` — IdentityStore class
- `src/talents/talents-store.ts` — TalentsStore class
- `src/memory/agent-memory.ts` — AgentMemory class
- `src/identity/defaults.ts` — Default identities
- `src/talents/defaults.ts` — Default talents