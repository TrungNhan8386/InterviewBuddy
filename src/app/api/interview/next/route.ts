import 'server-only';
import { createAiCallCounter, withInterviewerLimit } from '@/lib/ai/daily-limit.mjs';
import { getSignedInClient, isSupabaseConfigured } from '@/lib/interview/http';
import { InterviewerError } from '@/lib/interview/interviewer-contract.mjs';
import { createInterviewerProvider } from '@/lib/interview/interviewer-provider.mjs';
import { createNextHandler } from '@/lib/interview/next-http.mjs';
import { createNextRepository } from '@/lib/interview/next-repository.mjs';
import { createNextService } from '@/lib/interview/next-service.mjs';
import { withPracticeTurns } from '@/lib/practice/practice-turns.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = createNextHandler({
  observeTiming: process.env.INTERVIEW_TIMING_LOGS === '1'
    ? (event) => console.info('[interview-next timing]', JSON.stringify(event)) : undefined,
  authenticate: async (request) => {
    if (!isSupabaseConfigured) throw new InterviewerError('DATABASE_NOT_READY', 'Supabase is not configured.', 503);
    return getSignedInClient(request);
  },
  makeService: (auth) => createNextService({
    generationBudgetMs: Number(process.env.GEMINI_TIMEOUT_MS || 30000),
    // UC-10 (SCRUM-205): practice sessions take their questions from the saved list, not the AI.
    repository: withPracticeTurns(createNextRepository(auth.supabase), auth.supabase),
    // SCRUM-81: every Gemini request counts toward the user's daily AI limit.
    provider: withInterviewerLimit(createInterviewerProvider(), createAiCallCounter(auth.supabase)),
  }),
});
