"use client";

import React, { useState, useRef, useEffect } from "react";
import type { AiDoubtSolution, QuestionCategory } from "@/lib/ai/doubt-solver-engine";

interface ChatMessage {
  id: string;
  role: "student" | "ai";
  text: string;
  image?: string;
  solution?: AiDoubtSolution;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  "Explain with a simple example",
  "Is there an exam formula or shortcut?",
  "What is the NEET PYQ point on this?",
  "Explain in simple Hindi",
];

export function AiDoubtSolver({ subject }: { subject?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image attachment state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size is too large (maximum 5MB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if ((!textToSend && !selectedImage) || loading) return;

    setError(null);
    const userMsgId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "student",
      text: textToSend || "Please analyze this question image.",
      image: selectedImage || undefined,
      timestamp: new Date(),
    };

    // Update conversation thread immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputQuery("");
    const imagePayload = selectedImage;
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    try {
      // Build conversation history (excluding the current turn) for multi-turn context
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.role === "student" ? m.text : (m.solution?.directAnswer || m.text),
      }));

      const res = await fetch("/api/doubts/ai-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: userMessage.text,
          subject,
          imageBase64: imagePayload || undefined,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not generate response. Please try again.");
        return;
      }

      const aiSolution: AiDoubtSolution = data.data.solution;
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: aiSolution.directAnswer,
        solution: aiSolution,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setError("Network error communicating with Atomic AI Tutor. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setInputQuery("");
    setSelectedImage(null);
    setError(null);
  };

  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6 border-2 border-primary/20 space-y-4 relative overflow-hidden bg-gradient-to-br from-primary/5 via-surface to-surface shadow-sm">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md shrink-0">
            <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          </div>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <span>Atomic AI Tutor</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider">
                Instant Academic Assistant
              </span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Ask any conceptual doubt, numerical problem, or upload a textbook photo. Powered by real NEET &amp; JEE pedagogy.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isOpen && messages.length > 0 && (
            <button
              type="button"
              onClick={handleResetChat}
              title="Start a new doubt topic"
              className="px-3 py-1.5 rounded-xl border border-outline-variant/50 text-xs font-semibold hover:bg-surface-container-high text-on-surface-variant transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>New Doubt</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="px-4 py-2 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:opacity-90 transition-all shrink-0 active:scale-95 shadow-sm"
          >
            {isOpen ? "Close AI Tutor" : "Open AI Tutor"}
          </button>
        </div>
      </div>

      {/* Expandable Chat Area */}
      {isOpen && (
        <div className="space-y-4 pt-3 border-t border-outline-variant/20">
          {/* Threaded Conversation Container */}
          {messages.length > 0 ? (
            <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
              {messages.map((msg) => {
                const isStudent = msg.role === "student";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isStudent ? "items-end" : "items-start"}`}
                  >
                    {/* Role Header */}
                    <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant mb-1 px-1">
                      <span className="font-semibold">
                        {isStudent ? "You" : "Atomic AI Tutor"}
                      </span>
                      <span>•</span>
                      <span>
                        {msg.timestamp.toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>

                    {/* Message Bubble Content */}
                    {isStudent ? (
                      <div className="max-w-[88%] sm:max-w-[78%] bg-primary text-on-primary px-4 py-2.5 rounded-2xl rounded-tr-none text-xs sm:text-sm leading-relaxed shadow-sm space-y-2">
                        {msg.image && (
                          <div className="rounded-lg overflow-hidden border border-white/20 max-w-xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.image} alt="Question Upload" className="max-h-56 object-contain" />
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    ) : (
                      <div className="max-w-[95%] sm:max-w-[88%] w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl rounded-tl-none p-4 sm:p-5 shadow-sm space-y-3.5">
                        {/* Dynamic Response Rendering tailored to question type */}
                        {msg.solution ? (
                          <AiSolutionView solution={msg.solution} />
                        ) : (
                          <p className="text-xs sm:text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
                            {msg.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing / Thinking Indicator */}
              {loading && (
                <div className="flex items-start gap-2 text-xs text-on-surface-variant p-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-base animate-spin">
                      progress_activity
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-primary">Atomic AI Tutor is analyzing...</span>
                    <p className="text-[11px] text-on-surface-variant">
                      Formulating conceptual breakdown and NCERT exam connections...
                    </p>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          ) : (
            /* Initial Welcome / Empty Thread State */
            <div className="p-6 rounded-2xl bg-surface-container-lowest/60 border border-dashed border-outline-variant/40 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">psychology</span>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-on-surface">
                  What would you like to understand today?
                </h4>
                <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                  Type your question in Hindi, English, or Hinglish (e.g. <em>&quot;atom kya hota hai&quot;</em>, <em>&quot;2 mole H2O me molecules kitne honge&quot;</em>) or attach an image.
                </p>
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {[
                  "atom kya hota hai",
                  "atomic number kya hota hai",
                  "2 mole H2O me molecules kitne honge?",
                  "What is photosynthesis?",
                  "Newton's second law explain karo",
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(sample)}
                    className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-primary/10 hover:text-primary border border-outline-variant/30 text-[11px] font-medium text-on-surface-variant transition-all active:scale-95"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message if any */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/30 text-error text-xs rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <p className="flex-1">{error}</p>
            </div>
          )}

          {/* Quick Context Follow-up Suggestions (shown when conversation is active) */}
          {messages.length > 0 && !loading && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-on-surface-variant mr-1">
                Follow-up:
              </span>
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-primary/10 hover:text-primary text-[11px] text-on-surface-variant font-medium transition-all active:scale-95"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Selected Image Thumbnail Preview */}
          {selectedImage && (
            <div className="relative inline-block border-2 border-primary/40 rounded-xl overflow-hidden shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage} alt="Selected question preview" className="h-20 max-w-xs object-cover" />
              <button
                type="button"
                onClick={removeSelectedImage}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors"
                title="Remove image"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="flex items-end gap-2 bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/40 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />

            {/* Image Attach Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container flex items-center justify-center transition-all shrink-0"
              title="Upload question photo or screenshot"
            >
              <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
            </button>

            {/* Textarea Input */}
            <textarea
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                messages.length > 0
                  ? "Ask follow-up doubt on this topic (e.g. 'iske andar kya hota hai?')..."
                  : "Ask your academic doubt or paste equation (Hindi / English / Hinglish)..."
              }
              className="flex-1 max-h-32 resize-none bg-transparent py-2 text-xs sm:text-sm text-on-surface placeholder-on-surface-variant/60 outline-none leading-relaxed"
            />

            {/* Send Button */}
            <button
              type="button"
              disabled={loading || (!inputQuery.trim() && !selectedImage)}
              onClick={() => handleSend()}
              className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all shrink-0 active:scale-95 shadow-sm shadow-primary/20"
              title="Submit doubt"
            >
              <span className="material-symbols-outlined text-lg">arrow_upward</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dynamic View for AI Doubt Solution tailored by Question Category
 * (CONCEPTUAL, NUMERICAL, MCQ, DEFINITION, WHY, COMPARISON, etc.)
 * Strictly avoids generic problem-solving templates for conceptual questions.
 */
function AiSolutionView({ solution }: { solution: AiDoubtSolution }) {
  const isNumerical = solution.questionType === "NUMERICAL" && Boolean(solution.numericalSteps?.length);
  const isMcq = Boolean(solution.mcqDetails);
  const isComparison = Boolean(solution.comparison && solution.comparison.rows?.length);

  return (
    <div className="space-y-3.5">
      {/* 1. Direct Answer Lead Banner */}
      <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-on-surface space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">verified</span>
            {solution.topic ? solution.topic : "Direct Answer"}
          </span>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-surface text-on-surface-variant">
            {solution.questionType}
          </span>
        </div>
        <p className="text-xs sm:text-sm font-extrabold text-on-surface leading-snug">
          {solution.directAnswer}
        </p>
      </div>

      {/* 2. Detailed Explanation (Natural text/bullets, not forced templates) */}
      {solution.explanation && (
        <div className="space-y-1 text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
          <p>{solution.explanation}</p>
        </div>
      )}

      {/* 3. Numerical Steps & Formula (Rendered ONLY if genuine numerical) */}
      {isNumerical && solution.numericalSteps && (
        <div className="space-y-2.5 pt-1">
          {solution.formula && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container font-mono text-xs font-bold text-primary border border-outline-variant/30">
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-sans font-bold">
                Formula:
              </span>
              <span>{solution.formula}</span>
            </div>
          )}

          <div className="space-y-2">
            {solution.numericalSteps.map((step) => (
              <div
                key={step.step}
                className="text-xs space-y-1 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20"
              >
                <div className="font-bold text-on-surface flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
                    {step.step}
                  </span>
                  <span>{step.title}</span>
                </div>
                <p className="text-on-surface-variant pl-5 whitespace-pre-wrap leading-relaxed">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MCQ Analysis (Rendered ONLY if MCQ) */}
      {isMcq && solution.mcqDetails && (
        <div className="space-y-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{solution.mcqDetails.correctOption}</span>
          </div>

          <p className="text-emerald-900 dark:text-emerald-100 leading-relaxed">
            {solution.mcqDetails.explanation}
          </p>

          {solution.mcqDetails.otherOptionsAnalysis && (
            <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-200 space-y-1">
              <strong className="font-bold">Why other options are incorrect:</strong>
              <p className="leading-snug">{solution.mcqDetails.otherOptionsAnalysis}</p>
            </div>
          )}
        </div>
      )}

      {/* 5. Comparison Table (Rendered ONLY if comparison question) */}
      {isComparison && solution.comparison && (
        <div className="overflow-x-auto rounded-xl border border-outline-variant/30 text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/30">
                {solution.comparison.headers.map((h, i) => (
                  <th key={i} className="p-2.5 font-bold text-on-surface">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {solution.comparison.rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b border-outline-variant/10 hover:bg-surface-container-low"
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-on-surface-variant">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Concrete Example Box (Only if present) */}
      {solution.example && (
        <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">school</span>
            Example
          </span>
          <p className="text-on-surface leading-relaxed">{solution.example}</p>
        </div>
      )}

      {/* 7. NEET / Exam Tip Callout (Only if present) */}
      {solution.examTip && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-start gap-2 text-on-surface">
          <span className="material-symbols-outlined text-amber-500 text-sm shrink-0 mt-0.5">
            lightbulb
          </span>
          <p className="leading-snug">
            <strong className="font-bold text-amber-600 dark:text-amber-400">NEET Key Point: </strong>
            {solution.examTip.replace(/^(💡\s*NEET\s*Tip:?\s*|NEET\s*Tip:?\s*)/i, "")}
          </p>
        </div>
      )}
    </div>
  );
}
