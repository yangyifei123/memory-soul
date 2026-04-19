/**
 * Memory-Soul: Agent Memory Manager
 * Manages per-agent memory stores with session isolation
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  AgentId,
  MemoryEntry,
  SessionMemory,
  Interaction,
  AgentLearnings,
  Pattern
} from './interfaces';
import { ensureDir, generateId, sanitizeAgentId } from '../shared/utils';

export interface AgentMemoryConfig {
  agentId: AgentId;
  basePath?: string;
  maxSessions?: number;
}

const DEFAULT_MAX_SESSIONS = 100;

export class AgentMemory {
  private basePath: string;
  private agentId: AgentId;
  private maxSessions: number;

  constructor(config: AgentMemoryConfig) {
    this.agentId = config.agentId;
    this.maxSessions = config.maxSessions || DEFAULT_MAX_SESSIONS;
    const safeAgentId = sanitizeAgentId(config.agentId);
    this.basePath = (config.basePath || '.opencode/memory-soul') + '/agents/' + safeAgentId;
    ensureDir(this.basePath);
    ensureDir(path.join(this.basePath, 'sessions'));
    ensureDir(path.join(this.basePath, 'memories'));
    ensureDir(path.join(this.basePath, 'interactions'));
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.basePath, 'sessions', sessionId + '.json');
  }

  private getMemoryPath(memoryId: string): string {
    return path.join(this.basePath, 'memories', memoryId + '.json');
  }

  private getInteractionPath(interactionId: string): string {
    return path.join(this.basePath, 'interactions', interactionId + '.json');
  }

  private getIndexPath(type: 'sessions' | 'memories' | 'interactions'): string {
    return path.join(this.basePath, type + '-index.json');
  }

  private safeJsonParse(content: string, filePath: string): unknown {
    try {
      return JSON.parse(content);
    } catch (e) {
      console.warn(`[memory-soul v1.0.0] Corrupted JSON at ${filePath}: returning null`);
      return null;
    }
  }

  private readIndex(type: 'sessions' | 'memories' | 'interactions'): string[] {
    const indexPath = this.getIndexPath(type);
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      const result = this.safeJsonParse(content, indexPath);
      if (Array.isArray(result)) return result as string[];
    }
    return [];
  }

  private writeIndex(type: 'sessions' | 'memories' | 'interactions', index: string[]): void {
    const indexPath = this.getIndexPath(type);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  // Session Management
  async getSession(sessionId: string): Promise<SessionMemory | undefined> {
    const filePath = this.getSessionPath(sessionId);
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = this.safeJsonParse(content, filePath);
    return result as SessionMemory | undefined;
  }

  async saveSession(session: SessionMemory): Promise<void> {
    const filePath = this.getSessionPath(session.sessionId);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    await this.updateSessionIndex(session.sessionId);
  }

  private async updateSessionIndex(sessionId: string): Promise<void> {
    const index = this.readIndex('sessions');
    if (!index.includes(sessionId)) {
      index.push(sessionId);
      if (index.length > this.maxSessions) {
        const removed = index.shift();
        if (removed) {
          const removedPath = this.getSessionPath(removed);
          if (fs.existsSync(removedPath)) {
            fs.unlinkSync(removedPath);
          }
        }
      }
      this.writeIndex('sessions', index);
    }
  }

  async getRecentSessions(limit: number = 10): Promise<SessionMemory[]> {
    const index = this.readIndex('sessions');
    const sessions: SessionMemory[] = [];
    const toLoad = index.slice(-limit).reverse();

    for (const sessionId of toLoad) {
      const session = await this.getSession(sessionId);
      if (session) sessions.push(session);
    }

    return sessions;
  }

  // Memory Entry Management
  async addMemory(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<MemoryEntry> {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: generateId(),
      timestamp: Date.now()
    };

    const filePath = this.getMemoryPath(fullEntry.id);
    fs.writeFileSync(filePath, JSON.stringify(fullEntry, null, 2), 'utf-8');

    const index = this.readIndex('memories');
    index.push(fullEntry.id);
    this.writeIndex('memories', index);

    return fullEntry;
  }

  async updateMemory(entry: MemoryEntry): Promise<void> {
    const filePath = this.getMemoryPath(entry.id);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    }
  }

  async getMemories(scope?: string): Promise<MemoryEntry[]> {
    const index = this.readIndex('memories');
    const memories: MemoryEntry[] = [];

    for (const memoryId of index) {
      const filePath = this.getMemoryPath(memoryId);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const memory = this.safeJsonParse(content, filePath) as MemoryEntry | null;
        if (memory && (!scope || memory.scope === scope)) {
          memories.push(memory);
        }
      }
    }

    return memories.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getLearnings(): Promise<MemoryEntry[]> {
    return this.getMemoriesWithType('learnings');
  }

  async getPatterns(): Promise<MemoryEntry[]> {
    return this.getMemoriesWithType('patterns');
  }

  private async getMemoriesWithType(type: string): Promise<MemoryEntry[]> {
    const allMemories = await this.getMemories();
    return allMemories.filter(m => m.type === type);
  }

  // Interaction Tracking
  async addInteraction(interaction: Omit<Interaction, 'id' | 'timestamp'>): Promise<Interaction> {
    const fullInteraction: Interaction = {
      ...interaction,
      id: generateId(),
      timestamp: Date.now()
    };

    const filePath = this.getInteractionPath(fullInteraction.id);
    fs.writeFileSync(filePath, JSON.stringify(fullInteraction, null, 2), 'utf-8');

    const index = this.readIndex('interactions');
    index.push(fullInteraction.id);
    this.writeIndex('interactions', index);

    return fullInteraction;
  }

  async getRecentInteractions(limit: number = 50): Promise<Interaction[]> {
    const index = this.readIndex('interactions');
    const interactions: Interaction[] = [];
    const toLoad = index.slice(-limit).reverse();

    for (const interactionId of toLoad) {
      const filePath = this.getInteractionPath(interactionId);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const interaction = this.safeJsonParse(content, filePath) as Interaction | null;
        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    return interactions;
  }

  // Learnings Extraction
  async extractLearnings(
    session: SessionMemory,
    focusAreas: string[] = []
  ): Promise<string[]> {
    const learnings: string[] = [];

    const successfulInteractions = session.interactions.filter(
      i => i.type === 'tool-execution' && i.success
    );

    if (successfulInteractions.length > 0) {
      learnings.push(
        this.agentId + ' successfully executed ' + successfulInteractions.length + ' tools in session ' + session.sessionId
      );
    }

    const avgLength = session.interactions.reduce(
      (sum, i) => sum + i.content.length, 0
    ) / session.interactions.length;

    if (avgLength > 500) {
      learnings.push('User prefers detailed responses');
    } else if (avgLength < 100) {
      learnings.push('User prefers concise responses');
    }

    return learnings;
  }

  // Pattern Detection
  async detectPatterns(interactions: Interaction[]): Promise<Pattern[]> {
    const patterns: Pattern[] = [];
    const toolGroups = new Map<string, Interaction[]>();

    for (const interaction of interactions) {
      if (interaction.toolName) {
        const group = toolGroups.get(interaction.toolName) || [];
        group.push(interaction);
        toolGroups.set(interaction.toolName, group);
      }
    }

    for (const [toolName, toolInteractions] of toolGroups) {
      if (toolInteractions.length >= 3) {
        const successCount = toolInteractions.filter(i => i.success).length;
        const successRate = successCount / toolInteractions.length;
        patterns.push({
          id: generateId(),
          description: 'Frequent use of ' + toolName,
          frequency: toolInteractions.length,
          firstSeen: Math.min(...toolInteractions.map(i => i.timestamp)),
          lastSeen: Math.max(...toolInteractions.map(i => i.timestamp)),
          contexts: toolInteractions.slice(0, 3).map(i => i.content.substring(0, 100)),
          success: successRate,
          agentId: this.agentId
        });
      }
    }

    return patterns;
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    const filePath = this.getMemoryPath(memoryId);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    
    // Update index
    const index = this.readIndex('memories');
    const filtered = index.filter(id => id !== memoryId);
    this.writeIndex('memories', filtered);
    return true;
  }

  async searchMemories(query: string, limit: number = 20): Promise<MemoryEntry[]> {
    if (!query || query.trim().length === 0) return [];
    const allMemories = await this.getMemories();
    const lowerQuery = query.toLowerCase();
    const scored = allMemories.map(m => ({
      entry: m,
      score: m.content.toLowerCase().includes(lowerQuery) ? 1 : 0
    })).filter(s => s.score > 0);
    return scored.slice(0, limit).map(s => s.entry);
  }

  async getMemoryCount(): Promise<number> {
    const index = this.readIndex('memories');
    return index.length;
  }

  // Agent Learnings Summary
  async getLearningsSummary(): Promise<AgentLearnings> {
    const sessions = await this.getRecentSessions(20);
    const memories = await this.getMemories();
    const interactions = await this.getRecentInteractions(100);
    const patterns = await this.detectPatterns(interactions);

    return {
      agentId: this.agentId,
      sessionHistory: sessions,
      patternHistory: patterns,
      skillSuggestions: [],
      lastAnalysisTime: Date.now()
    };
  }

}

export function createAgentMemory(config: AgentMemoryConfig): AgentMemory {
  return new AgentMemory(config);
}