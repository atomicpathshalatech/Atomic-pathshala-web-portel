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
  const withLineBreaks = text.replace(/\n/g, "  \n");

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
