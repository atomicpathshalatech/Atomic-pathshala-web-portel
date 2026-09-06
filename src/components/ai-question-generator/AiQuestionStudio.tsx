"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  FileText,
  Sliders,
  History,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Save,
  Send,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  Square,
  ArrowRight,
  BookOpen,
  HelpCircle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  GenerationLanguage,
  GenerationPlan,
  NeetDifficulty,
} from "@/lib/ai-question-engine/types";
import { PdfUploadStep } from "./PdfUploadStep";
import { TaxonomyConfigStep } from "./TaxonomyConfigStep";
import { GenerationProgressModal } from "./GenerationProgressModal";
import { GeneratedQuestionCard, GeneratedQuestionItem } from "./GeneratedQuestionCard";
import { GenerationHistoryView } from "./GenerationHistoryView";

type ActiveTab = "PDF" | "AI";
type ViewMode = "STUDIO" | "HISTORY";

export function AiQuestionStudio() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("AI");
  const [viewMode, setViewMode] = useState<ViewMode>("STUDIO");

  // Taxonomy Lists
  const [subjectsList, setSubjectsList] = useState<Array<{ id: string; name: string }>>([]);
  const [chaptersList, setChaptersList] = useState<Array<{ id: string; title: string }>>([]);
  const [topicsList, setTopicsList] = useState<
    Array<{ id: string; title: string; subtopics: string[]; isCustom?: boolean }>
  >([]);

  // Selected Taxonomy
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);

  // Generation Config
  const [difficulties, setDifficulties] = useState<NeetDifficulty[]>(["MEDIUM"]);
  const [questionTypes, setQuestionTypes] = useState<string[]>(["SINGLE_CORRECT"]);
  const [language, setLanguage] = useState<GenerationLanguage>("BOTH");
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [generationPlan, setGenerationPlan] = useState<GenerationPlan>({
    totalQuestions: 10,
    items: [{ questionTypeId: "SINGLE_CORRECT", typeName: "Single Correct (MCQ)", count: 10 }],
    difficultyMix: { EASY: 0, MEDIUM: 10, HARD: 0, ULTRA: 0 },
    language: "BOTH",
  });

  // PDF Mode State
  const [pdfResult, setPdfResult] = useState<{
    sourcePdfId: string;
    fileName: string;
    pageCount: number;
    detectedTopics: string[];
    imagesCount: number;
  } | null>(null);

  // Job Execution & Polling State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [batchCode, setBatchCode] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [modalStats, setModalStats] = useState({
    generatedCount: 0,
    totalRequested: 10,
    passedCount: 0,
    needsReviewCount: 0,
    failedCount: 0,
  });

  // Generated Questions Deck
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestionItem[]>([]);
  const [activeBatchInfo, setActiveBatchInfo] = useState<any | null>(null);

  // Deck Filters & Selection
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // 1. Initial Load: Fetch Subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch("/api/team/ai-questions/taxonomy");
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.subjects)) {
          setSubjectsList(json.data.subjects);
          if (json.data.subjects.length > 0 && !subject) {
            setSubject(json.data.subjects[0].name);
          }
        }
      } catch {
        toast.error("Failed to load academic subjects.");
      }
    };
    fetchSubjects();
  }, []);

  // 2. Fetch Chapters when Subject changes
  useEffect(() => {
    if (!subject) {
      setChaptersList([]);
      setChapter("");
      return;
    }

    const fetchChapters = async () => {
      try {
        const res = await fetch(`/api/team/ai-questions/taxonomy?subject=${encodeURIComponent(subject)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.chapters)) {
          setChaptersList(json.data.chapters);
          if (json.data.chapters.length > 0) {
            setChapter(json.data.chapters[0].title);
          } else {
            setChapter("");
          }
        }
      } catch {
        toast.error("Failed to load chapters for selected subject.");
      }
    };

    fetchChapters();
    setSelectedTopics([]);
    setSelectedSubtopics([]);
  }, [subject]);

  // 3. Fetch Topics when Chapter changes
  useEffect(() => {
    if (!subject || !chapter) {
      setTopicsList([]);
      setSelectedTopics([]);
      setSelectedSubtopics([]);
      return;
    }

    const fetchTopics = async () => {
      try {
        const res = await fetch(
          `/api/team/ai-questions/taxonomy?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`
        );
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.topics)) {
          setTopicsList(json.data.topics);
          // Default select the first topic if available
          if (json.data.topics.length > 0 && selectedTopics.length === 0) {
            setSelectedTopics([json.data.topics[0].title]);
          }
        }
      } catch {
        toast.error("Failed to load topics for chapter.");
      }
    };

    fetchTopics();
  }, [subject, chapter]);

  // 4. Custom Topic Registration
  const handleCustomTopicAdded = async (newTopic: string) => {
    try {
      const res = await fetch("/api/team/ai-questions/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          chapter,
          customTopic: newTopic,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to register custom topic.");
      }

      toast.success(`Custom topic "${newTopic}" registered into memory.`);

      // Re-fetch topics to include the newly registered custom topic
      const topicRes = await fetch(
        `/api/team/ai-questions/taxonomy?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`
      );
      const topicJson = await topicRes.json();
      if (topicJson.success && Array.isArray(topicJson.data?.topics)) {
        setTopicsList(topicJson.data.topics);
        if (!selectedTopics.includes(newTopic)) {
          setSelectedTopics((prev) => [...prev, newTopic]);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to register custom topic.");
    }
  };

  // 5. Start Generation Dispatcher
  const handleStartGeneration = async () => {
    if (!subject.trim()) {
      toast.error("Please select a valid subject.");
      return;
    }
    if (!chapter.trim()) {
      toast.error("Please select a valid chapter.");
      return;
    }
    if (selectedTopics.length === 0) {
      toast.error("Please select at least one topic.");
      return;
    }
    if (activeTab === "PDF" && !pdfResult?.sourcePdfId) {
      toast.error("Please upload and process a PDF document first.");
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(5);
      setCurrentStep("Submitting generation request to engine...");

      const payload = {
        method: activeTab,
        subject,
        chapter,
        selectedTopics,
        selectedSubtopics,
        difficulties,
        questionTypes,
        language,
        totalQuestions,
        generationPlan,
        sourcePdfId: activeTab === "PDF" ? pdfResult?.sourcePdfId : undefined,
      };

      const res = await fetch("/api/team/ai-questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to initiate generation.");
      }

      const { batchId, batchCode: newBatchCode, totalRequested } = json.data;
      setCurrentBatchId(batchId);
      setBatchCode(newBatchCode);
      setModalStats({
        generatedCount: 0,
        totalRequested,
        passedCount: 0,
        needsReviewCount: 0,
        failedCount: 0,
      });

      toast.info(`Generation batch ${newBatchCode} started!`);
    } catch (err: any) {
      setIsGenerating(false);
      toast.error(err.message || "Generation initiation failed.");
    }
  };

  // 6. Polling effect when batchId is active and generating
  useEffect(() => {
    if (!currentBatchId || !isGenerating) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/team/ai-questions/jobs/${currentBatchId}`);
        const json = await res.json();
        if (!res.ok || !json.success) return;

        const { batch } = json.data;
        if (!batch) return;

        setProgress(batch.progress || 0);
        setCurrentStep(batch.currentStep || "Processing...");
        setModalStats({
          generatedCount: batch.generatedCount || 0,
          totalRequested: batch.totalRequested || totalQuestions,
          passedCount: batch.passedCount || 0,
          needsReviewCount: batch.needsReviewCount || 0,
          failedCount: batch.failedCount || 0,
        });

        if (batch.status === "COMPLETED" || batch.status === "FAILED") {
          clearInterval(interval);
          setIsGenerating(false);

          if (batch.status === "COMPLETED") {
            toast.success(`Batch ${batch.batchCode} completed successfully!`);
          } else {
            toast.warning(`Batch ${batch.batchCode} finished with warnings.`);
          }

          // Populate generated questions deck
          if (Array.isArray(batch.questions)) {
            setGeneratedQuestions(batch.questions);
            setActiveBatchInfo(batch);
            setSelectedQuestionIds([]);
          }
        }
      } catch (err) {
        console.error("Job polling error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentBatchId, isGenerating, totalQuestions]);

  // 7. Load Batch from History
  const handleSelectBatchFromHistory = async (batchId: string) => {
    try {
      const res = await fetch(`/api/team/ai-questions/jobs/${batchId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error("Failed to load batch.");
      }

      const { batch } = json.data;
      setActiveBatchInfo(batch);
      setGeneratedQuestions(batch.questions || []);
      setSelectedQuestionIds([]);
      setCurrentBatchId(batch.id);
      setBatchCode(batch.batchCode);
      setSubject(batch.subject);
      setChapter(batch.chapter);
      if (batch.method === "PDF") {
        setActiveTab("PDF");
      } else {
        setActiveTab("AI");
      }
      setViewMode("STUDIO");

      toast.success(`Loaded batch ${batch.batchCode} (${batch.questions?.length || 0} questions).`);
    } catch {
      toast.error("Failed to load batch details.");
    }
  };

  // 8. Individual Question Save to Draft
  const handleSaveToDraft = async (id: string, submitToReview = false) => {
    try {
      const res = await fetch("/api/team/ai-questions/save-to-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [id], submitToReview }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save to draft.");
      }

      setGeneratedQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, isSavedToDraft: true } : q))
      );

      toast.success(
        submitToReview
          ? "Question saved to Question Bank and submitted to Stage 1 Review!"
          : "Question successfully saved as DRAFT in Question Bank!"
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to save question to draft.");
      throw err;
    }
  };

  // 9. Bulk Save or Submit to Review
  const handleBulkSave = async (submitToReview = false) => {
    const targetIds =
      selectedQuestionIds.length > 0
        ? selectedQuestionIds
        : generatedQuestions.filter((q) => !q.isSavedToDraft).map((q) => q.id);

    if (targetIds.length === 0) {
      toast.info("No unsaved questions to process.");
      return;
    }

    setIsBulkSaving(true);
    try {
      const res = await fetch("/api/team/ai-questions/save-to-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: targetIds, submitToReview }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Bulk save operation failed.");
      }

      const savedCount = json.data?.savedCount || targetIds.length;
      setGeneratedQuestions((prev) =>
        prev.map((q) => (targetIds.includes(q.id) ? { ...q, isSavedToDraft: true } : q))
      );
      setSelectedQuestionIds([]);

      toast.success(
        submitToReview
          ? `Successfully saved ${savedCount} questions and submitted to Stage 1 Review!`
          : `Successfully saved ${savedCount} questions to Question Bank as DRAFT!`
      );
    } catch (err: any) {
      toast.error(err.message || "Bulk save failed.");
    } finally {
      setIsBulkSaving(false);
    }
  };

  // 10. Single Question Targeted Regeneration
  const handleRegenerate = async (id: string, mode: string) => {
    try {
      const res = await fetch("/api/team/ai-questions/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id, mode }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Regeneration failed.");
      }

      const updatedQuestion = json.data?.question;
      if (updatedQuestion) {
        setGeneratedQuestions((prev) =>
          prev.map((q) => (q.id === id ? updatedQuestion : q))
        );
        toast.success("Question regenerated with fresh validation checks!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate question.");
      throw err;
    }
  };

  // 11. Single Question In-place Edit Update
  const handleUpdateQuestion = async (id: string, updated: Partial<GeneratedQuestionItem>) => {
    if (!currentBatchId) return;
    try {
      const res = await fetch(`/api/team/ai-questions/jobs/${currentBatchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id, ...updated }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save edits.");
      }

      setGeneratedQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...updated } : q))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update question.");
      throw err;
    }
  };

  // Filtered Deck
  const filteredQuestions = useMemo(() => {
    return generatedQuestions.filter((q) => {
      // Status filter
      if (filterStatus === "PASSED" && q.validationStatus !== "PASSED") return false;
      if (filterStatus === "NEEDS_REVIEW" && q.validationStatus !== "NEEDS_REVIEW") return false;
      if (filterStatus === "FAILED" && q.validationStatus !== "FAILED") return false;
      if (filterStatus === "SAVED" && !q.isSavedToDraft) return false;
      if (filterStatus === "UNSAVED" && q.isSavedToDraft) return false;

      // Difficulty filter
      if (filterDifficulty !== "ALL" && q.difficulty !== filterDifficulty) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchEn = q.statementEn?.toLowerCase().includes(query);
        const matchHi = q.statementHi?.toLowerCase().includes(query);
        const matchTopic = q.topic?.toLowerCase().includes(query);
        if (!matchEn && !matchHi && !matchTopic) return false;
      }

      return true;
    });
  }, [generatedQuestions, filterStatus, filterDifficulty, searchQuery]);

  // Batch Summary Stats
  const deckStats = useMemo(() => {
    const total = generatedQuestions.length;
    const passed = generatedQuestions.filter((q) => q.validationStatus === "PASSED").length;
    const needsReview = generatedQuestions.filter((q) => q.validationStatus === "NEEDS_REVIEW").length;
    const failed = generatedQuestions.filter((q) => q.validationStatus === "FAILED").length;
    const saved = generatedQuestions.filter((q) => q.isSavedToDraft).length;
    return { total, passed, needsReview, failed, saved };
  }, [generatedQuestions]);

  const toggleSelectAll = () => {
    if (selectedQuestionIds.length === filteredQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(filteredQuestions.map((q) => q.id));
    }
  };

  const toggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Studio Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Production AI Question Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              AI Generated Questions
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Generate syllabus-aligned, source-grounded NEET questions with multi-agent adversarial
              validation, 20 question formats, KaTeX mathematics, and seamless 2-stage review integration.
            </p>
          </div>

          {/* Mode Navigation Toggle */}
          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 self-start md:self-auto">
            <button
              onClick={() => setViewMode("STUDIO")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === "STUDIO"
                  ? "bg-white text-slate-900 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Question Studio</span>
            </button>
            <button
              onClick={() => setViewMode("HISTORY")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === "HISTORY"
                  ? "bg-white text-slate-900 shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Batch History</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === "HISTORY" ? (
        <GenerationHistoryView onSelectBatch={handleSelectBatchFromHistory} />
      ) : (
        <div className="space-y-8">
          {/* Method Tabs: BY PDF vs BY AI */}
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-200/80 inline-flex gap-2">
            <button
              onClick={() => setActiveTab("AI")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-xs font-black transition-all ${
                activeTab === "AI"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>BY AI (Syllabus & Memory)</span>
            </button>

            <button
              onClick={() => setActiveTab("PDF")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-xs font-black transition-all ${
                activeTab === "PDF"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>BY PDF (Document Grounding)</span>
            </button>
          </div>

          {/* Tab 1: BY PDF Source Upload */}
          {activeTab === "PDF" && (
            <div className="animate-in fade-in-50 duration-300">
              <PdfUploadStep
                subject={subject}
                chapter={chapter}
                onSubjectChange={setSubject}
                onChapterChange={setChapter}
                subjectsList={subjectsList}
                chaptersList={chaptersList}
                onPdfProcessed={(result) => {
                  setPdfResult(result);
                  if (result.detectedTopics.length > 0) {
                    setSelectedTopics(result.detectedTopics);
                  }
                }}
                selectedTopics={selectedTopics}
                onSelectedTopicsChange={setSelectedTopics}
              />
            </div>
          )}

          {/* Tab 2: BY AI / Taxonomy & Question Type Distribution Config */}
          <div className="animate-in fade-in-50 duration-300">
            <TaxonomyConfigStep
              isPdfMode={activeTab === "PDF"}
              subject={subject}
              chapter={chapter}
              onSubjectChange={setSubject}
              onChapterChange={setChapter}
              subjectsList={subjectsList}
              chaptersList={chaptersList}
              topicsList={topicsList}
              selectedTopics={selectedTopics}
              onSelectedTopicsChange={setSelectedTopics}
              selectedSubtopics={selectedSubtopics}
              onSelectedSubtopicsChange={setSelectedSubtopics}
              difficulties={difficulties}
              onDifficultiesChange={setDifficulties}
              questionTypes={questionTypes}
              onQuestionTypesChange={setQuestionTypes}
              language={language}
              onLanguageChange={setLanguage}
              totalQuestions={totalQuestions}
              onTotalQuestionsChange={setTotalQuestions}
              generationPlan={generationPlan}
              onGenerationPlanChange={setGenerationPlan}
              onCustomTopicAdded={handleCustomTopicAdded}
            />
          </div>

          {/* Generation Launch Button */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Ready to Generate</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Targeting: <strong className="text-slate-800">{totalQuestions} questions</strong> across{" "}
                <strong className="text-slate-800">{selectedTopics.length} topics</strong> ({difficulties.join(", ")})
              </p>
            </div>

            <button
              onClick={handleStartGeneration}
              disabled={isGenerating || selectedTopics.length === 0 || (activeTab === "PDF" && !pdfResult)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-black shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Pipeline Active...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate {totalQuestions} Questions</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

          {/* Live Generation Progress Modal */}
          <GenerationProgressModal
            isOpen={isGenerating}
            batchCode={batchCode}
            progress={progress}
            currentStep={currentStep}
            generatedCount={modalStats.generatedCount}
            totalRequested={modalStats.totalRequested}
            passedCount={modalStats.passedCount}
            needsReviewCount={modalStats.needsReviewCount}
            failedCount={modalStats.failedCount}
            onClose={() => setIsGenerating(false)}
          />

          {/* Generated Deck Review Section */}
          {generatedQuestions.length > 0 && (
            <div className="space-y-6 pt-6">
              {/* Batch Info Header */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-purple-600 text-white">
                      Active Batch
                    </span>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {activeBatchInfo?.batchCode || batchCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Subject: <strong>{activeBatchInfo?.subject || subject}</strong> • Chapter:{" "}
                    <strong>{activeBatchInfo?.chapter || chapter}</strong> • Method:{" "}
                    <strong>{activeBatchInfo?.method || activeTab}</strong>
                  </p>
                </div>

                {/* Counter Pills */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700">
                    Total: {deckStats.total}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passed: {deckStats.passed}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Needs Review: {deckStats.needsReview}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1">
                    <Save className="w-3.5 h-3.5" /> Saved: {deckStats.saved}
                  </span>
                </div>
              </div>

              {/* Deck Toolbar (Filter, Search, Bulk Actions) */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Filters & Search */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">All Statuses ({deckStats.total})</option>
                        <option value="PASSED">Passed QA ({deckStats.passed})</option>
                        <option value="NEEDS_REVIEW">Needs Review ({deckStats.needsReview})</option>
                        <option value="FAILED">Failed QA ({deckStats.failed})</option>
                        <option value="SAVED">Saved to Draft ({deckStats.saved})</option>
                        <option value="UNSAVED">Unsaved Only</option>
                      </select>
                    </div>

                    {/* Difficulty Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                      <select
                        value={filterDifficulty}
                        onChange={(e) => setFilterDifficulty(e.target.value)}
                        className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">All Difficulties</option>
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                        <option value="ULTRA">Ultra</option>
                      </select>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search question or topic..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 w-48 sm:w-60"
                      />
                    </div>
                  </div>

                  {/* Right: Bulk Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
                    >
                      {selectedQuestionIds.length === filteredQuestions.length && filteredQuestions.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>
                        {selectedQuestionIds.length > 0
                          ? `Selected (${selectedQuestionIds.length})`
                          : "Select All"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleBulkSave(false)}
                      disabled={isBulkSaving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 text-purple-300" />
                      <span>
                        {selectedQuestionIds.length > 0
                          ? `Save Selected (${selectedQuestionIds.length}) to Draft`
                          : "Save All to Draft"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleBulkSave(true)}
                      disabled={isBulkSaving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit to Review (Stage 1)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Questions Cards List */}
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Filter className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">No questions match current filters</h4>
                  <p className="text-xs text-slate-500">
                    Try changing the status or difficulty filter to inspect other questions in this batch.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredQuestions.map((q) => {
                    const isSelected = selectedQuestionIds.includes(q.id);
                    return (
                      <div key={q.id} className="relative group">
                        {/* Checkbox Selector overlay on card */}
                        <div className="absolute top-4 left-4 z-20">
                          <button
                            onClick={() => toggleSelectQuestion(q.id)}
                            className="p-1 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm hover:scale-105 transition cursor-pointer"
                            title="Select question for bulk actions"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </div>

                        <div className={`transition-all ${isSelected ? "ring-2 ring-purple-600 rounded-3xl" : ""}`}>
                          <GeneratedQuestionCard
                            question={q}
                            pdfFileName={pdfResult?.fileName || activeBatchInfo?.sourcePdf?.fileName}
                            onSaveToDraft={handleSaveToDraft}
                            onRegenerate={handleRegenerate}
                            onUpdateQuestion={handleUpdateQuestion}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
