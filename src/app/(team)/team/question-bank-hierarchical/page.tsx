"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  HierarchicalQuestionBankResponse,
  HierarchyNode,
  RevisionItemSummary,
  RevisionDashboardStats,
} from "@/lib/question-bank-hierarchical/types";
import { HierarchicalBreadcrumb } from "@/components/question-bank-hierarchical/HierarchicalBreadcrumb";
import { HierarchicalSearchFilter } from "@/components/question-bank-hierarchical/HierarchicalSearchFilter";
import { HierarchicalTreeView } from "@/components/question-bank-hierarchical/HierarchicalTreeView";
import { HierarchicalMindmapView } from "@/components/question-bank-hierarchical/HierarchicalMindmapView";
import { RevisionDashboardView } from "@/components/question-bank-hierarchical/RevisionDashboardView";

export default function QuestionBankHierarchicalPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HierarchicalQuestionBankResponse | null>(null);
  const [revisionStats, setRevisionStats] = useState<RevisionDashboardStats>({
    activePortionsCount: 0,
    totalRevisionSessions: 0,
    questionsRevisedCount: 0,
    averageAccuracy: 0,
    weakAreas: [],
    strongAreas: [],
  });
  const [revisionItems, setRevisionItems] = useState<RevisionItemSummary[]>([]);

  const [viewMode, setViewMode] = useState<"TREE" | "MINDMAP" | "REVISION">("TREE");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "REVIEWED" | "DRAFT">("ALL");
  const [selectedBreadcrumbs, setSelectedBreadcrumbs] = useState<
    { id: string; name: string; level: any }[]
  >([]);

  useEffect(() => {
    fetchHierarchyData();
    fetchRevisionData();
  }, [statusFilter]);

  const fetchHierarchyData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/team/question-bank-hierarchical?status=${statusFilter}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        toast.error("Failed to load hierarchical question bank.");
      }
    } catch {
      toast.error("Network error loading question bank.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRevisionData = async () => {
    try {
      const res = await fetch("/api/team/revision");
      const json = await res.json();
      if (json.success && json.data) {
        setRevisionStats(json.data.stats);
        setRevisionItems(json.data.items);
      }
    } catch {
      // Ignored
    }
  };

  const handleToggleRevision = async (node: HierarchyNode) => {
    if (node.inRevision && node.revisionItemId) {
      // Remove from revision
      try {
        const res = await fetch("/api/team/revision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "remove",
            revisionItemId: node.revisionItemId,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Removed ${node.name} from Revision.`);
          fetchHierarchyData();
          fetchRevisionData();
        }
      } catch {
        toast.error("Failed to remove revision item.");
      }
    } else {
      // Add to revision
      try {
        const res = await fetch("/api/team/revision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            entityType: node.level,
            entityId: node.id,
            title: node.name,
            fullPath: node.fullPath,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Added ${node.name} to Revision Hub!`);
          fetchHierarchyData();
          fetchRevisionData();
        }
      } catch {
        toast.error("Failed to add to revision.");
      }
    }
  };

  const handleAcknowledgeNewNode = async (node: HierarchyNode) => {
    try {
      await fetch("/api/team/question-bank-hierarchical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acknowledge_seen",
          entityType: node.level,
          entityId: node.id,
        }),
      });
      fetchHierarchyData();
    } catch {
      // Ignored
    }
  };

  const handleSelectNode = (node: HierarchyNode) => {
    if (data?.breadcrumbsMap[node.key]) {
      setSelectedBreadcrumbs(data.breadcrumbsMap[node.key]);
    }
  };

  // Filtered Tree Nodes when searching
  const filteredTree = useMemo(() => {
    if (!data?.tree) return [];
    if (!searchQuery.trim()) return data.tree;

    const query = searchQuery.toLowerCase();

    const filterNode = (node: HierarchyNode): HierarchyNode | null => {
      const matchSelf =
        node.name.toLowerCase().includes(query) ||
        (node.nameHindi && node.nameHindi.toLowerCase().includes(query)) ||
        node.fullPath.toLowerCase().includes(query);

      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter((n): n is HierarchyNode => n !== null);

      if (matchSelf || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    };

    return data.tree.map(filterNode).filter((n): n is HierarchyNode => n !== null);
  }, [data?.tree, searchQuery]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Banner & Top Dynamic Summary */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                Single Source of Truth
              </span>
              <span className="text-xs text-slate-400 font-bold">• Live Auto-Sync</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              Question Bank Hierarchical &amp; Revision System
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl mt-1">
              Interactive academic hierarchy (Class &rarr; Subject &rarr; Chapter &rarr; Topic &rarr; Subtopic) with live dynamic count aggregation, new node detection, and persistent portion-based revision.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/team/questions"
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">table_chart</span>
              <span>Table View</span>
            </Link>
            <Link
              href="/team/questions/new"
              className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-500/20 transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Create Question</span>
            </Link>
          </div>
        </div>

        {/* Dynamic Top Summary Metrics */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Questions</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {data.summary.totalQuestions.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 text-center">
              <span className="text-[10px] font-bold text-emerald-600 block uppercase">Reviewed</span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                {data.summary.reviewedQuestions.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 text-center">
              <span className="text-[10px] font-bold text-amber-600 block uppercase">Draft</span>
              <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                {data.summary.draftQuestions.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Classes</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                {data.summary.classesCount}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Subjects</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                {data.summary.subjectsCount}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Chapters</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                {data.summary.chaptersCount}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Topics</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                {data.summary.topicsCount}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Sub-topics</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                {data.summary.subtopicsCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Search, Status Filter & View Mode Switcher */}
      <HierarchicalSearchFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeRevisionCount={revisionStats.activePortionsCount}
      />

      {/* 3. Interactive Breadcrumb Trail */}
      <div className="px-2">
        <HierarchicalBreadcrumb items={selectedBreadcrumbs} />
      </div>

      {/* 4. Active View Mode Render */}
      {loading ? (
        <div className="p-20 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
          <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">Loading dynamic question bank hierarchy...</p>
        </div>
      ) : viewMode === "TREE" ? (
        <HierarchicalTreeView
          nodes={filteredTree}
          onToggleRevision={handleToggleRevision}
          onAcknowledgeNewNode={handleAcknowledgeNewNode}
          onSelectNode={handleSelectNode}
          statusFilter={statusFilter}
        />
      ) : viewMode === "MINDMAP" ? (
        <HierarchicalMindmapView
          nodes={filteredTree}
          totalQuestions={data?.summary.totalQuestions || 0}
          onToggleRevision={handleToggleRevision}
          onSelectNode={handleSelectNode}
        />
      ) : (
        <RevisionDashboardView
          stats={revisionStats}
          items={revisionItems}
          onRefresh={fetchRevisionData}
          onRemoveFromRevision={(id) => {
            fetch("/api/team/revision", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "remove", revisionItemId: id }),
            }).then(() => {
              toast.success("Removed from active revision.");
              fetchRevisionData();
              fetchHierarchyData();
            });
          }}
        />
      )}
    </div>
  );
}
