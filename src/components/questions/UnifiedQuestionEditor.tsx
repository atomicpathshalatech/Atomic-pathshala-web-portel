"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Save,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Layers,
  HelpCircle,
  Check,
  RefreshCw,
  Eye,
  FileText,
  Sliders,
  CheckSquare,
  Square,
  Copy,
  ExternalLink,
} from "lucide-react";
import { EquationLivePreview } from "./EquationLivePreview";
import { FormulaInsertToolbar } from "./FormulaInsertToolbar";
import { QuestionIdBadge } from "./QuestionIdBadge";

export interface UnifiedQuestionEditorProps {
  mode: "bank" | "dpp" | "test";
  initialQuestion?: any;
  questionId?: string;
  dppId?: string;
  dppName?: string;
  testId?: string;
  testSectionId?: string;
  testName?: string;
  slotNumber?: number;
  totalSlots?: number;
  onSaveSuccess?: (savedQuestion: any) => void;
  onNext?: () => void;
  onPrev?: () => void;
  onCancelHref?: string;
}

export function UnifiedQuestionEditor({
  mode,
  initialQuestion,
  questionId,
  dppId,
  dppName,
  testId,
  testSectionId,
  testName,
  slotNumber = 1,
  totalSlots = 1,
  onSaveSuccess,
  onNext,
  onPrev,
  onCancelHref = "/team/questions",
}: UnifiedQuestionEditorProps) {
  const router = useRouter();

  // Translations initial data
  const translationEn = initialQuestion?.translations?.find((t: any) => t.language === "ENGLISH");
  const translationHi = initialQuestion?.translations?.find((t: any) => t.language === "HINDI");
  const optionsEnData = translationEn?.options || initialQuestion?.optionsEn || {};
  const optionsHiData = translationHi?.options || initialQuestion?.optionsHi || {};
  const initialCorrect =
    translationEn?.correctOptionIds?.[0] ||
    translationHi?.correctOptionIds?.[0] ||
    initialQuestion?.correctOption ||
    "A";

  // 1. MANDATORY METADATA STATES (At the top of the interface)
  const [subject, setSubject] = useState<string>(initialQuestion?.subject || "Biology");
  const [chapter, setChapter] = useState<string>(initialQuestion?.chapter || "");
  const [topic, setTopic] = useState<string>(initialQuestion?.topic || "");
  const [subTopic, setSubTopic] = useState<string>(initialQuestion?.subTopic || "");
  const [questionType, setQuestionType] = useState<string>(initialQuestion?.type || "SINGLE_CORRECT");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "ULTRA">(
    initialQuestion?.difficulty || "MEDIUM"
  );
  const [category, setCategory] = useState<string>(initialQuestion?.category || "NCERT Canonical");
  const [marks, setMarks] = useState<number>(initialQuestion?.marks || 4);
  const [negativeMarks, setNegativeMarks] = useState<number>(initialQuestion?.negativeMarks || 1);

  // Taxonomy Lists (Dynamic from Master NCERT Catalog + Memory)
  const [subjectsList, setSubjectsList] = useState<Array<{ id: string; name: string }>>([]);
  const [chaptersList, setChaptersList] = useState<Array<{ id: string; title: string; displayTitle?: string }>>([]);
  const [topicsList, setTopicsList] = useState<Array<{ id: string; title: string }>>([]);

  // Validation Error Highlight Flags
  const [missingFieldErrors, setMissingFieldErrors] = useState<Record<string, boolean>>({});

  // 2. QUESTION CONTENT STATES (Dual Column)
  const [statementEn, setStatementEn] = useState<string>(translationEn?.statement || initialQuestion?.statementEn || "");
  const [statementHi, setStatementHi] = useState<string>(translationHi?.statement || initialQuestion?.statementHi || "");

  const [optionAEn, setOptionAEn] = useState<string>(optionsEnData.A || "");
  const [optionBEn, setOptionBEn] = useState<string>(optionsEnData.B || "");
  const [optionCEn, setOptionCEn] = useState<string>(optionsEnData.C || "");
  const [optionDEn, setOptionDEn] = useState<string>(optionsEnData.D || "");

  const [optionAHi, setOptionAHi] = useState<string>(optionsHiData.A || "");
  const [optionBHi, setOptionBHi] = useState<string>(optionsHiData.B || "");
  const [optionCHi, setOptionCHi] = useState<string>(optionsHiData.C || "");
  const [optionDHi, setOptionDHi] = useState<string>(optionsHiData.D || "");

  const [correctOption, setCorrectOption] = useState<string>(initialCorrect);
  const [solutionEn, setSolutionEn] = useState<string>(translationEn?.solution || initialQuestion?.solutionEn || "");
  const [solutionHi, setSolutionHi] = useState<string>(translationHi?.solution || initialQuestion?.solutionHi || "");

  // Diagram / Reference Image
  const [diagramUrl, setDiagramUrl] = useState<string | null>(
    initialQuestion?.imageUrl || initialQuestion?.figureUrl || null
  );

  // 3. AI PIPELINE STATES
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isGeneratingSolution, setIsGeneratingSolution] = useState<boolean>(false);
  const [aiRecommendedAnswer, setAiRecommendedAnswer] = useState<string | null>(null);
  const [answerMismatchWarning, setAnswerMismatchWarning] = useState<string | null>(null);

  // Save State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(initialQuestion?.questionCode || null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // A. Fetch Master Subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch("/api/team/ai-questions/taxonomy");
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.subjects)) {
          setSubjectsList(json.data.subjects);
        }
      } catch {
        // Fallback
        setSubjectsList([
          { id: "Biology", name: "Biology" },
          { id: "Physics", name: "Physics" },
          { id: "Chemistry", name: "Chemistry" },
          { id: "Mathematics", name: "Mathematics" },
        ]);
      }
    };
    fetchSubjects();
  }, []);

  // B. Fetch Chapters when Subject changes
  useEffect(() => {
    if (!subject) {
      setChaptersList([]);
      return;
    }

    const fetchChapters = async () => {
      try {
        const res = await fetch(`/api/team/ai-questions/taxonomy?subject=${encodeURIComponent(subject)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.chapters)) {
          setChaptersList(json.data.chapters);
          // If current chapter not in list, pick first
          if (!chapter && json.data.chapters.length > 0) {
            setChapter(json.data.chapters[0].title);
          }
        }
      } catch {
        toast.error("Failed to load NCERT chapters for subject.");
      }
    };

    fetchChapters();
  }, [subject]);

  // C. Fetch Topics when Chapter changes
  useEffect(() => {
    if (!subject || !chapter) {
      setTopicsList([]);
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
          if (!topic && json.data.topics.length > 0) {
            setTopic(json.data.topics[0].title);
          }
        }
      } catch {
        toast.error("Failed to load topics for chapter.");
      }
    };

    fetchTopics();
  }, [subject, chapter]);

  // D. Global Paste (Ctrl+V) handler for automatic extraction
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // If user is typing inside an input or textarea, let default typing happen
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA";

      const items = e.clipboardData?.items;
      if (!items) return;

      // 1. Check for image in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageUploadAndExtract(file);
          }
          return;
        }
      }

      // 2. Check for text in clipboard (only if not focused in a specific text field)
      if (!isInput) {
        const text = e.clipboardData.getData("text");
        if (text && text.trim().length > 30) {
          e.preventDefault();
          handleTextAutoExtract(text.trim());
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [subject, chapter]);

  // E. Automatic Image OCR Extraction (No manual button click needed)
  const handleImageUploadAndExtract = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;
      setDiagramUrl(base64Url);

      setIsExtracting(true);
      toast.info("Extracting question, options, and formulas from image...");

      try {
        const res = await fetch("/api/team/questions/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "auto_extract",
            payload: {
              imageBase64: base64Url,
              mimeType: file.type,
              subject,
              chapter,
            },
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Extraction failed.");
        }

        const data = json.data?.result;
        if (!data) throw new Error("No data returned from extraction.");

        // Populate fields
        if (data.statementEn) setStatementEn(data.statementEn);
        if (data.statementHi) setStatementHi(data.statementHi);

        if (data.optionsEn) {
          setOptionAEn(data.optionsEn.A || "");
          setOptionBEn(data.optionsEn.B || "");
          setOptionCEn(data.optionsEn.C || "");
          setOptionDEn(data.optionsEn.D || "");
        }
        if (data.optionsHi) {
          setOptionAHi(data.optionsHi.A || "");
          setOptionBHi(data.optionsHi.B || "");
          setOptionCHi(data.optionsHi.C || "");
          setOptionDHi(data.optionsHi.D || "");
        }

        if (data.correctAnswer?.[0]) {
          const rec = data.correctAnswer[0].toUpperCase();
          setAiRecommendedAnswer(rec);
          setCorrectOption(rec);
        }

        if (data.solutionEn) setSolutionEn(data.solutionEn);
        if (data.solutionHi) setSolutionHi(data.solutionHi);

        if (data.subject && !subject) setSubject(data.subject);
        if (data.chapter && !chapter) setChapter(data.chapter);
        if (data.topic && !topic) setTopic(data.topic);

        toast.success("Question and options extracted successfully!");
      } catch (err: any) {
        toast.error(err.message || "Unable to extract this content. Please review or retry.");
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // F. Automatic Text Extraction
  const handleTextAutoExtract = async (rawText: string) => {
    setIsExtracting(true);
    toast.info("Parsing pasted text into structured question format...");

    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_extract",
          payload: {
            rawText,
            subject,
            chapter,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Text extraction failed.");
      }

      const data = json.data?.result;
      if (!data) throw new Error("No data returned from parser.");

      if (data.statementEn) setStatementEn(data.statementEn);
      if (data.statementHi) setStatementHi(data.statementHi);

      if (data.optionsEn) {
        setOptionAEn(data.optionsEn.A || "");
        setOptionBEn(data.optionsEn.B || "");
        setOptionCEn(data.optionsEn.C || "");
        setOptionDEn(data.optionsEn.D || "");
      }
      if (data.optionsHi) {
        setOptionAHi(data.optionsHi.A || "");
        setOptionBHi(data.optionsHi.B || "");
        setOptionCHi(data.optionsHi.C || "");
        setOptionDHi(data.optionsHi.D || "");
      }

      if (data.correctAnswer?.[0]) {
        const rec = data.correctAnswer[0].toUpperCase();
        setAiRecommendedAnswer(rec);
        setCorrectOption(rec);
      }

      toast.success("Text parsed into question and options successfully!");
    } catch (err: any) {
      toast.error(err.message || "Unable to parse this text. Please review.");
    } finally {
      setIsExtracting(false);
    }
  };

  // G. Action: CHECK TRANSLATION (Translates or aligns both languages)
  const handleCheckTranslation = async () => {
    if (!statementEn && !statementHi) {
      toast.error("Please provide at least an English or Hindi question statement first.");
      return;
    }

    setIsTranslating(true);
    toast.info("Checking translation parity and terminology alignment...");

    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_translation",
          payload: {
            subject,
            statementEn,
            statementHi,
            optionsEn: { A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn },
            optionsHi: { A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi },
            solutionEn,
            solutionHi,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Translation check failed.");
      }

      const resData = json.data?.result;
      if (resData) {
        setStatementEn(resData.statementEn || statementEn);
        setStatementHi(resData.statementHi || statementHi);

        if (resData.optionsEn) {
          setOptionAEn(resData.optionsEn.A || optionAEn);
          setOptionBEn(resData.optionsEn.B || optionBEn);
          setOptionCEn(resData.optionsEn.C || optionCEn);
          setOptionDEn(resData.optionsEn.D || optionDEn);
        }
        if (resData.optionsHi) {
          setOptionAHi(resData.optionsHi.A || optionAHi);
          setOptionBHi(resData.optionsHi.B || optionBHi);
          setOptionCHi(resData.optionsHi.C || optionCHi);
          setOptionDHi(resData.optionsHi.D || optionDHi);
        }

        if (resData.solutionEn) setSolutionEn(resData.solutionEn);
        if (resData.solutionHi) setSolutionHi(resData.solutionHi);

        toast.success(resData.report || "Translation checked and aligned successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to check translation.");
    } finally {
      setIsTranslating(false);
    }
  };

  // H. Action: SUBJECT-AWARE SOLUTION GENERATION
  const handleGenerateSolution = async () => {
    if (!statementEn && !statementHi) {
      toast.error("Please enter a question statement first.");
      return;
    }

    setIsGeneratingSolution(true);
    toast.info(`Generating ${subject} format step-by-step solution...`);

    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_subject_solution",
          payload: {
            subject,
            statementEn: statementEn || statementHi,
            statementHi: statementHi || statementEn,
            optionsEn: { A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn },
            optionsHi: { A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi },
            correctAnswer: correctOption,
            userSelectedAnswer: correctOption,
            userProvidedSolution: solutionEn || solutionHi,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Solution generation failed.");
      }

      const solData = json.data?.solution;
      if (solData) {
        if (solData.solutionEn) setSolutionEn(solData.solutionEn);
        if (solData.solutionHi) setSolutionHi(solData.solutionHi);

        if (solData.recommendedAnswer) {
          setAiRecommendedAnswer(solData.recommendedAnswer);
        }

        if (solData.answerMismatch) {
          setAnswerMismatchWarning(solData.mismatchWarning || "Answer mismatch detected.");
          toast.warning(solData.mismatchWarning || "Answer mismatch detected.");
        } else {
          setAnswerMismatchWarning(null);
          toast.success("Subject-aware solution generated successfully!");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate solution.");
    } finally {
      setIsGeneratingSolution(false);
    }
  };

  // I. User Selecting Correct Answer Option
  const handleSelectCorrectOption = (optKey: string) => {
    setCorrectOption(optKey);
    // If AI previously recommended a different answer, alert the user
    if (aiRecommendedAnswer && aiRecommendedAnswer !== optKey) {
      setAnswerMismatchWarning(
        `⚠ Answer mismatch: AI recommends Option (${aiRecommendedAnswer}), but you selected Option (${optKey}) — please verify.`
      );
    } else {
      setAnswerMismatchWarning(null);
    }
  };

  // J. Save Question with Strict Mandatory Metadata Validation
  const handleSaveQuestion = async (submitToReview = false) => {
    // 1. Mandatory Metadata Checks
    const errors: Record<string, boolean> = {};
    if (!subject?.trim()) errors.subject = true;
    if (!chapter?.trim()) errors.chapter = true;
    if (!topic?.trim()) errors.topic = true;

    // 2. Question Content Checks
    if (!statementEn.trim() && !statementHi.trim()) {
      errors.statement = true;
    }

    const hasOptionsEn = optionAEn.trim() && optionBEn.trim() && optionCEn.trim() && optionDEn.trim();
    const hasOptionsHi = optionAHi.trim() && optionBHi.trim() && optionCHi.trim() && optionDHi.trim();

    if (!hasOptionsEn && !hasOptionsHi) {
      errors.options = true;
    }

    if (!correctOption) {
      errors.correctOption = true;
    }

    if (Object.keys(errors).length > 0) {
      setMissingFieldErrors(errors);
      const missingNames = [];
      if (errors.subject) missingNames.push("Subject");
      if (errors.chapter) missingNames.push("Chapter");
      if (errors.topic) missingNames.push("Topic");
      if (errors.statement) missingNames.push("Question Statement");
      if (errors.options) missingNames.push("All 4 Options (A, B, C, D)");
      if (errors.correctOption) missingNames.push("Correct Answer");

      toast.error(`Please complete mandatory fields before saving: ${missingNames.join(", ")}`);
      return;
    }

    setMissingFieldErrors({});
    setIsSaving(true);

    try {
      const payload = {
        subject: subject.trim(),
        chapter: chapter.trim(),
        topic: topic.trim(),
        subTopic: subTopic.trim() || undefined,
        type: questionType,
        difficulty,
        category,
        marks,
        negativeMarks,
        statementEn: statementEn.trim() || undefined,
        statementHi: statementHi.trim() || undefined,
        optionsEn: {
          A: optionAEn.trim(),
          B: optionBEn.trim(),
          C: optionCEn.trim(),
          D: optionDEn.trim(),
        },
        optionsHi: {
          A: optionAHi.trim(),
          B: optionBHi.trim(),
          C: optionCHi.trim(),
          D: optionDHi.trim(),
        },
        correctOptionIds: [correctOption],
        correctAnswer: [correctOption],
        solutionEn: solutionEn.trim() || undefined,
        solutionHi: solutionHi.trim() || undefined,
        figureUrl: diagramUrl || undefined,
        referenceImageUrl: diagramUrl || undefined,
        dppId,
        testSectionId,
        isPublished: false,
        status: submitToReview ? "REVIEW_1" : "DRAFT",
      };

      let res;
      if (questionId) {
        res = await fetch("/api/team/questions/engine", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, ...payload }),
        });
      } else {
        res = await fetch("/api/team/questions/engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || "Failed to save question.");
      }

      const savedQ = json.data?.question;
      if (savedQ?.questionCode) {
        setGeneratedCode(savedQ.questionCode);
      }

      toast.success(
        submitToReview
          ? "Question saved to Question Bank and submitted to Stage 1 Review!"
          : "Question saved successfully!"
      );

      if (onSaveSuccess) {
        onSaveSuccess(savedQ);
      } else if (mode === "bank") {
        router.push("/team/questions");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save question.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* 1. TOP CONTEXT & QUESTION ID BANNER */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-600 text-white">
              {mode === "test" ? "Test Authoring Studio" : mode === "dpp" ? "DPP Studio" : "Question Bank"}
            </span>

            {testName && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
                Test: {testName}
              </span>
            )}
            {dppName && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-bold">
                DPP: {dppName}
              </span>
            )}

            {(mode === "test" || mode === "dpp") && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold font-mono">
                Slot #{slotNumber} of {totalSlots}
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Add New Question
          </h2>
          <p className="text-xs text-slate-500">
            Unified bilingual creation with mandatory NCERT metadata, auto-OCR paste, and subject-aware solutions.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <QuestionIdBadge questionCode={generatedCode} subjectName={subject} isSaving={isSaving} />
        </div>
      </div>

      {/* 2. MANDATORY METADATA BAR AT THE TOP (Section 1) */}
      <div
        className={`bg-white rounded-3xl p-6 shadow-sm border transition-all ${
          missingFieldErrors.subject || missingFieldErrors.chapter || missingFieldErrors.topic
            ? "border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10"
            : "border-slate-200/80"
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>1. Mandatory Question Metadata</span>
            <span className="text-[10px] text-rose-500 lowercase font-normal">* required before save</span>
          </h3>
          <span className="text-[11px] font-bold text-slate-400">Step 1 of 3</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Subject */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Subject <span className="text-rose-500">*</span>
            </label>
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setChapter("");
                setTopic("");
              }}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl font-bold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500 ${
                missingFieldErrors.subject ? "border-rose-500 bg-rose-50" : "border-slate-200"
              }`}
            >
              {subjectsList.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Chapter <span className="text-rose-500">*</span>
            </label>
            <select
              value={chapter}
              onChange={(e) => {
                setChapter(e.target.value);
                setTopic("");
              }}
              disabled={!subject}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl font-semibold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500 disabled:opacity-50 ${
                missingFieldErrors.chapter ? "border-rose-500 bg-rose-50" : "border-slate-200"
              }`}
            >
              <option value="">-- Select Chapter --</option>
              {chaptersList.map((c) => (
                <option key={c.id} value={c.title}>
                  {c.displayTitle || c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Topic <span className="text-rose-500">*</span>
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!chapter}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl font-semibold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500 disabled:opacity-50 ${
                missingFieldErrors.topic ? "border-rose-500 bg-rose-50" : "border-slate-200"
              }`}
            >
              <option value="">-- Select Topic --</option>
              {topicsList.map((t) => (
                <option key={t.id || t.title} value={t.title}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Question Type */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Question Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500"
            >
              <option value="SINGLE_CORRECT">Single Correct (MCQ)</option>
              <option value="MULTIPLE_CORRECT">Multiple Correct</option>
              <option value="ASSERTION_REASON">Assertion &amp; Reason</option>
              <option value="STATEMENT_BASED">Statement-Based (I &amp; II)</option>
              <option value="MATCH_COLUMN">Match The Columns</option>
              <option value="NUMERICAL">Numerical / Integer</option>
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Difficulty</label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-center font-black text-[11px]">
              {(["EASY", "MEDIUM", "HARD", "ULTRA"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`py-1.5 rounded-xl transition ${
                    difficulty === d
                      ? d === "EASY"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : d === "MEDIUM"
                        ? "bg-blue-600 text-white shadow-sm"
                        : d === "HARD"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-purple-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500"
            >
              <option value="NCERT Canonical">NCERT Canonical (Line-by-Line)</option>
              <option value="PYQ Inspired">PYQ Inspired</option>
              <option value="Exemplar">NCERT Exemplar</option>
              <option value="High-Yield Concept">High-Yield Concept</option>
            </select>
          </div>

          {/* Subtopic (Optional) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Sub-topic (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Rate Law expression"
              value={subTopic}
              onChange={(e) => setSubTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-800 outline-none transition focus:bg-white focus:border-blue-500"
            />
          </div>

          {/* Marks */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Marking Scheme</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-2xl">
                <span className="text-emerald-700 font-bold mr-1">+</span>
                <input
                  type="number"
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  className="w-full bg-transparent font-black text-emerald-800 outline-none"
                />
              </div>
              <div className="flex-1 flex items-center bg-rose-50 border border-rose-200 px-3 py-2 rounded-2xl">
                <span className="text-rose-700 font-bold mr-1">-</span>
                <input
                  type="number"
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(Number(e.target.value))}
                  className="w-full bg-transparent font-black text-rose-800 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. AUTO-EXTRACT DROP & PASTE ZONE (Section 4 — No Manual Click Needed) */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-indigo-200/80 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Auto-Extract Question (Paste Screenshot or Drop Image)
              </h4>
              <p className="text-[11px] text-slate-500">
                Press <strong className="text-purple-700 font-mono">Ctrl + V</strong> anywhere on this screen to paste an image or raw text. Extraction begins automatically!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUploadAndExtract(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-purple-600" />
              <span>Browse Image</span>
            </button>
          </div>
        </div>

        {/* Live Extraction Active State */}
        {isExtracting && (
          <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm flex items-center gap-3 animate-in fade-in">
            <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
            <div className="space-y-0.5">
              <p className="text-xs font-black text-slate-900">
                Extracting bilingual question, options, math formulas &amp; diagrams...
              </p>
              <p className="text-[11px] text-slate-500">
                Separating Hindi/English text and formatting LaTeX mathematical notation.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4. DUAL COLUMN BILINGUAL WORKSPACE (Section 3 — The Master Test Design) */}
      <div className="space-y-4">
        {/* Quick Toolbar (Check Translation & Solution Generation) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              2. Question &amp; Options Editor
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
              Dual Column: हिंदी + English
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Action 1: CHECK TRANSLATION */}
            <button
              type="button"
              onClick={handleCheckTranslation}
              disabled={isTranslating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-black text-purple-800 shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isTranslating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              )}
              <span>Check Translation</span>
            </button>

            {/* Primary Action 2: GENERATE SUBJECT-AWARE SOLUTION */}
            <button
              type="button"
              onClick={handleGenerateSolution}
              disabled={isGeneratingSolution}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-black text-indigo-800 shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingSolution ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Generate {subject} Solution</span>
            </button>
          </div>
        </div>

        {/* Answer Mismatch Conflict Alert (Section 11) */}
        {answerMismatchWarning && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{answerMismatchWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (aiRecommendedAnswer) {
                  setCorrectOption(aiRecommendedAnswer);
                  setAnswerMismatchWarning(null);
                  toast.success(`Switched to AI recommended Option (${aiRecommendedAnswer})!`);
                }
              }}
              className="px-3 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-black hover:bg-amber-700 transition"
            >
              Use Option ({aiRecommendedAnswer})
            </button>
          </div>
        )}

        {/* SIDE-BY-SIDE COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMN 1: HINDI (हिंदी) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                हिंदी (Hindi Statement &amp; Options)
              </span>
              <FormulaInsertToolbar
                onInsert={(snippet) => setStatementHi((prev) => (prev ? prev + " " + snippet : snippet))}
              />
            </div>

            {/* Statement Hi */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                प्रश्न कथन (Statement in Hindi)
              </label>
              <textarea
                rows={4}
                placeholder="हिंदी में प्रश्न कथन यहाँ लिखें या इमेज पेस्ट करें..."
                value={statementHi}
                onChange={(e) => setStatementHi(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-900 outline-none resize-none leading-relaxed focus:bg-white focus:border-blue-500 transition"
              />
              <EquationLivePreview content={statementHi} label="Hindi Statement KaTeX" />
            </div>

            {/* Hindi Options A, B, C, D */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                विकल्प (Options in Hindi) — Click circle to select correct answer
              </label>

              {[
                { key: "A", val: optionAHi, setVal: setOptionAHi },
                { key: "B", val: optionBHi, setVal: setOptionBHi },
                { key: "C", val: optionCHi, setVal: setOptionCHi },
                { key: "D", val: optionDHi, setVal: setOptionDHi },
              ].map((opt) => {
                const isSelected = correctOption === opt.key;
                return (
                  <div
                    key={opt.key}
                    className={`p-3 rounded-2xl border transition ${
                      isSelected
                        ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
                        : "bg-slate-50 border-slate-200 focus-within:bg-white focus-within:border-blue-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectCorrectOption(opt.key)}
                        title={`Select (${opt.key}) as correct answer`}
                        className={`w-7 h-7 rounded-xl font-mono font-black text-xs flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                            : "bg-white text-slate-600 border border-slate-300 hover:border-emerald-400"
                        }`}
                      >
                        {isSelected ? <Check className="w-4 h-4" /> : opt.key}
                      </button>

                      <input
                        type="text"
                        placeholder={`विकल्प (${opt.key}) हिंदी पाठ...`}
                        value={opt.val}
                        onChange={(e) => opt.setVal(e.target.value)}
                        className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 font-medium outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Solution Hi */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                विस्तृत व्याख्या / हल (Hindi Solution)
              </label>
              <textarea
                rows={5}
                placeholder="चरणबद्ध हल यहाँ लिखें..."
                value={solutionHi}
                onChange={(e) => setSolutionHi(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs text-slate-900 outline-none resize-none leading-relaxed font-mono focus:bg-white focus:border-blue-500 transition"
              />
              <EquationLivePreview content={solutionHi} label="Hindi Solution Preview" />
            </div>
          </div>

          {/* COLUMN 2: ENGLISH */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-blue-800 bg-blue-100 px-3 py-1 rounded-full">
                English (English Statement &amp; Options)
              </span>
              <FormulaInsertToolbar
                onInsert={(snippet) => setStatementEn((prev) => (prev ? prev + " " + snippet : snippet))}
              />
            </div>

            {/* Statement En */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Question Statement (English)
              </label>
              <textarea
                rows={4}
                placeholder="Write question statement in English or paste screenshot..."
                value={statementEn}
                onChange={(e) => setStatementEn(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-900 outline-none resize-none leading-relaxed focus:bg-white focus:border-blue-500 transition"
              />
              <EquationLivePreview content={statementEn} label="English Statement KaTeX" />
            </div>

            {/* English Options A, B, C, D */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                Options (English) — Click circle to select correct answer
              </label>

              {[
                { key: "A", val: optionAEn, setVal: setOptionAEn },
                { key: "B", val: optionBEn, setVal: setOptionBEn },
                { key: "C", val: optionCEn, setVal: setOptionCEn },
                { key: "D", val: optionDEn, setVal: setOptionDEn },
              ].map((opt) => {
                const isSelected = correctOption === opt.key;
                return (
                  <div
                    key={opt.key}
                    className={`p-3 rounded-2xl border transition ${
                      isSelected
                        ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
                        : "bg-slate-50 border-slate-200 focus-within:bg-white focus-within:border-blue-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectCorrectOption(opt.key)}
                        title={`Select (${opt.key}) as correct answer`}
                        className={`w-7 h-7 rounded-xl font-mono font-black text-xs flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                            : "bg-white text-slate-600 border border-slate-300 hover:border-emerald-400"
                        }`}
                      >
                        {isSelected ? <Check className="w-4 h-4" /> : opt.key}
                      </button>

                      <input
                        type="text"
                        placeholder={`Option (${opt.key}) English text...`}
                        value={opt.val}
                        onChange={(e) => opt.setVal(e.target.value)}
                        className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 font-medium outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Solution En */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                Detailed Step-by-Step Solution (English)
              </label>
              <textarea
                rows={5}
                placeholder="Write step-by-step English solution..."
                value={solutionEn}
                onChange={(e) => setSolutionEn(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs text-slate-900 outline-none resize-none leading-relaxed font-mono focus:bg-white focus:border-blue-500 transition"
              />
              <EquationLivePreview content={solutionEn} label="English Solution Preview" />
            </div>
          </div>
        </div>

        {/* Attached Diagram / Image Preview (Preserved) */}
        {diagramUrl && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-600" />
                <span>Attached Question Diagram / Reference Image</span>
              </h4>
              <button
                type="button"
                onClick={() => setDiagramUrl(null)}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                Remove Diagram
              </button>
            </div>

            <div className="max-w-md mx-auto p-2 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center">
              <img src={diagramUrl} alt="Question Diagram" className="max-h-60 rounded-xl object-contain" />
            </div>
          </div>
        )}
      </div>

      {/* 5. STICKY BOTTOM ACTION BAR (Save & Slot Navigation) */}
      <footer className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: Navigation or Cancel */}
        <div>
          {mode === "bank" ? (
            <button
              type="button"
              onClick={() => router.push(onCancelHref)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
            >
              Cancel
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={slotNumber <= 1}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs disabled:opacity-40 transition"
              >
                ← Prev Slot
              </button>
              <span className="text-xs font-mono font-bold text-slate-500">
                Slot {slotNumber} / {totalSlots}
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Save Actions */}
        <div className="flex items-center gap-3">
          {mode === "bank" && (
            <button
              type="button"
              onClick={() => handleSaveQuestion(false)}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save as Draft"}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSaveQuestion(true)}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-500/25 transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? "Saving Question..."
                : mode === "bank"
                ? "Save & Submit to Review (Stage 1)"
                : "Save Question"}
            </span>
          </button>

          {mode !== "bank" && onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={slotNumber >= totalSlots}
              className="px-4 py-2 rounded-xl bg-[#0c3ea4] hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-40"
            >
              Next Slot →
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
