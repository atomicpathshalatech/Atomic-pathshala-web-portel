"use client";

import { useState } from "react";
import { ScrollReveal } from "./ScrollReveal";

const FAQS = [
  {
    question: "How can I enroll in a batch?",
    answer:
      'Simply click on the "Join Now" button on any batch card or navigate to the Batches section to see all available programs.',
  },
  {
    question: "Do you offer scholarships?",
    answer:
      "Yes — we run scholarship tests periodically. Top scorers get fee waivers ranging from 25% to 100% based on their rank.",
  },
  {
    question: "Are classes live or recorded?",
    answer:
      "Both. Every live class is recorded automatically and added to your library, so you can revisit any session anytime.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-stack-lg bg-surface-container-low px-margin-mobile md:px-margin-desktop">
      <ScrollReveal className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h2 className="font-headline-lg text-headline-lg">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="bg-surface rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-primary/5 transition-colors group"
                >
                  <span className="font-label-md text-label-md">{faq.question}</span>
                  <span
                    className={`material-symbols-outlined text-primary transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 py-4 text-label-sm font-label-sm text-on-surface-variant border-t border-outline-variant/10">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollReveal>
    </section>
  );
}
