import { SessionMemory, Interaction } from '../src/memory/interfaces';
import { summarizeSession, buildToolUsageSummary, extractKeyFacts } from '../src/memory/summarizer';

describe('SessionSummarizer', () => {
  describe('summarizeSession', () => {
    it('empty session → summary with empty arrays', () => {
      const session: SessionMemory = {
        sessionId: 's1',
        agentId: 'sisyphus',
        startTime: 1000,
        interactions: [],
        learnings: [],
        preferences: {}
      };

      const summary = summarizeSession(session);

      expect(summary.sessionId).toBe('s1');
      expect(summary.agentId).toBe('sisyphus');
      expect(summary.changesMade).toEqual([]);
      expect(summary.decisionsTaken).toEqual([]);
      expect(summary.nextSteps).toEqual([]);
      expect(summary.keyFacts).toEqual([]);
      expect(summary.toolUsage).toEqual([]);
    });

    it('session with tool executions → toolUsage populated', () => {
      const session: SessionMemory = {
        sessionId: 's1',
        agentId: 'sisyphus',
        startTime: 1000,
        endTime: 2000,
        interactions: [
          { id: 'i1', type: 'tool-execution', timestamp: 100, content: 'write', toolName: 'write', success: true },
          { id: 'i2', type: 'tool-execution', timestamp: 200, content: 'read', toolName: 'read', success: true }
        ],
        learnings: [],
        preferences: {}
      };

      const summary = summarizeSession(session);

      expect(summary.toolUsage).toHaveLength(2);
      expect(summary.toolUsage.find(t => t.tool === 'write')?.count).toBe(1);
      expect(summary.toolUsage.find(t => t.tool === 'read')?.count).toBe(1);
    });

    it('session with user messages → keyFacts extracted', () => {
      const session: SessionMemory = {
        sessionId: 's1',
        agentId: 'sisyphus',
        startTime: 1000,
        interactions: [
          { id: 'i1', type: 'user-message', timestamp: 100, content: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum' },
          { id: 'i2', type: 'user-message', timestamp: 200, content: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt Neque porro quisquam est qui dolorem ipsum quia dolor sit amet consectetur adipisci velit' }
        ],
        learnings: [],
        preferences: {}
      };

      const summary = summarizeSession(session);

      expect(summary.keyFacts).toContain('User prefers detailed communication');
    });
  });

  describe('buildToolUsageSummary', () => {
    it('successful tool → successRate = 1.0', () => {
      const interactions: Interaction[] = [
        { id: 'i1', type: 'tool-execution', timestamp: 100, content: 'write', toolName: 'write', success: true }
      ];

      const summary = buildToolUsageSummary(interactions);

      expect(summary).toHaveLength(1);
      expect(summary[0].successRate).toBe(1.0);
    });

    it('mixed success → correct successRate', () => {
      const interactions: Interaction[] = [
        { id: 'i1', type: 'tool-execution', timestamp: 100, content: 'write', toolName: 'write', success: true },
        { id: 'i2', type: 'tool-execution', timestamp: 200, content: 'write', toolName: 'write', success: true },
        { id: 'i3', type: 'tool-execution', timestamp: 300, content: 'write', toolName: 'write', success: false }
      ];

      const summary = buildToolUsageSummary(interactions);

      expect(summary).toHaveLength(1);
      expect(summary[0].count).toBe(3);
      expect(summary[0].successRate).toBeCloseTo(2/3);
    });

    it('handles empty interactions', () => {
      const summary = buildToolUsageSummary([]);

      expect(summary).toEqual([]);
    });
  });

  describe('extractKeyFacts', () => {
    it('detects failed tool executions', () => {
      const interactions: Interaction[] = [
        { id: 'i1', type: 'tool-execution', timestamp: 100, content: 'fail', toolName: 'fail', success: false }
      ];

      const facts = extractKeyFacts(interactions);

      expect(facts).toContain('1 tool executions failed');
    });
  });
});