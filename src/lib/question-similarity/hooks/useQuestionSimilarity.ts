// src/question-similarity/hooks/useQuestionSimilarity.ts
"use client";

import { useState, useCallback, useRef } from "react";
import { QuestionInputForDetection, SimilarityReport, SimilarityMatch } from "../types";
import { QuestionSimilarityEngine } from "../similarity-engine";

export interface UseQuestionSimilarityReturn {
  report: SimilarityReport | null;
  checking: boolean;
  checkSimilarity: (input: QuestionInputForDetection) => Promise<SimilarityReport>;
  showPreventDuplicateModal: boolean;
  setShowPreventDuplicateModal: (show: boolean) => void;
  highestMatch: SimilarityMatch | null;
  reset: () => void;
}

export function useQuestionSimilarity(): UseQuestionSimilarityReturn {
  const [report, setReport] = useState<SimilarityReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [showPreventDuplicateModal, setShowPreventDuplicateModal] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkSimilarity = useCallback(async (input: QuestionInputForDetection): Promise<SimilarityReport> => {
    setChecking(true);
    try {
      // Direct high-speed local engine or API call
      const res = await QuestionSimilarityEngine.analyze(input);
      setReport(res);

      // Trigger prevention modal if high similarity >= 70%
      if (res.duplicateDetected) {
        setShowPreventDuplicateModal(true);
      }
      return res;
    } finally {
      setChecking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setReport(null);
    setChecking(false);
    setShowPreventDuplicateModal(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    report,
    checking,
    checkSimilarity,
    showPreventDuplicateModal,
    setShowPreventDuplicateModal,
    highestMatch: report?.highestMatch || null,
    reset,
  };
}
