/**
 * Memory-Soul: Agent Memory Hook System for OpenCode
 * Core interfaces for the memory system
 */

export type AgentId = 'sisyphus' | 'atlas' | 'prometheus' | 'oracle' | 'librarian' | 'explore' | 'metis' | 'momus' | string;

export type MemoryScope = 'persistent' | 'session' | 'ephemeral';

export type MemoryType = 'learnings' | 'preferences' | 'patterns' | 'context';

export interface MemoryEntry {
  id: string;
  agentId: AgentId;
  scope: MemoryScope;
  type: MemoryType;
  content: string;
  timestamp: number;
  confidence: number;
  source: 'user' | 'agent' | 'evolution' | 'system';
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface SessionMemory {
  sessionId: string;
  agentId: AgentId;
  startTime: number;
  endTime?: number;
  interactions: Interaction[];
  learnings: string[];
  preferences: Record<string, unknown>;
}

export interface Interaction {
  id: string;
  type: 'user-message' | 'agent-response' | 'tool-execution';
  timestamp: number;
  content: string;
  toolName?: string;
  success?: boolean;
  duration?: number;
}

export interface UserPreferences {
  userId: string;
  communicationStyle: 'concise' | 'detailed' | 'mixed';
  technicalLevel: 'beginner' | 'intermediate' | 'expert';
  preferredAgent?: AgentId;
  ignoredPatterns: string[];
  preferredPatterns: string[];
  lastUpdated: number;
}

export interface AgentLearnings {
  agentId: AgentId;
  sessionHistory: SessionMemory[];
  patternHistory: Pattern[];
  skillSuggestions: SkillSuggestion[];
  lastAnalysisTime: number;
}

export interface Pattern {
  id: string;
  description: string;
  frequency: number;
  firstSeen: number;
  lastSeen: number;
  contexts: string[];
  success: number;
  agentId: AgentId;
}

export interface SkillSuggestion {
  id: string;
  skillName: string;
  reason: string;
  confidence: number;
  suggestedBy: 'evolution' | 'user' | 'system';
  createdAt: number;
}

export interface IMemoryStore {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  query(filter: MemoryFilter): Promise<unknown[]>;
  exists(key: string): Promise<boolean>;
}

export interface MemoryFilter {
  agentId?: AgentId;
  scope?: MemoryScope;
  type?: MemoryType;
  tags?: string[];
  since?: number;
  until?: number;
  limit?: number;
}

export interface HookContext {
  agentId: AgentId;
  sessionId: string;
  hookType: HookType;
  payload: unknown;
  timestamp: number;
}

export type HookType = 
  | 'chat.message.pre'
  | 'chat.message.post'
  | 'tool.execute.before'
  | 'tool.execute.after'
  | 'session.start'
  | 'session.end'
  | 'command.execute.before';

export interface HookResult {
  success: boolean;
  modified?: boolean;
  data?: unknown;
  error?: string;
}

// Stub for Phase 2 - Identity
export interface AgentIdentity {
  agentId: AgentId;
  name: string;
  role: string;
  personality: string;
  capabilities: string[];
  constraints: string[];
  createdAt: number;
  updatedAt: number;
}

// Stub for Phase 3 - Talents
export interface TalentSkill {
  name: string;
  reason: string;
  priority: number;
  required: boolean;
}

export interface AgentTalents {
  agentId: AgentId;
  skills: TalentSkill[];
  autoLoad: boolean;
  updatedAt: number;
}

// Phase 4 - Session Summarization
export interface SessionSummary {
  sessionId: string;
  agentId: AgentId;
  intent: string;
  changesMade: string[];
  decisionsTaken: string[];
  nextSteps: string[];
  keyFacts: string[];
  toolUsage: ToolUsageSummary[];
  startTime: number;
  endTime: number;
}

export interface ToolUsageSummary {
  tool: string;
  count: number;
  successRate: number;
}
