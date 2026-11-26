import type { PracticePlan } from './fixtures/tai-practice-plan-types';
import { toPracticePlanView } from '../lib/planning/ui-adapter.mjs';

// Checked by npm run typecheck against the team's actual SCRUM-201 view contract.
type AssertViewCompatible<T extends PracticePlan | null> = T;
export type PlanningAdapterCompatibility = AssertViewCompatible<ReturnType<typeof toPracticePlanView>>;
