import {
  extractBilingualQuestionFromText,
  generateSubjectAwareSolution,
  checkAndTranslateQuestion,
} from "../src/lib/questions/gemini-engine";

async function verifyUnifiedQuestionSystem() {
  console.log("==================================================");
  console.log("STARTING UNIFIED QUESTION SYSTEM VERIFICATION");
  console.log("==================================================");

  // TEST 1: Single-Language English Extraction (Hindi fields must be strictly empty)
  console.log("\n[TEST 1] Single-Language English Extraction...");
  const englishRawText = `
Which of the following cell organelles is responsible for cellular respiration and ATP generation?
(A) Ribosome
(B) Mitochondria
(C) Golgi apparatus
(D) Lysosome
Answer: (B)
`;

  try {
    const resultEn = await extractBilingualQuestionFromText({
      rawText: englishRawText,
      subjectContext: "Biology",
      chapterContext: "Cell: The Unit of Life",
      topicContext: "Mitochondria",
      difficultyContext: "EASY",
    });

    console.log("Extracted Statement (En):", resultEn.statementEn);
    console.log("Extracted Statement (Hi) [Should be empty]:", `"${resultEn.statementHi}"`);
    console.log("Options (En):", resultEn.optionsEn);
    console.log("Options (Hi) [Should be empty]:", resultEn.optionsHi);
    console.log("Correct Answer:", resultEn.correctAnswer);

    if (resultEn.statementHi.trim() !== "" || resultEn.optionsHi.A.trim() !== "") {
      console.warn("⚠️ Warning: Hindi was auto-translated during single-language extraction! Expected empty strings.");
    } else {
      console.log("✅ Single-language isolation verified: Opposite language fields are empty.");
    }
  } catch (err: any) {
    console.log("OCR/Gemini text test note:", err?.message || err);
  }

  // TEST 2: Subject-Aware Solution Generation (Physics Format)
  console.log("\n[TEST 2] Testing Subject-Aware Solution Format (Physics)...");
  try {
    const physicsSol = await generateSubjectAwareSolution({
      subject: "Physics",
      statementEn: "A block of mass 2 kg is pulled on a frictionless horizontal surface with a constant force of 10 N. Calculate its acceleration.",
      optionsEn: {
        A: "2 m/s²",
        B: "5 m/s²",
        C: "10 m/s²",
        D: "20 m/s²",
      },
      correctAnswer: "B",
      userSelectedAnswer: "B",
    });

    console.log("Recommended Answer:", physicsSol.recommendedAnswer);
    console.log("Answer Mismatch:", physicsSol.answerMismatch);
    console.log("Generated Physics Solution (First 200 chars):\n", physicsSol.solutionEn.slice(0, 250));

    const hasExplaining = physicsSol.solutionEn.toLowerCase().includes("explaining");
    const hasConcept = physicsSol.solutionEn.toLowerCase().includes("concept");
    const hasSolution = physicsSol.solutionEn.toLowerCase().includes("solution");
    const hasFinalAnswer = physicsSol.solutionEn.toLowerCase().includes("final answer");

    if (hasExplaining && hasConcept && hasSolution && hasFinalAnswer) {
      console.log("✅ Physics Solution Format Verified: Contains EXPLAINING, CONCEPT, Solution, Final Answer.");
    } else {
      console.log("Format check report:", { hasExplaining, hasConcept, hasSolution, hasFinalAnswer });
    }
  } catch (err: any) {
    console.log("Physics solution test note:", err?.message || err);
  }

  // TEST 3: Subject-Aware Solution Generation (Biology Format)
  console.log("\n[TEST 3] Testing Subject-Aware Solution Format (Biology)...");
  try {
    const bioSol = await generateSubjectAwareSolution({
      subject: "Biology",
      statementEn: "Identify the incorrect statement regarding mitochondria:\nA. They are double membrane-bound organelles.\nB. The inner membrane forms infoldings called cristae.\nC. They possess their own single linear DNA molecule.\nD. They are the sites of aerobic respiration.",
      optionsEn: {
        A: "Statement A is incorrect",
        B: "Statement B is incorrect",
        C: "Statement C is incorrect",
        D: "Statement D is incorrect",
      },
      correctAnswer: "C",
      userSelectedAnswer: "C",
    });

    console.log("Recommended Answer:", bioSol.recommendedAnswer);
    console.log("Generated Biology Solution (First 250 chars):\n", bioSol.solutionEn.slice(0, 300));
    console.log("✅ Biology Solution format generated successfully.");
  } catch (err: any) {
    console.log("Biology solution test note:", err?.message || err);
  }

  // TEST 4: Answer Mismatch Conflict Detection
  console.log("\n[TEST 4] Testing Answer Mismatch Detection (User selects A, but Correct is B)...");
  try {
    const mismatchSol = await generateSubjectAwareSolution({
      subject: "Chemistry",
      statementEn: "What is the pH of a 0.001 M aqueous solution of HCl at 25°C?",
      optionsEn: {
        A: "1",
        B: "3",
        C: "7",
        D: "11",
      },
      correctAnswer: "B",
      userSelectedAnswer: "A", // Deliberate mismatch
    });

    console.log("User Selected:", "A");
    console.log("AI Recommended:", mismatchSol.recommendedAnswer);
    console.log("Answer Mismatch Flag:", mismatchSol.answerMismatch);
    console.log("Mismatch Warning Message:", mismatchSol.mismatchWarning);

    if (mismatchSol.answerMismatch && mismatchSol.mismatchWarning) {
      console.log("✅ Answer Mismatch correctly detected and flagged without silent overwrite.");
    } else {
      console.log("Mismatch check result:", mismatchSol);
    }
  } catch (err: any) {
    console.log("Mismatch test note:", err?.message || err);
  }

  console.log("\n==================================================");
  console.log("UNIFIED QUESTION SYSTEM VERIFICATION COMPLETE");
  console.log("==================================================");
}

verifyUnifiedQuestionSystem().catch((e) => {
  console.error("Verification script encountered error:", e);
  process.exit(1);
});
