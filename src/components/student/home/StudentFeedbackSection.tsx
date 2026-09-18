"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Star, MessageSquarePlus, X, Check, Quote } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "./SectionHeader";

export interface StudentFeedbackItem {
  id: string;
  studentName: string;
  photoUrl: string | null;
  studentClass?: string | null;
  targetExam?: string | null;
  quote: string;
  rating?: number | null;
  createdAt: string;
}

const DEFAULT_FEEDBACKS: StudentFeedbackItem[] = [
  {
    id: "f-1",
    studentName: "Aman Sharma",
    photoUrl: null,
    targetExam: "NEET 2026",
    studentClass: "Class 12",
    quote: "Atomic Pathshala's NCERT page-by-page practice and faculty live classes helped me score 680+ in my mock tests! Highly recommended for every serious NEET aspirant.",
    rating: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: "f-2",
    studentName: "Priya Patel",
    photoUrl: null,
    targetExam: "NEET 2026",
    studentClass: "Dropper Batch",
    quote: "The doubt portal and daily DPP questions keep me consistent every single day. The teachers explain every single concept with crystal clarity.",
    rating: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: "f-3",
    studentName: "Rahul Verma",
    photoUrl: null,
    targetExam: "JEE 2026",
    studentClass: "Class 11",
    quote: "Best learning platform for interactive problem solving and real test simulation. The AI Guru instant solutions are extremely helpful.",
    rating: 5,
    createdAt: new Date().toISOString(),
  },
];

export function StudentFeedbackSection({
  initialFeedbacks,
  studentName,
}: {
  initialFeedbacks: StudentFeedbackItem[];
  studentName: string;
}) {
  const [feedbacks, setFeedbacks] = useState<StudentFeedbackItem[]>(
    initialFeedbacks && initialFeedbacks.length > 0 ? initialFeedbacks : DEFAULT_FEEDBACKS
  );
  const [showModal, setShowModal] = useState(false);
  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote.trim() || quote.trim().length < 5) {
      toast.error("Please enter at least 5 characters for your feedback.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/student/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: quote.trim(), rating }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit feedback.");
      }

      toast.success("Thank you for your feedback!");
      if (data.data?.testimonial) {
        setFeedbacks((prev) => [
          {
            id: data.data.testimonial.id,
            studentName: data.data.testimonial.studentName,
            photoUrl: data.data.testimonial.photoUrl,
            studentClass: data.data.testimonial.studentClass,
            targetExam: data.data.testimonial.targetExam,
            quote: data.data.testimonial.quote,
            rating: data.data.testimonial.rating,
            createdAt: data.data.testimonial.createdAt,
          },
          ...prev,
        ]);
      }
      setShowModal(false);
      setQuote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Our Student Feedback" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-500/25 transition"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Add Feedback
          </button>
          {feedbacks.length > 2 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scroll("left")}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Previous feedback"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Next feedback"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {feedbacks.map((item) => {
          const stars = Array.from({ length: item.rating || 5 });
          return (
            <div
              key={item.id}
              className="w-[280px] sm:w-[320px] shrink-0 snap-start rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                {/* Rating & Quote Icon */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-0.5">
                    {stars.map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <Quote className="w-4 h-4 text-slate-300" />
                </div>

                {/* Feedback Quote */}
                <p className="text-xs text-slate-700 leading-relaxed italic line-clamp-4">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>

              {/* Student Info Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                  {item.photoUrl ? (
                    <img src={item.photoUrl} alt={item.studentName} className="h-full w-full object-cover" />
                  ) : (
                    item.studentName.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-900">{item.studentName}</p>
                  <p className="truncate text-[10px] text-slate-500 font-medium">
                    {item.targetExam || "NEET Aspirant"} {item.studentClass ? `• ${item.studentClass}` : ""}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900">Share Your Experience</h3>
            <p className="mt-1 text-xs text-slate-500">
              Your feedback inspires fellow aspirants and helps us improve Atomic Pathshala.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rating</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-slate-600">{rating} out of 5</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Feedback</label>
                <textarea
                  rows={4}
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="Share how Atomic Pathshala classes, questions, and faculty have helped your exam preparation..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !quote.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition shadow-sm"
                >
                  {isSubmitting ? "Submitting..." : "Submit Feedback"}
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
