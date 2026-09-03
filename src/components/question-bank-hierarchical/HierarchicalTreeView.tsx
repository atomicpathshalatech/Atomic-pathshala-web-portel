"use client";

import React, { useState } from "react";
import Link from "next/link";
import { HierarchyNode } from "@/lib/question-bank-hierarchical/types";

interface HierarchicalTreeViewProps {
  nodes: HierarchyNode[];
  onToggleRevision: (node: HierarchyNode) => void;
  onAcknowledgeNewNode: (node: HierarchyNode) => void;
  onSelectNode?: (node: HierarchyNode) => void;
  statusFilter?: "ALL" | "REVIEWED" | "DRAFT";
}

export function HierarchicalTreeView({
  nodes,
  onToggleRevision,
  onAcknowledgeNewNode,
  onSelectNode,
  statusFilter = "ALL",
}: HierarchicalTreeViewProps) {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({
    // Auto-expand top class nodes by default
    ...Object.fromEntries(nodes.slice(0, 2).map((n) => [n.key, true])),
  });

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.key}
          node={node}
          expandedKeys={expandedKeys}
          onToggleExpand={toggleExpand}
          onToggleRevision={onToggleRevision}
          onAcknowledgeNewNode={onAcknowledgeNewNode}
          onSelectNode={onSelectNode}
          statusFilter={statusFilter}
          depth={0}
        />
      ))}
    </div>
  );
}

interface TreeNodeItemProps {
  node: HierarchyNode;
  expandedKeys: Record<string, boolean>;
  onToggleExpand: (key: string) => void;
  onToggleRevision: (node: HierarchyNode) => void;
  onAcknowledgeNewNode: (node: HierarchyNode) => void;
  onSelectNode?: (node: HierarchyNode) => void;
  statusFilter: "ALL" | "REVIEWED" | "DRAFT";
  depth: number;
}

function TreeNodeItem({
  node,
  expandedKeys,
  onToggleExpand,
  onToggleRevision,
  onAcknowledgeNewNode,
  onSelectNode,
  statusFilter,
  depth,
}: TreeNodeItemProps) {
  const isExpanded = expandedKeys[node.key] ?? false;
  const hasChildren = Boolean(node.children && node.children.length > 0);

  // Level-specific styles and icons
  const getLevelMeta = (level: HierarchyNode["level"]) => {
    switch (level) {
      case "CLASS":
        return {
          icon: "school",
          bg: "bg-white dark:bg-slate-900",
          border: "border-slate-200 dark:border-slate-800",
          titleClass: "text-sm font-black text-slate-900 dark:text-white",
          tagBg: "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400",
        };
      case "SUBJECT":
        return {
          icon: "menu_book",
          bg: "bg-slate-50/70 dark:bg-slate-800/40",
          border: "border-slate-200 dark:border-slate-700/80",
          titleClass: "text-xs font-bold text-slate-800 dark:text-slate-100",
          tagBg: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400",
        };
      case "CHAPTER":
        return {
          icon: "bookmark",
          bg: "bg-white dark:bg-slate-900/60",
          border: "border-slate-100 dark:border-slate-800",
          titleClass: "text-xs font-bold text-slate-700 dark:text-slate-200",
          tagBg: "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400",
        };
      case "TOPIC":
        return {
          icon: "topic",
          bg: "bg-slate-50/50 dark:bg-slate-800/20",
          border: "border-slate-100 dark:border-slate-800",
          titleClass: "text-xs font-medium text-slate-700 dark:text-slate-300",
          tagBg: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400",
        };
      case "SUBTOPIC":
      default:
        return {
          icon: "subdirectory_arrow_right",
          bg: "bg-transparent",
          border: "border-transparent",
          titleClass: "text-xs text-slate-600 dark:text-slate-400",
          tagBg: "bg-slate-100 dark:bg-slate-800 text-slate-500",
        };
    }
  };

  const meta = getLevelMeta(node.level);

  return (
    <div className={`transition-all ${depth > 0 ? "ml-4 sm:ml-6 pl-2 border-l-2 border-slate-100 dark:border-slate-800" : ""}`}>
      {/* Main Node Card */}
      <div
        className={`group p-3 sm:p-4 rounded-2xl border transition-all ${meta.bg} ${meta.border} ${
          node.isNew ? "ring-2 ring-purple-500/40 border-purple-300 dark:border-purple-800" : ""
        } hover:shadow-md`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Expand Toggle + Icon + Title + NEW Badge */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleExpand(node.key)}
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition shrink-0"
              >
                <span className="material-symbols-outlined text-base">
                  {isExpanded ? "expand_more" : "chevron_right"}
                </span>
              </button>
            ) : (
              <span className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-700 shrink-0">
                •
              </span>
            )}

            <div
              onClick={() => onSelectNode?.(node)}
              className="cursor-pointer min-w-0 flex-1"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {/* Level badge */}
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold shrink-0 ${meta.tagBg}`}>
                  {node.level}
                </span>

                {/* Title */}
                <span className={`truncate ${meta.titleClass}`}>{node.name}</span>

                {/* Hindi Title if exists */}
                {node.nameHindi && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-sans hidden sm:inline">
                    ({node.nameHindi})
                  </span>
                )}

                {/* 🟣 NEW Node Indicator */}
                {node.isNew && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-800 shadow-sm shrink-0">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                    <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      NEW
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcknowledgeNewNode(node);
                      }}
                      title="Mark as Seen"
                      className="text-purple-400 hover:text-purple-700 text-[10px] font-bold ml-1"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Dynamic Aggregated Counts + Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Counts Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs">
              <span className="font-bold text-slate-900 dark:text-white">
                {node.counts.total.toLocaleString()} Questions
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                {node.counts.reviewed} Reviewed
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                {node.counts.draft} Draft
              </span>
            </div>

            {/* + Add to Revision Button */}
            <button
              type="button"
              onClick={() => onToggleRevision(node)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                node.inRevision
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-sm"
                  : "bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 border border-slate-200 dark:border-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {node.inRevision ? "check_circle" : "playlist_add"}
              </span>
              <span className="hidden sm:inline">
                {node.inRevision ? "In Revision" : "Add to Revision"}
              </span>
            </button>

            {/* Quick + Add Question under this node */}
            <Link
              href={`/team/questions/new?subject=${encodeURIComponent(
                node.pathIds.subjectId || node.name
              )}&chapter=${encodeURIComponent(node.pathIds.chapterId || node.name)}`}
              className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition"
              title={`Create new question under ${node.name}`}
            >
              <span className="material-symbols-outlined text-base">add</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Expanded Children */}
      {isExpanded && hasChildren && (
        <div className="mt-2 space-y-2">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.key}
              node={child}
              expandedKeys={expandedKeys}
              onToggleExpand={onToggleExpand}
              onToggleRevision={onToggleRevision}
              onAcknowledgeNewNode={onAcknowledgeNewNode}
              onSelectNode={onSelectNode}
              statusFilter={statusFilter}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
