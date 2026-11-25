import type { Metadata } from "next";
import PracticePlanView from "@/components/practice-plan/PracticePlanView";
import { PLAN_DEMOS, mockPlan } from "@/lib/practice-plan/mock";
import type { PlanDemo } from "@/lib/practice-plan/types";

export const metadata: Metadata = {
  title: "Kế hoạch luyện tập – InterviewBuddy",
};

// Practice Plan (UC-13), /practice-plan. Owner: Tài.
// SCRUM-201 (W8): skeleton with sample data. Try the states with ?demo=empty | general.
// Later: load the saved plan of the signed-in user and save task status through the plan API.
export default async function PracticePlanPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  const variant: PlanDemo = PLAN_DEMOS.includes(demo as PlanDemo) ? (demo as PlanDemo) : "default";
  // Today in Vietnam time, from the server, so server and browser render the same dates.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  return <PracticePlanView today={today} plan={mockPlan(today, variant)} />;
}
