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

  // Extract from user messages — capture what the user actually asked for
  const userMessages = interactions.filter(i => i.type === 'user-message');
  if (userMessages.length > 0) {
    const intent = userMessages[0].content.slice(0, 80);
    facts.push(`User goal: ${intent}`);
  }

  // Extract from successful tool executions — capture what tools were used
  const successfulTools = interactions.filter(i => i.type === 'tool-execution' && i.success);
  if (successfulTools.length > 0) {
    const toolNames = [...new Set(successfulTools.map(i => i.toolName!))];
    facts.push(`Tools used: ${toolNames.join(', ')}`);
  }

  // Extract from failed tool executions
  const failedTools = interactions.filter(i => i.type === 'tool-execution' && !i.success);
  if (failedTools.length > 0) {
    const failedNames = [...new Set(failedTools.map(i => i.toolName!))];
    facts.push(`Failed tools: ${failedNames.join(', ')}`);
  }

  // Extract from agent responses — capture key outcomes
  const agentResponses = interactions.filter(i => i.type === 'agent-response');
  if (agentResponses.length > 0) {
    const lastResponse = agentResponses[agentResponses.length - 1].content;
    if (lastResponse.length > 20) {
      facts.push(`Last outcome: ${lastResponse.slice(0, 80)}`);
    }
  }

  // Detect communication style
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
  const changes: string[] = [];

  // Capture write tool calls (file creation/modification)
  for (const i of interactions) {
    if (i.type === 'tool-execution' && i.success && i.toolName === 'write' && i.content) {
      changes.push(`Created/modified file: ${i.content}`);
    }
    // Capture edit tool calls
    if (i.type === 'tool-execution' && i.success && i.toolName === 'edit' && i.content) {
      changes.push(`Edited: ${i.content}`);
    }
    // Capture bash/shell commands that suggest project-level changes
    if (i.type === 'tool-execution' && i.success && i.toolName === 'bash' && i.content) {
      if (i.content.includes('npm') || i.content.includes('git') || i.content.includes('cargo')) {
        changes.push(`Ran: ${i.content.slice(0, 60)}`);
      }
    }
  }

  // Deduplicate
  return [...new Set(changes)].slice(0, 10);
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