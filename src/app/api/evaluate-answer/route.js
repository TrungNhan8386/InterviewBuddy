import 'server-only';
import { getSignedInClient, isSupabaseConfigured } from '@/lib/interview/http';
import { createAiCallCounter } from '@/lib/ai/daily-limit.mjs';
import { FeedbackError } from '@/lib/feedback/contract.mjs';
import { createFeedbackHandlers } from '@/lib/feedback/http.mjs';
import { createFeedbackProvider } from '@/lib/feedback/provider.mjs';
import { createFeedbackRepository } from '@/lib/feedback/repository.mjs';
import { createFeedbackService } from '@/lib/feedback/service.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;
const handlers = createFeedbackHandlers({
  authenticate: async request => {
    if (!isSupabaseConfigured) throw new FeedbackError('DATABASE_NOT_READY', 503);
    return getSignedInClient(request);
  },
  makeService: auth => createFeedbackService({
    repository: createFeedbackRepository(auth.supabase), provider: createFeedbackProvider(),
    consume: createAiCallCounter(auth.supabase),
    timeoutMs: Number(process.env.GEMINI_FEEDBACK_TIMEOUT_MS || 10000),
  }),
  observeTiming: process.env.FEEDBACK_TIMING_LOGS === '1'
    ? event => console.info('[evaluate-answer timing]', JSON.stringify(event)) : undefined,
});
export const POST = handlers.POST;
export const GET = handlers.GET;
