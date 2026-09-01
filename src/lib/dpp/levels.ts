export type DppLevel = {
  level: number;
  title: string;
  description: string;
};

/**
 * The 5-level DPP question-style system. `level` is optional on Dpp — a
 * DPP doesn't have to declare one of these five styles.
 */
export const DPP_LEVELS: DppLevel[] = [
  {
    level: 1,
    title: "Conceptual Questions",
    description: "Strengthen your basics with concept based questions and build a strong foundation.",
  },
  {
    level: 2,
    title: "Statementwise & Assertion Reason",
    description: "Practice statement based questions and assertion reason type for deeper understanding.",
  },
  {
    level: 3,
    title: "Match the Column & Multiple Correct / Incorrect Statement",
    description:
      "Enhance your accuracy with the match the column and multiple correct / incorrect statement questions.",
  },
  {
    level: 4,
    title: "Most Expected Questions",
    description: "Focus on highly expected questions from important topics and previous trends.",
  },
  {
    level: 5,
    title: "Teacher's Favorite Questions",
    description: "Handpicked high quality questions by our educators that make the real difference.",
  },
];
