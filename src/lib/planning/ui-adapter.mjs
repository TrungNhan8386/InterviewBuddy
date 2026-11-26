import { PlanError, validateSavedPlan } from './contract.mjs';

/** Map the saved API contract to Tai's SCRUM-201 PracticePlan view model. */
export function toPracticePlanView(response) {
 if(response?.plan===null)return null;
 const plan=response?.plan;
 if(!plan||typeof plan.id!=='string'||!plan.id.trim())throw new PlanError('INVALID_OUTPUT',502);
 const criterion=key=>key==='star'?'structure':key;
 // Current generation contract starts every task as incomplete. Reject malformed API data.
 const {tasks}=validateSavedPlan(plan);
 return {
  interviewDate:plan.interviewDate,targetRole:plan.targetPosition,
  weakCriteria:plan.weakCriteria.map(criterion),
  tasks:tasks.map(task=>({id:`${plan.id}:${task.date}`,date:task.date,task:task.task,
   reason:task.rationale,criterion:criterion(task.criterion),done:false})),
 };
}
