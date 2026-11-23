import { FeedbackError } from './contract.mjs';

export function createFeedbackRepository(supabase) {
  async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new FeedbackError(['PGRST202', '42883', '42P01', '42703'].includes(error.code) ? 'DATABASE_NOT_READY' : 'SERVER_ERROR',
      ['PGRST202', '42883', '42P01', '42703'].includes(error.code) ? 503 : 500);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new FeedbackError('SERVER_ERROR', 500);
    if (data.error) {
      const status = { NOT_FOUND: 404, LEASE_LOST: 409, STALE_ANSWER: 409, FEEDBACK_FORMAT_UNSUPPORTED: 409, INVALID_OUTPUT: 502 };
      throw new FeedbackError(Object.hasOwn(status, data.error) ? data.error : 'SERVER_ERROR', status[data.error] ?? 500);
    }
    return data;
  }
  return {
    read: answerId => rpc('read_answer_feedback', { p_answer_id: answerId }),
    claim: answerId => rpc('claim_answer_feedback', { p_answer_id: answerId }),
    finish: (answerId, token, feedback, metadata) => rpc('finish_answer_feedback', {
      p_answer_id: answerId, p_token: token, p_feedback: feedback, p_metadata: metadata,
    }),
    release: (answerId, token) => rpc('release_answer_feedback', { p_answer_id: answerId, p_token: token }),
  };
}
