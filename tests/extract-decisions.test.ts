import { extractDecisions, extractNextSteps } from '../src/memory/summarizer';
import { SessionMemory, Interaction } from '../src/memory/interfaces';

describe('extractDecisions', () => {
  it('extracts decision from "use" keyword', () => {
    const interactions: Interaction[] = [{
      id: 'i1',
      type: 'user-message',
      content: 'I think we should use TypeScript for this project',
      timestamp: Date.now()
    }];
    const decisions = extractDecisions(interactions);
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0].toLowerCase()).toContain('typescript');
  });

  it('extracts decision from "decided" keyword', () => {
    const interactions: Interaction[] = [{
      id: 'i2',
      type: 'user-message',
      content: 'I have decided to go with the microservices approach',
      timestamp: Date.now()
    }];
    const decisions = extractDecisions(interactions);
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('returns empty for non-decision messages', () => {
    const interactions: Interaction[] = [{
      id: 'i3',
      type: 'user-message',
      content: 'Can you help me with this bug?',
      timestamp: Date.now()
    }];
    const decisions = extractDecisions(interactions);
    expect(decisions).toEqual([]);
  });

  it('returns empty for empty interactions', () => {
    const decisions = extractDecisions([]);
    expect(decisions).toEqual([]);
  });

  it('caps at 5 decisions', () => {
    const interactions: Interaction[] = [
      { id: 'i1', type: 'user-message', content: 'I will use React', timestamp: Date.now() },
      { id: 'i2', type: 'user-message', content: 'I decided on Vue', timestamp: Date.now() },
      { id: 'i3', type: 'user-message', content: 'Let us choose Express', timestamp: Date.now() },
      { id: 'i4', type: 'user-message', content: 'We go with Python', timestamp: Date.now() },
      { id: 'i5', type: 'user-message', content: 'I select Rust', timestamp: Date.now() },
      { id: 'i6', type: 'user-message', content: 'I decided on Go', timestamp: Date.now() }
    ];
    const decisions = extractDecisions(interactions);
    expect(decisions.length).toBeLessThanOrEqual(5);
  });
});

describe('extractNextSteps', () => {
  const makeSession = (endTime?: number, interactions?: Interaction[]): SessionMemory => ({
    sessionId: 's1',
    agentId: 'sisyphus',
    startTime: 1000,
    endTime: endTime,
    interactions: interactions || [],
    learnings: [],
    preferences: {}
  });

  it('returns retry suggestion for failed tools', () => {
    const session = makeSession(Date.now(), [
      { id: 'i1', type: 'tool-execution', content: '', timestamp: 100, success: false, toolName: 'edit' }
    ]);
    const steps = extractNextSteps(session);
    expect(steps).toContainEqual(expect.stringContaining('Retry'));
  });

  it('returns empty for completed session', () => {
    const session = makeSession(Date.now(), []);
    const steps = extractNextSteps(session);
    expect(steps).toEqual([]);
  });

  it('returns empty for open session', () => {
    const session = makeSession(undefined);
    const steps = extractNextSteps(session);
    expect(steps).toEqual([]);
  });
});