export type PyqExam = "NEET" | "JEE";
export type PyqSubject = "Biology" | "Physics" | "Chemistry" | "Mathematics";

export interface PyqQuestion {
  exam: PyqExam;
  year: number;
  subject: PyqSubject;
  chapter?: string;
  topic?: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * ADD REAL PREVIOUS YEAR QUESTIONS HERE.
 * Each entry follows the PyqQuestion shape above. Example:
 *
 * {
 *   exam: "NEET",
 *   year: 2024,
 *   subject: "Biology",
 *   chapter: "Human Reproduction",
 *   topic: "Spermatogenesis",
 *   text: "...",
 *   options: ["...", "...", "...", "..."],
 *   correctIndex: 2,
 *   explanation: "...",
 * },
 */
export const PYQ_BANK: PyqQuestion[] = [];

export const PYQ_AVAILABLE_YEARS = Array.from({ length: 12 }, (_, i) => 2025 - i);
