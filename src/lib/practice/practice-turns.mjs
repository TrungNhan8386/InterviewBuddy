// UC-10 practice sessions (SCRUM-205). Owner: Khang.
// Wraps the interview-next repository: for a practice session the next question
// is the next saved practice question (SQL practice_next_turn), never the AI.
// For a normal interview practice_next_turn answers { kind: 'not_practice' } and
// the normal claim runs, so the AI engine is unchanged.
import { InterviewerError } from '../interview/interviewer-contract.mjs';

const MISSING_FUNCTION = ['PGRST202', '42883'];

export function withPracticeTurns(base, supabase) {
  return {
    ...base,
    async claim(request) {
      const { data, error } = await supabase.rpc('practice_next_turn', {
        p_session_id: request.sessionId, p_after_answer_id: request.afterAnswerId,
      });
      if (error) {
        // Migration 20261127000000 not applied yet: behave as before.
        if (MISSING_FUNCTION.includes(error.code)) return base.claim(request);
        throw new InterviewerError('SERVER_ERROR', 'The interview turn could not be saved.', 500);
      }
      if (!data || typeof data !== 'object') throw new InterviewerError('SERVER_ERROR', 'Invalid database response.', 500);
      if (data.kind === 'not_practice') return base.claim(request);
      if (data.error === 'NOT_FOUND') throw new InterviewerError('NOT_FOUND', 'Interview session not found.', 404);
      if (data.error === 'STALE_TURN') {
        throw new InterviewerError('STALE_TURN', 'Reload the current question before continuing.', 409);
      }
      if (data.kind !== 'ready' || !data.response) {
        throw new InterviewerError('SERVER_ERROR', 'The interview turn could not be saved.', 500);
      }
      return data;
    },
  };
}
