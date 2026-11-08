export function createNextHandler<Auth>(options: {
  authenticate(request: Request): Promise<Auth | null>;
  makeService(auth: Auth): NextService;
  observeTiming?: (event: import('./timing-trace.mjs').InterviewTimingEvent) => void;
}): (request: Request) => Promise<Response>;
import type { NextService } from './next-service.mjs';
