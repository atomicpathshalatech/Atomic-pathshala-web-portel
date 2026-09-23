"use client";

import React, { useState, useEffect } from "react";

interface FAQItem {
  q: string;
  a: string;
}

const DEFAULT_FAQS: FAQItem[] = [
  {
    q: "What is included in this YODHA Chemistry Batch?",
    a: "This batch covers complete NCERT Class 11 & 12 Chemistry for NEET/JEE 2027. It includes 128+ live interactive classes, 21 All-India standardized mock tests, chapter-wise downloadable notes, daily practice problems (DPPs) with video solutions, and 24/7 doubt resolution.",
  },
  {
    q: "How long is the course valid?",
    a: "Your access remains fully valid for 12 months, or until the conclusion of the NEET/JEE 2027 examination. You can watch the recordings unlimited times throughout this period.",
  },
  {
    q: "Are the classes live or recorded?",
    a: "Classes are conducted live daily. Immediately after each live session ends, the full 1080p high-definition recording with timestamps and downloadable PDF notes is available in your student dashboard.",
  },
  {
    q: "Which language is used in the lectures?",
    a: "The teaching language is Hinglish (concepts explained in clear conversational Hindi with all technical terminology, definitions, equations, and study material in English).",
  },
  {
    q: "Can I watch classes on mobile, tablet, and PC?",
    a: "Yes! Atomic Pathshala is fully responsive and supports Android mobile devices, iPhones, iPads, Android tablets, and desktop/laptop browsers.",
  },
  {
    q: "How does the doubt clearing system work?",
    a: "Students can ask doubts directly during live lectures or upload photo screenshots of difficult questions in the 24/7 Doubt Forum. Our expert faculty resolves queries quickly with step-by-step reasoning.",
  },
];

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [faqs, setFaqs] = useState<FAQItem[]>(DEFAULT_FAQS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadFaqs() {
      try {
        setLoading(true);
        const res = await fetch("/api/public/faqs");
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.data?.faqs) && data.data.faqs.length > 0) {
          setFaqs(
            data.data.faqs.map((f: any) => ({
              q: f.question,
              a: f.answer,
            }))
          );
        }
      } catch {
        // keep DEFAULT_FAQS on error
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFaqs();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section id="faq" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">help_center</span>
            <span>Frequently Asked Questions (FAQs)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Have questions before enrolling? Find answers below.
          </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={idx} className="bg-white">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50 transition"
              >
                <span className="text-xs sm:text-sm font-bold text-[#031635] pr-4">{faq.q}</span>
                <span
                  className={`material-symbols-outlined text-slate-400 transition-transform duration-300 shrink-0 ${
                    isOpen ? "rotate-180 text-blue-600" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {isOpen && (
                <div className="p-4 sm:p-5 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/50">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}