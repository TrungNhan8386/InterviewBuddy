// Drop this route beside Khang's /api/extract-cv route in the Next.js app.
import { createAnalysisFitHandler } from '../../../lib/analysis/analysis-fit.mjs';
import { originsFromEnvironment } from '../../../lib/analysis/http.mjs';
import { createSignedInAnalysisRoute } from '../../../lib/ai/signed-in-analysis-route.mjs';
import { getSignedInClient } from '../../../lib/interview/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

const allowedOrigins = originsFromEnvironment();
// SCRUM-81: sign-in required; each analysis counts toward the daily AI limit.
const route = createSignedInAnalysisRoute({
  createHandler: (options) => createAnalysisFitHandler({ allowedOrigins, ...options }),
  authenticate: getSignedInClient,
  unauthorizedMessage: 'Vui lòng đăng nhập để phân tích CV và JD.',
});

export const POST = route.POST;
export async function OPTIONS(request) { return route.handle(request); }
export async function GET(request) { return route.handle(request); }
export async function PUT(request) { return route.handle(request); }
export async function PATCH(request) { return route.handle(request); }
export async function DELETE(request) { return route.handle(request); }
export async function HEAD(request) { return route.handle(request); }
