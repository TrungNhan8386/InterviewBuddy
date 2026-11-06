// Route handlers for /api/analyze and /api/analyze-fit (SCRUM-81): POST needs
// a signed-in user, and each analysis counts toward that user's daily AI limit.
// The limit is checked after the input is validated, just before Gemini is called.
// `authenticate` is injected so tests can run without Next.js or Supabase.
import { createGeminiProvider } from '../analysis/gemini.mjs';
import { createAnalysisService } from '../analysis/service.mjs';
import { createAiCallCounter, withAnalysisLimit } from './daily-limit.mjs';

export function createSignedInAnalysisRoute({
  createHandler,
  authenticate,
  unauthorizedMessage = 'Please sign in first.',
  createProvider = () => createGeminiProvider(),
  createCounter = (supabase) => createAiCallCounter(supabase),
}) {
  // OPTIONS, GET and other methods only return CORS / 405 responses.
  const handle = createHandler({});
  return {
    handle,
    async POST(request) {
      const auth = await authenticate(request);
      if (!auth) {
        return Response.json(
          { error: { code: 'UNAUTHORIZED', message: unauthorizedMessage } },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const provider = withAnalysisLimit(createProvider(), createCounter(auth.supabase));
      return createHandler({ analyze: createAnalysisService({ provider }) })(request);
    },
  };
}
