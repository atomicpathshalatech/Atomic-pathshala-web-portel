"use client";
import {
  AlertCircle,
  ArrowLeft,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardList,
  History,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MathText } from "@/components/ai-chat/MathText";
import type {
  QuizConfigEntry,
  QuizAnswer,
  QuizQuestion,
  QuizSubject,
  QuizLevel,
  QuestionType,
} from "@/lib/ai-chat/quiz";
import { QUESTION_TYPE_LABELS } from "@/lib/ai-chat/quiz";
import { PYQ_AVAILABLE_YEARS } from "@/lib/ai-chat/pyqBank";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { NCERT_CHAPTERS } from "@/lib/ai-chat/ncertChapters";

type QuizStage =
  | "modeSelect"
  | "subjectForm"
  | "topicForm"
  | "pyqForm"
  | "ncertForm"
  | "loading"
  | "active"
  | "summary"
  | "review";
type QuizLanguage = "english" | "hindi" | "hinglish";
type PyqSubjectOption = "Biology" | "Physics" | "Chemistry";

interface SubjectTally {
  subject: string;
  correct: number;
  wrong: number;
  unattempted: number;
}
interface QuizModeProps {
  onClose: () => void;
}
const SUBJECT_OPTIONS: { value: QuizSubject; label: string }[] = [
  { value: "Biology", label: "Biology Quiz (20 Q)" },
  { value: "Physics", label: "Physics Quiz (10 Q)" },
  { value: "Chemistry", label: "Chemistry Quiz (10 Q)" },
  { value: "Full NEET", label: "Full NEET Quiz (40 Q)" },
];
const LANGUAGE_OPTIONS: { value: QuizLanguage; label: string }[] = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
];
const LEVEL_OPTIONS: { value: QuizLevel; label: string }[] = [
  { value: "Easy", label: "Easy" },
  { value: "Medium", label: "Medium" },
  { value: "Hard", label: "Hard" },
  { value: "Mixed", label: "Mixed" },
];
const TOPIC_SUBJECT_OPTIONS: { value: Exclude<QuizSubject, "Full NEET">; label: string }[] = [
  { value: "Biology", label: "Biology" },
  { value: "Physics", label: "Physics" },
  { value: "Chemistry", label: "Chemistry" },
];
const PYQ_SUBJECT_OPTIONS: { value: PyqSubjectOption; label: string }[] = [
  { value: "Biology", label: "Biology" },
  { value: "Physics", label: "Physics" },
  { value: "Chemistry", label: "Chemistry" },
];
const FORMAT_OPTIONS: { value: QuestionType | ""; label: string }[] = [
  { value: "", label: "Auto Mix (recommended)" },
  ...(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((key) => ({
    value: key,
    label: QUESTION_TYPE_LABELS[key],
  })),
];
const PDF_PAGE_PX = 1080;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function generateQuizId() {
  const sixDigits = Math.floor(100000 + Math.random() * 900000);
  return String(sixDigits);
}
async function waitForImages(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
    )
  );
}
function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function QuestionExtras({
  question,
  variant,
}: {
  question: QuizQuestion;
  variant: "screen" | "pdf";
}) {
  const isPdf = variant === "pdf";
  const textStyle = isPdf ? { fontSize: "14.5px", lineHeight: 1.6 } : undefined;
  const textClass = isPdf ? undefined : "text-sm leading-relaxed";

  const hasColumns = Boolean(question.columnI?.length && question.columnII?.length);
  const hasTable = Boolean(question.tableHeaders?.length && question.tableRows?.length);
  const hasStatements = Boolean(question.statements?.length);
  const hasSequence = Boolean(question.sequenceItems?.length);
  const hasFlowchart = Boolean(question.flowchartSteps?.length);
  const hasImage = Boolean(question.imageRequired);
  const hasPassage = Boolean(question.passage?.trim());
    const hasAssertionReason = Boolean(question.assertionText?.trim() && question.reasonText?.trim());

  return (
    <>
      {hasPassage && (
        <div
          style={isPdf ? { ...textStyle, fontStyle: "italic", padding: "8px 12px", border: "1px solid #cbd5e1", marginBottom: "8px" } : undefined}
          className={isPdf ? undefined : "mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm italic dark:border-slate-700 dark:bg-slate-800"}
        >
          <MathText text={question.passage ?? ""} />
        </div>
      )}

            {hasAssertionReason && (
        <div style={isPdf ? { marginBottom: "8px" } : undefined} className={isPdf ? undefined : "mb-3 space-y-2"}>
          <div style={textStyle} className={textClass}>
            <strong>Assertion (A): </strong>
            <MathText text={question.assertionText ?? ""} />
          </div>
          <div style={textStyle} className={textClass}>
            <strong>Reason (R): </strong>
            <MathText text={question.reasonText ?? ""} />
          </div>
        </div>
      )}

      {hasImage && (
        <div
          style={
            isPdf
              ? { border: "1px dashed #94a3b8", padding: "10px 12px", marginBottom: "8px", fontSize: "13px", color: "#475569" }
              : undefined
          }
          className={isPdf ? undefined : "mb-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800"}
        >
          <strong>Diagram/Figure: </strong>
          {question.imageDescription || "Refer to the figure described above."}
        </div>
      )}

      {hasFlowchart && (
        <div style={isPdf ? { marginBottom: "8px" } : undefined} className={isPdf ? undefined : "mb-3"}>
          {question.flowchartSteps!.map((step, idx) => (
            <div key={idx} style={textStyle} className={textClass}>
              {idx > 0 && <span style={isPdf ? { display: "block", textAlign: "center" } : undefined} className={isPdf ? undefined : "block text-center text-slate-400"}>↓</span>}
              <MathText text={step} />
            </div>
          ))}
        </div>
      )}

      {hasSequence && (
        <div
          style={isPdf ? { paddingLeft: "12px", marginBottom: "8px" } : undefined}
          className={isPdf ? undefined : "mb-3 space-y-1 pl-3"}
        >
          {question.sequenceItems!.map((item) => (
            <div key={item.label} style={textStyle} className={textClass}>
              <strong>({item.label})</strong> <MathText text={item.text} />
            </div>
          ))}
        </div>
      )}

      {hasStatements && (
        <div
          style={isPdf ? { paddingLeft: "12px", marginBottom: "8px" } : undefined}
          className={isPdf ? undefined : "mb-3 space-y-1 pl-3"}
        >
          {question.statements!.map((statement, idx) => (
            <div key={idx} style={textStyle} className={textClass}>
              <MathText text={statement} />
            </div>
          ))}
        </div>
      )}

      {hasColumns && (
        <table
          style={isPdf ? { width: "100%", borderCollapse: "collapse", marginBottom: "8px" } : undefined}
          className={isPdf ? undefined : "mb-3 mt-1 w-full border-collapse text-sm"}
        >
          <thead>
            <tr>
              <th style={isPdf ? { textAlign: "left", fontSize: "14px", padding: "3px 10px 3px 0" } : undefined} className={isPdf ? undefined : "px-1 pb-1 text-left text-xs font-semibold text-slate-500"}>
                Column-I
              </th>
              <th style={isPdf ? { textAlign: "left", fontSize: "14px", padding: "3px 0" } : undefined} className={isPdf ? undefined : "px-1 pb-1 text-left text-xs font-semibold text-slate-500"}>
                Column-II
              </th>
              {question.columnIII?.length ? (
                <th style={isPdf ? { textAlign: "left", fontSize: "14px", padding: "3px 0" } : undefined} className={isPdf ? undefined : "px-1 pb-1 text-left text-xs font-semibold text-slate-500"}>
                  Column-III
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {question.columnI!.map((item, idx) => {
              const right = question.columnII?.[idx];
              const third = question.columnIII?.[idx];
              return (
                <tr key={item.label}>
                  <td style={isPdf ? { ...textStyle, padding: "3px 10px 3px 0", verticalAlign: "top" } : undefined} className={isPdf ? undefined : "px-1 py-1 align-top text-sm"}>
                    <strong>({item.label})</strong> <MathText text={item.text} />
                  </td>
                  <td style={isPdf ? { ...textStyle, padding: "3px 10px 3px 0", verticalAlign: "top" } : undefined} className={isPdf ? undefined : "px-1 py-1 align-top text-sm"}>
                    {right && (
                      <>
                        <strong>({right.label})</strong> <MathText text={right.text} />
                      </>
                    )}
                  </td>
                  {question.columnIII?.length ? (
                    <td style={isPdf ? { ...textStyle, padding: "3px 0", verticalAlign: "top" } : undefined} className={isPdf ? undefined : "px-1 py-1 align-top text-sm"}>
                      {third && (
                        <>
                          <strong>({third.label})</strong> <MathText text={third.text} />
                        </>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {hasTable && (
        <table
          style={isPdf ? { width: "100%", borderCollapse: "collapse", marginBottom: "8px", border: "1px solid #cbd5e1" } : undefined}
          className={isPdf ? undefined : "mb-3 mt-1 w-full border-collapse border border-slate-200 text-sm dark:border-slate-700"}
        >
          <thead>
            <tr>
              <th
                style={isPdf ? { fontSize: "14px", padding: "4px 6px", border: "1px solid #cbd5e1" } : undefined}
                className={isPdf ? undefined : "border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700"}
              >
                Option
              </th>
              {question.tableHeaders!.map((header, idx) => (
                <th
                  key={idx}
                  style={isPdf ? { fontSize: "14px", padding: "4px 6px", border: "1px solid #cbd5e1" } : undefined}
                  className={isPdf ? undefined : "border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700"}
                >
                  <MathText text={header} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {question.tableRows!.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td
                  style={isPdf ? { fontSize: "14px", padding: "4px 6px", border: "1px solid #cbd5e1", fontWeight: 700 } : undefined}
                  className={isPdf ? undefined : "border border-slate-200 px-2 py-1 text-xs font-semibold dark:border-slate-700"}
                >
                  ({rowIdx + 1})
                </td>
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    style={isPdf ? { fontSize: "14px", padding: "4px 6px", border: "1px solid #cbd5e1" } : undefined}
                    className={isPdf ? undefined : "border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"}
                  >
                    <MathText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function PdfQuestionBlock({
  q,
  globalIndex,
  column,
  spacerPx,
}: {
  q: QuizQuestion;
  globalIndex: number;
  column: "left" | "right";
  spacerPx: number;
}) {
  return (
    <div data-qid={q.id} data-col={column} style={{ marginTop: spacerPx, marginBottom: "20px" }}>
      <div style={{ display: "flex", gap: "6px", fontSize: "15px", lineHeight: 1.6 }}>
        <strong>{globalIndex}.</strong>
        <div style={{ flex: 1 }}>
          <MathText text={q.text} />
          <QuestionExtras question={q} variant="pdf" />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: q.options.every((opt) => opt.length <= 18) ? "1fr 1fr" : "1fr",
          columnGap: "10px",
          rowGap: "5px",
          marginTop: "6px",
          fontSize: "14.5px",
          paddingLeft: "18px",
        }}
      >
        {q.options.map((opt, i) => (
          <div key={i}>
            <MathText text={`(${i + 1}) ${opt}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuizMode({ onClose }: QuizModeProps) {
  const [stage, setStage] = useState<QuizStage>("modeSelect");
  const [subject, setSubject] = useState<QuizSubject>("Biology");
  const [quizLanguage, setQuizLanguage] = useState<QuizLanguage>("english");
  const [subjectLevel, setSubjectLevel] = useState<QuizLevel>("Medium");
  const [subjectFormat, setSubjectFormat] = useState<QuestionType | "">("");
  const [topicSubject, setTopicSubject] =
    useState<Exclude<QuizSubject, "Full NEET">>("Biology");
  const [topicText, setTopicText] = useState("");
  const [customTopicText, setCustomTopicText] = useState("");
  const [topicLanguage, setTopicLanguage] = useState<QuizLanguage>("english");
  const [topicLevel, setTopicLevel] = useState<QuizLevel>("Medium");
  const [topicFormat, setTopicFormat] = useState<QuestionType | "">("");
  const [topicQuestionCount, setTopicQuestionCount] = useState(10);
  const [pyqSubject, setPyqSubject] = useState<PyqSubjectOption>("Biology");
  const [pyqYear, setPyqYear] = useState<string>("all");
  const [pyqQuestionCount, setPyqQuestionCount] = useState(10);
  const [ncertSubject, setNcertSubject] = useState<"Biology" | "Physics" | "Chemistry">("Biology");
  const [ncertChapter, setNcertChapter] = useState<string>("");
  const [ncertLanguage, setNcertLanguage] = useState<QuizLanguage>("english");
  const [ncertLevel, setNcertLevel] = useState<QuizLevel>("Medium");
  const [ncertFormat, setNcertFormat] = useState<QuestionType | "">("");
  const [ncertQuestionCount, setNcertQuestionCount] = useState(15);
  const [ncertSearchQuery, setNcertSearchQuery] = useState("");
  const [activeLevel, setActiveLevel] = useState<QuizLevel>("Medium");
  const [activeChapter, setActiveChapter] = useState<string | undefined>(undefined);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [entries, setEntries] = useState<QuizConfigEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByIndex, setAnswersByIndex] = useState<Record<number, QuizAnswer>>({});
  const [totalRemaining, setTotalRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [testName, setTestName] = useState("");
  const [quizId, setQuizId] = useState("");
  const [pdfSpacers, setPdfSpacers] = useState<Record<string, number>>({});
  const resultSubmittedRef = useRef(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const currentQuestion = questions[currentIndex] ?? null;
  const isLastQuestion = currentIndex === questions.length - 1;

  const orderedAnswers = useMemo<QuizAnswer[]>(
    () =>
      questions.map(
        (q, idx) =>
          answersByIndex[idx] ?? {
            questionId: q.id,
            selectedIndex: null,
            correct: false,
            timeTakenSeconds: 0,
          }
      ),
    [questions, answersByIndex]
  );

  const runQuizRequest = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      setStage("loading");
      setError(null);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await response.json()) as {
          questions?: QuizQuestion[];
          entries?: QuizConfigEntry[];
          error?: string;
        };
        if (!response.ok || !data.questions || !data.entries) {
          setError(data.error ?? "Could not generate the quiz. Please try again.");
          setStage("modeSelect");
          return;
        }
        setQuestions(data.questions);
        setEntries(data.entries);
        setAnswersByIndex({});
        setCurrentIndex(0);
        const totalSeconds = data.entries.reduce(
          (sum, entry) => sum + entry.questionCount * entry.timerSeconds,
          0
        );
        setTotalRemaining(totalSeconds);
        setStage("active");
      } catch {
        setError("Network error. Please try again.");
        setStage("modeSelect");
      }
    },
    []
  );
  const startSubjectQuiz = useCallback(() => {
    resultSubmittedRef.current = false;
    setTestName(subject);
    setQuizId(generateQuizId());
    setActiveLevel(subjectLevel);
    setActiveChapter(undefined);
    void runQuizRequest("/api/ai-chat/quiz", {
      subject,
      language: quizLanguage,
      level: subjectLevel,
      format: subjectFormat || undefined,
    });
  }, [quizLanguage, runQuizRequest, subject, subjectLevel, subjectFormat]);
  const startTopicQuiz = useCallback(() => {
    if (!topicText.trim()) {
      setError("Please select a chapter.");
      return;
    }
    resultSubmittedRef.current = false;
    const finalTopic = customTopicText.trim()
      ? `${topicText.trim()} - ${customTopicText.trim()}`
      : topicText.trim();
    setTestName(`${topicSubject} - ${finalTopic}`);
    setQuizId(generateQuizId());
    setActiveLevel(topicLevel);
    setActiveChapter(topicText.trim());
    void runQuizRequest("/api/ai-chat/quiz", {
      subject: topicSubject,
      language: topicLanguage,
      topic: finalTopic,
      questionCount: topicQuestionCount,
      level: topicLevel,
      format: topicFormat || undefined,
    });
  }, [
    runQuizRequest,
    topicLanguage,
    topicQuestionCount,
    topicSubject,
    topicText,
    topicLevel,
    customTopicText,
    topicFormat,
  ]);
  const startPyqQuiz = useCallback(() => {
    resultSubmittedRef.current = false;
    const yearLabel = pyqYear === "all" ? "All Years" : pyqYear;
    setTestName(`NEET PYQ - ${pyqSubject} (${yearLabel})`);
    setQuizId(generateQuizId());
    setActiveLevel("Hard");
    setActiveChapter(undefined);
    void runQuizRequest("/api/ai-chat/quiz/pyq", {
      subject: pyqSubject,
      years: pyqYear === "all" ? undefined : [Number(pyqYear)],
      questionCount: pyqQuestionCount,
    });
  }, [runQuizRequest, pyqSubject, pyqYear, pyqQuestionCount]);

  const startNcertQuiz = useCallback(() => {
    if (!ncertChapter.trim()) {
      setError("Please select an NCERT chapter to practice.");
      return;
    }
    resultSubmittedRef.current = false;
    const testTitle = `NCERT Practice - ${ncertSubject}: ${ncertChapter}`;
    setTestName(testTitle);
    setQuizId(generateQuizId());
    setActiveLevel(ncertLevel);
    setActiveChapter(ncertChapter.trim());
    void runQuizRequest("/api/ai-chat/quiz", {
      subject: ncertSubject,
      language: ncertLanguage,
      topic: ncertChapter.trim(),
      questionCount: ncertQuestionCount,
      level: ncertLevel,
      format: ncertFormat || undefined,
    });
  }, [
    runQuizRequest,
    ncertSubject,
    ncertChapter,
    ncertLanguage,
    ncertQuestionCount,
    ncertLevel,
    ncertFormat,
  ]);

  const saveAttempt = useCallback(
    async (finalAnswers: QuizAnswer[]) => {
      const correct = finalAnswers.filter((a) => a.correct).length;
      const wrong = finalAnswers.filter((a) => a.selectedIndex !== null && !a.correct).length;
      const unattempted = finalAnswers.filter((a) => a.selectedIndex === null).length;
      const score = correct * 4 - wrong * 1;
      const attempted = correct + wrong;
      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
      const timeTakenSec = finalAnswers.reduce((sum, a) => sum + a.timeTakenSeconds, 0);
      const subjectSet = new Set(questions.map((q) => q.subject));
      const attemptSubjectLabel = subjectSet.size === 1 ? Array.from(subjectSet)[0] : "Full NEET";
      const topicMap = new Map<string, { topic: string; subject: string; correct: number; wrong: number; unattempted: number }>();
      finalAnswers.forEach((answer, index) => {
        const question = questions[index];
        if (!question) return;
        const topicKey = question.topic?.trim() || question.subject;
        const entry =
          topicMap.get(topicKey) ??
          { topic: topicKey, subject: question.subject, correct: 0, wrong: 0, unattempted: 0 };
        if (answer.selectedIndex === null) entry.unattempted += 1;
        else if (answer.correct) entry.correct += 1;
        else entry.wrong += 1;
        topicMap.set(topicKey, entry);
      });
      try {
        await fetch("/api/ai-chat/quiz/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: attemptSubjectLabel,
            topic: topicText.trim() || undefined,
            totalQuestions: finalAnswers.length,
            correct,
            wrong,
            unattempted,
            score,
            accuracy,
            timeTakenSec,
            breakdown: { topics: Array.from(topicMap.values()) },
          }),
        });
      } catch {
        // Dashboard stats can catch up next time; don't block the summary screen.
      }
    },
    [questions, topicText]
  );

  const selectOption = useCallback(
    (optionIndex: number) => {
      if (!currentQuestion) return;
      setAnswersByIndex((prev) => ({
        ...prev,
        [currentIndex]: {
          questionId: currentQuestion.id,
          selectedIndex: optionIndex,
          correct: optionIndex === currentQuestion.correctIndex,
          timeTakenSeconds: 0,
        },
      }));
    },
    [currentQuestion, currentIndex]
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
  }, [questions.length]);

  const submitQuiz = useCallback(() => {
    setStage("summary");
  }, []);

  useEffect(() => {
    if (stage !== "active") return;

    if (totalRemaining <= 0) {
      setStage("summary");
      return;
    }

    const timer = window.setTimeout(() => setTotalRemaining((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [totalRemaining, stage]);

  const score = useMemo(() => {
    const correct = orderedAnswers.filter((a) => a.correct).length;
    const wrong = orderedAnswers.filter((a) => a.selectedIndex !== null && !a.correct).length;
    const unattempted = orderedAnswers.filter((a) => a.selectedIndex === null).length;
    const marks = correct * 4 - wrong * 1;
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    return { correct, wrong, unattempted, marks, accuracy, total: orderedAnswers.length };
  }, [orderedAnswers]);

  const performanceLabel = useMemo(() => {
    if (score.accuracy >= 85) return "Excellent";
    if (score.accuracy >= 65) return "Good";
    if (score.accuracy >= 40) return "Average";
    return "Needs Improvement";
  }, [score.accuracy]);

  const subjectResults = useMemo(() => {
    const map = new Map<string, SubjectTally>();
    orderedAnswers.forEach((answer, index) => {
      const question = questions[index];
      if (!question) return;
      const entry = map.get(question.subject) ?? {
        subject: question.subject,
        correct: 0,
        wrong: 0,
        unattempted: 0,
      };
      if (answer.selectedIndex === null) entry.unattempted += 1;
      else if (answer.correct) entry.correct += 1;
      else entry.wrong += 1;
      map.set(question.subject, entry);
    });
    return Array.from(map.values()).map((entry) => ({
      ...entry,
      score: entry.correct * 4 - entry.wrong * 1,
      maxScore: (entry.correct + entry.wrong + entry.unattempted) * 4,
    }));
  }, [orderedAnswers, questions]);

  const subjectLabel = useMemo(() => {
    const subjects = Array.from(new Set(questions.map((q) => q.subject)));
    if (subjects.length === 0) return "General";
    if (subjects.length === 1) return subjects[0];
    return `Full NEET (${subjects.join(", ")})`;
  }, [questions]);
  const chapterLabel = useMemo(() => activeChapter || "Full Syllabus", [activeChapter]);
  const topicLabel = useMemo(() => {
    const topics = Array.from(
      new Set(questions.map((q) => q.topic).filter((t): t is string => Boolean(t?.trim())))
    );
    if (topics.length === 0) return "Various Topics";
    if (topics.length === 1) return topics[0];
    return "Multiple Topics";
  }, [questions]);
  const durationLabel = useMemo(() => {
    const totalSeconds = entries.reduce((sum, e) => sum + e.questionCount * e.timerSeconds, 0);
    const minutes = Math.round(totalSeconds / 60);
    return `${minutes} minutes`;
  }, [entries]);
  const totalMarks = questions.length * 4;

  const computeAndApplySpacers = useCallback(async () => {
    if (!questionsRef.current) return;

    setPdfSpacers({});
    await nextFrame();

    const container = questionsRef.current;
    const containerTop = container.getBoundingClientRect().top;

    const computeForColumn = (columnName: "left" | "right") => {
      const blocks = Array.from(
        container.querySelectorAll<HTMLElement>(`[data-col="${columnName}"]`)
      );
      const spacers: Record<string, number> = {};
      let extraOffset = 0;

      for (const block of blocks) {
        const rect = block.getBoundingClientRect();
        const top = rect.top - containerTop + extraOffset;
        const height = rect.height;
        const bottom = top + height;

        const pageIndexTop = Math.floor(top / PDF_PAGE_PX);
        const pageIndexBottom = Math.floor((bottom - 1) / PDF_PAGE_PX);

        if (pageIndexBottom > pageIndexTop && height < PDF_PAGE_PX) {
          const nextPageStart = (pageIndexTop + 1) * PDF_PAGE_PX;
          const needed = Math.ceil(nextPageStart - top);
          const qid = block.getAttribute("data-qid") || "";
          if (qid) spacers[qid] = needed;
          extraOffset += needed;
        }
      }

      return spacers;
    };

    const leftSpacers = computeForColumn("left");
    const rightSpacers = computeForColumn("right");

    setPdfSpacers({ ...leftSpacers, ...rightSpacers });
    await nextFrame();
  }, []);

  const downloadReviewPdf = useCallback(async () => {
    if (!coverRef.current || !questionsRef.current || !resultsRef.current) return;
    setIsGeneratingPdf(true);
    setError(null);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const renderSectionOnNewPages = async (el: HTMLElement) => {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      };

      await waitForImages(coverRef.current);
      const coverCanvas = await html2canvas(coverRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      pdf.addImage(coverCanvas.toDataURL("image/png"), "PNG", 0, 0, pageWidth, pageHeight);

      await computeAndApplySpacers();
      await renderSectionOnNewPages(questionsRef.current);

      await renderSectionOnNewPages(resultsRef.current);

      const idPart = quizId || generateQuizId();
      const chapterPart = (chapterLabel || "Full Syllabus").trim();
      const topicPart = (topicLabel || "General").trim();

      pdf.save(`Quiz-${idPart} : ${chapterPart}(${topicPart})-Atomic_Pathshala.pdf`);
    } catch (err) {
      alert("PDF Error: " + String(err));
      setError("Could not generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
      setPdfSpacers({});
    }
  }, [testName, quizId, chapterLabel, topicLabel, computeAndApplySpacers]);

  useEffect(() => {
    if (stage !== "summary" || resultSubmittedRef.current || subjectResults.length === 0) return;
    resultSubmittedRef.current = true;
    void saveAttempt(orderedAnswers);
    void fetch("/api/ai-chat/quiz-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testName: testName || "Quiz", results: subjectResults }),
    }).catch(() => {
      // Result saving is best-effort; it must not block showing the summary screen.
    });
  }, [stage, subjectResults, testName, saveAttempt, orderedAnswers]);

  const selectedIndexForCurrent = answersByIndex[currentIndex]?.selectedIndex ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-atomic-navy">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #quiz-review-printable,
          #quiz-review-printable * {
            visibility: visible;
          }
          #quiz-review-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 16px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <header className="no-print flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <p className="text-sm font-semibold text-atomic-orange">NEET Quiz</p>
      </header>

      {/* Hidden cover page — captured for PDF export only */}
      <div
        ref={coverRef}
        style={{
          position: "fixed",
          top: 0,
          left: "-10000px",
          width: "794px",
          minHeight: "1123px",
          backgroundColor: "#ffffff",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#1a1a1a",
          padding: "48px 56px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <h1
            style={{
              fontSize: "40px",
              fontWeight: 700,
              letterSpacing: "2px",
              margin: 0,
              color: "#0f172a",
            }}
          >
            ATOMIC PATHSHALA
          </h1>
          <img
            src="/atomic-logo.png"
            alt="Atomic Pathshala"
            crossOrigin="anonymous"
            style={{ width: "110px", height: "auto", margin: "24px auto 0", display: "block" }}
          />
        </div>
        <div style={{ marginTop: "56px", border: "1.5px solid #cbd5e1", borderRadius: "4px" }}>
          {[
            ["Quiz ID", quizId || "—"],
            ["Quiz Name", testName || "NEET Practice Quiz"],
            ["Subject", subjectLabel],
            ["Chapter", chapterLabel],
            ["Topic", topicLabel],
            ["Total Questions", String(questions.length)],
            ["Total Marks", String(totalMarks)],
          ].map(([label, value], idx) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "14px 24px",
                borderBottom: idx === 6 ? "none" : "1px solid #e2e8f0",
                fontSize: "15px",
              }}
            >
              <span style={{ fontWeight: 600, color: "#334155" }}>{label}</span>
              <span style={{ color: "#0f172a" }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: "48px", left: 0, right: 0 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "48px" }}>
            <div style={{ textAlign: "center" }}>
              <img
                src="/telegram-qr.png"
                alt="Telegram QR"
                crossOrigin="anonymous"
                style={{ width: "110px", height: "110px", margin: "0 auto", display: "block" }}
              />
              <p style={{ marginTop: "8px", fontSize: "12px", color: "#475569" }}>
                Join us on Telegram
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <img
                src="/AP-YT-QR-CODE.png"
                alt="YouTube QR"
                crossOrigin="anonymous"
                style={{ width: "110px", height: "110px", margin: "0 auto", display: "block" }}
              />
              <p style={{ marginTop: "8px", fontSize: "12px", color: "#475569" }}>
                Subscribe on YouTube
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden PDF: QUESTIONS */}
      <div
        ref={questionsRef}
        style={{
          position: "fixed",
          top: 0,
          left: "-10000px",
          width: "794px",
          backgroundColor: "#ffffff",
          fontFamily: '"Times New Roman", Times, serif',
          color: "#111111",
          padding: "36px 44px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px solid #000000",
            paddingBottom: "10px",
            marginBottom: "24px",
          }}
        >
          <img src="/atomic-logo.png" alt="Atomic Pathshala" style={{ height: "38px" }} />
          <p style={{ fontStyle: "italic", fontWeight: 700, fontSize: "15px", margin: 0 }}>
            {testName || "Practice Paper"}
          </p>
        </div>
        {Array.from(new Set(questions.map((q) => q.subject))).map((subjectName) => {
          const subjectQuestions = questions
            .map((q, idx) => ({ ...q, globalIndex: idx + 1 }))
            .filter((q) => q.subject === subjectName);
          const mid = Math.ceil(subjectQuestions.length / 2);
          const leftColumn = subjectQuestions.slice(0, mid);
          const rightColumn = subjectQuestions.slice(mid);
          return (
            <div key={subjectName} style={{ marginBottom: "8px" }}>
              <h2
                style={{
                  textAlign: "center",
                  fontSize: "21px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  borderBottom: "1px solid #000000",
                  paddingBottom: "6px",
                  marginBottom: "18px",
                  letterSpacing: "1px",
                }}
              >
                {subjectName}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "28px" }}>
                <div style={{ borderRight: "1px solid #cccccc", paddingRight: "14px" }}>
                  {leftColumn.map((q) => (
                    <PdfQuestionBlock
                      key={q.id}
                      q={q}
                      globalIndex={q.globalIndex}
                      column="left"
                      spacerPx={pdfSpacers[q.id] ?? 0}
                    />
                  ))}
                </div>
                <div style={{ paddingLeft: "14px" }}>
                  {rightColumn.map((q) => (
                    <PdfQuestionBlock
                      key={q.id}
                      q={q}
                      globalIndex={q.globalIndex}
                      column="right"
                      spacerPx={pdfSpacers[q.id] ?? 0}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hidden PDF: ANSWER KEY + SOLUTIONS */}
      <div
        ref={resultsRef}
        style={{
          position: "fixed",
          top: 0,
          left: "-10000px",
          width: "794px",
          backgroundColor: "#ffffff",
          fontFamily: '"Times New Roman", Times, serif',
          color: "#111111",
          padding: "36px 44px",
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            fontSize: "21px",
            fontWeight: 700,
            textAlign: "center",
            textTransform: "uppercase",
            borderBottom: "1px solid #000000",
            paddingBottom: "6px",
            marginBottom: "18px",
            letterSpacing: "1px",
          }}
        >
          Answer Key
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "8px",
            fontSize: "15px",
            marginBottom: "28px",
          }}
        >
          {questions.map((q, i) => (
            <div key={q.id}>
              {i + 1}. ({q.correctIndex + 1})
            </div>
          ))}
        </div>

        <h2
          style={{
            fontSize: "21px",
            fontWeight: 700,
            textAlign: "center",
            textTransform: "uppercase",
            borderBottom: "1px solid #000000",
            paddingBottom: "6px",
            marginBottom: "18px",
            letterSpacing: "1px",
          }}
        >
          Solutions
        </h2>
                {questions.map((q, i) => (
          <div key={q.id} style={{ marginBottom: "16px", fontSize: "15px", lineHeight: 1.6 }}>
            <p style={{ fontWeight: 700, margin: "0 0 3px" }}>
              {i + 1}. Correct Answer: ({q.correctIndex + 1})
            </p>
            {q.explanationSteps?.length ? (
              <ol style={{ paddingLeft: "18px", margin: 0 }}>
                {q.explanationSteps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: "3px" }}>
                    <MathText text={step} />
                  </li>
                ))}
              </ol>
            ) : (
              <MathText text={q.explanation} />
            )}
          </div>
        ))}
      </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
        {stage === "modeSelect" && (
          <div className="mx-auto w-full max-w-md">
            <h1 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">NEET Quiz</h1>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              Choose how you want to practice.
            </p>

            {error && (
              <p className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setStage("subjectForm")}
                className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-left shadow-md transition hover:brightness-105 active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    NEET Quiz (Full Syllabus)
                  </p>
                  <p className="text-xs text-white/80">
                    Subject-wise or full NEET timed test
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStage("topicForm")}
                className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-left shadow-md transition hover:brightness-105 active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                  <BookMarked className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Topic-wise Quiz
                  </p>
                  <p className="text-xs text-white/80">
                    Practice a specific chapter or topic only
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStage("pyqForm")}
                className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 p-4 text-left shadow-md transition hover:brightness-105 active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    PYQ Practice
                  </p>
                  <p className="text-xs text-white/80">
                    Real NEET previous year questions, by year and subject
                  </p>
                </div>
              </button>

              {/* 4. NCERT Chapterwise Question Practice Card */}
              <button
                type="button"
                onClick={() => {
                  setNcertChapter(NCERT_CHAPTERS[ncertSubject]?.[0] || "");
                  setStage("ncertForm");
                }}
                className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 text-left shadow-md transition hover:brightness-105 active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    NCERT Chapterwise Question Practice
                  </p>
                  <p className="text-xs text-white/80">
                    Line-by-line NCERT questions &amp; concept drill for Class 11 &amp; 12
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {stage === "subjectForm" && (
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={() => setStage("modeSelect")}
              className="mb-4 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-atomic-orange hover:bg-orange-50 hover:text-atomic-orange active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-orange-950/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <h1 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">
              NEET Quiz (Full Syllabus)
            </h1>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
              Choose a subject to begin your timed practice test.
            </p>
            <div className="mb-4 space-y-2">
              {SUBJECT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSubject(option.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                    subject === option.value
                      ? "border-atomic-orange bg-orange-50 text-atomic-orange dark:bg-orange-950/20"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="mb-5 block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Language</span>
              <select
                value={quizLanguage}
                onChange={(event) => setQuizLanguage(event.target.value as QuizLanguage)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
              >
                {LANGUAGE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-5 block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Difficulty Level</span>
              <select
                value={subjectLevel}
                onChange={(event) => setSubjectLevel(event.target.value as QuizLevel)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
              >
                {LEVEL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-5 block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Question Format</span>
              <select
                value={subjectFormat}
                onChange={(event) => setSubjectFormat(event.target.value as QuestionType | "")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
              >
                {FORMAT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <p className="mb-1 font-semibold">Rules</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Correct answer = +4, Wrong answer = -1, Unattempted = 0</li>
                <li>Results are shown only after you submit the test</li>
                <li>Use Previous/Next to move freely between questions</li>
                <li>Timer auto-submits when time runs out</li>
                <li>Biology: 60s/question, Physics &amp; Chemistry: 90s/question</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={startSubjectQuiz}
              className="w-full rounded-xl bg-atomic-orange px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-atomic-orange-dark"
            >
              Start Quiz
            </button>
          </div>
        )}

        {stage === "topicForm" && (
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={() => setStage("modeSelect")}
              className="mb-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-atomic-orange"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <h1 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">Topic-wise Quiz</h1>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Practice a specific chapter or topic only.
            </p>
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Language</span>
                <select
                  value={topicLanguage}
                  onChange={(event) => setTopicLanguage(event.target.value as QuizLanguage)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  {LANGUAGE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Subject</span>
                <select
                  value={topicSubject}
                  onChange={(event) => {
                    setTopicSubject(event.target.value as Exclude<QuizSubject, "Full NEET">);
                    setTopicText("");
                    setCustomTopicText("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  {TOPIC_SUBJECT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Chapter</span>
                <select
                  value={topicText}
                  onChange={(event) => setTopicText(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Select a chapter</option>
                  {NCERT_CHAPTERS[topicSubject].map((chapter) => (
                    <option key={chapter} value={chapter}>
                      {chapter}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Specific topic (optional)
                </span>
                <input
                  value={customTopicText}
                  onChange={(event) => setCustomTopicText(event.target.value)}
                  placeholder="e.g. Spermatogenesis — leave blank for full chapter"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Number of questions
                </span>
                <select
                  value={topicQuestionCount}
                  onChange={(event) => setTopicQuestionCount(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                  <option value={15}>15 Questions</option>
                  <option value={20}>20 Questions</option>
                </select>
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Difficulty Level</span>
                <select
                  value={topicLevel}
                  onChange={(event) => setTopicLevel(event.target.value as QuizLevel)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  {LEVEL_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Question Format</span>
                <select
                  value={topicFormat}
                  onChange={(event) => setTopicFormat(event.target.value as QuestionType | "")}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  {FORMAT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {error && (
                <p className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={startTopicQuiz}
                className="w-full rounded-xl bg-atomic-blue px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-800"
              >
                Start Topic Quiz
              </button>
            </div>
          </div>
        )}

        {stage === "pyqForm" && (
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={() => setStage("modeSelect")}
              className="mb-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-atomic-orange"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <h1 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">PYQ Practice</h1>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Practice with real NEET previous year questions.
            </p>
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Subject</span>
                <select
                  value={pyqSubject}
                  onChange={(event) => setPyqSubject(event.target.value as PyqSubjectOption)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  {PYQ_SUBJECT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Year</span>
                <select
                  value={pyqYear}
                  onChange={(event) => setPyqYear(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">All Years</option>
                  {PYQ_AVAILABLE_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Number of questions
                </span>
                <select
                  value={pyqQuestionCount}
                  onChange={(event) => setPyqQuestionCount(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                  <option value={15}>15 Questions</option>
                  <option value={20}>20 Questions</option>
                </select>
              </label>
              {error && (
                <p className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={startPyqQuiz}
                className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-purple-700"
              >
                Start PYQ Practice
              </button>
            </div>
          </div>
        )}

        {stage === "ncertForm" && (
          <div className="mx-auto w-full max-w-lg">
            <button
              type="button"
              onClick={() => setStage("modeSelect")}
              className="mb-4 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                  NCERT Canonical Base
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                NCERT Chapterwise Question Practice
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Practice line-by-line questions directly mapped to NCERT Class 11 &amp; 12 syllabus.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 space-y-4">
              {/* Subject Selector Tabs */}
              <div>
                <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Select Subject
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(["Biology", "Chemistry", "Physics"] as const).map((sub) => {
                    const isSelected = ncertSubject === sub;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setNcertSubject(sub);
                          setNcertChapter(NCERT_CHAPTERS[sub]?.[0] || "");
                        }}
                        className={`py-2 px-3 rounded-xl font-bold text-xs transition text-center ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NCERT Chapter Selection with Search */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Select NCERT Chapter
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {NCERT_CHAPTERS[ncertSubject]?.length || 0} Chapters
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search chapter name..."
                    value={ncertSearchQuery}
                    onChange={(e) => setNcertSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 p-1 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 no-scrollbar">
                  {NCERT_CHAPTERS[ncertSubject]
                    ?.filter((ch) =>
                      ch.toLowerCase().includes(ncertSearchQuery.toLowerCase())
                    )
                    .map((ch, idx) => {
                      const isSelected = ncertChapter === ch;
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setNcertChapter(ch)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                            isSelected
                              ? "bg-emerald-600 text-white font-bold shadow-sm"
                              : "hover:bg-slate-200/60 text-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          }`}
                        >
                          <span className="truncate">
                            {idx + 1}. {ch}
                          </span>
                          {isSelected && <span className="text-[10px]">✓ Selected</span>}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Grid: Language, Count, Level, Format */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="mb-1 block font-medium text-slate-500">Language</span>
                  <select
                    value={ncertLanguage}
                    onChange={(e) => setNcertLanguage(e.target.value as QuizLanguage)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {LANGUAGE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="mb-1 block font-medium text-slate-500">Questions Count</span>
                  <select
                    value={ncertQuestionCount}
                    onChange={(e) => setNcertQuestionCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                    <option value={20}>20 Questions</option>
                    <option value={30}>30 Questions</option>
                    <option value={45}>45 Questions (Full Test)</option>
                  </select>
                </div>

                <div>
                  <span className="mb-1 block font-medium text-slate-500">Difficulty</span>
                  <select
                    value={ncertLevel}
                    onChange={(e) => setNcertLevel(e.target.value as QuizLevel)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {LEVEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="mb-1 block font-medium text-slate-500">Question Format</span>
                  <select
                    value={ncertFormat}
                    onChange={(e) => setNcertFormat(e.target.value as QuestionType | "")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {FORMAT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={startNcertQuiz}
                disabled={!ncertChapter}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                <span>Start NCERT Chapter Practice ({ncertQuestionCount} Q)</span>
              </button>
            </div>
          </div>
        )}

        {stage === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-atomic-orange border-t-transparent" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Preparing your quiz...</p>
          </div>
        )}
        {stage === "active" && currentQuestion && (
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-4 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>
                {currentQuestion.subject} · Question {currentIndex + 1} / {questions.length}
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                  totalRemaining <= 60
                    ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300"
                    : "bg-blue-50 text-atomic-blue dark:bg-blue-900/20"
                }`}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {formatTime(totalRemaining)}
              </span>
            </div>

            <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-atomic-orange transition-all"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>

            <p className="mb-2 mt-4 text-base font-medium leading-relaxed text-slate-900 dark:text-white">
              <MathText text={currentQuestion.text} />
            </p>
            <QuestionExtras question={currentQuestion} variant="screen" />

            <div className="space-y-2.5">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedIndexForCurrent === index;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectOption(index)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                      isSelected
                        ? "border-atomic-orange bg-orange-50 text-atomic-orange dark:bg-orange-950/20"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>
                      <strong className="mr-2">{String.fromCharCode(65 + index)}.</strong>
                      <MathText text={option} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={goPrev}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={submitQuiz}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-atomic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-atomic-orange-dark"
                >
                  Submit Test
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
        {stage === "summary" && (
          <div className="mx-auto w-full max-w-md text-center">
            <h1 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">Quiz Complete</h1>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{performanceLabel}</p>

            <div className="mb-6 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs text-slate-500">Total marks</p>
                <p className="mt-1 text-lg font-bold text-atomic-orange">{score.marks}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs text-slate-500">Accuracy</p>
                <p className="mt-1 text-lg font-bold">{score.accuracy}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs text-slate-500">Correct</p>
                <p className="mt-1 text-lg font-bold text-emerald-600">{score.correct}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs text-slate-500">Wrong</p>
                <p className="mt-1 text-lg font-bold text-red-500">{score.wrong}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs text-slate-500">Unattempted</p>
                <p className="mt-1 text-lg font-bold text-slate-500">{score.unattempted}</p>
              </div>
            </div>

                        <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStage("review")}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Review answers
              </button>
              <button
                type="button"
                onClick={() => setStage("modeSelect")}
                className="flex-1 rounded-xl bg-atomic-orange px-4 py-3 text-sm font-semibold text-white hover:bg-atomic-orange-dark"
              >
                New quiz
              </button>
            </div>
            <button
              type="button"
              onClick={downloadReviewPdf}
              disabled={isGeneratingPdf}
              className="mt-2 w-full rounded-xl border border-atomic-orange px-4 py-2.5 text-sm font-semibold text-atomic-orange transition hover:bg-orange-50 disabled:opacity-60 dark:hover:bg-orange-950/20"
            >
              {isGeneratingPdf ? "Preparing PDF..." : "Download PDF"}
            </button>
          </div>
        )}
        {stage === "review" && (
          <div className="mx-auto w-full max-w-xl space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Review</h1>
              <button
                type="button"
                onClick={downloadReviewPdf}
                disabled={isGeneratingPdf}
                className="rounded-lg border border-atomic-orange px-3 py-1.5 text-xs font-semibold text-atomic-orange hover:bg-orange-50 disabled:opacity-60 dark:hover:bg-orange-950/20"
              >
                {isGeneratingPdf ? "Preparing PDF..." : "Download PDF"}
              </button>
            </div>
            <div ref={reviewRef} className="space-y-4 bg-white p-2 dark:bg-atomic-navy">
              {questions.map((question, index) => {
                const answer = orderedAnswers[index];
                return (
                  <div
                    key={question.id}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      Q{index + 1} · {question.subject} {question.topic ? `· ${question.topic}` : ""}
                    </p>
                    <p className="mb-2 text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
                      <MathText text={question.text} />
                    </p>
                    <QuestionExtras question={question} variant="screen" />
                    <div className="mb-3 space-y-1.5">
                      {question.options.map((option, optIndex) => {
                        const isCorrect = optIndex === question.correctIndex;
                        const wasSelected = answer?.selectedIndex === optIndex;
                        return (
                          <p
                            key={optIndex}
                            className={`rounded-lg px-3 py-1.5 text-xs ${
                              isCorrect
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                                : wasSelected
                                  ? "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-300"
                                  : "text-slate-500"
                            }`}
                          >
                            {String.fromCharCode(65 + optIndex)}. <MathText text={option} />
                          </p>
                        );
                      })}
                    </div>
                                        {question.explanationSteps?.length ? (
                      <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
                        {question.explanationSteps.map((step, i) => (
                          <li key={i}>
                            <MathText text={step} />
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        <MathText text={question.explanation} />
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setStage("modeSelect")}
              className="w-full rounded-xl bg-atomic-orange px-4 py-3 text-sm font-semibold text-white hover:bg-atomic-orange-dark"
            >
              New quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}