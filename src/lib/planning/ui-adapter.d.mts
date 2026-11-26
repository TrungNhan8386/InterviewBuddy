export type PlanViewCriterion = 'content' | 'structure' | 'clarity' | 'confidence';
export interface PracticePlanViewModel {
 interviewDate: string;
 targetRole: string;
 weakCriteria: PlanViewCriterion[];
 tasks: {id:string;date:string;task:string;reason:string;criterion:PlanViewCriterion|null;done:boolean}[];
}
export function toPracticePlanView(response: unknown): PracticePlanViewModel | null;
