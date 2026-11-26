// Practice Plan (UC-13). Owner: Tài. Jira: SCRUM-201 (skeleton with sample data).
// Shape follows UC-13: one item per day with a task and a short reason, a done flag kept per task.
// W9+: replace the sample data with the plan API (practice-plan agent) when it exists.

export type PlanCriterion = "content" | "structure" | "clarity" | "confidence";

export type PlanTask = {
  id: string;
  /** Calendar day, YYYY-MM-DD (Asia/Ho_Chi_Minh). */
  date: string;
  task: string;
  reason: string;
  /** Criterion this task trains; null for a general task. */
  criterion: PlanCriterion | null;
  done: boolean;
};

export type PracticePlan = {
  /** Date of the real interview, YYYY-MM-DD. */
  interviewDate: string;
  targetRole: string;
  /** Weak criteria taken from the latest reports; empty when the plan is general (no report yet). */
  weakCriteria: PlanCriterion[];
  tasks: PlanTask[];
};

export type PlanDemo = "default" | "empty" | "general";
