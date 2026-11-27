export function withPracticeTurns<T extends { claim(request: { sessionId: string; afterAnswerId: string | null }): Promise<unknown> }>(
  base: T,
  supabase: unknown,
): T;
