import { INTERVIEWER_PROMPT_CONFIG, promptText } from '../ai/prompt-config.mjs';
import { GEMINI_SAFETY_SETTINGS } from '../ai/guardrails.mjs';
import { getInterviewPolicy, INTERVIEWER_OUTPUT_SCHEMA, validateInterviewerInput } from './interviewer-contract.mjs';
import { planQuestion } from './question-plan.mjs';
import { buildConversationMemory } from './conversation-memory.mjs';
import { buildDocumentContext } from './document-context.mjs';

export const PROMPT_VERSION = INTERVIEWER_PROMPT_CONFIG.version;
export const INTERVIEWER_SYSTEM_PROMPT = INTERVIEWER_PROMPT_CONFIG.system.join('\n');

export function buildInterviewerRequest(value, { contextMode = 'compact', repair } = {}) {
  const input = validateInterviewerInput(value);
  const memory = buildConversationMemory(input.history);
  const plan = planQuestion(input);
  const documentContext = buildDocumentContext(input, plan, contextMode);
  const policy = getInterviewPolicy(input);
  return {
    safetySettings: GEMINI_SAFETY_SETTINGS,
    systemInstruction: { parts: [{ text: promptText(INTERVIEWER_PROMPT_CONFIG, input.settings.language) }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({
      documents: documentContext.documents,
      documentCoverage: documentContext.documentCoverage,
      settings: input.settings,
      serverPolicy: { ...policy, remainingMainQuestions: Math.max(0, input.settings.plannedQuestions - policy.mainQuestionsAnswered) },
      questionPlan: plan,
      turnEvidence: documentContext.turnEvidence,
      conversationSummary: memory.conversationSummary,
      completedTurns: memory.completedTurns,
      askedQuestions: input.history.map(turn => ({ question: Array.from(turn.question).slice(0, 220).join(''), kind: turn.kind })),
      ...(repair ? { repair: { reason: repair.reason, rejectedQuestion: repair.rejectedQuestion, rejectedAction: repair.rejectedAction } } : {}),
    }) }] }],
    generationConfig: {
      responseMimeType: 'application/json', responseJsonSchema: {
        ...INTERVIEWER_OUTPUT_SCHEMA, properties: {
          ...INTERVIEWER_OUTPUT_SCHEMA.properties,
          action: { ...INTERVIEWER_OUTPUT_SCHEMA.properties.action, enum: policy.allowedActions },
          question: { ...INTERVIEWER_OUTPUT_SCHEMA.properties.question, type: policy.endReason ? 'null' : 'string' },
        },
      },
      temperature: 0.2, maxOutputTokens: 2048,
    },
  };
}
