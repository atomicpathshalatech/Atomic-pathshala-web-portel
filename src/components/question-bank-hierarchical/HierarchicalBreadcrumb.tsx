"use client";

import React from "react";
import { HierarchyLevel } from "@/lib/question-bank-hierarchical/types";

interface BreadcrumbItem {
  id: string;
  name: string;
  level: HierarchyLevel;
}

interface HierarchicalBreadcrumbProps {
  items: BreadcrumbItem[];
  onSelectNode?: (id: string, level: HierarchyLevel) => void;
}

export function HierarchicalBreadcrumb({ items, onSelectNode }: HierarchicalBreadcrumbProps) {
  if (!items || items.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
        <span className="material-symbols-outlined text-sm text-blue-600">account_tree</span>
        <span className="font-bold text-slate-900 dark:text-white">Question Bank Root</span>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs overflow-x-auto py-1 scrollbar-none">
      <button
        type="button"
        onClick={() => onSelectNode?.("root", "ROOT")}
        className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-bold flex items-center gap-1 shrink-0 transition"
      >
        <span className="material-symbols-outlined text-sm">account_tree</span>
        <span>Question Bank</span>
      </button>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.level}_${item.id}`}>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <button
              type="button"
              disabled={isLast}
              onClick={() => onSelectNode?.(item.id, item.level)}
              className={`shrink-0 transition font-medium ${
                isLast
                  ? "text-blue-600 dark:text-blue-400 font-black cursor-default"
                  : "text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              {item.name}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
