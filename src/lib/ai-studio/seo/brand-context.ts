export const ATOMIC_PATHSHALA_BRAND_CONTEXT = {
  brandName: "Atomic Pathshala",
  educator: "Firoz Sir",
  exams: ["NEET UG", "NEET 2026", "NEET 2027", "JEE Main", "Boards (Class 10/11/12)"],
  subjects: ["Chemistry", "Physics", "Biology"],
  mediums: ["Hindi Medium", "English Medium", "Hinglish"],
  teachingStyle: "Concept-first, NCERT-aligned, high-clarity explanations with exam-oriented tricks and motivation.",
  website: "https://atomicpathshala.in",
  cta: "Subscribe to Atomic Pathshala, download the app, and join our upcoming NEET/JEE batches!",
  socialLinks: {
    website: "https://atomicpathshala.in",
    youtube: "Atomic Pathshala Official",
    instagram: "@atomicpathshala",
    telegram: "t.me/atomicpathshala",
  },
};

export function formatBrandContextForPrompt(): string {
  return [
    `BRAND PROFILE (${ATOMIC_PATHSHALA_BRAND_CONTEXT.brandName}):`,
    `- Lead Educator: ${ATOMIC_PATHSHALA_BRAND_CONTEXT.educator} (${ATOMIC_PATHSHALA_BRAND_CONTEXT.teachingStyle})`,
    `- Focus Exams: ${ATOMIC_PATHSHALA_BRAND_CONTEXT.exams.join(", ")}`,
    `- Subjects: ${ATOMIC_PATHSHALA_BRAND_CONTEXT.subjects.join(", ")}`,
    `- Mediums: ${ATOMIC_PATHSHALA_BRAND_CONTEXT.mediums.join(", ")}`,
    `- Website: ${ATOMIC_PATHSHALA_BRAND_CONTEXT.website}`,
    `- Standard CTA: ${ATOMIC_PATHSHALA_BRAND_CONTEXT.cta}`,
  ].join("\n");
}
