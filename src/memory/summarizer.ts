import { SessionMemory, Interaction, SessionSummary, ToolUsageSummary } from './interfaces';

export function summarizeSession(session: SessionMemory): SessionSummary {
  const toolUsage = buildToolUsageSummary(session.interactions);
  const keyFacts = extractKeyFacts(session.interactions);
  const changesMade = extractChanges(session.interactions);
  const decisionsTaken = extractDecisions(session.interactions);
  const nextSteps = extractNextSteps(session);

  return {
    sessionId: session.sessionId,
    agentId: session.agentId,
    intent: inferIntent(session.interactions),
    changesMade,
    decisionsTaken,
    nextSteps,
    keyFacts,
    toolUsage,
    startTime: session.startTime,
    endTime: session.endTime || Date.now()
  };
}

export function buildToolUsageSummary(interactions: Interaction[]): ToolUsageSummary[] {
  const toolMap = new Map<string, { count: number; success: number }>();

  for (const i of interactions) {
    if (i.type === 'tool-execution' && i.toolName) {
      const entry = toolMap.get(i.toolName) || { count: 0, success: 0 };
      entry.count++;
      if (i.success) entry.success++;
      toolMap.set(i.toolName, entry);
    }
  }

  return Array.from(toolMap.entries()).map(([tool, stats]) => ({
    tool,
    count: stats.count,
    successRate: stats.count > 0 ? stats.success / stats.count : 0
  }));
}

export function extractKeyFacts(interactions: Interaction[]): string[] {
  const facts: string[] = [];

  // Extract from successful tool executions
  const successfulTools = interactions.filter(i => i.type === 'tool-execution' && i.success);
  if (successfulTools.length > 0) {
    facts.push(`${successfulTools.length} tool executions succeeded`);
  }

  // Extract from failed tool executions
  const failedTools = interactions.filter(i => i.type === 'tool-execution' && !i.success);
  if (failedTools.length > 0) {
    facts.push(`${failedTools.length} tool executions failed`);
  }

  // Detect communication style
  const userMessages = interactions.filter(i => i.type === 'user-message');
  if (userMessages.length > 0) {
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    if (avgLength > 200) {
      facts.push('User prefers detailed communication');
    } else if (avgLength < 50) {
      facts.push('User prefers concise communication');
    }
  }

  return facts;
}

function extractChanges(interactions: Interaction[]): string[] {
  return interactions
    .filter(i => i.type === 'tool-execution' && i.success && i.toolName === 'write')
    .map(i => i.content);
}

export function extractDecisions(interactions: Interaction[]): string[] {
  // Detect decisions from user messages containing decision keywords
  const decisions: string[] = [];
  const decisionKeywords = ['use', 'choose', 'select', 'go with', 'decided', 'will', 'switch'];

  for (const i of interactions) {
    if (i.type === 'user-message') {
      const lower = i.content.toLowerCase();
      for (const keyword of decisionKeywords) {
        if (lower.includes(keyword)) {
          decisions.push(i.content.slice(0, 100));
          break;
        }
      }
    }
  }
  return decisions.slice(0, 5);
}

export function extractNextSteps(session: SessionMemory): string[] {
  // If session ended without completion, suggest next steps
  const steps: string[] = [];

  // Only suggest retrying failed tools if there actually are failed tools AND the session had proper start/end
  const pendingTools = session.interactions.filter(
    i => i.type === 'tool-execution' && !i.success
  );

  if (pendingTools.length > 0 && session.endTime) {
    steps.push(`Retry ${pendingTools.length} failed tool executions`);
  }

  return steps;
}

function inferIntent(interactions: Interaction[]): string {
  const firstUser = interactions.find(i => i.type === 'user-message');
  if (!firstUser) return 'Unknown';
  const content = firstUser.content;
  if (content.length > 100) return content.slice(0, 100) + '...';
  return content;
}