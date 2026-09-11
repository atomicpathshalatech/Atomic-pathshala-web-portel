import type { Metadata } from "next";
import { BirthdayTemplatesConsole } from "@/components/team-portal/BirthdayTemplatesConsole";

export const metadata: Metadata = { title: "Birthday Templates — Communication Center" };

export default function BirthdayTemplatesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Birthday Message Templates</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          One per category (+ optional board override). The Staff template is a GENERAL-category
          template named "Staff Birthday" — teachers get that one, students get the others.
        </p>
      </div>
      <BirthdayTemplatesConsole />
    </div>
  );
}
