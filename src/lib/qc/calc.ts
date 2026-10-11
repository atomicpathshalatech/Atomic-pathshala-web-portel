/**
 * Deterministic arithmetic for QC: an independent computation pathway for the
 * numbers a reviewing model relies on. The model states each calculation as a
 * plain expression plus the value it claims; this evaluates the expression
 * itself (no model involved) and reports whether the two agree.
 *
 * A small recursive-descent evaluator — numbers, + - * / ^, parentheses, unary
 * minus, scientific notation and a fixed set of functions. Nothing else is
 * accepted, so an expression can never run code.
 */

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  // degree versions (physics problems state angles in degrees)
  sind: (x) => Math.sin((x * Math.PI) / 180),
  cosd: (x) => Math.cos((x * Math.PI) / 180),
  tand: (x) => Math.tan((x * Math.PI) / 180),
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export class CalcError extends Error {}

/** "2 × 10^3", "6.02×10²³", "3·4", "a÷b" → plain ASCII operators. */
function normalize(expr: string): string {
  const superscripts: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
  let s = expr.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => "^(" + m.split("").map((c) => superscripts[c]).join("") + ")");
  s = s
    .replace(/[×·✕*]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/π/g, "pi")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([0-9.]+)/g, "sqrt($1)")
    .replace(/\*\*/g, "^")
    .replace(/,(?=\d{3}\b)/g, "") // 1,000 → 1000
    .replace(/\s+/g, "");
  return s;
}

export function evaluateExpression(expression: string): number {
  const s = normalize(expression);
  if (!s) throw new CalcError("empty expression");
  if (s.length > 400) throw new CalcError("expression too long");
  let i = 0;

  const peek = () => s[i];
  const fail = (msg: string): never => {
    throw new CalcError(`${msg} at ${i} in "${s.slice(0, 80)}"`);
  };

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseUnary();
    for (;;) {
      const c = peek();
      if (c === "*" || c === "/") {
        i++;
        const r = parseUnary();
        v = c === "*" ? v * r : v / r;
      } else if (c === "(" || (c !== undefined && /[a-z]/i.test(c))) {
        // implicit multiplication: 2(3+4), 2pi, 3sqrt(2)
        v *= parseUnary();
      } else break;
    }
    return v;
  }
  function parseUnary(): number {
    if (peek() === "-") {
      i++;
      return -parseUnary();
    }
    if (peek() === "+") {
      i++;
      return parseUnary();
    }
    return parsePower();
  }
  function parsePower(): number {
    const base = parseAtom();
    if (peek() === "^") {
      i++;
      return Math.pow(base, parseUnary()); // right-associative
    }
    return base;
  }
  function parseAtom(): number {
    const c = peek();
    if (c === undefined) return fail("unexpected end");
    if (c === "(") {
      i++;
      const v = parseExpr();
      if (peek() !== ")") fail("missing )");
      i++;
      return v;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) return fail("bad number");
      // "2e" followed by a letter is "2 × e…", not an exponent — the regex only takes e when digits follow.
      i += m[0].length;
      return Number(m[0]);
    }
    if (/[a-z]/i.test(c)) {
      const m = /^[a-z][a-z0-9]*/i.exec(s.slice(i))!;
      const name = m[0].toLowerCase();
      i += m[0].length;
      if (FUNCTIONS[name]) {
        if (peek() !== "(") fail(`${name} needs (`);
        i++;
        const arg = parseExpr();
        if (peek() !== ")") fail("missing )");
        i++;
        return FUNCTIONS[name](arg);
      }
      if (name in CONSTANTS) return CONSTANTS[name]!;
      return fail(`unknown name "${name}"`);
    }
    return fail(`unexpected "${c}"`);
  }

  const value = parseExpr();
  if (i < s.length) fail(`unexpected "${s[i]}"`);
  if (!Number.isFinite(value)) throw new CalcError("result is not a finite number");
  return value;
}

export type CalcCheckInput = { label?: string; expression: string; claimedValue: number };
export type CalcCheckResult = CalcCheckInput & {
  /** Could the expression be evaluated at all? */
  evaluated: boolean;
  computedValue: number | null;
  /** Claimed and computed agree within rounding (1 %, or 0.005 absolute near zero). */
  agrees: boolean | null;
  error?: string;
};

/** Agreement within ordinary rounding of a worked solution. */
export function valuesAgree(claimed: number, computed: number): boolean {
  if (!Number.isFinite(claimed) || !Number.isFinite(computed)) return false;
  const diff = Math.abs(claimed - computed);
  if (diff <= 0.005) return true;
  const scale = Math.max(Math.abs(claimed), Math.abs(computed));
  return diff / scale <= 0.01;
}

export function runCalcChecks(checks: CalcCheckInput[]): CalcCheckResult[] {
  return checks.slice(0, 30).map((c) => {
    try {
      const computedValue = evaluateExpression(c.expression);
      return { ...c, evaluated: true, computedValue, agrees: valuesAgree(c.claimedValue, computedValue) };
    } catch (err) {
      return { ...c, evaluated: false, computedValue: null, agrees: null, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
