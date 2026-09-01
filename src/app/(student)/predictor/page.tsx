import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { RankCollegePredictor } from "@/components/student/RankCollegePredictor";

export const metadata: Metadata = {
  title: "Rank & College Predictor",
};

export default async function PredictorPage() {
  await requireStudentSession();

  return (
    <div className="space-y-stack-lg max-w-2xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
          Rank &amp; College Predictor
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Estimate your All India Rank from expected marks, and see which colleges past ranks in your category got into.
        </p>
      </header>
      <RankCollegePredictor />
    </div>
  );
}
