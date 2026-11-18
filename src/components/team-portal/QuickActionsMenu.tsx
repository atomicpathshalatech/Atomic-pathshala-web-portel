"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface QuickActionItem {
  label: string;
  sublabel: string;
  icon: string;
  href: string;
  badge?: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    label: "Create Test",
    sublabel: "Build NEET / JEE test from Question Bank",
    icon: "quiz",
    href: "/team/tests/new",
    badge: "Assessment",
  },
  {
    label: "Add Question",
    sublabel: "Add single or bilingual MCQ to bank",
    icon: "add_circle",
    href: "/team/questions/new",
    badge: "Question Bank",
  },
  {
    label: "Create Batch",
    sublabel: "Set up new cohort and assign faculty",
    icon: "group_add",
    href: "/team/batches",
    badge: "Academic",
  },
  {
    label: "Schedule Class",
    sublabel: "Book timetable slot or live studio",
    icon: "calendar_add_on",
    href: "/team/my-schedule",
    badge: "Timetable",
  },
  {
    label: "Onboard Student",
    sublabel: "Enroll student and grant courses",
    icon: "person_add",
    href: "/team/students",
    badge: "Students",
  },
  {
    label: "Broadcast Notification",
    sublabel: "Send push & app notification",
    icon: "campaign",
    href: "/team/notifications",
    badge: "Marketing",
  },
  {
    label: "Add CRM Lead",
    sublabel: "Register admission prospect",
    icon: "person_search",
    href: "/team/leads",
    badge: "Admissions",
  },
  {
    label: "Send Document / ID",
    sublabel: "Joining letter, contract, ID card",
    icon: "badge",
    href: "/team/id-cards",
    badge: "HR",
  },
];

export function QuickActionsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2563EB] text-white hover:bg-[#1d4ed8] shadow-sm transition-all active:scale-95"
        aria-expanded={open}
        aria-haspopup="true"
        title="Quick Create & Actions"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
        <span className="hidden sm:inline">Quick Action</span>
        <span className="material-symbols-outlined text-[14px]">expand_more</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl bg-white shadow-xl ring-1 ring-slate-200 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-2.5 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Quick Actions
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Atomic OPS 2.0</span>
          </div>

          <div className="p-1.5 max-h-[65vh] overflow-y-auto space-y-0.5">
            {QUICK_ACTIONS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="w-7 h-7 rounded-md bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-800 truncate group-hover:text-[#2563EB]">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{item.sublabel}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
