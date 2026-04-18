/**
 * Memory-Soul: Hook Registry
 * Central registry for managing memory hooks
 */

import {
  HookType,
  HookContext,
  HookResult,
  AgentId
} from '../memory/interfaces';
import { AgentMemory, createAgentMemory } from '../memory/agent-memory';
import { UserModel, createUserModel } from '../memory/user-model';

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

  constructor(config: MemoryHookConfig) {
    this.config = config;
    this.handlers = new Map();
    this.agentMemories = new Map();
    
    // Initialize user model
    this.userModel = createUserModel({
      userId: config.userId,
      basePath: config.basePath
    });
    
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
    await memory.addInteraction({
      type: 'agent-response',
      content: response,
      success: true
    });
    
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
    await memory.addInteraction({
      type: 'tool-execution',
      content: `Tool ${toolName} executed with ${success ? 'success' : 'failure'}`,
      toolName,
      success,
      duration
    });
    
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
      
      // Extract learnings from session
      const learnings = await memory.extractLearnings(session);
      for (const learning of learnings) {
        await memory.addMemory({
          agentId,
          scope: 'persistent',
          type: 'learnings',
          content: learning,
          confidence: 0.7,
          source: 'agent',
          tags: ['session-summary']
        });
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
}

// Factory function
export function createMemoryHookRegistry(config: MemoryHookConfig): MemoryHookRegistry {
  return new MemoryHookRegistry(config);
}
