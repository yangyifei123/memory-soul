/**
 * Memory-Soul: Identity Store
 * Per-agent identity management with CRUD operations and defaults
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentId, AgentIdentity } from '../memory/interfaces';
import { ensureDir, sanitizeAgentId } from '../shared/utils';
import { getDefaultIdentities } from './defaults';

export interface IdentityStoreConfig {
  basePath?: string;
}

export class IdentityStore {
  private basePath: string;

  constructor(config: IdentityStoreConfig = {}) {
    this.basePath = (config.basePath || '.opencode/memory-soul') + '/identities';
    ensureDir(this.basePath);
  }

  private getIdentityPath(agentId: string): string {
    return path.join(this.basePath, sanitizeAgentId(agentId) + '.json');
  }

  private safeJsonParse<T>(content: string, filePath: string, defaultValue: T): T {
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      console.warn(`[identity-store] Corrupted JSON at ${filePath}, returning null`);
      return defaultValue;
    }
  }

  async load(agentId: AgentId): Promise<AgentIdentity> {
    const filePath = this.getIdentityPath(agentId);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.safeJsonParse<AgentIdentity>(content, filePath, this.getDefault(agentId));
    }
    return this.getDefault(agentId);
  }

  async save(identity: AgentIdentity): Promise<void> {
    this.validate(identity);
    identity.updatedAt = Date.now();
    const filePath = this.getIdentityPath(identity.agentId);
    fs.writeFileSync(filePath, JSON.stringify(identity, null, 2), 'utf-8');
  }

  async exists(agentId: AgentId): Promise<boolean> {
    return fs.existsSync(this.getIdentityPath(agentId));
  }

  /**
   * Serialize identity to compact markdown for agent context injection.
   * Target: <400 tokens (~200 words).
   */
  toContext(identity: AgentIdentity): string {
    const caps = identity.capabilities.length > 0
      ? identity.capabilities.slice(0, 5).map(c => '- ' + c).join('\n')
      : '- General assistance';
    const constraints = identity.constraints.length > 0
      ? identity.constraints.slice(0, 3).map(c => '- ' + c).join('\n')
      : '';
    return [
      `## Identity: ${identity.name}`,
      `**Role**: ${identity.role}`,
      `**Personality**: ${identity.personality}`,
      `**Capabilities**:\n${caps}`,
      constraints ? `**Constraints**:\n${constraints}` : ''
    ].filter(Boolean).join('\n');
  }

  private validate(identity: AgentIdentity): void {
    if (!identity.agentId || !identity.name || !identity.role) {
      throw new Error('Identity must have agentId, name, and role');
    }
  }

  private getDefault(agentId: AgentId): AgentIdentity {
    const defaults: Record<string, Partial<AgentIdentity>> = getDefaultIdentities();
    const base = defaults[agentId] || {};
    return {
      agentId,
      name: base.name || agentId,
      role: base.role || 'Assistant',
      personality: base.personality || 'Helpful and responsive.',
      capabilities: base.capabilities || ['general-assistance'],
      constraints: base.constraints || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
}

export function createIdentityStore(config?: IdentityStoreConfig): IdentityStore {
  return new IdentityStore(config);
}