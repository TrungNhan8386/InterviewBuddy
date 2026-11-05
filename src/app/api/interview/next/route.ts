import 'server-only';
import { createAiCallCounter, withInterviewerLimit } from '@/lib/ai/daily-limit.mjs';
import { getSignedInClient, isSupabaseConfigured } from '@/lib/interview/http';
import { InterviewerError } from '@/lib/interview/interviewer-contract.mjs';
import { createInterviewerProvider } from '@/lib/interview/interviewer-provider.mjs';
import { createNextHandler } from '@/lib/interview/next-http.mjs';
import { createNextRepository } from '@/lib/interview/next-repository.mjs';
import { createNextService } from '@/lib/interview/next-service.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = createNextHandler({
  authenticate: async (request) => {
    if (!isSupabaseConfigured) throw new InterviewerError('DATABASE_NOT_READY', 'Supabase is not configured.', 503);
    return getSignedInClient(request);
  },
  makeService: (auth) => createNextService({
    repository: createNextRepository(auth.supabase),
    // SCRUM-81: every Gemini request counts toward the user's daily AI limit.
    provider: withInterviewerLimit(createInterviewerProvider(), createAiCallCounter(auth.supabase)),
  }),
});
