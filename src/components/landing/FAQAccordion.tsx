"use client";

import { useState } from "react";
import { ScrollReveal } from "./ScrollReveal";

export type FaqItem = { question: string; answer: string };

export function FAQAccordion({ faqs }: { faqs: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-stack-lg bg-surface-container-low px-margin-mobile md:px-margin-desktop">
      <ScrollReveal className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h2 className="font-headline-lg text-headline-lg">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
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
                  <div className="px-6 py-4 text-label-sm font-label-sm text-on-surface-variant border-t border-outline-variant/10 whitespace-pre-line">
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
