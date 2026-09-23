"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import "katex/dist/katex.min.css";

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * KaTeX only superscripts/subscripts a SINGLE token after `^`/`_` unless
 * it's wrapped in `{...}` — so AI-generated LaTeX like "10^23" or "s^-1"
 * (missing braces around multi-digit or signed exponents) renders as
 * "10²3" / "s⁻1" with only the first character raised, which is exactly
 * the "powers look wrong" bug this fixes. Scoped to inside $...$ / $$...$$
 * math segments only, so it never touches markdown's own use of `_` for
 * italics elsewhere in the text.
 */
function autoBraceExponents(mathSegment: string): string {
  return mathSegment.replace(/([_^])(?!\{)(-?\d+)/g, "$1{$2}");
}

function fixMathFormatting(text: string): string {
  return text.replace(/(\${1,2})([\s\S]+?)\1/g, (_match, delims: string, inner: string) => {
    return `${delims}${autoBraceExponents(inner)}${delims}`;
  });
}

/**
 * Renders quiz question/option/explanation text with the same math
 * formatting (KaTeX) used in the chat, so things like "kg m^2 s^-2"
 * render as proper superscripts instead of raw caret text.
 *
 * Single newlines in the source text are treated as line breaks (not
 * collapsed into one line), so Column-I/Column-II, Assertion-Reason,
 * and multi-statement questions keep their intended layout.
 */
export function MathText({ text, className }: MathTextProps) {
  // Turn every single newline into a markdown hard line-break
  // (two trailing spaces + newline) so line structure is preserved
  // without needing an extra remark-breaks dependency.
  const withLineBreaks = fixMathFormatting(text).replace(/\n/g, "  \n");

  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        skipHtml
        components={{
          // Render paragraphs inline (as a plain span) so this component
          // stays a drop-in replacement for plain text inside existing
          // <p>/<button>/<span> layouts, instead of adding its own
          // block-level margins.
          p: ({ children }) => <span>{children}</span>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2"
            >
              {children}
            </a>
          ),
        }}
      >
        {withLineBreaks}
      </ReactMarkdown>
    </span>
  );
}
