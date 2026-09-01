import type { Metadata } from "next";
import { TestAttemptView } from "@/components/course-platform/TestAttemptView";

export const metadata: Metadata = {
  title: "NEET All-India Mock Test #01 — Atomic Pathshala",
};

export default function TestsSimulationPage() {
  return <TestAttemptView />;
}