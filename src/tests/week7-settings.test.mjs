import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTestDatabase, USER_A, USER_B } from './interview-next-db.mjs';
import { validLanguageBody, validDeleteBody, sameOrigin } from '../lib/settings/contract.mjs';

test('settings rejects foreign user ids, invalid languages and missing confirmation', () => {
  assert.equal(validLanguageBody({ preferredLanguage: 'en' }), true);
  for (const body of [null, [], { preferredLanguage: 'fr' }, { preferredLanguage: 'en', userId: USER_B }]) assert.equal(validLanguageBody(body), false);
  assert.equal(validDeleteBody({ confirmation: 'DELETE' }), true);
  for (const body of [{}, { confirmation: 'delete' }, { confirmation: 'DELETE', userId: USER_B }]) assert.equal(validDeleteBody(body), false);
  assert.equal(sameOrigin(new Request('https://example.test/api/settings', { headers: { origin: 'https://evil.test' } })), false);
  assert.equal(sameOrigin(new Request('https://example.test/api/settings', { headers: { origin: 'https://example.test' } })), true);
});

test('migration: own-only atomic purge, idempotence, answer retry and stale/foreign turns', async () => {
  const context = await createTestDatabase();
  const { db, user, session } = context;
  try {
    await db.exec('reset role');
    await db.exec('grant select, update on public.profiles to authenticated; grant select, insert on public.feedbacks, public.reports to authenticated');
    await db.exec(await readFile(new URL('../supabase/migrations/20261107000000_settings_data.sql', import.meta.url), 'utf8'));
    await user(USER_A);
    const a = await session();
    const q = (await db.query("insert into public.questions(session_id,position,kind,content) values($1,1,'main','Question') returning id", [a])).rows[0].id;
    const save = content => db.query('select public.save_own_interview_answer($1,$2,$3) as id', [a, q, content]);
    const answer = (await save('hello world')).rows[0].id;
    assert.equal((await save('hello world')).rows[0].id, answer);
    await assert.rejects(save('different'));
    await db.query("insert into public.questions(session_id,position,kind,content) values($1,2,'main','Question 2')", [a]);
    await assert.rejects(save('hello world'));
    await db.query("insert into public.fit_analyses(jd_text,cv_text) values('JD','CV')");
    await db.query("insert into public.feedbacks(answer_id,content_score,structure_score,clarity_score,confidence_score,overall_score,explanation) values($1,5,5,5,5,5,'fixture')", [answer]);
    await db.query("insert into public.reports(session_id,overall_score) values($1,5)", [a]);
    await db.query("update public.profiles set preferred_language = 'en' where id = $1", [USER_A]);
    await db.exec('reset role');
    await db.query("insert into public.interview_next_generations(session_id,turn_key,after_answer_id,status) values($1,$2::uuid::text,$2::uuid,'failed')", [a, answer]);
    await user(USER_B);
    const b = await session();
    await assert.rejects(save('foreign answer'));
    await user(USER_A);
    // Force the second delete to fail: verify the first delete rolls back too.
    await db.exec(`reset role; create function public.test_block_delete() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end; $$;
      create trigger test_block before delete on public.fit_analyses for each row execute function public.test_block_delete();`);
    await user(USER_A);
    await assert.rejects(db.query('select public.delete_own_practice_data()'));
    assert.equal((await db.query('select count(*)::int as n from public.interview_sessions')).rows[0].n, 1);
    await db.exec('reset role; drop trigger test_block on public.fit_analyses; drop function public.test_block_delete();');
    await user(USER_A);
    const result = (await db.query('select public.delete_own_practice_data() as result')).rows[0].result;
    assert.deepEqual(result, { sessionsDeleted: 1, analysesDeleted: 1 });
    assert.equal((await db.query('select count(*)::int as n from public.questions')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int as n from public.answers')).rows[0].n, 0);
    for (const table of ['feedbacks', 'reports', 'interview_next_generations']) {
      assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 0);
    }
    assert.equal((await db.query('select preferred_language from public.profiles')).rows[0].preferred_language, 'en');
    assert.deepEqual((await db.query('select public.delete_own_practice_data() as result')).rows[0].result, { sessionsDeleted: 0, analysesDeleted: 0 });
    await user(USER_B);
    assert.equal((await db.query('select id from public.interview_sessions')).rows[0].id, b);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.delete_own_practice_data()'));
    await assert.rejects(save('anonymous'));
  } finally { await db.close(); }
});
