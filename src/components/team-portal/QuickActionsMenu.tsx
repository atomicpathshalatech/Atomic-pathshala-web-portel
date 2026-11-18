"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  FileCheck2,
  PlusCircle,
  Layers,
  Calendar,
  UserPlus,
  Megaphone,
  Contact2,
  CreditCard,
  ChevronDown,
} from "lucide-react";

interface QuickActionItem {
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    label: "Create Test",
    sublabel: "Build NEET / JEE test from Question Bank",
    icon: FileCheck2,
    href: "/team/tests/new",
    badge: "Assessment",
  },
  {
    label: "Add Question",
    sublabel: "Add single or bilingual MCQ to bank",
    icon: PlusCircle,
    href: "/team/questions/new",
    badge: "Questions",
  },
  {
    label: "Create Batch",
    sublabel: "Set up new cohort and assign faculty",
    icon: Layers,
    href: "/team/batches",
    badge: "Academic",
  },
  {
    label: "Schedule Class",
    sublabel: "Book timetable slot or live studio",
    icon: Calendar,
    href: "/team/my-schedule",
    badge: "Timetable",
  },
  {
    label: "Onboard Student",
    sublabel: "Enroll student and grant courses",
    icon: UserPlus,
    href: "/team/students",
    badge: "Students",
  },
  {
    label: "Broadcast Notification",
    sublabel: "Send push & app notification",
    icon: Megaphone,
    href: "/team/notifications",
    badge: "Marketing",
  },
  {
    label: "Add CRM Lead",
    sublabel: "Register admission prospect",
    icon: Contact2,
    href: "/team/leads",
    badge: "Admissions",
  },
  {
    label: "Send Document / ID",
    sublabel: "Joining letter, contract, ID card",
    icon: CreditCard,
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs transition"
        aria-expanded={open}
        aria-haspopup="true"
        title="Quick Actions"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Quick Action</span>
        <ChevronDown className="w-3 h-3 text-white/80" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl bg-white shadow-xl border border-[#E2E8F0] z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-2.5 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              Quick Create
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Atomic OPS</span>
          </div>

          <div className="p-1 max-h-[65vh] overflow-y-auto space-y-0.5">
            {QUICK_ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-md bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[#0F172A] truncate group-hover:text-[#2563EB]">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-[#64748B]">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748B] truncate">{item.sublabel}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
