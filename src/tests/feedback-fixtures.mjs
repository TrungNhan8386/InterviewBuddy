export const answerId = '00000000-0000-4000-8000-000000000011';
export const context = {
  answerId, questionId: '00000000-0000-4000-8000-000000000012',
  sessionId: '00000000-0000-4000-8000-000000000013',
  type: 'behavioral', language: 'en', difficulty: 'easy', targetPosition: 'Frontend Intern',
  question: 'Tell me about resolving a difficult team problem.',
  answer: 'Our release was late. I owned the React form. I added validation and tests. We shipped the next day.',
  jdText: 'Build React forms and collaborate with teammates.',
};
export function validOutput(type = 'behavioral') {
  return {
    scores: {
      content: { score: 8, reason: 'The answer describes a relevant release problem and an action.', quotes: ['I added validation and tests.'] },
      star: type === 'behavioral'
        ? { score: 6, reason: 'Situation, responsibility, action and result are present but the result lacks metrics.', quotes: ['We shipped the next day.'] }
        : { score: null, reason: null, quotes: [] },
      clarity: { score: 7, reason: 'The sequence is easy to follow.', quotes: ['I owned the React form.'] },
      confidence: { score: 5, reason: 'The text states personal responsibility; this does not measure spoken confidence.', quotes: ['I owned the React form.'] },
    },
    strengths: ['You describe your own React form changes instead of attributing everything to the team.'],
    improvements: ['Explain which validation cases you tested and how those checks reduced release risk.'],
    outline: type === 'behavioral'
      ? { kind: 'star', sections: [{ label: 'Situation', guidance: 'Name the release constraint.' }, { label: 'Task', guidance: 'State your responsibility.' }, { label: 'Action', guidance: 'Explain the validation and tests you personally added.' }, { label: 'Result', guidance: 'State the next-day release and add a verified metric if available.' }] }
      : { kind: 'key_points', sections: [{ label: 'Approach', guidance: 'Explain your validation approach and a concrete test case.' }] },
  };
}
