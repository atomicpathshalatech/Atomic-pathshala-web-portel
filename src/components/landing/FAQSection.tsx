import { FAQAccordion, type FaqItem } from "./FAQAccordion";
import { getPublishedFaqs } from "@/lib/homepage";

// Shown only until an admin publishes FAQs in Team → Website → FAQs.
const DEFAULT_FAQS: FaqItem[] = [
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

export async function FAQSection() {
  const cms = await getPublishedFaqs();
  const faqs: FaqItem[] = cms.length
    ? cms.map((f) => ({ question: f.question, answer: f.answer }))
    : DEFAULT_FAQS;

  return <FAQAccordion faqs={faqs} />;
}
