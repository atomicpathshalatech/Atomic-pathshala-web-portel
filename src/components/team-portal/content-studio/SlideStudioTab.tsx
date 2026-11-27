"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Presentation,
  Save,
  Search,
  Sparkles,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import {
  SLIDE_CONTENT_TYPES,
  SLIDE_THEMES,
  SLIDE_TYPES,
  type SlideElement,
  type SlideItem,
  type SlideOutlineItem,
  type SlideThemeId,
  type SlideType,
} from "@/lib/ai-studio/slides/types";

interface SlideDeckRecord {
  id: string;
  title: string;
  subject: string | null;
  chapter: string | null;
  contentType: string;
  language: string;
  medium: string;
  templateTheme: string;
  outlineJson: SlideOutlineItem[] | null;
  slidesJson: SlideItem[] | null;
  exportedAssetId: string | null;
  updatedAt: string;
}

interface ExportedSlideAsset {
  id: string;
  title: string | null;
  publicUrl: string;
  createdAt: string;
}

interface BankQuestionItem {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  sourceLabel: string;
  statement: string;
  options: [string, string, string, string];
  imageUrl: string | null;
  solution: string | null;
}

interface SlideStudioTabProps {
  projectId: string;
  projectTitle: string;
  projectTopic?: string | null;
  projectSubject?: string | null;
  projectChapter?: string | null;
  projectLanguage?: string | null;
  projectMedium?: string | null;
}

export function SlideStudioTab({
  projectId,
  projectTitle,
  projectTopic,
  projectSubject,
  projectChapter,
  projectLanguage,
  projectMedium,
}: SlideStudioTabProps) {
  const [decks, setDecks] = useState<SlideDeckRecord[]>([]);
  const [exportedAssets, setExportedAssets] = useState<ExportedSlideAsset[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Generator form state
  const [topic, setTopic] = useState(projectTopic || projectTitle);
  const [contentType, setContentType] = useState<string>("Chapter lecture");
  const [subject, setSubject] = useState(projectSubject || "");
  const [chapter, setChapter] = useState(projectChapter || "");
  const [language, setLanguage] = useState(projectLanguage || "Hinglish");
  const [medium, setMedium] = useState(projectMedium || "English");
  const [slideCount, setSlideCount] = useState(10);
  const [themeId, setThemeId] = useState<SlideThemeId>("ATOMIC_BLACK_ORANGE");
  const [sourceMaterial, setSourceMaterial] = useState("");

  // Editable Outline & Slides state
  const [subView, setSubView] = useState<"OUTLINE" | "EDITOR">("OUTLINE");
  const [outline, setOutline] = useState<SlideOutlineItem[]>([]);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
  const [selectedElId, setSelectedElId] = useState<string | null>(null);

  // Question Bank Verbatim Modal
  const [showQModal, setShowQModal] = useState(false);
  const [qQuery, setQQuery] = useState("");
  const [bankQuestions, setBankQuestions] = useState<BankQuestionItem[]>([]);
  const [searchingQ, setSearchingQ] = useState(false);
  const [manualQText, setManualQText] = useState("");
  const [manualSource, setManualSource] = useState("NEET");
  const [manualOpts, setManualOpts] = useState<[string, string, string, string]>([
    "",
    "",
    "",
    "",
  ]);
  const [manualImageUrl, setManualImageUrl] = useState("");

  const activeDeck = useMemo(
    () => decks.find((d) => d.id === activeDeckId) || null,
    [decks, activeDeckId]
  );

  const selectedSlide = slides[selectedSlideIdx] || null;
  const selectedElement = useMemo(
    () => selectedSlide?.elements.find((e) => e.id === selectedElId) || null,
    [selectedSlide, selectedElId]
  );

  const fetchSlidesData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/slides`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load slide studio");
      const loadedDecks: SlideDeckRecord[] = json.data?.slideDecks || [];
      setDecks(loadedDecks);
      setExportedAssets(json.data?.exportedAssets || []);
      const first = loadedDecks[0];
      if (first) {
        setActiveDeckId(first.id);
        setOutline(Array.isArray(first.outlineJson) ? first.outlineJson : []);
        const loadedSlides = Array.isArray(first.slidesJson) ? first.slidesJson : [];
        setSlides(loadedSlides);
        setThemeId((first.templateTheme as SlideThemeId) || "ATOMIC_BLACK_ORANGE");
        setSubView(loadedSlides.length > 0 ? "EDITOR" : "OUTLINE");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load slides");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSlidesData();
  }, [fetchSlidesData]);

  const selectDeck = (deck: SlideDeckRecord) => {
    setActiveDeckId(deck.id);
    setOutline(Array.isArray(deck.outlineJson) ? deck.outlineJson : []);
    const s = Array.isArray(deck.slidesJson) ? deck.slidesJson : [];
    setSlides(s);
    setSelectedSlideIdx(0);
    setSelectedElId(null);
    setThemeId((deck.templateTheme as SlideThemeId) || "ATOMIC_BLACK_ORANGE");
    setSubView(s.length > 0 ? "EDITOR" : "OUTLINE");
  };

  const handleGenerateOutline = async () => {
    setBusyAction("GENERATE_OUTLINE");
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_OUTLINE",
          topic,
          contentType,
          subject,
          chapter,
          language,
          medium,
          slideCount,
          templateTheme: themeId,
          sourceMaterial,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate outline");
      const deck: SlideDeckRecord = json.data.deck;
      setDecks((prev) => [deck, ...prev]);
      selectDeck(deck);
      setSubView("OUTLINE");
      setSuccessMsg("AI Slide Outline generated! Review & edit before generating slides.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Outline generation failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveDeck = async (silent = false) => {
    if (!activeDeckId) return;
    if (!silent) setBusyAction("SAVE_DECK");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/slides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: activeDeckId,
          templateTheme: themeId,
          outlineJson: outline,
          slidesJson: slides,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save deck");
      setDecks((prev) =>
        prev.map((d) => (d.id === activeDeckId ? json.data.deck : d))
      );
      if (!silent) setSuccessMsg("Slide deck saved.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      if (!silent) setBusyAction(null);
    }
  };

  const handleGenerateSlides = async () => {
    if (!activeDeckId) return;
    setBusyAction("GENERATE_SLIDES");
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_SLIDES",
          deckId: activeDeckId,
          outline,
          templateTheme: themeId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate slides");
      const deck: SlideDeckRecord = json.data.deck;
      setDecks((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
      setSlides(Array.isArray(deck.slidesJson) ? deck.slidesJson : []);
      setSelectedSlideIdx(0);
      setSelectedElId(null);
      setSubView("EDITOR");
      setSuccessMsg("Editable slides generated! Click any element on the canvas to edit.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Slide generation failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportPptx = async () => {
    if (!activeDeckId) return;
    setBusyAction("EXPORT_PPTX");
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await handleSaveDeck(true);
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXPORT_PPTX",
          deckId: activeDeckId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to export PPTX");
      const asset: ExportedSlideAsset = json.data.asset;
      setExportedAssets((prev) => [asset, ...prev]);
      setSuccessMsg("Editable PowerPoint (.pptx) exported and saved to Project Assets!");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "PPTX export failed");
    } finally {
      setBusyAction(null);
    }
  };

  const searchQuestionBank = async (query: string) => {
    setSearchingQ(true);
    try {
      const res = await fetch(
        `/api/team/content-studio/projects/${projectId}/slides?q=${encodeURIComponent(query)}`
      );
      const json = await res.json();
      if (res.ok) {
        setBankQuestions(json.data?.bankQuestions || []);
      }
    } finally {
      setSearchingQ(false);
    }
  };

  const handleInsertQuestionSlide = async (payload: {
    questionId?: string;
    questionText?: string;
    options?: [string, string, string, string];
    sourceLabel?: string;
    imageUrl?: string;
  }) => {
    if (!activeDeckId) return;
    setBusyAction("INSERT_Q");
    setErrorMsg(null);
    try {
      await handleSaveDeck(true);
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "INSERT_QUESTION_SLIDE",
          deckId: activeDeckId,
          ...payload,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to insert question slide");
      const deck: SlideDeckRecord = json.data.deck;
      const nextSlides = Array.isArray(deck.slidesJson) ? deck.slidesJson : [];
      setSlides(nextSlides);
      setDecks((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
      setSelectedSlideIdx(Math.max(0, nextSlides.length - 1));
      setShowQModal(false);
      setSubView("EDITOR");
      setSuccessMsg("Verbatim Atomic Pathshala Question Slide inserted!");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Insert failed");
    } finally {
      setBusyAction(null);
    }
  };

  // Element editing helpers
  const updateSelectedElement = (patch: Partial<SlideElement>) => {
    if (!selectedSlide || !selectedElId) return;
    setSlides((prev) =>
      prev.map((s, idx) =>
        idx !== selectedSlideIdx
          ? s
          : {
              ...s,
              elements: s.elements.map((el) =>
                el.id === selectedElId ? { ...el, ...patch } : el
              ),
            }
      )
    );
  };

  const addElementToSlide = (type: "TEXT" | "SHAPE" | "IMAGE") => {
    if (!selectedSlide) return;
    const newEl: SlideElement = {
      id: `el_${Math.random().toString(36).slice(2, 9)}`,
      type,
      x: 1.5,
      y: 2.0,
      w: type === "IMAGE" ? 3.0 : 4.0,
      h: type === "IMAGE" ? 2.2 : 0.8,
      text: type === "TEXT" ? "New editable text" : undefined,
      fontSize: 16,
      fontFace: "Arial",
      color: "#FFFFFF",
      fillColor: type === "SHAPE" ? "#F97316" : undefined,
      shapeType: type === "SHAPE" ? "rect" : undefined,
      imageUrl: type === "IMAGE" ? "" : undefined,
      align: "left",
      valign: "top",
      zIndex: (selectedSlide.elements.length || 0) + 1,
    };
    setSlides((prev) =>
      prev.map((s, idx) =>
        idx === selectedSlideIdx ? { ...s, elements: [...s.elements, newEl] } : s
      )
    );
    setSelectedElId(newEl.id);
  };

  const deleteSelectedElement = () => {
    if (!selectedSlide || !selectedElId) return;
    setSlides((prev) =>
      prev.map((s, idx) =>
        idx === selectedSlideIdx
          ? { ...s, elements: s.elements.filter((e) => e.id !== selectedElId) }
          : s
      )
    );
    setSelectedElId(null);
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const copy = [...slides];
    const [removed] = copy.splice(idx, 1);
    if (!removed) return;
    copy.splice(target, 0, removed);
    const reindexed = copy.map((s, i) => ({ ...s, sequence: i + 1 }));
    setSlides(reindexed);
    setSelectedSlideIdx(target);
  };

  const duplicateSlide = (idx: number) => {
    const src = slides[idx];
    if (!src) return;
    const cloned: SlideItem = {
      ...src,
      id: `slide_${Math.random().toString(36).slice(2, 9)}`,
      title: `${src.title} (Copy)`,
      elements: src.elements.map((e) => ({
        ...e,
        id: `el_${Math.random().toString(36).slice(2, 9)}`,
      })),
    };
    const copy = [...slides];
    copy.splice(idx + 1, 0, cloned);
    setSlides(copy.map((s, i) => ({ ...s, sequence: i + 1 })));
    setSelectedSlideIdx(idx + 1);
  };

  const deleteSlide = (idx: number) => {
    const copy = slides.filter((_, i) => i !== idx);
    setSlides(copy.map((s, i) => ({ ...s, sequence: i + 1 })));
    setSelectedSlideIdx(Math.max(0, Math.min(idx, copy.length - 1)));
    setSelectedElId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-orange-500" />
        Loading AI Slide Studio...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Deck Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Presentation className="h-5 w-5 text-orange-500" />
            AI Slide Studio & Editable PPTX Generator
          </h2>
          <p className="text-xs text-neutral-400">
            Generate editable outlines, Atomic Pathshala Question/PYQ slides, and native PowerPoint (.pptx) decks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {decks.length > 0 && (
            <select
              value={activeDeckId || ""}
              onChange={(e) => {
                const found = decks.find((d) => d.id === e.target.value);
                if (found) selectDeck(found);
              }}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({Array.isArray(d.slidesJson) ? d.slidesJson.length : 0} slides)
                </option>
              ))}
            </select>
          )}
          {activeDeck && (
            <>
              <button
                onClick={() => handleSaveDeck(false)}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
              <button
                onClick={handleExportPptx}
                disabled={busyAction !== null || slides.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {busyAction === "EXPORT_PPTX" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export Editable .pptx
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {successMsg}
        </div>
      )}

      {/* Generator Panel */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">New Presentation Setup</h3>
          <span className="text-xs text-neutral-400">Step 1: Generate Editable Outline</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-neutral-400">Topic / Title</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Chemical Bonding One Shot (NEET 2026)"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Content Type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            >
              {SLIDE_CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Design Theme</label>
            <select
              value={themeId}
              onChange={(e) => setThemeId(e.target.value as SlideThemeId)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            >
              {Object.values(SLIDE_THEMES).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Chemistry / Physics / Biology"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Chapter</label>
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Chapter name"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Language / Medium</label>
            <div className="flex gap-2">
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-1/2 rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm text-white"
              />
              <input
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                className="w-1/2 rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Slides Count</label>
            <input
              type="number"
              min={3}
              max={30}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value) || 10)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-400">
              Optional Source Material / Notes (auto-uses project script if left blank)
            </label>
            <textarea
              rows={2}
              value={sourceMaterial}
              onChange={(e) => setSourceMaterial(e.target.value)}
              placeholder="Paste NCERT notes, lecture points, or custom questions..."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            onClick={handleGenerateOutline}
            disabled={busyAction !== null || !topic.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {busyAction === "GENERATE_OUTLINE" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Slide Outline
          </button>
        </div>
      </div>

      {/* Sub-navigation: Outline vs Slide Editor */}
      {activeDeck && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSubView("OUTLINE")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium ${
                  subView === "OUTLINE"
                    ? "bg-orange-600 text-white"
                    : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <FileText className="h-4 w-4" />
                1. Slide Outline ({outline.length})
              </button>
              <button
                onClick={() => setSubView("EDITOR")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium ${
                  subView === "EDITOR"
                    ? "bg-orange-600 text-white"
                    : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <Layers className="h-4 w-4" />
                2. Interactive Slide Editor ({slides.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowQModal(true);
                  searchQuestionBank(qQuery);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Insert Verbatim Question / PYQ Slide
              </button>
              <button
                onClick={handleGenerateSlides}
                disabled={busyAction !== null || outline.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busyAction === "GENERATE_SLIDES" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate Editable Slides
              </button>
            </div>
          </div>

          {/* VIEW 1: EDITABLE OUTLINE */}
          {subView === "OUTLINE" && (
            <div className="space-y-3">
              {outline.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-400">
                        Slide {idx + 1}
                      </span>
                      <select
                        value={item.slideType}
                        onChange={(e) => {
                          const val = e.target.value as SlideType;
                          setOutline((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, slideType: val } : o
                            )
                          );
                        }}
                        className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white"
                      >
                        {SLIDE_TYPES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() =>
                        setOutline((prev) =>
                          prev
                            .filter((_, i) => i !== idx)
                            .map((o, i) => ({ ...o, sequence: i + 1 }))
                        )
                      }
                      className="text-neutral-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-neutral-400">
                        Slide Title
                      </label>
                      <input
                        value={item.title}
                        onChange={(e) =>
                          setOutline((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, title: e.target.value } : o
                            )
                          )
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-neutral-400">
                        Visual / Diagram / Question Note
                      </label>
                      <input
                        value={item.visualRequirement || ""}
                        onChange={(e) =>
                          setOutline((prev) =>
                            prev.map((o, i) =>
                              i === idx
                                ? { ...o, visualRequirement: e.target.value }
                                : o
                            )
                          )
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-neutral-400">
                        Slide Content
                      </label>
                      <textarea
                        rows={2}
                        value={item.content}
                        onChange={(e) =>
                          setOutline((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, content: e.target.value } : o
                            )
                          )
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-neutral-400">
                        Teacher Notes
                      </label>
                      <textarea
                        rows={2}
                        value={item.teacherNotes || ""}
                        onChange={(e) =>
                          setOutline((prev) =>
                            prev.map((o, i) =>
                              i === idx
                                ? { ...o, teacherNotes: e.target.value }
                                : o
                            )
                          )
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  setOutline((prev) => [
                    ...prev,
                    {
                      id: `out_${Date.now()}`,
                      sequence: prev.length + 1,
                      slideType: "Concept explanation",
                      title: `New Slide ${prev.length + 1}`,
                      content: "",
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-4 py-2 text-xs text-neutral-300 hover:border-orange-500 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Outline Slide
              </button>
            </div>
          )}

          {/* VIEW 2: INTERACTIVE SLIDE EDITOR */}
          {subView === "EDITOR" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Slide List */}
              <div className="space-y-2 lg:col-span-3">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
                  <span>SLIDES ({slides.length})</span>
                </div>
                <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
                  {slides.map((s, idx) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSlideIdx(idx);
                        setSelectedElId(null);
                      }}
                      className={`cursor-pointer rounded-lg border p-2.5 transition ${
                        idx === selectedSlideIdx
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold text-orange-400">
                          #{idx + 1} • {s.slideType}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSlide(idx, -1);
                            }}
                            className="p-0.5 text-neutral-400 hover:text-white"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSlide(idx, 1);
                            }}
                            className="p-0.5 text-neutral-400 hover:text-white"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateSlide(idx);
                            }}
                            className="p-0.5 text-neutral-400 hover:text-white"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSlide(idx);
                            }}
                            className="p-0.5 text-neutral-400 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 truncate text-xs font-medium text-white">
                        {s.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 16:9 Interactive Canvas */}
              <div className="space-y-3 lg:col-span-6">
                {selectedSlide ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => addElementToSlide("TEXT")}
                          className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2.5 py-1 text-xs text-white hover:bg-neutral-700"
                        >
                          <Type className="h-3.5 w-3.5 text-orange-400" />
                          + Text
                        </button>
                        <button
                          onClick={() => addElementToSlide("SHAPE")}
                          className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2.5 py-1 text-xs text-white hover:bg-neutral-700"
                        >
                          <Square className="h-3.5 w-3.5 text-orange-400" />
                          + Shape
                        </button>
                        <button
                          onClick={() => addElementToSlide("IMAGE")}
                          className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2.5 py-1 text-xs text-white hover:bg-neutral-700"
                        >
                          <ImageIcon className="h-3.5 w-3.5 text-orange-400" />
                          + Image
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <span>BG:</span>
                        <input
                          type="color"
                          value={selectedSlide.backgroundColor}
                          onChange={(e) =>
                            setSlides((prev) =>
                              prev.map((s, idx) =>
                                idx === selectedSlideIdx
                                  ? { ...s, backgroundColor: e.target.value }
                                  : s
                              )
                            )
                          }
                          className="h-6 w-8 cursor-pointer rounded border border-neutral-700 bg-transparent"
                        />
                      </div>
                    </div>

                    {/* 16:9 Scaled Stage (10 x 5.625 inches) */}
                    <div
                      className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-700 shadow-2xl"
                      style={{ backgroundColor: selectedSlide.backgroundColor }}
                      onClick={() => setSelectedElId(null)}
                    >
                      {[...selectedSlide.elements]
                        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
                        .map((el) => {
                          const isSelected = el.id === selectedElId;
                          const leftPct = `${(el.x / 10) * 100}%`;
                          const topPct = `${(el.y / 5.625) * 100}%`;
                          const widthPct = `${(el.w / 10) * 100}%`;
                          const heightPct = `${(el.h / 5.625) * 100}%`;

                          return (
                            <div
                              key={el.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedElId(el.id);
                              }}
                              style={{
                                position: "absolute",
                                left: leftPct,
                                top: topPct,
                                width: widthPct,
                                height: heightPct,
                                zIndex: el.zIndex,
                                backgroundColor: el.fillColor || "transparent",
                                border: el.borderColor
                                  ? `${el.borderWidth ?? 1}px solid ${el.borderColor}`
                                  : undefined,
                                color: el.color || "#FFFFFF",
                                fontSize: `${Math.max(8, (el.fontSize || 14) * 0.56)}px`,
                                fontWeight: el.bold ? 700 : 400,
                                fontStyle: el.italic ? "italic" : "normal",
                                textAlign: el.align || "left",
                              }}
                              className={`cursor-pointer overflow-hidden whitespace-pre-wrap p-1.5 transition ${
                                isSelected
                                  ? "ring-2 ring-orange-400 ring-offset-1 ring-offset-black"
                                  : "hover:ring-1 hover:ring-white/30"
                              }`}
                            >
                              {el.type === "LOGO" || el.type === "IMAGE" ? (
                                el.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={el.imageUrl}
                                    alt={el.type}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center border border-dashed border-neutral-600 text-[10px] text-neutral-400">
                                    Set Image URL
                                  </div>
                                )
                              ) : el.type === "SHAPE" ? null : (
                                el.text
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Teacher Notes */}
                    <div>
                      <label className="mb-1 block text-xs text-neutral-400">
                        Speaker / Teacher Notes
                      </label>
                      <textarea
                        rows={2}
                        value={selectedSlide.teacherNotes || ""}
                        onChange={(e) =>
                          setSlides((prev) =>
                            prev.map((s, idx) =>
                              idx === selectedSlideIdx
                                ? { ...s, teacherNotes: e.target.value }
                                : s
                            )
                          )
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-neutral-700 text-sm text-neutral-400">
                    No slides yet. Generate slides from your outline or insert a Question Slide.
                  </div>
                )}
              </div>

              {/* Element Inspector */}
              <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3.5 lg:col-span-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Object Inspector
                </h4>
                {selectedElement ? (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-[11px] text-orange-400">
                        {selectedElement.type}
                      </span>
                      <button
                        onClick={deleteSelectedElement}
                        className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>

                    {selectedElement.type !== "SHAPE" &&
                      selectedElement.type !== "IMAGE" &&
                      selectedElement.type !== "LOGO" && (
                        <div>
                          <label className="mb-1 block text-neutral-400">Text</label>
                          <textarea
                            rows={4}
                            value={selectedElement.text || ""}
                            onChange={(e) =>
                              updateSelectedElement({ text: e.target.value })
                            }
                            className="w-full rounded border border-neutral-700 bg-neutral-950 p-2 text-xs text-white"
                          />
                        </div>
                      )}

                    {(selectedElement.type === "IMAGE" ||
                      selectedElement.type === "LOGO") && (
                      <div>
                        <label className="mb-1 block text-neutral-400">Image URL</label>
                        <input
                          value={selectedElement.imageUrl || ""}
                          onChange={(e) =>
                            updateSelectedElement({ imageUrl: e.target.value })
                          }
                          placeholder="/atomic-logo.png or https://..."
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-neutral-400">X (in)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedElement.x}
                          onChange={(e) =>
                            updateSelectedElement({ x: Number(e.target.value) })
                          }
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-neutral-400">Y (in)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedElement.y}
                          onChange={(e) =>
                            updateSelectedElement({ y: Number(e.target.value) })
                          }
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-neutral-400">W (in)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedElement.w}
                          onChange={(e) =>
                            updateSelectedElement({ w: Number(e.target.value) })
                          }
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-neutral-400">H (in)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedElement.h}
                          onChange={(e) =>
                            updateSelectedElement({ h: Number(e.target.value) })
                          }
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-neutral-400">Font Size</label>
                        <input
                          type="number"
                          value={selectedElement.fontSize || 16}
                          onChange={(e) =>
                            updateSelectedElement({
                              fontSize: Number(e.target.value),
                            })
                          }
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-neutral-400">Layer (Z)</label>
                        <input
                          type="number"
                          value={selectedElement.zIndex}
                          onChange={(e) =>
                            updateSelectedElement({ zIndex: Number(e.target.value) })
                          }
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-neutral-400">Text</label>
                        <input
                          type="color"
                          value={selectedElement.color || "#FFFFFF"}
                          onChange={(e) =>
                            updateSelectedElement({ color: e.target.value })
                          }
                          className="h-7 w-full cursor-pointer rounded border border-neutral-700 bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-neutral-400">Fill</label>
                        <input
                          type="color"
                          value={selectedElement.fillColor || "#161616"}
                          onChange={(e) =>
                            updateSelectedElement({ fillColor: e.target.value })
                          }
                          className="h-7 w-full cursor-pointer rounded border border-neutral-700 bg-transparent"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-neutral-400">Border</label>
                        <input
                          type="color"
                          value={selectedElement.borderColor || "#2E2E2E"}
                          onChange={(e) =>
                            updateSelectedElement({
                              borderColor: e.target.value,
                              borderWidth: selectedElement.borderWidth || 1,
                            })
                          }
                          className="h-7 w-full cursor-pointer rounded border border-neutral-700 bg-transparent"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateSelectedElement({ bold: !selectedElement.bold })
                        }
                        className={`rounded border px-2.5 py-1 font-bold ${
                          selectedElement.bold
                            ? "border-orange-500 bg-orange-500/20 text-orange-300"
                            : "border-neutral-700 text-neutral-300"
                        }`}
                      >
                        B
                      </button>
                      <select
                        value={selectedElement.align || "left"}
                        onChange={(e) =>
                          updateSelectedElement({
                            align: e.target.value as "left" | "center" | "right",
                          })
                        }
                        className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
                      >
                        <option value="left">Align Left</option>
                        <option value="center">Align Center</option>
                        <option value="right">Align Right</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Click any element on the 16:9 slide canvas to edit its text, position, size, colors, or image.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exported PPTX Files */}
      {exportedAssets.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">
            Exported Editable PowerPoint Files (.pptx)
          </h3>
          <div className="space-y-2">
            {exportedAssets.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs"
              >
                <span className="font-medium text-neutral-200">
                  {a.title || "Presentation.pptx"}
                </span>
                <a
                  href={a.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-orange-600/20 px-2.5 py-1 font-semibold text-orange-300 hover:bg-orange-600/30"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .pptx
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verbatim Question / PYQ Slide Modal */}
      {showQModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Insert Official Atomic Pathshala Question Slide
              </h3>
              <button
                onClick={() => setShowQModal(false)}
                className="text-sm text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Search Question Bank */}
            <div className="mb-6 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="text-xs font-semibold text-orange-400">
                Option A: Import Verbatim from Atomic Question Bank / PYQ DB
              </div>
              <div className="flex gap-2">
                <input
                  value={qQuery}
                  onChange={(e) => setQQuery(e.target.value)}
                  placeholder="Search by question text, chapter, or code..."
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
                />
                <button
                  onClick={() => searchQuestionBank(qQuery)}
                  disabled={searchingQ}
                  className="inline-flex items-center gap-1 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
                >
                  <Search className="h-3.5 w-3.5" />
                  Search
                </button>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {bankQuestions.map((bq) => (
                  <div
                    key={bq.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-xs"
                  >
                    <div className="space-y-1">
                      <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-300">
                        {bq.sourceLabel}
                      </span>
                      <p className="line-clamp-2 text-neutral-200">{bq.statement}</p>
                    </div>
                    <button
                      onClick={() => handleInsertQuestionSlide({ questionId: bq.id })}
                      disabled={busyAction !== null}
                      className="shrink-0 rounded bg-orange-600 px-2.5 py-1 font-semibold text-white hover:bg-orange-500"
                    >
                      Insert
                    </button>
                  </div>
                ))}
                {!searchingQ && bankQuestions.length === 0 && (
                  <p className="text-xs text-neutral-500">No matching questions found.</p>
                )}
              </div>
            </div>

            {/* Manual Verbatim Entry */}
            <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="text-xs font-semibold text-orange-400">
                Option B: Paste Exact Question Verbatim
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">
                    Exact Source Label
                  </label>
                  <select
                    value={manualSource}
                    onChange={(e) => setManualSource(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
                  >
                    <option value="NEET">NEET</option>
                    <option value="JEE Main">JEE Main</option>
                    <option value="JEE Advanced">JEE Advanced</option>
                    <option value="NCERT">NCERT</option>
                    <option value="NCERT Exemplar">NCERT Exemplar</option>
                    <option value="Board">Board</option>
                    <option value="Other source">Other source</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-400">
                    Optional Question Diagram URL
                  </label>
                  <input
                    value={manualImageUrl}
                    onChange={(e) => setManualImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
                  />
                </div>
              </div>
              <textarea
                rows={3}
                value={manualQText}
                onChange={(e) => setManualQText(e.target.value)}
                placeholder="Paste exact question statement..."
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-2.5 text-sm text-white"
              />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {manualOpts.map((opt, idx) => (
                  <input
                    key={idx}
                    value={opt}
                    onChange={(e) => {
                      const next = [...manualOpts] as [string, string, string, string];
                      next[idx] = e.target.value;
                      setManualOpts(next);
                    }}
                    placeholder={`Option (${idx + 1})`}
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
                  />
                ))}
              </div>
              <button
                onClick={() =>
                  handleInsertQuestionSlide({
                    questionText: manualQText,
                    options: manualOpts,
                    sourceLabel: manualSource,
                    imageUrl: manualImageUrl || undefined,
                  })
                }
                disabled={busyAction !== null || !manualQText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Insert Atomic Question Slide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
