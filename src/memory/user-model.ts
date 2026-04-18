/**
 * Memory-Soul: User Preference Model
 * Tracks and learns user preferences across all agents
 */

import * as fs from 'fs';
import * as path from 'path';
import { UserPreferences, AgentId } from './interfaces';
import { ensureDir } from '../shared/utils';

export interface UserModelConfig {
  userId: string;
  basePath?: string;
}

export class UserModel {
  private basePath: string;
  private userId: string;
  private preferences: UserPreferences | null = null;

  constructor(config: UserModelConfig) {
    this.userId = config.userId;
    this.basePath = (config.basePath || '.opencode/memory-soul') + '/users/' + config.userId;
    ensureDir(this.basePath);
    ensureDir(path.join(this.basePath, 'agent-usage'));
  }

  private getPreferencesPath(): string {
    return path.join(this.basePath, 'preferences.json');
  }

  private getAgentUsagePath(agentId: string): string {
    return path.join(this.basePath, 'agent-usage', agentId + '.json');
  }

  async load(): Promise<UserPreferences> {
    if (this.preferences) {
      return this.preferences;
    }
    
    const filePath = this.getPreferencesPath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.preferences = JSON.parse(content);
    } else {
      this.preferences = this.createDefault();
      await this.save();
    }
    
    return this.preferences!;
  }

  async save(): Promise<void> {
    if (!this.preferences) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    
    this.preferences.lastUpdated = Date.now();
    const filePath = this.getPreferencesPath();
    fs.writeFileSync(filePath, JSON.stringify(this.preferences, null, 2), 'utf-8');
  }

  async updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<void> {
    await this.load();
    (this.preferences as any)[key] = value;
    await this.save();
  }

  async addPreferredPattern(pattern: string): Promise<void> {
    await this.load();
    if (!this.preferences!.preferredPatterns.includes(pattern)) {
      this.preferences!.preferredPatterns.push(pattern);
      await this.save();
    }
  }

  async addIgnoredPattern(pattern: string): Promise<void> {
    await this.load();
    if (!this.preferences!.ignoredPatterns.includes(pattern)) {
      this.preferences!.ignoredPatterns.push(pattern);
      await this.save();
    }
  }

  async setPreferredAgent(agentId: AgentId): Promise<void> {
    await this.updatePreference('preferredAgent', agentId);
  }

  async setCommunicationStyle(
    style: 'concise' | 'detailed' | 'mixed'
  ): Promise<void> {
    await this.updatePreference('communicationStyle', style);
  }

  async setTechnicalLevel(
    level: 'beginner' | 'intermediate' | 'expert'
  ): Promise<void> {
    await this.updatePreference('technicalLevel', level);
  }

  // Pattern-based preference inference
  async inferPreferencesFromInteraction(
    content: string,
    agentId: AgentId
  ): Promise<void> {
    await this.load();

    // Use character count for robustness (CJK compatibility)
    const charCount = content.length;
    const hasTechnicalTerms = /function|class|interface|type|async|await|import|export/i.test(content);

    // Detect and add preferred patterns
    if (charCount > 150) {
      if (!this.preferences!.preferredPatterns.includes('detailed')) {
        this.preferences!.preferredPatterns.push('detailed');
      }
      this.preferences!.preferredPatterns = this.preferences!.preferredPatterns.filter(p => p !== 'concise');
    } else if (charCount < 50) {
      if (!this.preferences!.preferredPatterns.includes('concise')) {
        this.preferences!.preferredPatterns.push('concise');
      }
      this.preferences!.preferredPatterns = this.preferences!.preferredPatterns.filter(p => p !== 'detailed');
    }

    if (hasTechnicalTerms && this.preferences!.technicalLevel !== 'expert') {
      await this.setTechnicalLevel('expert');
    }

    await this.save();

    // Track agent usage
    await this.incrementAgentUsage(agentId);
  }

  private async incrementAgentUsage(agentId: AgentId): Promise<void> {
    const usagePath = this.getAgentUsagePath(agentId);
    let usage = 0;
    if (fs.existsSync(usagePath)) {
      const content = fs.readFileSync(usagePath, 'utf-8');
      usage = JSON.parse(content);
    }
    usage++;
    fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2), 'utf-8');
  }

  async getAgentUsageStats(): Promise<Record<AgentId, number>> {
    const stats: Record<AgentId, number> = {} as Record<AgentId, number>;
    const agentUsageDir = path.join(this.basePath, 'agent-usage');
    
    if (fs.existsSync(agentUsageDir)) {
      const files = fs.readdirSync(agentUsageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const agentId = file.replace('.json', '') as AgentId;
          const filePath = path.join(agentUsageDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          stats[agentId] = JSON.parse(content);
        }
      }
    }
    
    return stats;
  }

  async getMostUsedAgent(): Promise<AgentId | undefined> {
    const stats = await this.getAgentUsageStats();
    const entries = Object.entries(stats);
    if (entries.length === 0) return undefined;
    
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0] as AgentId;
  }

  private createDefault(): UserPreferences {
    return {
      userId: this.userId,
      communicationStyle: 'mixed',
      technicalLevel: 'intermediate',
      ignoredPatterns: [],
      preferredPatterns: [],
      lastUpdated: Date.now()
    };
  }
}

export function createUserModel(config: UserModelConfig): UserModel {
  return new UserModel(config);
}
