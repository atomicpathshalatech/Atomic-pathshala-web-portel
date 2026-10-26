/**
 * ATOMIC PATHSHALA — MATHEMATICAL & LATEX VALIDATOR
 * Deterministic checker for LaTeX / KaTeX syntax and step-by-step arithmetic.
 */

import { MathematicalValidationResult } from "../ai-provider/types";

export function validateMathematics(text: string, solutionText?: string): MathematicalValidationResult {
  const syntaxErrors: string[] = [];
  const arithmeticErrors: string[] = [];
  const detectedEquations: string[] = [];

  const combined = `${text} ${solutionText || ""}`;

  // 1. Delimiter balance check for $ and $$
  const singleDollarCount = (combined.match(/(?<!\\)\$/g) || []).length;
  if (singleDollarCount % 2 !== 0) {
    syntaxErrors.push(`Unbalanced inline math delimiter '$' (count: ${singleDollarCount})`);
  }

  // 2. Bracket balance inside LaTeX
  let openBraces = 0;
  for (let i = 0; i < combined.length; i++) {
    if (combined[i] === "{" && (i === 0 || combined[i - 1] !== "\\")) {
      openBraces++;
    } else if (combined[i] === "}" && (i === 0 || combined[i - 1] !== "\\")) {
      openBraces--;
      if (openBraces < 0) {
        syntaxErrors.push("Mismatched closing brace '}' without opening '{'");
        break;
      }
    }
  }
  if (openBraces > 0) {
    syntaxErrors.push(`Unclosed LaTeX brace '{' (unclosed count: ${openBraces})`);
  }

  // 3. LaTeX commands syntax checks
  const latexCommandRegex = /\\([a-zA-Z]+)(?:\{([^}]*)\})?(?:\{([^}]*)\})?/g;
  let match: RegExpExecArray | null;
  while ((match = latexCommandRegex.exec(combined)) !== null) {
    const cmd = match[1];
    if (cmd === "frac") {
      if (match[2] === undefined || match[3] === undefined) {
        syntaxErrors.push(`Malformed \\frac command: missing numerator or denominator arguments`);
      }
    } else if (cmd === "sqrt") {
      if (match[2] === undefined) {
        syntaxErrors.push(`Malformed \\sqrt command: missing radicand argument`);
      }
    }
  }

  // 4. Arithmetic evaluation check in solutions
  // Look for patterns like "10 + 5 = 16" or "4 * 2.5 = 9" or "20 / 4 = 6"
  if (solutionText) {
    const arithmeticPattern = /(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)/g;
    let arithMatch: RegExpExecArray | null;
    while ((arithMatch = arithmeticPattern.exec(solutionText)) !== null) {
      const a = parseFloat(arithMatch[1]);
      const op = arithMatch[2];
      const b = parseFloat(arithMatch[3]);
      const stated = parseFloat(arithMatch[4]);
      let expected: number | null = null;

      if (op === "+") expected = a + b;
      else if (op === "-") expected = a - b;
      else if (op === "*") expected = a * b;
      else if (op === "/") {
        if (b === 0) {
          arithmeticErrors.push(`Division by zero detected: ${a} / 0`);
          continue;
        }
        expected = a / b;
      }

      if (expected !== null) {
        const diff = Math.abs(expected - stated);
        const tolerance = Math.max(0.01, Math.abs(expected) * 0.01);
        detectedEquations.push(`${a} ${op} ${b} = ${stated} (computed: ${expected})`);
        if (diff > tolerance) {
          arithmeticErrors.push(
            `Arithmetic discrepancy: stated "${a} ${op} ${b} = ${stated}", but calculation gives ${expected.toFixed(4)}`
          );
        }
      }
    }
  }

  const valid = syntaxErrors.length === 0 && arithmeticErrors.length === 0;

  return {
    valid,
    syntaxErrors,
    arithmeticErrors,
    detectedEquations,
  };
}
