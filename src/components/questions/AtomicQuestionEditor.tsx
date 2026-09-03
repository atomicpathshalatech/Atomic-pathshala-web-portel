"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OcrExtractionProgress } from "./OcrExtractionProgress";
import { EquationLivePreview } from "./EquationLivePreview";
import { FormulaInsertToolbar } from "./FormulaInsertToolbar";
import { QuestionIdBadge } from "./QuestionIdBadge";
import { QuestionTaxonomySidebar } from "./QuestionTaxonomySidebar";
import { QuestionSimilaritySidebar } from "./QuestionSimilaritySidebar";
import { AiAssistantTools } from "./AiAssistantTools";
import { SimilarityReport, SimilarityMatch } from "@/lib/questions/similarity";
import { AiMetadataSuggestion } from "@/lib/questions/ai-service";

export interface AtomicQuestionEditorProps {
  questionId?: string;
  initialQuestion?: any;
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

function FieldImageUploadButton({
  onInsertImage,
}: {
  onInsertImage: (imgMarkdown: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onInsertImage(`\n![](${reader.result as string})\n`);
      toast.success("Image attached to field!");
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="Upload or paste image into this field (Ctrl+V supported)"
        className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95"
      >
        <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
        <span className="text-[10px] hidden sm:inline">Add Image</span>
      </button>
    </>
  );
}

export function AtomicQuestionEditor({
  questionId,
  initialQuestion,
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

  const translationEn = initialQuestion?.translations?.find((t: any) => t.language === "ENGLISH");
  const translationHi = initialQuestion?.translations?.find((t: any) => t.language === "HINDI");
  const optionsEnData = translationEn?.options || {};
  const optionsHiData = translationHi?.options || {};
  const initialCorrect = translationEn?.correctOptionIds?.[0] || translationHi?.correctOptionIds?.[0] || "A";

  // Reference Images (Permanent Source Verification)
  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(initialQuestion?.referenceImageUrl || null);
  const [questionImageFile, setQuestionImageFile] = useState<File | null>(null);
  const [solutionImagePreview, setSolutionImagePreview] = useState<string | null>(initialQuestion?.solutionImageUrl || null);
  const [solutionImageFile, setSolutionImageFile] = useState<File | null>(null);
  const [showSplitReference, setShowSplitReference] = useState(true);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([]);

  // View Modes & NTA Simulation
  const [editorViewMode, setEditorViewMode] = useState<"STUDIO" | "NTA_PREVIEW">("STUDIO");
  const [ntaViewLang, setNtaViewLang] = useState<"ENGLISH" | "HINDI">("ENGLISH");
  const [ntaSimSelectedOption, setNtaSimSelectedOption] = useState<string | null>(null);
  const [ntaShowSolution, setNtaShowSolution] = useState(false);

  // Content states
  const [activeLangTab, setActiveLangTab] = useState<"ENGLISH" | "HINDI" | "BOTH">("BOTH");
  const [statementEn, setStatementEn] = useState(translationEn?.statement || "");
  const [statementHi, setStatementHi] = useState(translationHi?.statement || "");
  const [isAiTranslatedHi, setIsAiTranslatedHi] = useState(false);
  const [isAiTranslatedEn, setIsAiTranslatedEn] = useState(false);

  const [optionAEn, setOptionAEn] = useState(optionsEnData.A || "");
  const [optionBEn, setOptionBEn] = useState(optionsEnData.B || "");
  const [optionCEn, setOptionCEn] = useState(optionsEnData.C || "");
  const [optionDEn, setOptionDEn] = useState(optionsEnData.D || "");

  const [optionAHi, setOptionAHi] = useState(optionsHiData.A || "");
  const [optionBHi, setOptionBHi] = useState(optionsHiData.B || "");
  const [optionCHi, setOptionCHi] = useState(optionsHiData.C || "");
  const [optionDHi, setOptionDHi] = useState(optionsHiData.D || "");

  const [correctOption, setCorrectOption] = useState<string>(initialCorrect);
  const [solutionEn, setSolutionEn] = useState(translationEn?.solution || "");
  const [solutionHi, setSolutionHi] = useState(translationHi?.solution || "");

  // Figure / Diagram attachment (For Student UI)
  const [figureUrl, setFigureUrl] = useState(initialQuestion?.imageUrl || "");
  const [figureCaption, setFigureCaption] = useState("");

  // Taxonomy states
  const [subject, setSubject] = useState(initialQuestion?.subject || initialSubject);
  const [chapter, setChapter] = useState(initialQuestion?.chapter || initialChapter);
  const [topic, setTopic] = useState(initialQuestion?.topic || initialTopic);
  const [subTopic, setSubTopic] = useState(initialQuestion?.subTopic || "");
  const [type, setType] = useState(initialQuestion?.type || "SINGLE_CORRECT");
  const [difficulty, setDifficulty] = useState(initialQuestion?.difficulty || "MEDIUM");
  const [category, setCategory] = useState(initialQuestion?.category || "NCERT Canonical");
  const [pyqSource, setPyqSource] = useState(initialQuestion?.pyqSource || "");
  const [tags, setTags] = useState<string[]>(
    initialQuestion?.tags
      ? Array.isArray(initialQuestion.tags)
        ? initialQuestion.tags
        : initialQuestion.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : ["NEET 2026", "NCERT Line-by-Line"]
  );

  // Similarity states
  const [similarityReport, setSimilarityReport] = useState<SimilarityReport | null>(null);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);

  // Status & submission states
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(initialQuestion?.questionCode || null);

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

  // Run In-Built Self-Hosted OCR & Formula Recognition Pipeline
  const triggerOcrExtraction = async (base64Img: string, mime: string) => {
    setOcrLoading(true);
    try {
      // Primary: In-Built Self-Hosted OCR Engine (PaddleOCR + Formula LaTeX + Chemistry)
      const res = await fetch("/api/ocr/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Img,
          mimeType: mime || "image/png",
          solutionImageBase64: solutionImagePreview || undefined,
          language: "both",
        }),
      });
      const json = await res.json();
      if (json.success && json.data.question) {
        handleApplyExtraction(json.data.question);
        if (json.data.question.lowConfidenceFields?.length > 0) {
          setLowConfidenceFields(json.data.question.lowConfidenceFields);
          toast.warning("Extracted with minor uncertainty. Marked fields for review.");
        } else {
          setLowConfidenceFields([]);
          toast.success("Question & Formulas extracted via In-Built OCR Engine!");
        }
      } else {
        // Fallback to secondary AI route if needed
        const aiRes = await fetch("/api/team/questions/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ocr_image",
            payload: {
              imageBase64: base64Img,
              mimeType: mime || "image/png",
              solutionImageBase64: solutionImagePreview || undefined,
            },
          }),
        });
        const aiJson = await aiRes.json();
        if (aiJson.success && aiJson.data.result) {
          handleApplyExtraction(aiJson.data.result);
          toast.success("Question & Formulas extracted successfully!");
        } else {
          toast.error("Could not extract question from image. Please try a clearer screenshot.");
        }
      }
    } catch {
      toast.error("Failed to connect to in-built OCR engine.");
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

  // Direct in-field image paste handler (Ctrl+V directly into Statement or Options)
  const handlePasteImageToField = (
    e: React.ClipboardEvent,
    appendValue: (imgMarkdown: string) => void
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            appendValue(`\n![](${base64})\n`);
            toast.success("Image pasted directly into question field!");
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
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

  const handleSubmit = async () => {
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

      if (questionId) {
        const res = await fetch("/api/team/questions/engine", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            ...payload,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to update question.");
        }

        toast.success("Question updated successfully!");
        if (onSuccess) {
          onSuccess(json.data.question);
        } else {
          router.push("/team/questions");
          router.refresh();
        }
        return;
      }

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
            Paste/upload question or textbook screenshot (Ctrl+V). Standardized bilingual NTA format for Question Bank, DPP and Tests.
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <QuestionIdBadge questionCode={generatedCode} subjectName={subject} isSaving={saving} />
        </div>
      </div>

      {/* 2. Top View Switcher: Authoring Studio vs NTA CBT Exam Live Preview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-3xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-inner">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditorViewMode("STUDIO")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
              editorViewMode === "STUDIO"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-base">edit_note</span>
            <span>Authoring Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setEditorViewMode("NTA_PREVIEW")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
              editorViewMode === "NTA_PREVIEW"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-base">desktop_windows</span>
            <span>NTA CBT Exam Live Preview (NEET/JEE)</span>
          </button>
        </div>

        {editorViewMode === "NTA_PREVIEW" ? (
          <div className="flex items-center gap-2 pr-2">
            <span className="text-xs font-bold text-slate-500">View In:</span>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setNtaViewLang("ENGLISH")}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  ntaViewLang === "ENGLISH"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-blue-600"
                }`}
              >
                <span>English</span>
              </button>
              <button
                type="button"
                onClick={() => setNtaViewLang("HINDI")}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  ntaViewLang === "HINDI"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-emerald-600"
                }`}
              >
                <span>हिंदी (Hindi)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 font-medium pr-3 hidden sm:block">
            Standard format: Statement &amp; Options authored bilingually
          </div>
        )}
      </div>

      {/* When in NTA CBT PREVIEW MODE, render authentic NTA screen */}
      {editorViewMode === "NTA_PREVIEW" ? (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          {/* NTA Examination Header */}
          <div className="p-4 rounded-2xl bg-[#0f2744] text-white flex flex-wrap items-center justify-between gap-4 shadow-md">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-200 block">
                NTA Computer Based Test (CBT) Simulation
              </span>
              <h3 className="text-base font-black text-white">
                {subject ? subject.toUpperCase() : "CHEMISTRY"} — SECTION A
              </h3>
            </div>

            {/* Language Switcher Popup Dropdown */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-xs font-bold">
                <span className="material-symbols-outlined text-sm text-amber-300">translate</span>
                <span>View in:</span>
                <select
                  value={ntaViewLang}
                  onChange={(e) => setNtaViewLang(e.target.value as any)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer"
                >
                  <option value="ENGLISH" className="text-slate-900">English</option>
                  <option value="HINDI" className="text-slate-900">हिंदी (Hindi)</option>
                </select>
              </div>

              <div className="text-xs font-mono bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                <span className="text-emerald-300 font-bold">+4.00</span> / <span className="text-red-300 font-bold">-1.00</span>
              </div>
            </div>
          </div>

          {/* Question Body */}
          <div className="space-y-4 p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-2 border-b border-slate-200 dark:border-slate-700">
              <span>Question No. 1 ({type})</span>
              <span className="text-blue-600 dark:text-blue-400">
                {ntaViewLang === "ENGLISH" ? "Language: English" : "भाषा: हिंदी"}
              </span>
            </div>

            {/* Statement */}
            <div className="space-y-3">
              <p className="text-base font-bold text-slate-900 dark:text-white leading-relaxed">
                {ntaViewLang === "ENGLISH"
                  ? statementEn || "No English statement provided yet."
                  : statementHi || "कोई हिंदी प्रश्न कथन दर्ज नहीं किया गया है।"}
              </p>
              <EquationLivePreview
                content={ntaViewLang === "ENGLISH" ? statementEn : statementHi}
                label="KaTeX Formatted Question"
              />
            </div>

            {/* Options */}
            <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-slate-700/80">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Choose the correct option:
              </span>

              {[
                { key: "A", val: ntaViewLang === "ENGLISH" ? optionAEn : optionAHi },
                { key: "B", val: ntaViewLang === "ENGLISH" ? optionBEn : optionBHi },
                { key: "C", val: ntaViewLang === "ENGLISH" ? optionCEn : optionCHi },
                { key: "D", val: ntaViewLang === "ENGLISH" ? optionDEn : optionDHi },
              ].map((opt) => {
                const isSelected = ntaSimSelectedOption === opt.key;
                const isCorrect = correctOption === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setNtaSimSelectedOption(opt.key)}
                    className={`w-full p-4 rounded-2xl border text-left transition flex items-center gap-3.5 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {opt.key}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white block">
                        {opt.val || `Option (${opt.key}) content`}
                      </span>
                      {opt.val && (
                        <EquationLivePreview
                          content={opt.val}
                          label=""
                          className="p-1 mt-1 bg-transparent border-none"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* CBT Action Buttons Simulator */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNtaSimSelectedOption(null)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  Clear Response
                </button>
                <button
                  type="button"
                  onClick={() => setNtaShowSolution(!ntaShowSolution)}
                  className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">help</span>
                  <span>{ntaShowSolution ? "Hide Explanation" : "Inspect Solution"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditorViewMode("STUDIO")}
                  className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
                >
                  Back to Editing Studio
                </button>
              </div>
            </div>

            {/* Explanation Drawer */}
            {ntaShowSolution && (
              <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span>Correct Answer: Option ({correctOption})</span>
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-200 space-y-2">
                  <p className="font-medium">
                    {ntaViewLang === "ENGLISH" ? solutionEn : solutionHi}
                  </p>
                  <EquationLivePreview
                    content={ntaViewLang === "ENGLISH" ? solutionEn : solutionHi}
                    label="Solution Formula Render"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 3. Unified Image Dropzone & Permanent Reference Dock (Top) */}
      <div className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 ${editorViewMode === "NTA_PREVIEW" ? "hidden" : ""}`}>
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

        {/* In-Built OCR Extraction Progress Indicator */}
        <OcrExtractionProgress isLoading={ocrLoading} />
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
                      {lowConfidenceFields.includes("statementEn") && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-amber-600">warning</span>
                          Review Required
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      <FieldImageUploadButton
                        onInsertImage={(md) =>
                          setStatementEn((prev: string) => (prev ? prev + " " + md : md))
                        }
                      />
                      <FormulaInsertToolbar onInsert={(snippet) => setStatementEn((prev: string) => (prev ? prev + " " + snippet : snippet))} />
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">LaTeX &amp; Paste (Ctrl+V)</span>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Which of the following statements is correct regarding the Bohr model? (You can paste Ctrl+V images directly here)"
                    value={statementEn}
                    onPaste={(e) =>
                      handlePasteImageToField(e, (md) =>
                        setStatementEn((prev: string) => (prev ? prev + " " + md : md))
                      )
                    }
                    onChange={(e) => setStatementEn(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-sm text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none font-sans leading-relaxed shadow-sm transition placeholder-slate-400"
                  />
                  {/* Live Rendered Equation Preview */}
                  <EquationLivePreview content={statementEn} label="English Statement" />
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
                      {lowConfidenceFields.includes("statementHi") && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-amber-600">warning</span>
                          Review Required
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      <FieldImageUploadButton
                        onInsertImage={(md) =>
                          setStatementHi((prev: string) => (prev ? prev + " " + md : md))
                        }
                      />
                      <FormulaInsertToolbar onInsert={(snippet) => setStatementHi((prev: string) => (prev ? prev + " " + snippet : snippet))} />
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">Devanagari &amp; Paste (Ctrl+V)</span>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="e.g. हाइड्रोजन परमाणु के संबंध में निम्नलिखित में से कौन सा कथन सही है? (यहाँ सीधे Ctrl+V से इमेज पेस्ट कर सकते हैं)"
                    value={statementHi}
                    onPaste={(e) =>
                      handlePasteImageToField(e, (md) =>
                        setStatementHi((prev: string) => (prev ? prev + " " + md : md))
                      )
                    }
                    onChange={(e) => setStatementHi(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-sm text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none font-sans leading-relaxed shadow-sm transition placeholder-slate-400"
                  />
                  {/* Live Rendered Equation Preview */}
                  <EquationLivePreview content={statementHi} label="Hindi Statement" />
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
                      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
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
                          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Option ({opt.key})</span>
                            {isSelected && <span className="text-emerald-600 dark:text-emerald-400">— Correct Answer</span>}
                            {(lowConfidenceFields.includes(`option_${opt.key}_En`) || lowConfidenceFields.includes(`option_${opt.key}_Hi`)) && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs text-amber-600">warning</span>
                                Review Required
                              </span>
                            )}
                          </span>
                        </label>

                        {/* Quick Formula & Image Palette for Option */}
                        <div className="flex items-center gap-2">
                          <FieldImageUploadButton
                            onInsertImage={(md) => {
                              if (activeLangTab === "HINDI") {
                                opt.setValHi((prev: string) => (prev ? prev + " " + md : md));
                              } else {
                                opt.setValEn((prev: string) => (prev ? prev + " " + md : md));
                              }
                            }}
                          />
                          <FormulaInsertToolbar
                            onInsert={(snippet) => {
                              if (activeLangTab === "HINDI") {
                                opt.setValHi((prev: string) => (prev ? prev + " " + snippet : snippet));
                              } else {
                                opt.setValEn((prev: string) => (prev ? prev + " " + snippet : snippet));
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(activeLangTab === "BOTH" || activeLangTab === "ENGLISH") && (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              placeholder={`Option (${opt.key}) English text or paste image (Ctrl+V)`}
                              value={opt.valEn}
                              onPaste={(e) =>
                                handlePasteImageToField(e, (md) =>
                                  opt.setValEn((prev: string) => (prev ? prev + " " + md : md))
                                )
                              }
                              onChange={(e) => opt.setValEn(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-none transition placeholder-slate-400"
                            />
                            {/* Live KaTeX / Math / Chemistry Render Preview */}
                            <EquationLivePreview content={opt.valEn} label={`Option (${opt.key})`} />
                          </div>
                        )}
                        {(activeLangTab === "BOTH" || activeLangTab === "HINDI") && (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              placeholder={`विकल्प (${opt.key}) हिंदी पाठ या इमेज पेस्ट करें (Ctrl+V)`}
                              value={opt.valHi}
                              onPaste={(e) =>
                                handlePasteImageToField(e, (md) =>
                                  opt.setValHi((prev: string) => (prev ? prev + " " + md : md))
                                )
                              }
                              onChange={(e) => opt.setValHi(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 dark:text-white focus:border-blue-500 outline-none transition placeholder-slate-400"
                            />
                            {/* Live KaTeX / Math / Chemistry Render Preview */}
                            <EquationLivePreview content={opt.valHi} label={`विकल्प (${opt.key})`} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* D. STEP-BY-STEP SOLUTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Step-by-Step Solution &amp; Concepts
                </h4>
                <div className="flex items-center gap-2">
                  <FieldImageUploadButton
                    onInsertImage={(md) => {
                      if (activeLangTab === "HINDI") {
                        setSolutionHi((prev: string) => (prev ? prev + " " + md : md));
                      } else {
                        setSolutionEn((prev: string) => (prev ? prev + " " + md : md));
                      }
                    }}
                  />
                  <FormulaInsertToolbar
                    onInsert={(snippet) => {
                      if (activeLangTab === "HINDI") {
                        setSolutionHi((prev: string) => (prev ? prev + " " + snippet : snippet));
                      } else {
                        setSolutionEn((prev: string) => (prev ? prev + " " + snippet : snippet));
                      }
                    }}
                  />
                </div>
              </div>

              {(activeLangTab === "BOTH" || activeLangTab === "ENGLISH") && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Solution (English)
                  </label>
                  <textarea
                    rows={4}
                    placeholder={"Step 1: Formula used...\nStep 2: Calculation...\nHence, Option (A) is correct. (Ctrl+V image paste supported)"}
                    value={solutionEn}
                    onPaste={(e) =>
                      handlePasteImageToField(e, (md) =>
                        setSolutionEn((prev: string) => (prev ? prev + " " + md : md))
                      )
                    }
                    onChange={(e) => setSolutionEn(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none leading-relaxed font-mono transition placeholder-slate-400"
                  />
                  {/* Live Rendered Solution Preview */}
                  <EquationLivePreview content={solutionEn} label="English Solution" />
                </div>
              )}

              {(activeLangTab === "BOTH" || activeLangTab === "HINDI") && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Solution (Hindi - हिंदी)
                  </label>
                  <textarea
                    rows={4}
                    placeholder={"चरण 1: प्रयुक्त सूत्र...\nचरण 2: गणना...\nअतः, विकल्प (A) सही है। (Ctrl+V इमेज पेस्ट समर्थित)"}
                    value={solutionHi}
                    onPaste={(e) =>
                      handlePasteImageToField(e, (md) =>
                        setSolutionHi((prev: string) => (prev ? prev + " " + md : md))
                      )
                    }
                    onChange={(e) => setSolutionHi(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none leading-relaxed font-mono transition placeholder-slate-400"
                  />
                  {/* Live Rendered Solution Preview */}
                  <EquationLivePreview content={solutionHi} label="Hindi Solution" />
                </div>
              )}
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
                  onClick={() => handleSubmit()}
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