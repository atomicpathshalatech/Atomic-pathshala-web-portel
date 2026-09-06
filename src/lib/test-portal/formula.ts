import katex from "katex";

type Segment = { type: "text" | "inline" | "block" | "image" | "bold"; content: string; width?: string };

function parseSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /!\[(.*?)\]\((.+?)\)|\$\$(.+?)\$\$|\$(.+?)\$|\*\*(.+?)\*\*/gs;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: input.slice(lastIndex, match.index) });
    }
    if (match[2] !== undefined && match[1] !== undefined) {
      segments.push({ type: "image", content: match[2], width: match[1] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "block", content: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ type: "inline", content: match[4] });
    } else if (match[5] !== undefined) {
      segments.push({ type: "bold", content: match[5] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < input.length) {
    segments.push({ type: "text", content: input.slice(lastIndex) });
  }
  return segments;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderFormulaContent(input: string): string {
  if (!input) return "";
  const segments = parseSegments(input);
  return segments
    .map((seg) => {
      if (seg.type === "text") {
        return escapeHtml(seg.content).replace(/\n/g, "<br/>");
      }
      if (seg.type === "bold") {
        return `<strong>${escapeHtml(seg.content).replace(/\n/g, "<br/>")}</strong>`;
      }
      if (seg.type === "image") {
        let width = "60%";
        const rawWidth = (seg.width || "").trim();
        if (/^\d+%?$/.test(rawWidth)) {
          width = rawWidth.endsWith("%") ? rawWidth : `${rawWidth}%`;
        } else if (/^\d+px$/.test(rawWidth)) {
          width = rawWidth;
        }
        return `<img src="${escapeHtml(seg.content)}" style="width:${width};max-width:100%;height:auto;display:block;margin:8px 0;border-radius:8px;" alt="Diagram" />`;
      }
      try {
        const cleanFormula = seg.content.replace(/\\\\/g, "\\");
        return katex.renderToString(cleanFormula, {
          throwOnError: false,
          displayMode: seg.type === "block",
        });
      } catch {
        return escapeHtml(seg.content);
      }
    })
    .join("");
}
