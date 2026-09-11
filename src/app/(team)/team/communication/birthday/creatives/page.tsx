import type { Metadata } from "next";
import { BirthdayCreativesConsole } from "@/components/team-portal/BirthdayCreativesConsole";

export const metadata: Metadata = { title: "Birthday Creatives — Communication Center" };

export default function BirthdayCreativesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Creative Library</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload multiple images per category — sends pick randomly, avoiding a student&apos;s last 3
          used creatives when enough alternatives exist.
        </p>
      </div>
      <BirthdayCreativesConsole />
    </div>
  );
}
