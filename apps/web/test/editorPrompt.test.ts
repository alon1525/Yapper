import { describe, expect, it } from 'vitest';
import { EDITOR_SYSTEM, editorPrompt } from '@/lib/editorPrompt';

describe('the edit', () => {
  it('puts the material first and the draft, fenced, after it', () => {
    const prompt = editorPrompt({
      material: '=== THE SLIDES ===\n--- stat-ghost ---\nabout: Person D',
      draft: {
        slides: [
          {
            id: 'stat-ghost',
            type: 'stat',
            format: 'eulogy',
            title: 'Person D is resting.',
            subtitle: '',
            body: '',
            quotes: [],
            people: ['Person D'],
            stats: [],
            scores: [],
            jokeScores: [],
            evidenceMessageIds: [],
            closer: '',
            confidence: 1,
            sensitivity: 'low',
            visualDirection: '',
            shareCaption: '',
          },
        ],
        dictionary: [],
      },
    });

    expect(prompt.indexOf('=== THE SLIDES ===')).toBeLessThan(prompt.indexOf('=== THE DRAFT ==='));
    expect(prompt).toContain('"id": "stat-ghost"');
    expect(prompt).toContain('Person D is resting.');
  });

  it('edits rather than grades, and keeps the writer’s constraints', () => {
    expect(EDITOR_SYSTEM).toContain('You are not grading');
    // The browser re-checks quotes and figures; the editor is told not to touch them.
    expect(EDITOR_SYSTEM).toContain('Copy each one exactly');
    expect(EDITOR_SYSTEM).toContain('Use only the numbers the slide was given');
    expect(EDITOR_SYSTEM).toContain('Person A, Person B');
    // Cutting is allowed, adding is not.
    expect(EDITOR_SYSTEM).toContain('Leave a slide out to cut it');
    expect(EDITOR_SYSTEM).toContain('Do not add slides');
  });
});
