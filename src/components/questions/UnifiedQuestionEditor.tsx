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
  ZoomIn,
  Maximize2,
  PlusCircle,
  Wand2,
  Tag,
  Trash2,
  Compass,
} from "lucide-react";
import { EquationLivePreview } from "./EquationLivePreview";
import { FormulaInsertToolbar } from "./FormulaInsertToolbar";
import { QuestionIdBadge } from "./QuestionIdBadge";
import { QuestionMetadataDrawer } from "./QuestionMetadataDrawer";
import { QuestionMetadataPanel } from "./QuestionMetadataPanel";
import { CamDrawRenderer } from "@/components/camdraw/CamDrawRenderer";
import { CamDrawEditor } from "@/components/camdraw/CamDrawEditor";

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
  order?: number;
  totalSlots?: number;
  onSaveSuccess?: (savedQuestion: any) => void;
  onDelete?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onCancelHref?: string;
  /**
   * The test/DPP syllabus: a question added to it can only belong to one of
   * these chapters (and, when a chapter lists topics, one of those topics).
   * Empty topics = the whole chapter.
   */
  syllabus?: SyllabusChapter[];
}

export type SyllabusChapter = { subject: string; chapter: string; topics: string[] };

type AiSuggestion = {
  subject?: string;
  chapter?: string;
  topic?: string;
  subTopic?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "ULTRA";
  type?: string;
  pyqExam?: string;
  pyqYear?: number;
  pyqMonth?: string;
  pyqQuestionNumber?: string;
};

/** Case/spacing/punctuation-insensitive name for matching chapter & topic titles. */
function sameName(a?: string | null, b?: string | null) {
  const norm = (s?: string | null) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return norm(a) !== "" && norm(a) === norm(b);
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
  order,
  totalSlots = 1,
  onSaveSuccess,
  onDelete,
  onNext,
  onPrev,
  onCancelHref = "/team/questions",
  syllabus,
}: UnifiedQuestionEditorProps) {
  const router = useRouter();
  // Metadata is checked at the bottom, just before Save. A question already
  // saved was checked when it was saved; a new one needs the click.
  const [metadataConfirmed, setMetadataConfirmed] = useState<boolean>(Boolean(questionId));
  const [metadataFromAi, setMetadataFromAi] = useState<boolean>(false);
  const metadataPanelRef = useRef<HTMLDivElement | null>(null);

  // Translations initial data
  const translationEn = initialQuestion?.translations?.find((t: any) => t.language === "ENGLISH");
  const translationHi = initialQuestion?.translations?.find((t: any) => t.language === "HINDI");
  
  const rawOptEn = typeof translationEn?.options === "string" 
    ? (() => { try { return JSON.parse(translationEn.options); } catch { return {}; } })() 
    : (translationEn?.options || initialQuestion?.optionsEn || {});
  
  const rawOptHi = typeof translationHi?.options === "string" 
    ? (() => { try { return JSON.parse(translationHi.options); } catch { return {}; } })() 
    : (translationHi?.options || initialQuestion?.optionsHi || {});

  const optionsEnData = {
    A: rawOptEn.A || initialQuestion?.optionAEn || "",
    B: rawOptEn.B || initialQuestion?.optionBEn || "",
    C: rawOptEn.C || initialQuestion?.optionCEn || "",
    D: rawOptEn.D || initialQuestion?.optionDEn || "",
  };

  const optionsHiData = {
    A: rawOptHi.A || initialQuestion?.optionAHi || "",
    B: rawOptHi.B || initialQuestion?.optionBHi || "",
    C: rawOptHi.C || initialQuestion?.optionCHi || "",
    D: rawOptHi.D || initialQuestion?.optionDHi || "",
  };

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

  // PYQ Metadata States
  const [pyqExam, setPyqExam] = useState<string>(
    initialQuestion?.pyqExam ||
    (initialQuestion?.category === "NEET_PYQ" ? "NEET" :
     initialQuestion?.category === "JEE_MAINS_PYQ" ? "JEE_MAINS" :
     initialQuestion?.category === "JEE_ADVANCED_PYQ" ? "JEE_ADVANCED" : "")
  );
  const [pyqYear, setPyqYear] = useState<string>(
    initialQuestion?.pyqYear ? String(initialQuestion.pyqYear) : "2025"
  );
  const [pyqMonth, setPyqMonth] = useState<string>(initialQuestion?.pyqMonth || "January");
  const [pyqQuestionNumber, setPyqQuestionNumber] = useState<string>(
    initialQuestion?.pyqQuestionNumber || "Question 01"
  );

  // Taxonomy Lists (Dynamic from Master NCERT Catalog + Memory)
  const [subjectsList, setSubjectsList] = useState<Array<{ id: string; name: string }>>([]);
  const [chaptersList, setChaptersList] = useState<Array<{ id: string; title: string; displayTitle?: string }>>([]);
  const [topicsList, setTopicsList] = useState<Array<{ id: string; title: string; subtopics?: string[] }>>([]);

  // Validation Error Highlight Flags
  const [missingFieldErrors, setMissingFieldErrors] = useState<Record<string, boolean>>({});
  const [isMetadataDrawerOpen, setIsMetadataDrawerOpen] = useState<boolean>(false);

  // Dynamic Custom Topic & Subtopic Addition
  const [isAddingCustomTopic, setIsAddingCustomTopic] = useState<boolean>(false);
  const [customTopicInput, setCustomTopicInput] = useState<string>("");
  const [isAddingCustomSubtopic, setIsAddingCustomSubtopic] = useState<boolean>(false);
  const [customSubtopicInput, setCustomSubtopicInput] = useState<string>("");
  const [isSavingTaxonomy, setIsSavingTaxonomy] = useState<boolean>(false);

  // Solution Inbuilt AI Assistant & Diagram states
  const [solutionRefinePrompt, setSolutionRefinePrompt] = useState<string>("");

  // Helper: Persist New Topic to Master Catalog
  const handleSaveNewTopic = async (overrideName?: string) => {
    const titleToSave = (overrideName ?? customTopicInput).trim();
    if (!titleToSave) {
      toast.error("Please enter a topic name.");
      return;
    }
    if (!subject || !chapter) {
      toast.error("Please select a subject and chapter first.");
      return;
    }

    setIsSavingTaxonomy(true);
    try {
      const res = await fetch("/api/team/ai-questions/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          chapter,
          topicTitle: titleToSave,
          subtopics: subTopic ? [subTopic] : [],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || "Failed to save topic.");
      }

      const savedTopic = json.data?.topic;
      const finalTitle = savedTopic?.title || titleToSave;

      setTopicsList((prev) => {
        const exists = prev.some((t) => t.title.toLowerCase() === finalTitle.toLowerCase());
        if (!exists) {
          return [...prev, { id: savedTopic?.id || finalTitle, title: finalTitle, subtopics: savedTopic?.subtopics || [] }];
        }
        return prev;
      });

      setTopic(finalTitle);
      setCustomTopicInput("");
      setIsAddingCustomTopic(false);
      setMissingFieldErrors((prev) => {
        const next = { ...prev };
        delete next.topic;
        return next;
      });
      toast.success(`Topic "${finalTitle}" saved to NCERT catalog permanently!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add topic.");
    } finally {
      setIsSavingTaxonomy(false);
    }
  };

  // Helper: Persist New Subtopic to Master Catalog
  const handleSaveNewSubtopic = async (overrideSubtopic?: string) => {
    const subToSave = (overrideSubtopic ?? customSubtopicInput).trim();
    if (!subToSave) {
      toast.error("Please enter a subtopic name.");
      return;
    }
    if (!subject || !chapter || !topic) {
      toast.error("Please select a subject, chapter, and topic first.");
      return;
    }

    setIsSavingTaxonomy(true);
    try {
      const res = await fetch("/api/team/ai-questions/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          chapter,
          topicTitle: topic,
          customSubtopic: subToSave,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || "Failed to save subtopic.");
      }

      setTopicsList((prev) =>
        prev.map((t) => {
          if (t.title.toLowerCase() === topic.toLowerCase()) {
            const curSub = t.subtopics || [];
            if (!curSub.includes(subToSave)) {
              return { ...t, subtopics: [...curSub, subToSave] };
            }
          }
          return t;
        })
      );

      setSubTopic(subToSave);
      setCustomSubtopicInput("");
      setIsAddingCustomSubtopic(false);
      toast.success(`Subtopic "${subToSave}" added to catalog permanently!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add subtopic.");
    } finally {
      setIsSavingTaxonomy(false);
    }
  };

  // AI Suggested Curriculum Metadata (Pending user approval)
  const [aiSuggestedMetadata, setAiSuggestedMetadata] = useState<AiSuggestion | null>(null);
  // What the AI last detected, kept for the metadata panel's "AI detected" line.
  const [lastAiSuggestion, setLastAiSuggestion] = useState<AiSuggestion | null>(null);

  /** The extraction result in the editor's own values (type and level names differ). */
  const toSuggestion = (data: any): AiSuggestion => {
    const t = String(data.type || "").toUpperCase();
    const type =
      t === "MULTI_CORRECT" ? "MULTIPLE_CORRECT"
      : t === "INTEGER" ? "NUMERICAL"
      : t === "MATCH_THE_COLUMN" ? "MATCH_COLUMN"
      : ["SINGLE_CORRECT", "MULTIPLE_CORRECT", "ASSERTION_REASON", "STATEMENT_BASED", "MATCH_COLUMN", "NUMERICAL"].includes(t) ? t
      : questionType || "SINGLE_CORRECT";
    const d = String(data.difficulty || "").toUpperCase();
    const level = d === "VERY_HARD" || d === "ULTRA" ? "ULTRA" : d === "EASY" || d === "HARD" ? d : "MEDIUM";
    return {
      subject: data.subject || subject || "Biology",
      chapter: data.chapter || "",
      topic: data.topic || "",
      subTopic: data.subTopic || "",
      difficulty: level as AiSuggestion["difficulty"],
      type,
      pyqExam: data.pyqExam || undefined,
      pyqYear: typeof data.pyqYear === "number" ? data.pyqYear : undefined,
      pyqMonth: data.pyqMonth || undefined,
      pyqQuestionNumber: data.pyqQuestionNumber || undefined,
    };
  };

  // The AI's metadata is filled in straight away (no separate approve step);
  // the teacher checks it in the panel above Save. Inside a test/DPP the
  // subject comes from the section and the chapter must be in the syllabus.
  const handleApplySuggestedMetadata = async () => {
    if (!aiSuggestedMetadata) return;

    const appliedSubject = mode === "bank" ? aiSuggestedMetadata.subject || subject : subject;
    const allowed = (syllabus ?? []).filter((s) => sameName(s.subject, appliedSubject));
    let appliedChapter = aiSuggestedMetadata.chapter || chapter;
    let appliedTopic = aiSuggestedMetadata.topic || topic;
    if (allowed.length > 0) {
      const match = allowed.find((s) => sameName(s.chapter, appliedChapter));
      // One chapter in the syllabus: it is that chapter, whatever the AI says.
      const entry = match ?? (allowed.length === 1 ? allowed[0] : undefined);
      appliedChapter = entry?.chapter ?? "";
      if (entry && entry.topics.length > 0) {
        appliedTopic = entry.topics.find((t) => sameName(t, appliedTopic)) ?? "";
      }
    }
    const appliedSubTopic = appliedTopic ? aiSuggestedMetadata.subTopic || subTopic : "";

    if (mode === "bank" && aiSuggestedMetadata.subject) setSubject(aiSuggestedMetadata.subject);
    setChapter(appliedChapter);
    setTopic(appliedTopic);
    setSubTopic(appliedSubTopic);
    if (aiSuggestedMetadata.difficulty) setDifficulty(aiSuggestedMetadata.difficulty);
    if (aiSuggestedMetadata.type) setQuestionType(aiSuggestedMetadata.type);
    // A printed "NEET 2019" / "AIPMT 2007" / "JEE Main …" tag → PYQ details.
    if (aiSuggestedMetadata.pyqExam && aiSuggestedMetadata.pyqYear) {
      setPyqExam(aiSuggestedMetadata.pyqExam);
      setPyqYear(String(aiSuggestedMetadata.pyqYear));
      if (aiSuggestedMetadata.pyqMonth) setPyqMonth(aiSuggestedMetadata.pyqMonth);
      if (aiSuggestedMetadata.pyqQuestionNumber) setPyqQuestionNumber(aiSuggestedMetadata.pyqQuestionNumber);
      setCategory(
        aiSuggestedMetadata.pyqExam === "NEET" ? "NEET_PYQ" : aiSuggestedMetadata.pyqExam === "JEE_MAINS" ? "JEE_MAINS_PYQ" : "JEE_ADVANCED_PYQ"
      );
    }
    setLastAiSuggestion({ ...aiSuggestedMetadata, chapter: appliedChapter, topic: appliedTopic, subTopic: appliedSubTopic });
    setMetadataConfirmed(false);
    setMetadataFromAi(true);

    setMissingFieldErrors((prev) => {
      const next = { ...prev };
      delete next.subject;
      delete next.chapter;
      delete next.topic;
      return next;
    });

    // Auto-persist suggested topic/subtopic to database catalog
    if (appliedSubject && appliedChapter && appliedTopic) {
      try {
        const res = await fetch("/api/team/ai-questions/taxonomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: appliedSubject,
            chapter: appliedChapter,
            topicTitle: appliedTopic,
            subtopics: appliedSubTopic ? [appliedSubTopic] : [],
          }),
        });
        const json = await res.json();
        if (json.success && json.data?.topic) {
          const tData = json.data.topic;
          setTopicsList((prev) => {
            const exists = prev.some((t) => t.title.toLowerCase() === tData.title.toLowerCase());
            if (!exists) {
              return [...prev, { id: tData.id, title: tData.title, subtopics: tData.subtopics || [] }];
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn("[Taxonomy] Auto-persist suggested taxonomy warning:", err);
      }
    }

    toast.info("AI filled the metadata — check it at the bottom before saving.");
    setAiSuggestedMetadata(null);
  };

  useEffect(() => {
    if (aiSuggestedMetadata) void handleApplySuggestedMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSuggestedMetadata]);

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

  // 1. Reference / Source Screenshot (Editor Verification Only — NEVER shown to students/PDF)
  const initialRefImg =
    initialQuestion?.referenceImageUrl ||
    initialQuestion?.assets?.find((a: any) => a.type === "REFERENCE")?.publicUrl ||
    null;
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(initialRefImg);
  const [isRefImgZoomed, setIsRefImgZoomed] = useState<boolean>(false);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // 2. Question Content Diagram / Figure (Genuine Diagram — Student Facing)
  // An image that is the reference screenshot is not a diagram: an old upload
  // bug copied the screenshot into imageUrl, and it showed here as "Student
  // Facing" (students never got it — every student page and the PDF drop it).
  // Saving the question now clears it.
  const referenceUrls = new Set<string>(
    [initialRefImg, ...(initialQuestion?.assets ?? []).filter((a: any) => a.type === "REFERENCE").map((a: any) => a.publicUrl)].filter(Boolean)
  );
  const initialDiag =
    [
      initialQuestion?.assets?.find((a: any) => a.type === "DIAGRAM" || a.type === "FIGURE")?.publicUrl,
      initialQuestion?.imageUrl,
      initialQuestion?.figureUrl,
    ].find((u: string | null | undefined) => u && !referenceUrls.has(u)) || null;
  const [diagramUrl, setDiagramUrl] = useState<string | null>(initialDiag);
  const [isDiagramZoomed, setIsDiagramZoomed] = useState<boolean>(false);

  // 3. Dedicated Solution Diagram / Image (Independent from Question Diagram)
  const initialSolImg =
    initialQuestion?.solutionImageUrl ||
    initialQuestion?.assets?.find((a: any) => a.type === "SOLUTION")?.publicUrl ||
    null;
  const [solutionImageUrl, setSolutionImageUrl] = useState<string | null>(initialSolImg);
  const [isUploadingSolImg, setIsUploadingSolImg] = useState<boolean>(false);
  const [isSolutionImgZoomed, setIsSolutionImgZoomed] = useState<boolean>(false);
  const solutionFileInputRef = useRef<HTMLInputElement>(null);

  // 4. CamDraw Vector Structure State
  const [camDrawData, setCamDrawData] = useState<any>(initialQuestion?.camDrawData || null);
  const [isCamDrawModalOpen, setIsCamDrawModalOpen] = useState<boolean>(false);

  // 4. AI PIPELINE STATES
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isGeneratingSolution, setIsGeneratingSolution] = useState<boolean>(false);
  const [aiRecommendedAnswer, setAiRecommendedAnswer] = useState<string | null>(null);
  const [answerMismatchWarning, setAnswerMismatchWarning] = useState<string | null>(null);

  // Save State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(initialQuestion?.questionCode || null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(questionId || initialQuestion?.id || null);
  const [isAutoDraftSaved, setIsAutoDraftSaved] = useState<boolean>(Boolean(questionId || initialQuestion?.id));

  useEffect(() => {
    const effectiveId = questionId || initialQuestion?.id || null;
    if (effectiveId) {
      setCurrentDraftId(effectiveId);
    }
    if (initialQuestion?.questionCode) {
      setGeneratedCode(initialQuestion.questionCode);
    }
  }, [questionId, initialQuestion?.id, initialQuestion?.questionCode]);
  const [aiCostInfo, setAiCostInfo] = useState<{
    costPaise: number;
    isFreeTier: boolean;
    tier: "FREE" | "PAID";
    keyMasked: string;
    totalTokens: number;
    inputTokens?: number;
    outputTokens?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Upload file to /api/upload and return permanent public/relative URL
  const uploadImageFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || json.error || "Failed to upload image.");
    }
    return json.data?.url || null;
  };

  // Helper: In-field image paste handler for Textareas & Inputs (Options, Solution)
  const handleFieldImagePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        const file = item.getAsFile();
        if (!file) return;

        const target = e.currentTarget;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const origVal = target.value;

        const toastId = toast.loading("Uploading pasted image...");
        try {
          const url = await uploadImageFile(file);
          if (url) {
            const markdownImg = `\n![60%](${url})\n`;
            const newVal = origVal.slice(0, start) + markdownImg + origVal.slice(end);
            setter(newVal);
            toast.success("Image embedded (default 60% width)!", { id: toastId });
          } else {
            toast.error("Could not obtain image URL.", { id: toastId });
          }
        } catch (err: any) {
          toast.error(err.message || "Failed to upload image.", { id: toastId });
        }
        return;
      }
    }
  };

  // Helper: Statement Paste Handler (Pasted images are embedded directly into statement markdown; no auto-extract hijacking)
  const handleStatementFieldPaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    _lang: "ENGLISH" | "HINDI",
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    // 1. Check for image in clipboard -> Directly upload & embed as markdown in statement field
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith("image/")) {
          e.preventDefault();
          e.stopPropagation();
          const file = item.getAsFile();
          if (!file) return;

          const target = e.currentTarget;
          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? target.value.length;
          const origVal = target.value;

          const toastId = toast.loading("Uploading pasted image to statement...");
          try {
            const url = await uploadImageFile(file);
            if (url) {
              const markdownImg = `\n![60%](${url})\n`;
              const newVal = origVal.slice(0, start) + markdownImg + origVal.slice(end);
              setter(newVal);
              toast.success("Image embedded into statement!", { id: toastId });
            } else {
              toast.error("Could not obtain image URL.", { id: toastId });
            }
          } catch (err: any) {
            toast.error(err.message || "Failed to upload image.", { id: toastId });
          }
          return;
        }
      }
    }
    // Normal text pasting continues natively into the textarea without overwriting other fields.
  };

  // Auto-Draft Ingestion Helper (Guarantees zero data loss as soon as question is generated/extracted)
  const triggerAutoDraft = async (extracted: any, imgUrl?: string | null, source = "DIRECT_OCR") => {
    try {
      const res = await fetch("/api/team/questions/auto-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingQuestionId: currentDraftId || (questionId ? questionId : undefined),
          statementEn: extracted.statementEn || "",
          statementHi: extracted.statementHi || "",
          optionsEn: extracted.optionsEn || { A: optionAEn, B: optionBEn, C: optionCEn, D: optionDEn },
          optionsHi: extracted.optionsHi || { A: optionAHi, B: optionBHi, C: optionCHi, D: optionDHi },
          correctAnswer: extracted.correctAnswer || [correctOption || "A"],
          solutionEn: extracted.solutionEn || "",
          solutionHi: extracted.solutionHi || "",
          subject: extracted.subject || subject || "Biology",
          chapter: extracted.chapter || chapter || "",
          topic: extracted.topic || topic || "",
          subTopic: extracted.subTopic || subTopic || "",
          difficulty: extracted.difficulty || difficulty || "MEDIUM",
          type: extracted.type || questionType || "SINGLE_CORRECT",
          referenceImageUrl: imgUrl || referenceImageUrl || undefined,
          figureUrl: diagramUrl || null,
          solutionImageUrl: solutionImageUrl || undefined,
          source,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.questionId) {
        setCurrentDraftId(json.data.questionId);
        if (json.data.questionCode) {
          setGeneratedCode(json.data.questionCode);
        }
        setIsAutoDraftSaved(true);
        toast.success(`⚡ Auto-saved to AI Drafts (#${json.data.questionCode || json.data.questionId})!`, {
          duration: 3500,
        });
      }
    } catch (e) {
      console.warn("[Auto-Draft] Background save note:", e);
    }
  };

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
          // No guessing: the first chapter of the subject used to be picked
          // here, so questions landed in unrelated chapters. Only a syllabus
          // with exactly one chapter for this subject decides it.
          const own = (syllabus ?? []).filter((s) => sameName(s.subject, subject));
          if (!chapter && own.length === 1 && own[0]) setChapter(own[0].chapter);
        }
      } catch {
        toast.error("Failed to load NCERT chapters for subject.");
      }
    };

    fetchChapters();
  }, [subject]);

  // What the metadata panel offers. With a syllabus (test/DPP) only its
  // chapters for this subject — and only the listed topics when the chapter
  // names some; without one, the subject's whole catalog.
  const syllabusForSubject = (syllabus ?? []).filter((s) => sameName(s.subject, subject));
  const chapterOptions =
    syllabusForSubject.length > 0
      ? syllabusForSubject.map((s) => chaptersList.find((c) => sameName(c.title, s.chapter))?.title ?? s.chapter)
      : chaptersList.map((c) => c.title);
  const syllabusChapter = syllabusForSubject.find((s) => sameName(s.chapter, chapter));
  const topicOptions =
    syllabusChapter && syllabusChapter.topics.length > 0
      ? syllabusChapter.topics.map((t) => topicsList.find((x) => sameName(x.title, t)) ?? { title: t, subtopics: [] })
      : topicsList;

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
        }
      } catch {
        toast.error("Failed to load topics for chapter.");
      }
    };

    fetchTopics();
  }, [subject, chapter]);

  // Helper: Solution Image Paste & Upload (Strictly for Solution area)
  const handlePasteSolutionImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select or paste an image file (PNG, JPG, WebP) for the solution.");
      return;
    }

    setIsUploadingSolImg(true);
    const toastId = toast.loading("Uploading solution reference figure...");
    try {
      const url = await uploadImageFile(file);
      if (url) {
        setSolutionImageUrl(url);
        toast.success("Solution Reference Image attached to Solution area!", { id: toastId });
      } else {
        toast.error("Could not obtain image URL.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload solution image.", { id: toastId });
    } finally {
      setIsUploadingSolImg(false);
    }
  };

  const handlePasteSolutionFromClipboardButton = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "solution_screenshot.png", { type: imageType });
          await handlePasteSolutionImage(file);
          return;
        }
      }
      toast.info("No image found in clipboard. Please copy a screenshot first or click Browse.");
    } catch {
      toast.error("Clipboard access not allowed. You can press Ctrl+V directly or use Browse.");
    }
  };

  // D. Global Paste (Ctrl+V) handler with strict Section Context Awareness
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // If user is focused inside an input or textarea, let the field handle image pasting or normal typing
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA";
      if (isInput) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Detect if user is interacting with / focused on / hovering over the Solution section
      const isSolutionTarget = Boolean(
        activeEl?.closest?.('[data-section="solution"]') ||
        (activeEl as HTMLElement)?.dataset?.section === "solution" ||
        document.querySelector('[data-section="solution"]:hover')
      );

      // 1. Check for image in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            if (isSolutionTarget) {
              handlePasteSolutionImage(file);
            } else {
              handleImageUploadAndExtract(file);
            }
          }
          return;
        }
      }

      // 2. Check for text in clipboard (only for Question section, not solution)
      if (!isSolutionTarget) {
        const text = e.clipboardData.getData("text");
        if (text && text.trim().length > 30) {
          e.preventDefault();
          handleTextAutoExtract(text.trim());
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [subject, chapter, topic, difficulty]);

  // E. Automatic Image OCR Extraction (No manual button click needed)
  const handleImageUploadAndExtract = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }

    setIsExtracting(true);
    const toastId = toast.loading("Uploading image & executing all-in-one extraction...");

    try {
      // 1. Upload file first to get clean short URL (e.g. /uploads/questions/q_xxx.png)
      let shortUrl: string | null = null;
      try {
        shortUrl = await uploadImageFile(file);
        if (shortUrl) {
          setReferenceImageUrl(shortUrl);
        }
      } catch (uploadErr) {
        console.warn("Upload warning, proceeding with extraction:", uploadErr);
      }

      // 2. Read image as base64 for multimodal extraction
      const base64Url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_extract",
          payload: {
            imageBase64: base64Url,
            mimeType: file.type,
            subject: subject || "Biology",
            chapter: chapter || "",
            topic: topic || "",
            // The paper's chapters: the AI picks one of these. No level
            // hint — it judges the difficulty from the question.
            allowedChapters: syllabusForSubject.length ? chapterOptions : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(typeof json.error === "string" ? json.error : json.error?.message || "Extraction failed.");
      }

      const data = json.data?.result;
      if (!data) throw new Error("No data returned from extraction.");

      // Populate fields for both languages simultaneously
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

      // Capture AI-suggested metadata for teacher approval
      if (data.subject || data.chapter || data.topic) {
        setAiSuggestedMetadata(toSuggestion(data));
      }

      // Record AI Cost in Paise
      if (data.costEstimate) {
        setAiCostInfo(data.costEstimate);
      }

      // INSTANT AUTO-DRAFT: Save with short URL
      triggerAutoDraft(data, shortUrl || base64Url, "DIRECT_OCR");
      toast.success("✨ Extracted, translated & solved in 1 call!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Unable to extract this content. Please review or retry.", { id: toastId });
    } finally {
      setIsExtracting(false);
    }
  };

  // F. Automatic Text Extraction
  const handleTextAutoExtract = async (rawText: string) => {
    setIsExtracting(true);
    const toastId = toast.loading("Parsing text, translating & solving in 1 call...");

    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_extract",
          payload: {
            rawText,
            subject: subject || "Biology",
            chapter: chapter || "",
            topic: topic || "",
            // The paper's chapters: the AI picks one of these. No level
            // hint — it judges the difficulty from the question.
            allowedChapters: syllabusForSubject.length ? chapterOptions : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(typeof json.error === "string" ? json.error : json.error?.message || "Text extraction failed.");
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

      if (data.solutionEn) setSolutionEn(data.solutionEn);
      if (data.solutionHi) setSolutionHi(data.solutionHi);

      if (data.subject || data.chapter || data.topic) {
        setAiSuggestedMetadata(toSuggestion(data));
      }

      if (data.costEstimate) {
        setAiCostInfo(data.costEstimate);
      }

      // INSTANT AUTO-DRAFT: Save to database immediately
      triggerAutoDraft(data, null, "DIRECT_TEXT");
      toast.success("✨ Text parsed, translated & classified in 1 call!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Unable to parse this text. Please review.", { id: toastId });
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
        throw new Error(typeof json.error === "string" ? json.error : json.error?.message || "Translation check failed.");
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

  // H. Action: SUBJECT-AWARE SOLUTION GENERATION (Inbuilt AI Solution Assistant)
  const handleGenerateSolution = async (customPrompt?: string) => {
    if (!statementEn && !statementHi) {
      toast.error("Please enter a question statement first.");
      return;
    }

    setIsGeneratingSolution(true);
    toast.info(`Generating ${subject} 4-part authoritative solution...`);

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
            customInstruction: customPrompt ?? solutionRefinePrompt,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(typeof json.error === "string" ? json.error : json.error?.message || "Solution generation failed.");
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
          toast.success("Solution generated successfully in 4-part format!");
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

    // The metadata panel above Save must have been checked (✓ Confirm).
    if (!errors.chapter && !errors.topic && !metadataConfirmed) errors.metadata = true;

    if (Object.keys(errors).length > 0) {
      setMissingFieldErrors(errors);
      const missingNames = [];
      if (errors.subject) missingNames.push("Subject");
      if (errors.chapter) missingNames.push("Chapter");
      if (errors.topic) missingNames.push("Topic");
      if (errors.statement) missingNames.push("Question Statement");
      if (errors.options) missingNames.push("All 4 Options (A, B, C, D)");
      if (errors.correctOption) missingNames.push("Correct Answer");
      if (errors.metadata) missingNames.push("Metadata check (✓ Confirm metadata)");

      if (errors.subject || errors.chapter || errors.topic || errors.metadata) {
        metadataPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast.error(`Please complete before saving: ${missingNames.join(", ")}`);
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
        pyqExam: pyqExam || undefined,
        pyqYear: pyqExam && pyqYear ? parseInt(pyqYear, 10) : undefined,
        pyqMonth: pyqExam === "JEE_MAINS" ? pyqMonth : undefined,
        pyqQuestionNumber: pyqExam && pyqQuestionNumber ? pyqQuestionNumber.trim() : undefined,
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
        figureUrl: diagramUrl || null,
        referenceImageUrl: referenceImageUrl || undefined,
        solutionImageUrl: solutionImageUrl || undefined,
        camDrawData: camDrawData || undefined,
        dppId,
        testSectionId,
        order,
        slotNumber,
        isPublished: false,
        status: submitToReview ? "REVIEW_1" : "DRAFT",
      };

      let res;
      const targetId = questionId || currentDraftId || initialQuestion?.id;
      if (targetId) {
        res = await fetch("/api/team/questions/engine", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: targetId, ...payload }),
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
      if (savedQ?.id) {
        setCurrentDraftId(savedQ.id);
      }
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
      }

      // Automatically advance to the next question slot in test / DPP mode
      if (mode !== "bank" && onNext) {
        if (slotNumber < totalSlots) {
          onNext();
        } else {
          toast.success("All question slots completed!");
        }
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
    <div className="space-y-3.5 select-none font-sans pb-20">
      {/* Question code only — the metadata is checked at the bottom, above Save. */}
      <div className="flex items-center justify-end">
        <QuestionIdBadge questionCode={generatedCode} subjectName={subject} isSaving={isSaving} />
      </div>

      {/* DEDICATED SLIDING METADATA DRAWER / POPUP */}
      <QuestionMetadataDrawer
        isOpen={isMetadataDrawerOpen}
        onClose={() => setIsMetadataDrawerOpen(false)}
        subject={subject}
        setSubject={setSubject}
        chapter={chapter}
        setChapter={setChapter}
        topic={topic}
        setTopic={setTopic}
        subTopic={subTopic}
        setSubTopic={setSubTopic}
        questionType={questionType}
        setQuestionType={setQuestionType}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        category={category}
        setCategory={setCategory}
        pyqExam={pyqExam}
        setPyqExam={setPyqExam}
        pyqYear={pyqYear}
        setPyqYear={setPyqYear}
        pyqMonth={pyqMonth}
        setPyqMonth={setPyqMonth}
        pyqQuestionNumber={pyqQuestionNumber}
        setPyqQuestionNumber={setPyqQuestionNumber}
        marks={marks}
        setMarks={setMarks}
        negativeMarks={negativeMarks}
        setNegativeMarks={setNegativeMarks}
        subjectsList={subjectsList}
        chaptersList={chaptersList}
        topicsList={topicsList}
        missingFieldErrors={missingFieldErrors}
        onSaveNewTopic={handleSaveNewTopic}
        onSaveNewSubtopic={handleSaveNewSubtopic}
        isSavingTaxonomy={isSavingTaxonomy}
      />

      {/* 3. AUTO-EXTRACT DROP & PASTE ZONE (Section 4 — No Manual Click Needed) */}
      <div
        data-section="question"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleImageUploadAndExtract(file);
        }}
        className="bg-blue-50 border border-blue-200/80 rounded-3xl p-5 shadow-sm space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Auto-Extract Question (Paste Screenshot or Drop Image)
              </h4>
              <p className="text-[11px] text-slate-500">
                Press <strong className="text-blue-700 font-mono">Ctrl + V</strong> anywhere on this screen to paste an image or raw text. Extraction begins automatically!
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
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Browse Image</span>
            </button>
          </div>
        </div>

        {/* Live Extraction Active State */}
        {isExtracting && (
          <div className="p-4 rounded-2xl bg-white border border-blue-200 shadow-sm flex items-center gap-3 animate-in fade-in">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
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
      {/* 3. PROMINENT QUESTION REFERENCE SCREENSHOT DOCK (Editor Verification Only) */}
      {referenceImageUrl && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200/80 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
                <ImageIcon className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                    Source / Reference Screenshot
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950 font-bold">
                    Editor Only
                  </span>
                </div>
                <p className="text-[10px] text-amber-700">
                  Visible to teacher/admin for verification. Will NOT appear on student tests, reviews, or PDF exports.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsRefImgZoomed(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="View Full Size"
              >
                <ZoomIn className="w-3 h-3" />
                <span className="hidden sm:inline">Zoom</span>
              </button>
              <button
                type="button"
                onClick={() => refFileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="Replace Reference Image"
              >
                <Upload className="w-3 h-3" />
                <span className="hidden sm:inline">Replace</span>
              </button>
              <button
                type="button"
                onClick={() => setReferenceImageUrl(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="Remove Reference Image"
              >
                <XCircle className="w-3 h-3" />
                <span className="hidden sm:inline">Remove</span>
              </button>
              <input
                type="file"
                ref={refFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const toastId = toast.loading("Uploading reference screenshot...");
                    try {
                      const url = await uploadImageFile(file);
                      if (url) {
                        setReferenceImageUrl(url);
                        toast.success("Reference screenshot updated!", { id: toastId });
                      }
                    } catch (err: any) {
                      toast.error(err.message || "Failed to upload reference image.", { id: toastId });
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center p-2 bg-white/80 rounded-xl border border-amber-200/80 max-h-48 overflow-hidden">
            <img
              src={referenceImageUrl}
              alt="Source Screenshot"
              className="max-h-44 object-contain rounded-lg shadow-xs cursor-pointer hover:scale-102 transition"
              onClick={() => setIsRefImgZoomed(true)}
            />
          </div>
        </div>
      )}

      {/* 3A. CAMDRAW UNIVERSAL STRUCTURE ENGINE DOCK */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm text-white space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  CamDraw Vector Structure
                </h4>
                {camDrawData?.elements?.length > 0 ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    {camDrawData.elements.length} Vector Elements Active
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    No Structure Attached
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Vector academic diagrams render with high fidelity in Student Test, Review &amp; PDF exports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {referenceImageUrl && (
              <button
                type="button"
                onClick={() => setIsCamDrawModalOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Recreate with CamDraw</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCamDrawModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{camDrawData?.elements?.length > 0 ? "Edit in CamDraw" : "Open CamDraw Editor"}</span>
            </button>

            {camDrawData?.elements?.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCamDrawData(null);
                  toast.info("CamDraw structure detached.");
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition"
                title="Remove Structure"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Live Vector Preview inside Question Editor */}
        {camDrawData?.elements?.length > 0 ? (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center relative group">
            <CamDrawRenderer document={camDrawData} theme="dark" maxWidth={600} maxHeight={280} />
            <button
              type="button"
              onClick={() => setIsCamDrawModalOpen(true)}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-xs font-extrabold text-white backdrop-blur-[2px] rounded-xl"
            >
              <Compass className="w-4 h-4" />
              <span>Click to Edit in CamDraw Studio</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-center">
            <p className="text-xs text-slate-500">
              No chemical structure or scientific vector attached. Click &quot;Open CamDraw Editor&quot; or &quot;Recreate with CamDraw&quot; to build or recognize structures from reference image.
            </p>
          </div>
        )}
      </div>

      {/* CAMDRAW FULL INTERACTIVE STUDIO MODAL */}
      {isCamDrawModalOpen && (
        <CamDrawEditor
          initialDocument={camDrawData}
          referenceImageUrl={referenceImageUrl}
          hintSubject={subject}
          onSave={(newDoc) => {
            setCamDrawData(newDoc);
            setIsCamDrawModalOpen(false);
            toast.success("CamDraw structure attached to question!");
          }}
          onClose={() => setIsCamDrawModalOpen(false)}
        />
      )}

      {/* FULLSCREEN REFERENCE IMAGE MODAL */}
      {isRefImgZoomed && referenceImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsRefImgZoomed(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-4 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-black uppercase text-slate-800">Source / Reference Screenshot Full Size</h3>
              <button
                type="button"
                onClick={() => setIsRefImgZoomed(false)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg font-bold"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex items-center justify-center overflow-auto max-h-[75vh]">
              <img src={referenceImageUrl} alt="Zoomed Reference Screenshot" className="max-h-[70vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* 3B. GENUINE QUESTION DIAGRAM DOCK (Student Facing — Optional) */}
      {diagramUrl && (
        <div className="bg-white border border-blue-200 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-100 text-blue-700">
                <ImageIcon className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Question Content Figure / Diagram
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                    Student Facing
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Genuine diagram/figure required as part of the question content.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsDiagramZoomed(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="View Full Size"
              >
                <ZoomIn className="w-3 h-3" />
                <span className="hidden sm:inline">Zoom</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="Replace Diagram"
              >
                <Upload className="w-3 h-3" />
                <span className="hidden sm:inline">Replace</span>
              </button>
              <button
                type="button"
                onClick={() => setDiagramUrl(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="Remove Diagram"
              >
                <XCircle className="w-3 h-3" />
                <span className="hidden sm:inline">Remove</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const toastId = toast.loading("Uploading question figure...");
                    try {
                      const url = await uploadImageFile(file);
                      if (url) {
                        setDiagramUrl(url);
                        toast.success("Question diagram uploaded!", { id: toastId });
                      }
                    } catch (err: any) {
                      toast.error(err.message || "Failed to upload diagram.", { id: toastId });
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-200/80 max-h-48 overflow-hidden">
            <img
              src={diagramUrl}
              alt="Question Diagram"
              className="max-h-44 object-contain rounded-lg shadow-xs cursor-pointer hover:scale-102 transition"
              onClick={() => setIsDiagramZoomed(true)}
            />
          </div>
        </div>
      )}

      {/* FULLSCREEN DIAGRAM MODAL */}
      {isDiagramZoomed && diagramUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsDiagramZoomed(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-4 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-black uppercase text-slate-800">Question Diagram Full Size</h3>
              <button
                type="button"
                onClick={() => setIsDiagramZoomed(false)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg font-bold"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex items-center justify-center overflow-auto max-h-[75vh]">
              <img src={diagramUrl} alt="Zoomed Diagram" className="max-h-[70vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* 4. DUAL COLUMN BILINGUAL WORKSPACE (Section 2 — Clean Question & Options) */}
      <div className="space-y-3">
        {/* Section 2 Header Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              2. Question Statement &amp; Options
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
              हिंदी + English
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckTranslation}
              disabled={isTranslating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold text-blue-800 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isTranslating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>Sync Translation &amp; Alignment</span>
            </button>
          </div>
        </div>

        {/* SIDE-BY-SIDE CLEAN COLUMNS (Only Statements & Options) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* COLUMN 1: HINDI (हिंदी) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                  हिंदी (Hindi)
                </span>
                <button
                  type="button"
                  onClick={handleCheckTranslation}
                  disabled={isTranslating || (!statementHi && !statementEn)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-900 transition disabled:opacity-40 cursor-pointer"
                  title="Translate Hindi content to English"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>→ English</span>
                </button>
              </div>
              <FormulaInsertToolbar
                onInsert={(snippet) => setStatementHi((prev) => (prev ? prev + " " + snippet : snippet))}
              />
            </div>

            {/* Statement Hi */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                प्रश्न कथन (Statement in Hindi)
              </label>
              <textarea
                rows={3}
                placeholder="हिंदी में प्रश्न कथन यहाँ लिखें या इमेज पेस्ट करें (Ctrl+V)..."
                value={statementHi}
                onChange={(e) => setStatementHi(e.target.value)}
                onPaste={(e) => handleStatementFieldPaste(e, "HINDI", setStatementHi)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-900 outline-none resize-none leading-relaxed focus:bg-white focus:border-blue-500 transition"
              />
              {statementHi.trim() && (
                <EquationLivePreview
                  content={statementHi}
                  label="हिंदी प्रश्न पूर्वावलोकन"
                  alwaysShow={true}
                  className="mt-1.5"
                />
              )}
            </div>

            {/* Hindi Options A, B, C, D */}
            <div className="space-y-2">
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
                    className={`p-2.5 rounded-xl border transition ${
                      isSelected
                        ? "bg-emerald-50/90 border-emerald-500 shadow-xs"
                        : "bg-slate-50 border-slate-200 focus-within:bg-white focus-within:border-blue-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectCorrectOption(opt.key)}
                        title={`Select (${opt.key}) as correct answer`}
                        className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white text-slate-600 border border-slate-300 hover:border-emerald-400"
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : opt.key}
                      </button>

                      <input
                        type="text"
                        placeholder={`विकल्प (${opt.key}) हिंदी पाठ या Ctrl+V इमेज...`}
                        value={opt.val}
                        onChange={(e) => opt.setVal(e.target.value)}
                        onPaste={(e) => handleFieldImagePaste(e, opt.setVal)}
                        className="flex-1 bg-transparent text-xs text-slate-900 font-medium outline-none"
                      />
                    </div>
                    {opt.val.trim() && (
                      <EquationLivePreview
                        content={opt.val}
                        label={`विकल्प (${opt.key})`}
                        alwaysShow={true}
                        className="mt-1.5"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMN 2: ENGLISH */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-full">
                  English
                </span>
                <button
                  type="button"
                  onClick={handleCheckTranslation}
                  disabled={isTranslating || (!statementHi && !statementEn)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[10px] font-bold text-blue-900 transition disabled:opacity-40 cursor-pointer"
                  title="Translate English content to Hindi"
                >
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>→ Hindi</span>
                </button>
              </div>
              <FormulaInsertToolbar
                onInsert={(snippet) => setStatementEn((prev) => (prev ? prev + " " + snippet : snippet))}
              />
            </div>

            {/* Statement En */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Question Statement (English)
              </label>
              <textarea
                rows={3}
                placeholder="Write question statement in English or paste image (Ctrl+V)..."
                value={statementEn}
                onChange={(e) => setStatementEn(e.target.value)}
                onPaste={(e) => handleStatementFieldPaste(e, "ENGLISH", setStatementEn)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-900 outline-none resize-none leading-relaxed focus:bg-white focus:border-blue-500 transition"
              />
              {statementEn.trim() && (
                <EquationLivePreview
                  content={statementEn}
                  label="English Statement Preview"
                  alwaysShow={true}
                  className="mt-1.5"
                />
              )}
            </div>

            {/* English Options A, B, C, D */}
            <div className="space-y-2">
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
                    className={`p-2.5 rounded-xl border transition ${
                      isSelected
                        ? "bg-emerald-50/90 border-emerald-500 shadow-xs"
                        : "bg-slate-50 border-slate-200 focus-within:bg-white focus-within:border-blue-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSelectCorrectOption(opt.key)}
                        title={`Select (${opt.key}) as correct answer`}
                        className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white text-slate-600 border border-slate-300 hover:border-emerald-400"
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : opt.key}
                      </button>

                      <input
                        type="text"
                        placeholder={`Option (${opt.key}) English text or Ctrl+V image...`}
                        value={opt.val}
                        onChange={(e) => opt.setVal(e.target.value)}
                        onPaste={(e) => handleFieldImagePaste(e, opt.setVal)}
                        className="flex-1 bg-transparent text-xs text-slate-900 font-medium outline-none"
                      />
                    </div>
                    {opt.val.trim() && (
                      <EquationLivePreview
                        content={opt.val}
                        label={`Option (${opt.key})`}
                        alwaysShow={true}
                        className="mt-1.5"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. DEDICATED BILINGUAL SOLUTION STUDIO (Inbuilt AI Assistant & Regenerator) */}
      <div
        data-section="solution"
        className="bg-white border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
      >
        {/* Solution Header & Regenerate Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                3. Step-by-Step Bilingual Solution Studio
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-bold">
                Concept • Solution • Final Answer
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Authoritative step-by-step solution. Inbuilt AI regenerator &amp; separate solution reference available below.
            </p>
          </div>

          {/* Inbuilt AI Regenerate Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleGenerateSolution()}
              disabled={isGeneratingSolution}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingSolution ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Regenerate Solution</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inbuilt AI Assistant Prompt Bar */}
        <div className="p-3 rounded-xl bg-slate-50 border border-blue-100 space-y-2">
          <div className="flex items-center gap-2">
            <Wand2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800">
              AI Solution Prompt / Refinement:
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="e.g. 'Show full algebraic derivation', 'Explain why Option B is incorrect'..."
              value={solutionRefinePrompt}
              onChange={(e) => setSolutionRefinePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGenerateSolution(solutionRefinePrompt);
                }
              }}
              className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:border-blue-500 transition"
            />
            <button
              type="button"
              onClick={() => handleGenerateSolution(solutionRefinePrompt)}
              disabled={isGeneratingSolution}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {isGeneratingSolution ? "Generating..." : "Apply Prompt"}
            </button>
          </div>
        </div>

        {/* Answer Mismatch Conflict Alert */}
        {answerMismatchWarning && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
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
              className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold hover:bg-amber-700 transition"
            >
              Use Option ({aiRecommendedAnswer})
            </button>
          </div>
        )}

        {/* DEDICATED SOLUTION DIAGRAM / FIGURE DOCK (Strictly Separated from Question Reference) */}
        <div
          data-section="solution"
          tabIndex={0}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handlePasteSolutionImage(file);
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item && item.type.startsWith("image/")) {
                e.preventDefault();
                e.stopPropagation();
                const file = item.getAsFile();
                if (file) handlePasteSolutionImage(file);
                return;
              }
            }
          }}
          className="bg-slate-50 hover:bg-slate-50/90 border-2 border-dashed border-blue-200/90 focus:border-blue-500 rounded-xl p-3.5 space-y-2.5 transition outline-none"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <ImageIcon className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Solution Reference / Working Diagram
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold">
                    Solution Only
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Separated from Question screenshot. Paste (Ctrl+V), drop or browse image for Solution only.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handlePasteSolutionFromClipboardButton}
                disabled={isUploadingSolImg}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                title="Paste screenshot directly from clipboard into solution"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Paste Screenshot</span>
              </button>

              <input
                type="file"
                ref={solutionFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handlePasteSolutionImage(file);
                    if (solutionFileInputRef.current) solutionFileInputRef.current.value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={() => solutionFileInputRef.current?.click()}
                disabled={isUploadingSolImg}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>
                  {isUploadingSolImg
                    ? "Uploading..."
                    : solutionImageUrl
                    ? "Replace Figure"
                    : "Browse Figure"}
                </span>
              </button>

              {solutionImageUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsSolutionImgZoomed(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                    title="Zoom Full Size"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span className="hidden sm:inline">Zoom</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSolutionImageUrl(null)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                    title="Remove Figure"
                  >
                    <XCircle className="w-3 h-3" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {solutionImageUrl && (
            <div className="flex items-center justify-center p-2 bg-white rounded-lg border border-slate-200 max-h-48 overflow-hidden">
              <img
                src={solutionImageUrl}
                alt="Solution Figure"
                className="max-h-44 object-contain rounded-md shadow-xs cursor-pointer hover:scale-102 transition"
                onClick={() => setIsSolutionImgZoomed(true)}
              />
            </div>
          )}
        </div>

        {/* FULLSCREEN SOLUTION DIAGRAM MODAL */}
        {isSolutionImgZoomed && solutionImageUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsSolutionImgZoomed(false)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-4 shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-black uppercase text-slate-800">
                  Solution Figure Full Size
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSolutionImgZoomed(false)}
                  className="p-1 text-slate-400 hover:text-slate-800 rounded-lg font-bold"
                >
                  ✕ Close
                </button>
              </div>
              <div className="flex items-center justify-center overflow-auto max-h-[75vh]">
                <img
                  src={solutionImageUrl}
                  alt="Zoomed Solution Figure"
                  className="max-h-[70vh] object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* SIDE-BY-SIDE SOLUTION TEXTAREAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Hindi Solution Card */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                हिंदी हल (Hindi Solution)
              </span>
              <FormulaInsertToolbar
                onInsert={(snippet) => setSolutionHi((prev) => (prev ? prev + " " + snippet : snippet))}
              />
            </div>
            <textarea
              rows={4}
              placeholder="कथन : ... \n\nसिद्धांत : ... \n\nहल : ... \n\nअंतिम उत्तर : विकल्प (...)"
              value={solutionHi}
              onChange={(e) => setSolutionHi(e.target.value)}
              onPaste={(e) => handleFieldImagePaste(e, setSolutionHi)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-900 outline-none resize-none leading-relaxed font-mono focus:bg-white focus:border-blue-500 transition"
            />
            {solutionHi.trim() && (
              <EquationLivePreview
                content={solutionHi}
                label="हिंदी समाधान पूर्वावलोकन"
                alwaysShow={true}
                className="mt-1.5"
              />
            )}
          </div>

          {/* English Solution Card */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-full">
                English Solution (Detailed Derivation)
              </span>
              <FormulaInsertToolbar
                onInsert={(snippet) => setSolutionEn((prev) => (prev ? prev + " " + snippet : snippet))}
              />
            </div>
            <textarea
              rows={4}
              placeholder="Explaining : ... \n\nConcept : ... \n\nSolution : ... \n\nFinal Answer : Option (...)"
              value={solutionEn}
              onChange={(e) => setSolutionEn(e.target.value)}
              onPaste={(e) => handleFieldImagePaste(e, setSolutionEn)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-900 outline-none resize-none leading-relaxed font-mono focus:bg-white focus:border-blue-500 transition"
            />
            {solutionEn.trim() && (
              <EquationLivePreview
                content={solutionEn}
                label="English Solution Preview"
                alwaysShow={true}
                className="mt-1.5"
              />
            )}
          </div>
        </div>
      </div>

      {/* METADATA — last thing before Save */}
      <QuestionMetadataPanel
        ref={metadataPanelRef}
        slotLabel={mode === "bank" ? undefined : `Q.${slotNumber}`}
        subject={subject}
        chapter={chapter}
        setChapter={setChapter}
        topic={topic}
        setTopic={setTopic}
        subTopic={subTopic}
        setSubTopic={setSubTopic}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        questionType={questionType}
        setQuestionType={setQuestionType}
        marks={marks}
        setMarks={setMarks}
        negativeMarks={negativeMarks}
        setNegativeMarks={setNegativeMarks}
        chapterOptions={chapterOptions}
        topicOptions={topicOptions}
        syllabusLocked={syllabusForSubject.length > 0}
        fromAi={metadataFromAi}
        confirmed={metadataConfirmed}
        onConfirm={() => {
          if (!chapter.trim() || !topic.trim()) {
            setMissingFieldErrors((prev) => ({ ...prev, chapter: !chapter.trim(), topic: !topic.trim() }));
            toast.error("Choose the chapter and topic first.");
            return;
          }
          setMissingFieldErrors((prev) => {
            const next = { ...prev };
            delete next.chapter;
            delete next.topic;
            delete next.metadata;
            return next;
          });
          setMetadataConfirmed(true);
        }}
        missing={missingFieldErrors}
        onMore={() => setIsMetadataDrawerOpen(true)}
        onAddTopic={(title) => void handleSaveNewTopic(title)}
        isSavingTaxonomy={isSavingTaxonomy}
        aiDetected={
          lastAiSuggestion
            ? {
                chapter: lastAiSuggestion.chapter,
                topic: lastAiSuggestion.topic,
                subTopic: lastAiSuggestion.subTopic,
                difficulty: lastAiSuggestion.difficulty,
                type: lastAiSuggestion.type,
                pyq: lastAiSuggestion.pyqExam && lastAiSuggestion.pyqYear ? `${lastAiSuggestion.pyqExam.replace("_", " ")} ${lastAiSuggestion.pyqYear}` : undefined,
              }
            : null
        }
        pyqLabel={pyqExam ? `${pyqExam.replace("_", " ")} ${pyqYear}${pyqMonth && pyqExam === "JEE_MAINS" ? ` ${pyqMonth}` : ""}` : null}
        onClearPyq={() => {
          setPyqExam("");
          setCategory("NCERT Canonical");
        }}
      />

      {/* 5. STICKY BOTTOM ACTION BAR (Save & Slot Navigation) */}
      <footer className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 mt-4">
        {/* Left Side: Navigation, Cancel or Delete */}
        <div className="flex items-center gap-2 flex-wrap">
          {mode === "bank" ? (
            <button
              type="button"
              onClick={() => router.push(onCancelHref)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={slotNumber <= 1}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs disabled:opacity-40 transition cursor-pointer"
              >
                ← Prev Slot
              </button>
              <span className="text-xs font-mono font-bold text-slate-600 px-1">
                Slot {slotNumber} / {totalSlots}
              </span>
            </div>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition active:scale-95 disabled:opacity-40 cursor-pointer ml-1 sm:ml-2"
              title="Delete question and clear this slot"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Question</span>
            </button>
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
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-500/25 transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? "Saving..."
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
              className="px-4 py-2 rounded-xl bg-[#0c3ea4] hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-40 cursor-pointer"
            >
              Next Slot →
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
