/**
 * Memory-Soul: Evolution Engine
 * Analyzes patterns and learns from interactions to improve agent performance
 */

import { AgentMemory } from '../memory/agent-memory';
import { UserModel } from '../memory/user-model';
import { Pattern, SkillSuggestion, AgentId } from '../memory/interfaces';

export interface EvolutionConfig {
  userId: string;
  basePath?: string;
  minConfidenceForSuggestion: number;
}

const DEFAULT_CONFIG: Partial<EvolutionConfig> = {
  minConfidenceForSuggestion: 0.7
};

export interface EvolutionResult {
  patterns: Pattern[];
  suggestions: SkillSuggestion[];
  improvements: string[];
}

export class EvolutionEngine {
  private config: EvolutionConfig;
  private agentMemories: Map<AgentId, AgentMemory>;
  private userModel: UserModel;
  private lastAnalysisTime: number;

  constructor(
    config: EvolutionConfig,
    agentMemories: Map<AgentId, AgentMemory>,
    userModel: UserModel
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as EvolutionConfig;
    this.agentMemories = agentMemories;
    this.userModel = userModel;
    this.lastAnalysisTime = 0;
  }

  async analyze(agentId?: AgentId): Promise<EvolutionResult> {
    const improvements: string[] = [];
    const patterns: Pattern[] = [];
    const suggestions: SkillSuggestion[] = [];

    // Analyze specified agent or all agents
    const agentIds = agentId ? [agentId] : Array.from(this.agentMemories.keys());

    for (const aid of agentIds) {
      const memory = this.agentMemories.get(aid);
      if (!memory) continue;

      // Detect patterns from recent interactions
      const recentInteractions = await memory.getRecentInteractions(50);
      const detectedPatterns = await memory.detectPatterns(recentInteractions);
      patterns.push(...detectedPatterns);

      // Analyze pattern effectiveness
      for (const pattern of detectedPatterns) {
        if (pattern.success > 0.8) {
          improvements.push(
            `${aid}: High success pattern detected: ${pattern.description}`
          );
        } else if (pattern.success < 0.3 && pattern.frequency > 5) {
          improvements.push(
            `${aid}: Low success pattern needs attention: ${pattern.description}`
          );
          suggestions.push({
            id: this.generateId(),
            skillName: `avoid-${pattern.id}`,
            reason: `Pattern "${pattern.description}" has low success rate (${pattern.success})`,
            confidence: 1 - pattern.success,
            suggestedBy: 'evolution',
            createdAt: Date.now()
          });
        }
      }

      // Generate skill suggestions based on patterns
      const skillSuggs = await this.analyzeSkillNeeds(aid, detectedPatterns);
      suggestions.push(...skillSuggs);
    }

    // Analyze user preferences
    const prefs = await this.userModel.load();
    if (prefs.preferredPatterns.includes('concise') && prefs.preferredPatterns.includes('detailed')) {
      suggestions.push({
        id: this.generateId(),
        skillName: 'adaptive-communication',
        reason: 'User shows mixed communication preferences',
        confidence: 0.8,
        suggestedBy: 'evolution',
        createdAt: Date.now()
      });
    }

    this.lastAnalysisTime = Date.now();

    return { patterns, suggestions, improvements };
  }

  private async analyzeSkillNeeds(
    agentId: AgentId,
    patterns: Pattern[]
  ): Promise<SkillSuggestion[]> {
    const suggestions: SkillSuggestion[] = [];
    
    // Analyze tool usage patterns
    const toolUsage = new Map<string, number>();
    for (const pattern of patterns) {
      const match = pattern.description.match(/Frequent use of (\w+)/);
      if (match) {
        toolUsage.set(match[1], pattern.frequency);
      }
    }
    
    // Suggest related skills based on tool usage
    for (const [tool, frequency] of toolUsage) {
      if (frequency > 10) {
        suggestions.push({
          id: this.generateId(),
          skillName: `master-${tool}`,
          reason: `${agentId} frequently uses ${tool} (${frequency} times)`,
          confidence: Math.min(frequency / 20, 0.95),
          suggestedBy: 'evolution',
          createdAt: Date.now()
        });
      }
    }
    
    return suggestions;
  }

  async getPatternInsights(agentId: AgentId): Promise<string[]> {
    const memory = this.agentMemories.get(agentId);
    if (!memory) return [];
    
    const patterns = await memory.detectPatterns(
      await memory.getRecentInteractions(100)
    );
    
    const insights: string[] = [];
    
    for (const pattern of patterns) {
      if (pattern.success > 0.7) {
        insights.push(
          `${pattern.description}: ${pattern.success * 100}% success rate over ${pattern.frequency} uses`
        );
      }
    }
    
    return insights;
  }

  async shouldSuggestImprovement(
    agentId: AgentId,
    recentInteractions: number
  ): Promise<boolean> {
    if (recentInteractions < 10) return false;
    
    const memory = this.agentMemories.get(agentId);
    if (!memory) return false;
    
    const patterns = await memory.detectPatterns(
      await memory.getRecentInteractions(50)
    );
    
    // Suggest improvement if low-success patterns exist
    return patterns.some(p => p.success < 0.5 && p.frequency > 3);
  }

  private generateId(): string {
    return `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Factory function
export function createEvolutionEngine(
  config: EvolutionConfig,
  agentMemories: Map<AgentId, AgentMemory>,
  userModel: UserModel
): EvolutionEngine {
  return new EvolutionEngine(config, agentMemories, userModel);
}
