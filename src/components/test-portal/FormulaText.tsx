"use client";

import { renderFormulaContent } from "@/lib/test-portal/formula";

export function FormulaText({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderFormulaContent(text || "") }}
    />
  );
}

export default FormulaText;
