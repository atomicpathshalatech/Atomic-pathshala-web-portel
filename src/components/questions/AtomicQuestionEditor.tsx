"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QuestionIdBadge } from "./QuestionIdBadge";
import { QuestionTaxonomySidebar } from "./QuestionTaxonomySidebar";
import { QuestionSimilaritySidebar } from "./QuestionSimilaritySidebar";
import { AiAssistantTools } from "./AiAssistantTools";
import { SimilarityReport, SimilarityMatch } from "@/lib/questions/similarity";
import { AiMetadataSuggestion } from "@/lib/questions/ai-service";

export interface AtomicQuestionEditorProps {
  initialSubject?: string;
  initialChapter?: string;
  initialTopic?: string;
  dppId?: string;
  dppName?: string;
  testSectionId?: string;
  testName?: string;
  onSuccess?: (createdQuestion: any) => void;
  onCancelHref?: string;
}

export function AtomicQuestionEditor({
  initialSubject = "Chemistry",
  initialChapter = "",
  initialTopic = "",
  dppId,
  dppName,
  testSectionId,
  testName,
  onSuccess,
  onCancelHref = "/team/questions",
}: AtomicQuestionEditorProps) {
  const router = useRouter();

  // Reference Images (Permanent Source Verification)
  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(null);
  const [questionImageFile, setQuestionImageFile] = useState<File | null>(null);
  const [solutionImagePreview, setSolutionImagePreview] = useState<string | null>(null);
  const [solutionImageFile, setSolutionImageFile] = useState<File | null>(null);
  const [showSplitReference, setShowSplitReference] = useState(true);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Content states
  const [activeLangTab, setActiveLangTab] = useState<"ENGLISH" | "HINDI" | "BOTH">("BOTH");
  const [statementEn, setStatementEn] = useState("");
  const [statementHi, setStatementHi] = useState("");
  const [isAiTranslatedHi, setIsAiTranslatedHi] = useState(false);
  const [isAiTranslatedEn, setIsAiTranslatedEn] = useState(false);

  const [optionAEn, setOptionAEn] = useState("");
  const [optionBEn, setOptionBEn] = useState("");
  const [optionCEn, setOptionCEn] = useState("");
  const [optionDEn, setOptionDEn] = useState("");

  const [optionAHi, setOptionAHi] = useState("");
  const [optionBHi, setOptionBHi] = useState("");
  const [optionCHi, setOptionCHi] = useState("");
  const [optionDHi, setOptionDHi] = useState("");

  const [correctOption, setCorrectOption] = useState<string>("A");
  const [solutionEn, setSolutionEn] = useState("");
  const [solutionHi, setSolutionHi] = useState("");

  // Figure / Diagram attachment (For Student UI)
  const [figureUrl, setFigureUrl] = useState("");
  const [figureCaption, setFigureCaption] = useState("");

  // Taxonomy states
  const [subject, setSubject] = useState(initialSubject);
  const [chapter, setChapter] = useState(initialChapter);
  const [topic, setTopic] = useState(initialTopic);
  const [subTopic, setSubTopic] = useState("");
  const [type, setType] = useState("SINGLE_CORRECT");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [category, setCategory] = useState("NCERT Canonical");
  const [pyqSource, setPyqSource] = useState("");
  const [tags, setTags] = useState<string[]>(["NEET 2026", "NCERT Line-by-Line"]);

  // Similarity states
  const [similarityReport, setSimilarityReport] = useState<SimilarityReport | null>(null);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);

  // Status & submission states
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const questionInputRef = useRef<HTMLInputElement>(null);
  const solutionInputRef = useRef<HTMLInputElement>(null);

  // Global Clipboard Paste (Ctrl+V) handler for Images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              if (!questionImagePreview) {
                setQuestionImagePreview(base64);
                setQuestionImageFile(file);
                toast.success("Question Image pasted from clipboard! Running AI OCR...");
                triggerOcrExtraction(base64, file.type);
              } else if (!solutionImagePreview) {
                setSolutionImagePreview(base64);
                setSolutionImageFile(file);
                toast.success("Solution Image pasted from clipboard!");
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [questionImagePreview, solutionImagePreview]);

  // Auto trigger debounced similarity check when statement changes
  useEffect(() => {
    if (!statementEn.trim() && !statementHi.trim()) return;

    const timer = setTimeout(() => {
      runSimilarityCheck();
    }, 1200);

    return () => clearTimeout(timer);
  }, [statementEn, statementHi, subject, chapter]);

  const runSimilarityCheck = async () => {
    if (!statementEn.trim() && !statementHi.trim()) return;
    setCheckingSimilarity(true);
    try {
      const res = await fetch("/api/team/questions/similarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementEn,
          statementHi,
          subject,
          chapter,
          threshold: 0.75,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSimilarityReport(json.data.report);
      }
    } catch (err) {
      console.error("Similarity check failed:", err);
    } finally {
      setCheckingSimilarity(false);
    }
  };

  // Run Unified Gemini Multimodal OCR
  const triggerOcrExtraction = async (base64Img: string, mime: string) => {
    setOcrLoading(true);
    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ocr_image",
          payload: {
            imageBase64: base64Img,
            mimeType: mime || "image/png",
            solutionImageBase64: solutionImagePreview || undefined,
            solutionMimeType: solutionImageFile?.type || "image/png",
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.result) {
        handleApplyExtraction(json.data.result);
        toast.success("Bilingual Question & Formulas extracted with high accuracy!");
      } else {
        toast.error(json.error || "Could not extract question from image.");
      }
    } catch {
      toast.error("Failed to connect to Gemini AI OCR engine.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleQuestionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQuestionImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setQuestionImagePreview(base64);
      triggerOcrExtraction(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleSolutionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSolutionImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setSolutionImagePreview(reader.result as string);
      toast.success("Solution reference image attached!");
    };
    reader.readAsDataURL(file);
  };

  // AI Assistant Callbacks
  const handleApplyExtraction = (extracted: any) => {
    if (extracted.statementEn) setStatementEn(extracted.statementEn);
    if (extracted.statementHi) setStatementHi(extracted.statementHi);

    if (extracted.optionsEn) {
      if (extracted.optionsEn.A) setOptionAEn(extracted.optionsEn.A);
      if (extracted.optionsEn.B) setOptionBEn(extracted.optionsEn.B);
      if (extracted.optionsEn.C) setOptionCEn(extracted.optionsEn.C);
      if (extracted.optionsEn.D) setOptionDEn(extracted.optionsEn.D);
    }

    if (extracted.optionsHi) {
      if (extracted.optionsHi.A) setOptionAHi(extracted.optionsHi.A);
      if (extracted.optionsHi.B) setOptionBHi(extracted.optionsHi.B);
      if (extracted.optionsHi.C) setOptionCHi(extracted.optionsHi.C);
      if (extracted.optionsHi.D) setOptionDHi(extracted.optionsHi.D);
    }

    if (extracted.correctAnswer && extracted.correctAnswer[0]) {
      setCorrectOption(extracted.correctAnswer[0].toUpperCase());
    }

    if (extracted.solutionEn) setSolutionEn(extracted.solutionEn);
    if (extracted.solutionHi) setSolutionHi(extracted.solutionHi);

    if (extracted.subject) setSubject(extracted.subject);
    if (extracted.chapter) setChapter(extracted.chapter);
    if (extracted.topic) setTopic(extracted.topic);
    if (extracted.difficulty) setDifficulty(extracted.difficulty);
    if (extracted.hasFigure) setFigureCaption(extracted.figureCaption || "Figure 1.1");
  };

  // 1-Click Translation Action
  const handleQuickTranslate = async (targetLang: "HINDI" | "ENGLISH") => {
    const sourceText = targetLang === "HINDI" ? statementEn : statementHi;
    if (!sourceText.trim()) {
      toast.error(`Please enter ${targetLang === "HINDI" ? "English" : "Hindi"} text first.`);
      return;
    }

    const toastId = toast.loading(`Translating to ${targetLang === "HINDI" ? "Hindi (Devanagari)" : "English"} via Gemini NCERT engine...`);
    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate",
          payload: { text: sourceText, targetLang, subject },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.translated) {
        if (targetLang === "HINDI") {
          setStatementHi(json.data.translated);
          setIsAiTranslatedHi(true);
        } else {
          setStatementEn(json.data.translated);
          setIsAiTranslatedEn(true);
        }
        toast.success(`Translated to ${targetLang} with formulas preserved!`, { id: toastId });
      } else {
        toast.error("Translation failed. Please try again.", { id: toastId });
      }
    } catch {
      toast.error("Network error during translation.", { id: toastId });
    }
  };

  const handleApplySolution = (solution: any) => {
    if (typeof solution === "string") {
      setSolutionEn(solution);
    } else if (solution) {
      if (solution.solutionEn) setSolutionEn(solution.solutionEn);
      if (solution.solutionHi) setSolutionHi(solution.solutionHi);
    }
  };

  const handleApplyMetadata = (metadata: AiMetadataSuggestion) => {
    if (metadata.subject) setSubject(metadata.subject);
    if (metadata.chapter) setChapter(metadata.chapter);
    if (metadata.topic) setTopic(metadata.topic);
    if (metadata.difficulty) setDifficulty(metadata.difficulty);
    if (metadata.tags && metadata.tags.length > 0) {
      setTags(Array.from(new Set([...tags, ...metadata.tags])));
    }
  };

  const handleSubmit = async (publishImmediate = false) => {
    setSaveError("");

    const activeStatement = statementEn || statementHi;
    if (!activeStatement.trim()) {
      setSaveError("Please enter question statement in English or Hindi.");
      return;
    }

    if (!chapter.trim()) {
      setSaveError("Chapter name is required in taxonomy metadata.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        subject,
        chapter,
        topic: topic.trim() || undefined,
        subTopic: subTopic.trim() || undefined,
        type,
        difficulty,
        category,
        pyqSource: pyqSource.trim() || undefined,
        statementEn: statementEn.trim() || undefined,
        statementHi: statementHi.trim() || undefined,
        optionsEn: {
          A: optionAEn.trim() || undefined,
          B: optionBEn.trim() || undefined,
          C: optionCEn.trim() || undefined,
          D: optionDEn.trim() || undefined,
        },
        optionsHi: {
          A: optionAHi.trim() || undefined,
          B: optionBHi.trim() || undefined,
          C: optionCHi.trim() || undefined,
          D: optionDHi.trim() || undefined,
        },
        correctAnswer: [correctOption],
        solutionEn: solutionEn.trim() || undefined,
        solutionHi: solutionHi.trim() || undefined,
        figureUrl: figureUrl.trim() || undefined,
        figureCaption: figureCaption.trim() || undefined,
        referenceImageUrl: questionImagePreview || undefined,
        solutionImageUrl: solutionImagePreview || undefined,
        tags,
        isPublished: false,
        status: "REVIEW_1",
        workflowStatus: "REVIEW_1",
        dppId,
        testSectionId,
      };

      const res = await fetch("/api/team/questions/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save question.");
      }

      setGeneratedCode(json.data.question.questionCode);
      toast.success("Question saved and submitted to Review System for approval.");

      if (onSuccess) {
        onSuccess(json.data.question);
      } else if (dppId) {
        router.push(`/team/dpp/${dppId}`);
        router.refresh();
      } else {
        router.push("/team/questions");
        router.refresh();
      }
    } catch (err: any) {
      setSaveError(err.message || "Network error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Question ID Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-mono">
              AI MULTIMODAL INGESTION
            </span>
            {dppName && (
              <span className="text-xs px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-semibold">
                Target: {dppName}
              </span>
            )}
            {testName && (
              <span className="text-xs px-3 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                Target: {testName}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1.5">
            Unified Image to Question Studio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Paste/upload question or textbook screenshot (Ctrl+V). AI extracts bilingual text, formulas &amp; options with side-by-side verification.
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <QuestionIdBadge questionCode={generatedCode} subjectName={subject} isSaving={saving} />
        </div>
      </div>

      {/* 2. Unified Image Dropzone & Permanent Reference Dock (Top) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">document_scanner</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Image Source &amp; Reference Verification
              </h3>
              <p className="text-[11px] text-slate-500">
                Paste directly (<kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-[10px] font-mono">Ctrl+V</kbd>) or upload. Original image is preserved permanently.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {questionImagePreview && (
              <button
                type="button"
                onClick={() => setShowSplitReference(!showSplitReference)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">
                  {showSplitReference ? "visibility_off" : "visibility"}
                </span>
                <span>{showSplitReference ? "Hide Reference View" : "Show Side Reference"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropzone Boxes: Question Image (Primary) + Solution Image (Secondary) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Question Image Dropzone */}
          <div
            onClick={() => questionInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition relative group ${
              questionImagePreview
                ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/20"
                : "border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50 dark:bg-slate-800/40"
            }`}
          >
            <input
              ref={questionInputRef}
              type="file"
              accept="image/*"
              onChange={handleQuestionFileSelect}
              className="hidden"
            />

            {questionImagePreview ? (
              <div className="space-y-3">
                <div className="relative max-h-48 mx-auto overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                  <img
                    src={questionImagePreview}
                    alt="Question Reference"
                    className="max-h-48 w-full object-contain"
                  />
                  {ocrLoading && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                      <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        Extracting Question, Formulas &amp; Options...
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Question Reference Stored
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (questionImageFile && questionImagePreview) {
                          triggerOcrExtraction(questionImagePreview, questionImageFile.type);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-sm transition"
                    >
                      Re-Extract OCR
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuestionImagePreview(null);
                        setQuestionImageFile(null);
                      }}
                      className="px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 text-[11px] font-bold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 py-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                  Drop Question Image or Click to Browse
                </h4>
                <p className="text-[11px] text-slate-500">
                  Supports bilingual English/Hindi, chemical formulas, and circuit diagrams.
                </p>
              </div>
            )}
          </div>

          {/* Solution Image Dropzone */}
          <div
            onClick={() => solutionInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition relative group ${
              solutionImagePreview
                ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20"
                : "border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/40"
            }`}
          >
            <input
              ref={solutionInputRef}
              type="file"
              accept="image/*"
              onChange={handleSolutionFileSelect}
              className="hidden"
            />

            {solutionImagePreview ? (
              <div className="space-y-3">
                <div className="max-h-48 mx-auto overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                  <img
                    src={solutionImagePreview}
                    alt="Solution Reference"
                    className="max-h-48 w-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Solution Reference Attached
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSolutionImagePreview(null);
                      setSolutionImageFile(null);
                    }}
                    className="px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 text-[11px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 py-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-xl">description</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                  Attach Solution / Answer Key Image (Optional)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Step-by-step solution reference will be stored beside the question.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Grid with Split Screen Support */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* If Split Reference is active and Question Image exists, show left comparison dock */}
        {showSplitReference && questionImagePreview && (
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-blue-200 dark:border-blue-900/60 shadow-sm sticky top-6 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                  <span className="material-symbols-outlined text-base">image</span>
                  Source Reference
                </span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                  Side-by-Side Verification
                </span>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 max-h-[75vh] overflow-y-auto p-2">
                <img
                  src={questionImagePreview}
                  alt="Original Source Reference"
                  className="w-full object-contain rounded-xl"
                />
              </div>

              {solutionImagePreview && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 uppercase font-mono">
                    <span className="material-symbols-outlined text-base">description</span>
                    Solution Reference
                  </span>
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 p-2">
                    <img
                      src={solutionImagePreview}
                      alt="Solution Source Reference"
                      className="w-full object-contain rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CENTER / MAIN COLUMN: Editable Bilingual Content Canvas */}
        <div
          className={`${
            showSplitReference && questionImagePreview ? "lg:col-span-8" : "lg:col-span-8"
          } space-y-6`}
        >
          {/* AI Tools Co-Pilot Bar */}
          <AiAssistantTools
            statementEn={statementEn}
            statementHi={statementHi}
            optionsEn={{ A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn }}
            optionsHi={{ A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi }}
            correctAnswer={[correctOption]}
            onApplyExtraction={handleApplyExtraction}
            onApplyTranslation={(txt, lang) => {
              if (lang === "HINDI") setStatementHi(txt);
              else setStatementEn(txt);
            }}
            onApplySolution={handleApplySolution}
            onApplyMetadata={handleApplyMetadata}
          />

          {/* Question Editor Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            {/* Bilingual Language Switcher */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Language View:
                </span>
                <button
                  type="button"
                  onClick={() => setActiveLangTab("BOTH")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeLangTab === "BOTH"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Bilingual (English + Hindi)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab("ENGLISH")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeLangTab === "ENGLISH"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  English Only
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab("HINDI")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeLangTab === "HINDI"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Hindi Only
                </button>
              </div>

              {/* 1-Click Translation Buttons */}
              <div className="flex items-center gap-2">
                {statementEn && !statementHi && (
                  <button
                    type="button"
                    onClick={() => handleQuickTranslate("HINDI")}
                    className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-xs">translate</span>
                    <span>Translate to Hindi (Devanagari)</span>
                  </button>
                )}
                {statementHi && !statementEn && (
                  <button
                    type="button"
                    onClick={() => handleQuickTranslate("ENGLISH")}
                    className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-xs">translate</span>
                    <span>Translate to English</span>
                  </button>
                )}
              </div>
            </div>

            {/* A. QUESTION STATEMENTS */}
            <div className="space-y-4">
              {(activeLangTab === "BOTH" || activeLangTab === "ENGLISH") && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <span>Question Statement (English) *</span>
                      {isAiTranslatedEn && (
                        <span className="px-2 py-0.2 rounded-full bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-mono font-bold">
                          AI Translated
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">LaTeX / Math supported</span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Which of the following statements is correct regarding the Bohr model of hydrogen atom?"
                    value={statementEn}
                    onChange={(e) => setStatementEn(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-sm text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none font-sans leading-relaxed shadow-sm transition placeholder-slate-400"
                  />
                </div>
              )}

              {(activeLangTab === "BOTH" || activeLangTab === "HINDI") && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <span>Question Statement (Hindi - हिंदी)</span>
                      {isAiTranslatedHi && (
                        <span className="px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-mono font-bold">
                          AI Translated (NCERT Aligned)
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Devanagari supported</span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="e.g. हाइड्रोजन परमाणु के बोहर मॉडल के संबंध में निम्नलिखित में से कौन सा कथन सही है?"
                    value={statementHi}
                    onChange={(e) => setStatementHi(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-sm text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none font-sans leading-relaxed shadow-sm transition placeholder-slate-400"
                  />
                </div>
              )}
            </div>

            {/* B. FIGURE / DIAGRAM ATTACHMENT */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-blue-600">image</span>
                  Figure / Diagram for Student UI (Optional)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Figure Image URL (e.g. https://.../circuit.png)"
                  value={figureUrl}
                  onChange={(e) => setFigureUrl(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 placeholder-slate-400"
                />
                <input
                  type="text"
                  placeholder="Figure Caption (e.g. Fig 1.1 — Wheatstone Bridge Circuit)"
                  value={figureCaption}
                  onChange={(e) => setFigureCaption(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 placeholder-slate-400"
                />
              </div>

              {figureUrl && (
                <div className="w-32 h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                  <img src={figureUrl} alt="Question figure" className="max-w-full max-h-full object-contain" />
                </div>
              )}
            </div>

            {/* C. OPTIONS (A, B, C, D) & CORRECT ANSWER */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Options &amp; Correct Answer
                </h4>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Correct Answer: Option ({correctOption})
                </span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: "A",
                    valEn: optionAEn,
                    setValEn: setOptionAEn,
                    valHi: optionAHi,
                    setValHi: setOptionAHi,
                  },
                  {
                    key: "B",
                    valEn: optionBEn,
                    setValEn: setOptionBEn,
                    valHi: optionBHi,
                    setValHi: setOptionBHi,
                  },
                  {
                    key: "C",
                    valEn: optionCEn,
                    setValEn: setOptionCEn,
                    valHi: optionCHi,
                    setValHi: setOptionCHi,
                  },
                  {
                    key: "D",
                    valEn: optionDEn,
                    setValEn: setOptionDEn,
                    valHi: optionDHi,
                    setValHi: setOptionDHi,
                  },
                ].map((opt) => {
                  const isSelected = correctOption === opt.key;
                  return (
                    <div
                      key={opt.key}
                      className={`p-4 rounded-2xl border transition ${
                        isSelected
                          ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 shadow-sm"
                          : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="correctOptionRadio"
                            checked={isSelected}
                            onChange={() => setCorrectOption(opt.key)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                              isSelected
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {opt.key}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Option ({opt.key}) {isSelected && <span className="text-emerald-600 dark:text-emerald-400">— Correct Answer</span>}
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(activeLangTab === "BOTH" || activeLangTab === "ENGLISH") && (
                          <input
                            type="text"
                            placeholder={`Option (${opt.key}) English text`}
                            value={opt.valEn}
                            onChange={(e) => opt.setValEn(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-none transition placeholder-slate-400"
                          />
                        )}
                        {(activeLangTab === "BOTH" || activeLangTab === "HINDI") && (
                          <input
                            type="text"
                            placeholder={`विकल्प (${opt.key}) हिंदी पाठ`}
                            value={opt.valHi}
                            onChange={(e) => opt.setValHi(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-none transition placeholder-slate-400"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* D. STEP-BY-STEP SOLUTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Step-by-Step Solution &amp; Concepts
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(activeLangTab === "BOTH" || activeLangTab === "ENGLISH") && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Solution (English)
                    </label>
                    <textarea
                      rows={4}
                      placeholder={"Step 1: Formula used...\nStep 2: Calculation...\nHence, Option (A) is correct."}
                      value={solutionEn}
                      onChange={(e) => setSolutionEn(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none leading-relaxed font-mono transition placeholder-slate-400"
                    />
                  </div>
                )}

                {(activeLangTab === "BOTH" || activeLangTab === "HINDI") && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Solution (Hindi - हिंदी)
                    </label>
                    <textarea
                      rows={4}
                      placeholder={"चरण 1: प्रयुक्त सूत्र...\nचरण 2: गणना...\nअतः, विकल्प (A) सही है।"}
                      value={solutionHi}
                      onChange={(e) => setSolutionHi(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none leading-relaxed font-mono transition placeholder-slate-400"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Save Error */}
            {saveError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base text-red-600">error</span>
                <span>{saveError}</span>
              </div>
            )}

            {/* Save Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => router.push(onCancelHref)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-500/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">save</span>
                  <span>{saving ? "Saving..." : "Save"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Curriculum Taxonomy & Similarity Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <QuestionTaxonomySidebar
            subject={subject}
            setSubject={setSubject}
            chapter={chapter}
            setChapter={setChapter}
            topic={topic}
            setTopic={setTopic}
            subTopic={subTopic}
            setSubTopic={setSubTopic}
            type={type}
            setType={setType}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            category={category}
            setCategory={setCategory}
            pyqSource={pyqSource}
            setPyqSource={setPyqSource}
            tags={tags}
            setTags={setTags}
          />

          <QuestionSimilaritySidebar
            report={similarityReport}
            checking={checkingSimilarity}
            onCheckSimilarity={runSimilarityCheck}
            newQuestionData={{
              statementEn,
              statementHi,
              optionsEn: { A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn },
              optionsHi: { A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi },
              correctAnswer: [correctOption],
              subject,
              chapter,
              topic,
            }}
            onUseExisting={(match) => {
              setGeneratedCode(match.questionCode);
              setStatementEn(match.statementEn || "");
              setStatementHi(match.statementHi || "");
              if (match.optionsEn) {
                setOptionAEn(match.optionsEn.A || "");
                setOptionBEn(match.optionsEn.B || "");
                setOptionCEn(match.optionsEn.C || "");
                setOptionDEn(match.optionsEn.D || "");
              }
              if (match.correctAnswer?.[0]) setCorrectOption(match.correctAnswer[0]);
              if (match.solutionEn) setSolutionEn(match.solutionEn);
            }}
          />
        </div>
      </div>
    </div>
  );
}