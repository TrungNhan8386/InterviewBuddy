// Daily AI call limit per user (SCRUM-81). Server only: the limit is checked
// with the signed-in user's Supabase client, before every real Gemini request.
// Contract: docs/api/INTERVIEW_SESSION_API_v1.md, section 6.
import { AnalysisError } from '../analysis/errors.mjs';
import { createEndDecision, InterviewerError, validateInterviewerInput } from '../interview/interviewer-contract.mjs';

export const DEFAULT_DAILY_AI_LIMIT = 100;

/** AI_DAILY_LIMIT from the environment (1–10000), or the default of 100. */
export function dailyLimitFromEnv(env = process.env) {
  const value = Number(env.AI_DAILY_LIMIT);
  return Number.isInteger(value) && value >= 1 && value <= 10000 ? value : DEFAULT_DAILY_AI_LIMIT;
}

export class AiLimitError extends Error {
  constructor(code, usage = null) {
    super(code);
    this.name = 'AiLimitError';
    this.code = code; // 'AI_DAILY_LIMIT' | 'DATABASE_NOT_READY' | 'SERVER_ERROR'
    this.usage = usage;
  }
}

/**
 * Returns consume(): counts one AI call for the user of `supabase`, or throws
 * AiLimitError('AI_DAILY_LIMIT') when today's limit is used up. Fails closed:
 * if the count cannot be checked, no AI call is made.
 */
export function createAiCallCounter(supabase, { limit = dailyLimitFromEnv() } = {}) {
  return async function consume() {
    const { data, error } = await supabase.rpc('consume_ai_call', { p_limit: limit });
    if (error) {
      throw new AiLimitError(['PGRST202', '42883'].includes(error.code) ? 'DATABASE_NOT_READY' : 'SERVER_ERROR');
    }
    if (!data || typeof data !== 'object' || data.error) throw new AiLimitError('SERVER_ERROR');
    if (!data.allowed) throw new AiLimitError('AI_DAILY_LIMIT', data);
    return data;
  };
}

function resetText(usage) {
  return usage?.limit ? ` (${usage.limit} lượt/ngày, làm mới lúc 0:00 giờ Việt Nam)` : '';
}

/** Wraps the CV–JD analysis provider so each analyze() counts as one AI call. */
export function withAnalysisLimit(provider, consume) {
  return {
    ...provider,
    async analyze(input, options) {
      try {
        await consume();
      } catch (error) {
        if (!(error instanceof AiLimitError)) throw error;
        if (error.code === 'AI_DAILY_LIMIT') {
          throw new AnalysisError('AI_DAILY_LIMIT', `Bạn đã dùng hết lượt AI hôm nay${resetText(error.usage)}.`, 429);
        }
        throw new AnalysisError('AI_LIMIT_UNAVAILABLE', 'Không kiểm tra được hạn mức AI. Vui lòng thử lại sau.', 503);
      }
      return provider.analyze(input, options);
    },
  };
}

/**
 * Wraps the AI interviewer provider. Turns that end without a Gemini request
 * (time or question limit reached) are not counted.
 */
export function withInterviewerLimit(provider, consume) {
  return {
    ...provider,
    async next(value, options) {
      if (!createEndDecision(validateInterviewerInput(value))) {
        try {
          await consume();
        } catch (error) {
          if (!(error instanceof AiLimitError)) throw error;
          if (error.code === 'AI_DAILY_LIMIT') {
            throw new InterviewerError('AI_DAILY_LIMIT', 'You have used all AI calls for today. The limit resets at 00:00 Vietnam time.', 429);
          }
          throw new InterviewerError(error.code === 'DATABASE_NOT_READY' ? 'DATABASE_NOT_READY' : 'SERVER_ERROR',
            'Could not check the daily AI limit. Please try again.', error.code === 'DATABASE_NOT_READY' ? 503 : 500);
        }
      }
      return provider.next(value, options);
    },
  };
}
