import test from 'node:test';
import assert from 'node:assert/strict';
import {toPracticePlanView} from '../lib/planning/ui-adapter.mjs';
import {savedPlanPayload} from './planning-fixtures.mjs';

test('persisted plan maps to Tai UI shape with stable task IDs and structure criterion',()=>{
 const plan={...savedPlanPayload(),id:'00000000-0000-4000-8000-000000000021',general:false,weakCriteria:['star','clarity'],sourceSessionId:'00000000-0000-4000-8000-000000000011'};
 plan.tasks[0].criterion='star';plan.tasks[1].criterion='clarity';
 const before=structuredClone(plan);
 const view=toPracticePlanView({plan});
 assert.equal(view.targetRole,'Developer');assert.deepEqual(view.weakCriteria,['structure','clarity']);
 assert.equal(view.tasks[0].criterion,'structure');assert.equal(view.tasks[0].reason,'Practice a concrete explanation.');
 assert.equal(view.tasks[0].done,false);assert.ok(view.tasks[0].id);
 assert.notEqual(view.tasks[0].id,view.tasks[1].id);
 assert.equal(toPracticePlanView({plan}).tasks[0].id,view.tasks[0].id);
 assert.deepEqual(plan,before);
 assert.equal(toPracticePlanView({plan:null}),null);
});
test('UI adapter rejects malformed plans instead of producing incomplete UI data',()=>{
 const plan={...savedPlanPayload(),id:'plan'};plan.tasks[0].rationale='';
 assert.throws(()=>toPracticePlanView({plan}),{code:'INVALID_OUTPUT'});
 assert.throws(()=>toPracticePlanView({}),{code:'INVALID_OUTPUT'});
 const incoherent={...savedPlanPayload(),id:'plan',interviewDate:'2026-12-01'};
 assert.throws(()=>toPracticePlanView({plan:incoherent}),{code:'INVALID_OUTPUT'});
 const unknown={...savedPlanPayload(),id:'plan',general:false,weakCriteria:['invented']};
 assert.throws(()=>toPracticePlanView({plan:unknown}),{code:'INVALID_OUTPUT'});
});
