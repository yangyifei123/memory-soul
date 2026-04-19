/**
 * Memory-Soul: Agent Memory Hook System for OpenCode
 * 
 * This package provides memory and experience capabilities for OpenCode agents.
 * It allows each agent to remember user preferences, learn from interactions,
 * and evolve over time.
 * 
 * @example
 * import { createMemoryHookRegistry } from 'memory-soul';
 * 
 * const registry = createMemoryHookRegistry({
 *   userId: 'default',
 *   basePath: '.opencode/memory-soul'
 * });
 * 
 * // Hook into chat messages
 * await registry.preChatMessage('sisyphus', sessionId, userMessage);
 * await registry.postChatMessage('sisyphus', sessionId, userMessage, response);
 */

export * from './memory/interfaces';
export * from './storage/json-store';
export * from './memory/agent-memory';
export * from './memory/user-model';
export * from './hooks/registry';
export * from './engine/evolution-engine';
export * from './talents/talents-store';
export * from './memory/summarizer';
export * from './memory/dedup';
export * from './memory/consolidator';
export * from './identity/identity-store';

// Re-export types for convenience
import {
  AgentId,
  MemoryEntry,
  SessionMemory,
  UserPreferences,
  HookContext,
  HookType,
  HookResult,
  Pattern,
  SkillSuggestion,
  AgentIdentity,
  AgentTalents,
  TalentSkill
} from './memory/interfaces';

import { JsonStore, createStore, JsonStoreConfig } from './storage/json-store';
import { AgentMemory, createAgentMemory, AgentMemoryConfig } from './memory/agent-memory';
import { UserModel, createUserModel, UserModelConfig } from './memory/user-model';
import { MemoryHookRegistry, createMemoryHookRegistry, MemoryHookConfig } from './hooks/registry';
import { EvolutionEngine, createEvolutionEngine, EvolutionConfig } from './engine/evolution-engine';

// Version info
export const VERSION = '1.0.0';
export const PACKAGE_NAME = 'memory-soul';
