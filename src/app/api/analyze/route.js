// Next.js App Router adapter. No API key or provider code is imported by the UI.
import { createAnalysisHandler, originsFromEnvironment } from '../../../lib/analysis/http.mjs';
import { createSignedInAnalysisRoute } from '../../../lib/ai/signed-in-analysis-route.mjs';
import { getSignedInClient } from '../../../lib/interview/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

const allowedOrigins = originsFromEnvironment();
// SCRUM-81: same sign-in and daily AI limit as /api/analyze-fit, so this route
// cannot be used to bypass the limit. The standalone server.mjs is unchanged.
const route = createSignedInAnalysisRoute({
  createHandler: (options) => createAnalysisHandler({ allowedOrigins, ...options }),
  authenticate: getSignedInClient,
  unauthorizedMessage: 'Sign in to analyze a CV and JD.',
});

export const POST = route.POST;
export async function OPTIONS(request) { return route.handle(request); }
export async function GET(request) { return route.handle(request); }
export async function PUT(request) { return route.handle(request); }
export async function PATCH(request) { return route.handle(request); }
export async function DELETE(request) { return route.handle(request); }
export async function HEAD(request) { return route.handle(request); }
