"use client";

import React, { useState } from "react";
import { INBUILT_SLIDE_TEMPLATES, type SlideTemplate } from "@/lib/whiteboard/templates";

interface SlideTemplatesModalProps {
  currentBackground?: string;
  onApplyCurrent: (bgValue: string) => void;
  onAddNewPageWithTemplate: (bgValue: string) => void;
  onClose: () => void;
}

export function SlideTemplatesModal({
  currentBackground,
  onApplyCurrent,
  onAddNewPageWithTemplate,
  onClose,
}: SlideTemplatesModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Slides", icon: "auto_awesome" },
    { id: "brand", label: "Atomic Brand", icon: "branding_watermark" },
    { id: "ruled", label: "Ruled Notebook", icon: "subject" },
    { id: "math", label: "Math & Graphs", icon: "grid_4x4" },
  ];

  const filteredTemplates =
    selectedCategory === "all"
      ? INBUILT_SLIDE_TEMPLATES
      : INBUILT_SLIDE_TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#121422] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0a0b12] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">style</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Inbuilt Slide Templates</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 font-bold">
                  Ctrl + D
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Choose a template to apply to current slide or add as a fresh page
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-[#0f111c] border-b border-slate-800/80 overflow-x-auto shrink-0">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                selectedCategory === c.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800/60 hover:bg-slate-800 text-slate-300"
              }`}
            >
              <span className="material-symbols-outlined text-sm">{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((t) => {
            const isCurrent = currentBackground === t.backgroundValue;
            return (
              <div
                key={t.id}
                className={`flex flex-col justify-between p-3.5 rounded-2xl border transition-all duration-150 bg-[#161828]/90 ${
                  isCurrent
                    ? "border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Preview Thumbnail Card */}
                <div
                  className={`w-full aspect-video rounded-xl border flex flex-col items-center justify-center p-3 relative overflow-hidden shadow-inner ${t.thumbnailBg}`}
                >
                  <span className="material-symbols-outlined text-2xl opacity-75">{t.icon}</span>
                  <span className="text-[11px] font-bold mt-1 tracking-wide">{t.name}</span>
                  {isCurrent && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold shadow">
                      Current Page
                    </span>
                  )}
                </div>

                {/* Details & Actions */}
                <div className="mt-3 space-y-2">
                  <div className="min-h-[32px]">
                    <h4 className="text-xs font-bold text-white truncate">{t.name}</h4>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{t.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onApplyCurrent(t.backgroundValue);
                        onClose();
                      }}
                      className="w-full py-1.5 px-2 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition text-center"
                      title="Apply this template to current slide"
                    >
                      Apply Current
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddNewPageWithTemplate(t.backgroundValue);
                        onClose();
                      }}
                      className="w-full py-1.5 px-2 rounded-xl text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition text-center flex items-center justify-center gap-1"
                      title="Add a new slide page with this template"
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      <span>+ New Slide</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info showing custom folder path */}
        <div className="px-5 py-3 bg-[#0a0b12] border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-indigo-400 text-sm">folder</span>
            <span>
              Custom slides folder: <code className="text-indigo-300 font-mono">public/templates/slides/</code>
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Shortcut: Ctrl+D to open anytime</span>
        </div>
      </div>
    </div>
  );
}
