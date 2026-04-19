/**
 * Memory-Soul: Hook Registry
 * Central registry for managing memory hooks
 */

import {
  HookType,
  HookContext,
  HookResult,
  AgentId,
  MemoryEntry
} from '../memory/interfaces';
import { AgentMemory, createAgentMemory } from '../memory/agent-memory';
import { UserModel, createUserModel } from '../memory/user-model';
import { summarizeSession } from '../memory/summarizer';
import { consolidate } from '../memory/consolidator';
import { createIdentityStore, IdentityStore } from '../identity/identity-store';
import { createTalentsStore, TalentsStore } from '../talents/talents-store';

export interface HookHandler {
  type: HookType;
  agentId?: AgentId;  // If undefined, applies to all agents
  priority: number;    // Higher = runs first
  handler: (context: HookContext) => Promise<HookResult>;
}

export interface MemoryHookConfig {
  userId: string;
  basePath?: string;
  enabledHooks?: HookType[];
}

export class MemoryHookRegistry {
  private handlers: Map<HookType, HookHandler[]>;
  private agentMemories: Map<AgentId, AgentMemory>;
  private userModel: UserModel;
  private config: MemoryHookConfig;
  private identityStore: IdentityStore;
  private talentsStore: TalentsStore;

  constructor(config: MemoryHookConfig) {
    this.config = config;
    this.handlers = new Map();
    this.agentMemories = new Map();

    // Initialize user model
    this.userModel = createUserModel({
      userId: config.userId,
      basePath: config.basePath
    });

    // Initialize identity and talents stores
    this.identityStore = createIdentityStore({ basePath: config.basePath });
    this.talentsStore = createTalentsStore({ basePath: config.basePath });

    // Initialize default handlers
    this.initializeDefaultHandlers();
  }

  private initializeDefaultHandlers(): void {
    // These will be populated with actual handlers
    const defaultTypes: HookType[] = [
      'chat.message.pre',
      'chat.message.post',
      'tool.execute.before',
      'tool.execute.after',
      'session.start',
      'session.end',
      'command.execute.before'
    ];
    
    for (const type of defaultTypes) {
      this.handlers.set(type, []);
    }
  }

  registerHandler(handler: HookHandler): void {
    const handlers = this.handlers.get(handler.type) || [];
    handlers.push(handler);
    handlers.sort((a, b) => b.priority - a.priority);
    this.handlers.set(handler.type, handlers);
  }

  getAgentMemory(agentId: AgentId): AgentMemory {
    let memory = this.agentMemories.get(agentId);
    if (!memory) {
      memory = createAgentMemory({
        agentId,
        basePath: this.config.basePath
      });
      this.agentMemories.set(agentId, memory);
    }
    return memory;
  }

  async executeHooks(
    type: HookType,
    context: HookContext
  ): Promise<HookResult[]> {
    const handlers = this.handlers.get(type) || [];
    const results: HookResult[] = [];
    
    for (const handler of handlers) {
      // Check agent filter
      if (handler.agentId && handler.agentId !== context.agentId) {
        continue;
      }
      
      try {
        const result = await handler.handler(context);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }

  async preChatMessage(
    agentId: AgentId,
    sessionId: string,
    message: string
  ): Promise<{ message: string; context: Record<string, unknown> }> {
    const context: HookContext = {
      agentId,
      sessionId,
      hookType: 'chat.message.pre',
      payload: { message },
      timestamp: Date.now()
    };
    
    const results = await this.executeHooks('chat.message.pre', context);
    
    // Aggregate context from all handlers
    const aggregatedContext: Record<string, unknown> = {};
    for (const result of results) {
      if (result.success && result.data) {
        Object.assign(aggregatedContext, result.data as Record<string, unknown>);
      }
    }
    
    return {
      message,
      context: aggregatedContext
    };
  }

async postChatMessage(
    agentId: AgentId,
    sessionId: string,
    message: string,
    response: string
  ): Promise<void> {
    const context: HookContext = {
      agentId,
      sessionId,
      hookType: 'chat.message.post',
      payload: { message, response },
      timestamp: Date.now()
    };

    // Save interaction to agent memory
    const memory = this.getAgentMemory(agentId);
    const interaction = await memory.addInteraction({
      type: 'agent-response',
      content: response,
      success: true
    });

    // Also update session with the interaction
    let session = await memory.getSession(sessionId);
    if (!session) {
      // Create session if missing (onSessionStart wasn't called)
      session = {
        sessionId,
        agentId,
        startTime: Date.now(),
        interactions: [],
        learnings: [],
        preferences: {}
      };
      await memory.saveSession(session);
    }

    session.interactions.push(interaction);
    await memory.saveSession(session);

    // Infer user preferences
    await this.userModel.inferPreferencesFromInteraction(message, agentId);

    await this.executeHooks('chat.message.post', context);
  }

  async preToolExecution(
    agentId: AgentId,
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<{ allowed: boolean; modifiedParams?: Record<string, unknown> }> {
    const context: HookContext = {
      agentId,
      sessionId,
      hookType: 'tool.execute.before',
      payload: { toolName, params },
      timestamp: Date.now()
    };
    
    const results = await this.executeHooks('tool.execute.before', context);
    
    // Check if any handler blocked the execution
    const blocked = results.some(r => !r.success);
    if (blocked) {
      return { allowed: false };
    }
    
    // Aggregate modified params
    let modifiedParams = params;
    for (const result of results) {
      if (result.success && result.data) {
        const data = result.data as { modifiedParams?: Record<string, unknown> };
        if (data.modifiedParams) {
          modifiedParams = data.modifiedParams;
        }
      }
    }
    
    return { allowed: true, modifiedParams };
  }

async postToolExecution(
    agentId: AgentId,
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>,
    result: unknown,
    success: boolean,
    duration?: number
  ): Promise<void> {
    const context: HookContext = {
      agentId,
      sessionId,
      hookType: 'tool.execute.after',
      payload: { toolName, params, result, success, duration },
      timestamp: Date.now()
    };

    // Save tool execution to memory
    const memory = this.getAgentMemory(agentId);
    const interaction = await memory.addInteraction({
      type: 'tool-execution',
      content: `Tool ${toolName} executed with ${success ? 'success' : 'failure'}`,
      toolName,
      success,
      duration
    });

    // Also update session with the interaction
    let session = await memory.getSession(sessionId);
    if (!session) {
      // Create session if missing (onSessionStart wasn't called)
      session = {
        sessionId,
        agentId,
        startTime: Date.now(),
        interactions: [],
        learnings: [],
        preferences: {}
      };
      await memory.saveSession(session);
    }

    session.interactions.push(interaction);
    await memory.saveSession(session);

    await this.executeHooks('tool.execute.after', context);
  }

async onSessionEnd(
    agentId: AgentId,
    sessionId: string
  ): Promise<void> {
    const context: HookContext = {
      agentId,
      sessionId,
      hookType: 'session.end',
      payload: {},
      timestamp: Date.now()
    };

    // Save session end
    const memory = this.getAgentMemory(agentId);
    const session = await memory.getSession(sessionId);
    if (session) {
      session.endTime = Date.now();
      await memory.saveSession(session);

      // Summarize session
      const summary = summarizeSession(session);

      // Get existing memories for dedup
      const existingMemories = await memory.getMemories();  // Get ALL memories, not just learnings

      // Create memory entries from summary
      const newEntries = [
        ...summary.keyFacts.map(fact => ({
          agentId,
          scope: 'persistent' as const,
          type: 'learnings' as const,
          content: fact,
          confidence: 0.7,
          source: 'agent' as const,
          tags: ['session-summary']
        })),
        ...summary.changesMade.map(change => ({
          agentId,
          scope: 'persistent' as const,
          type: 'context' as const,
          content: change,
          confidence: 0.8,
          source: 'agent' as const,
          tags: ['changes']
        }))
      ];

      // Consolidate with dedup
      const result = consolidate(newEntries, existingMemories);

      // Persist new and updated memories
      for (const entry of result.added) {
        await memory.addMemory(entry);
      }
      // Update existing entries by re-saving
      for (const entry of result.updated) {
        await memory.updateMemory(entry);
      }

      // Log summary of what was learned
      const summaryCount = result.added.length + result.updated.length;
      const skippedCount = result.skipped.length;
      if (summaryCount > 0 || skippedCount > 0) {
        // Note: Using console.warn to ensure visibility in agent logs
        console.warn(`[memory-soul] Session ${sessionId}: ${summaryCount} memories saved, ${skippedCount} duplicates skipped`);
      }
    }

    await this.executeHooks('session.end', context);
  }

  async onSessionStart(
    agentId: AgentId,
    sessionId: string
  ): Promise<void> {
    const context: HookContext = {
      agentId,
      sessionId,
      hookType: 'session.start',
      payload: {},
      timestamp: Date.now()
    };
    
    // Create new session
    const memory = this.getAgentMemory(agentId);
    await memory.saveSession({
      sessionId,
      agentId,
      startTime: Date.now(),
      interactions: [],
      learnings: [],
      preferences: {}
    });
    
await this.executeHooks('session.start', context);
  }

  async getAgentContext(agentId: AgentId): Promise<string> {
    const identity = await this.identityStore.load(agentId);
    const talents = await this.talentsStore.load(agentId);
    const skillNames = this.talentsStore.getSkillNames(talents);

    const identityContext = this.identityStore.toContext(identity);

    let result = identityContext;

    // Inject talents with required/required markers
    if (skillNames.length > 0) {
      result += '\n\n## Talents (auto-load skills)\n';
      const talentsConfig = await this.talentsStore.load(agentId);
      result += talentsConfig.skills
        .sort((a, b) => b.priority - a.priority)
        .map(s => `- ${s.name}${s.required ? ' (required)' : ''} — ${s.reason}`)
        .join('\n');
    }

    // Inject recent learnings into context (top 10, most recent first)
    const memory = this.getAgentMemory(agentId);
    const learnings = await memory.getLearnings();
    if (learnings.length > 0) {
      const recentLearnings = learnings
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);
      result += '\n\n## Recent Learnings\n';
      result += recentLearnings.map(l => `- ${l.content}`).join('\n');
    }

    // Inject user preferences relevant to this agent
    const prefs = await this.userModel.load();
    if (prefs) {
      const prefItems: string[] = [];
      if (prefs.communicationStyle) {
        prefItems.push(`Communication: ${prefs.communicationStyle}`);
      }
      if (prefs.technicalLevel) {
        prefItems.push(`Technical level: ${prefs.technicalLevel}`);
      }
      if (prefs.preferredPatterns && prefs.preferredPatterns.length > 0) {
        prefItems.push(`Patterns: ${prefs.preferredPatterns.join(', ')}`);
      }
      if (prefItems.length > 0) {
        result += '\n\n## User Preferences\n';
        result += prefItems.map(p => `- ${p}`).join('\n');
      }
    }

    return result;
  }

  async cleanupExpiredMemories(agentId: AgentId): Promise<number> {
    const memory = this.getAgentMemory(agentId);
    return await memory.cleanupExpired();
  }

  async getMemoryStats(agentId: AgentId): Promise<{
    totalMemories: number;
    learningsCount: number;
    patternsCount: number;
    sessionsCount: number;
  }> {
    const memory = this.getAgentMemory(agentId);
    const [totalMemories, learningsCount, patternsCount, sessionsCount] = await Promise.all([
      memory.getMemoryCount(),
      memory.getLearnings().then(l => l.length),
      memory.getPatterns().then(p => p.length),
      memory.getRecentSessions(999).then(s => s.length)
    ]);
    return { totalMemories, learningsCount, patternsCount, sessionsCount };
  }

  /** Convenience: add a learning for an agent */
  async addLearning(agentId: AgentId, content: string, confidence: number = 0.7, tags: string[] = []): Promise<MemoryEntry> {
    const memory = this.getAgentMemory(agentId);
    return memory.addMemory({
      agentId,
      scope: 'persistent',
      type: 'learnings',
      content,
      confidence,
      source: 'agent',
      tags
    });
  }
}

// Factory function
export function createMemoryHookRegistry(config: MemoryHookConfig): MemoryHookRegistry {
  return new MemoryHookRegistry(config);
}
