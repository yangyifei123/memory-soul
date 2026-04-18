import * as fs from 'fs';
import * as path from 'path';
import { AgentId, AgentTalents, TalentSkill } from '../memory/interfaces';
import { ensureDir, sanitizeAgentId } from '../shared/utils';
import { getDefaultTalents } from './defaults';

export interface TalentsStoreConfig {
  basePath?: string;
}

export class TalentsStore {
  private basePath: string;

  constructor(config: TalentsStoreConfig = {}) {
    this.basePath = (config.basePath || '.opencode/memory-soul') + '/talents';
    ensureDir(this.basePath);
  }

  private getTalentsPath(agentId: string): string {
    return path.join(this.basePath, sanitizeAgentId(agentId) + '.json');
  }

  private safeJsonParse<T>(content: string, filePath: string, defaultValue: T): T {
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      console.warn(`[talents-store] Corrupted JSON at ${filePath}, returning null`);
      return defaultValue;
    }
  }

  async load(agentId: AgentId): Promise<AgentTalents> {
    const filePath = this.getTalentsPath(agentId);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.safeJsonParse<AgentTalents>(content, filePath, this.getDefault(agentId));
    }
    return this.getDefault(agentId);
  }

  async save(talents: AgentTalents): Promise<void> {
    talents.updatedAt = Date.now();
    const filePath = this.getTalentsPath(talents.agentId);
    fs.writeFileSync(filePath, JSON.stringify(talents, null, 2), 'utf-8');
  }

  async exists(agentId: AgentId): Promise<boolean> {
    return fs.existsSync(this.getTalentsPath(agentId));
  }

  /**
   * Get ordered skill names for loading.
   * Returns skills sorted by priority (highest first).
   */
  getSkillNames(talents: AgentTalents): string[] {
    return talents.skills
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .map(s => s.name);
  }

  async addSkill(agentId: AgentId, skill: TalentSkill): Promise<void> {
    const talents = await this.load(agentId);
    if (talents.skills.some(s => s.name === skill.name)) {
      return; // Already exists, skip
    }
    talents.skills.push(skill);
    await this.save(talents);
  }

  async removeSkill(agentId: AgentId, skillName: string): Promise<void> {
    const talents = await this.load(agentId);
    talents.skills = talents.skills.filter(s => s.name !== skillName);
    await this.save(talents);
  }

  private getDefault(agentId: AgentId): AgentTalents {
    const defaults: Record<string, TalentSkill[]> = getDefaultTalents();
    return {
      agentId,
      skills: defaults[agentId] || [],
      autoLoad: true,
      updatedAt: Date.now()
    };
  }
}

export function createTalentsStore(config?: TalentsStoreConfig): TalentsStore {
  return new TalentsStore(config);
}