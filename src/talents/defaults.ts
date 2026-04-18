import { TalentSkill } from '../memory/interfaces';

export function getDefaultTalents(): Record<string, TalentSkill[]> {
  return {
    sisyphus: [
      { name: 'git-master', reason: 'Core orchestration needs git expertise', priority: 10, required: true },
      { name: 'bug-fixing', reason: 'Must debug issues found during delegation', priority: 8, required: true },
      { name: 'testing-strategies', reason: 'Must verify delegated work', priority: 8, required: true },
      { name: 'code-docs', reason: 'Maintain code quality standards', priority: 5, required: false },
    ],
    atlas: [
      { name: 'writing-plans', reason: 'Core planning capability', priority: 10, required: true },
      { name: 'architecture-designer', reason: 'Architecture-aware planning', priority: 8, required: true },
      { name: 'mermaid-diagrams', reason: 'Visual planning support', priority: 5, required: false },
    ],
    oracle: [
      { name: 'security-auditor', reason: 'Security review expertise', priority: 10, required: true },
      { name: 'caveman-review', reason: 'Efficient code review', priority: 8, required: false },
      { name: 'performance-optimization', reason: 'Performance analysis', priority: 7, required: false },
    ],
    explore: [
      { name: 'context7', reason: 'External documentation lookup', priority: 10, required: true },
      { name: 'find-skills', reason: 'Skill discovery for delegation', priority: 8, required: false },
    ],
    librarian: [
      { name: 'context7', reason: 'External documentation lookup', priority: 10, required: true },
    ],
    prometheus: [
      { name: 'brainstorming', reason: 'Creative ideation', priority: 10, required: true },
      { name: 'architecture-designer', reason: 'Architecture-aware creativity', priority: 8, required: false },
    ],
  };
}