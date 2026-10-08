import { describe, it, expect, beforeAll } from "vitest";
import { QuestionSimilarityEngine } from "../similarity-engine";
import { DiffHighlighter } from "../diff-highlighter";
import { TextNormalizer } from "../text-normalizer";

describe("Question Content Detection & Similarity Engine", () => {
  beforeAll(() => {
    QuestionSimilarityEngine.init();
  });

  it("should detect exact duplicate question statement with 100% similarity", async () => {
    const report = await QuestionSimilarityEngine.analyze({
      statementEn: "A body of mass 5 kg moves with an acceleration of 2 m/s^2. What is the net force acting on the body?",
      subject: "Physics",
    });

    expect(report.overallScore).toBe(100);
    expect(report.classification).toBe("EXACT_OR_NEAR_DUPLICATE");
    expect(report.highestMatch?.questionCode).toBe("C2600012456");
  });

  it("should detect near duplicate with boilerplate differences", async () => {
    const report = await QuestionSimilarityEngine.analyze({
      statementEn: "Which of the following statements is true about the structure of benzene?",
      subject: "Chemistry",
    });

    expect(report.overallScore).toBeGreaterThanOrEqual(30);
    expect(report.highestMatch?.questionCode).toBe("C2600012890");
  });

  it("should give low similarity score for unique/distinct questions", async () => {
    const report = await QuestionSimilarityEngine.analyze({
      statementEn: "Explain the biochemical role of RuBisCO enzyme in the Calvin cycle of C3 plants during photosynthesis.",
      subject: "Biology",
    });

    expect(report.overallScore).toBeLessThan(30);
    expect(report.classification).toBe("LOW_SIMILARITY");
  });

  it("should generate highlighted diff tokens between matching questions", () => {
    const original = "Net force acting on body of mass 5 kg is 10 N";
    const candidate = "Total force acting on object of mass 5 kg is 10 N";

    const diff = DiffHighlighter.generateHighlightedDiff(original, candidate);
    expect(diff.originalTokens.length).toBeGreaterThan(0);
    expect(diff.newTokens.length).toBeGreaterThan(0);
  });

  it("should properly clean and hash text", () => {
    const raw = "  Solve: F = m * a  ";
    const cleaned = TextNormalizer.clean(raw);
    const hash = TextNormalizer.hash(raw);
    expect(cleaned).toBe("solve f = m * a");
    expect(hash).toHaveLength(64);
  });
});
