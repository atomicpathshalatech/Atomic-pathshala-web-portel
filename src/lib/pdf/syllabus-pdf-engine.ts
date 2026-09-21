/**
 * Official Test Syllabus Engine for Atomic Pathshala
 * Generates an official, printable and downloadable Syllabus Document
 * containing institute header, batch details, test schedule, chapters and topic breakdown.
 */

export interface TestSyllabusChapterItem {
  id: string;
  subject: string;
  chapterTitle: string;
  isComplete: boolean;
  topics: string[];
  customTopics?: string[];
}

export interface TestSyllabusData {
  testId: string;
  testName: string;
  testCode?: string | null;
  durationMin: number;
  openTime?: Date | string | null;
  examType?: string | null;
  testType?: string | null;
  batchName?: string | null;
  chapters: TestSyllabusChapterItem[];
  generatedAt?: Date | string;
}

export function generateTestSyllabusHtml(data: TestSyllabusData): string {
  const generatedDate = new Date(data.generatedAt || Date.now()).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const testScheduleStr = data.openTime
    ? new Date(data.openTime).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
    : "To be announced";

  // Group chapters by Subject
  const subjectsMap: Record<string, TestSyllabusChapterItem[]> = {};
  for (const ch of data.chapters || []) {
    const sub = ch.subject || "General";
    if (!subjectsMap[sub]) subjectsMap[sub] = [];
    subjectsMap[sub].push(ch);
  }

  const subjectsHtml = Object.entries(subjectsMap)
    .map(([subject, chapters]) => {
      const chaptersList = chapters
        .map((ch, idx) => {
          const isCompleteBadge = ch.isComplete
            ? `<div style="display:inline-block; background-color:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:700; margin-bottom:6px;">✓ COMPLETE CHAPTER INCLUDED</div>`
            : "";

          const topicsList =
            ch.topics && ch.topics.length > 0 && !ch.isComplete
              ? `<ul style="margin:4px 0 8px 18px; padding:0; list-style-type:disc; font-size:12px; color:#334155;">
                  ${ch.topics.map((t) => `<li style="margin-bottom:2px;">${t}</li>`).join("")}
                 </ul>`
              : "";

          const customTopicsList =
            ch.customTopics && ch.customTopics.length > 0
              ? `<div style="margin-top:6px;">
                  <span style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Special / Custom Topics:</span>
                  <ul style="margin:2px 0 6px 18px; padding:0; list-style-type:circle; font-size:12px; color:#1e293b;">
                    ${ch.customTopics.map((ct) => `<li style="margin-bottom:2px; font-weight:600;">${ct}</li>`).join("")}
                  </ul>
                 </div>`
              : "";

          return `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <h4 style="margin:0; font-size:14px; font-weight:800; color:#0f172a;">
                  ${idx + 1}. ${ch.chapterTitle}
                </h4>
                ${isCompleteBadge}
              </div>
              ${topicsList}
              ${customTopicsList}
            </div>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom:24px;">
          <div style="display:flex; align-items:center; gap:8px; border-bottom:2px solid #0c3ea4; padding-bottom:6px; margin-bottom:12px;">
            <div style="width:8px; height:18px; background:#0c3ea4; border-radius:2px;"></div>
            <h3 style="margin:0; font-size:16px; font-weight:800; color:#0c3ea4; text-transform:uppercase; letter-spacing:0.5px;">
              ${subject}
            </h3>
            <span style="margin-left:auto; font-size:11px; font-weight:700; color:#64748b;">
              ${chapters.length} Chapter${chapters.length > 1 ? "s" : ""}
            </span>
          </div>
          ${chaptersList}
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.testName} - Official Syllabus | Atomic Pathshala</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px 44px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
      position: relative;
    }
    .no-print {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 820px;
      margin: 0 auto 16px auto;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn-primary { background: #0c3ea4; color: #fff; }
    .btn-primary:hover { background: #092c77; }
    .btn-outline { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
    .btn-outline:hover { background: #f8fafc; }

    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border: none; padding: 20px; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="no-print">
    <a href="javascript:window.close()" class="btn btn-outline">← Back</a>
    <button onclick="window.print()" class="btn btn-primary">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/><path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/></svg>
      Print / Save as PDF
    </button>
  </div>

  <div class="sheet">
    <!-- Header with Branding -->
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:16px; margin-bottom:20px;">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <h1 style="margin:0; font-size:24px; font-weight:900; color:#0c3ea4; letter-spacing:-0.5px;">ATOMIC PATHSHALA</h1>
        </div>
        <p style="margin:3px 0 0 0; font-size:12px; font-weight:600; color:#64748b;">Premier Medical & Engineering Assessment Portal</p>
      </div>
      <div style="text-align:right;">
        <span style="display:inline-block; background:#0c3ea4; color:#fff; font-size:11px; font-weight:800; padding:4px 10px; border-radius:6px; letter-spacing:0.5px;">
          OFFICIAL TEST SYLLABUS
        </span>
        <p style="margin:4px 0 0 0; font-size:11px; color:#94a3b8; font-family:monospace;">Published: ${generatedDate}</p>
      </div>
    </div>

    <!-- Test Meta Details Card -->
    <div style="background:#f1f5f9; border-radius:10px; padding:16px 20px; margin-bottom:24px; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:14px;">
      <div>
        <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Test Title</div>
        <div style="font-size:15px; font-weight:800; color:#0f172a; margin-top:2px;">${data.testName}</div>
      </div>
      <div>
        <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Batch</div>
        <div style="font-size:14px; font-weight:700; color:#0c3ea4; margin-top:2px;">${data.batchName || "All Enrolled Batches"}</div>
      </div>
      <div>
        <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Scheduled Date & Time</div>
        <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">${testScheduleStr}</div>
      </div>
      <div>
        <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Exam Type & Duration</div>
        <div style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">${data.examType || "Standard"} • ${data.durationMin} Mins</div>
      </div>
    </div>

    <!-- Syllabus Sections Breakdown -->
    <div>
      ${
        data.chapters && data.chapters.length > 0
          ? subjectsHtml
          : `<div style="text-align:center; padding:32px 16px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; color:#64748b; font-size:13px;">
              Full Syllabus test covering all topics of the curriculum according to latest NTA / exam pattern.
             </div>`
      }
    </div>

    <!-- Footer Notice -->
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#94a3b8;">
      <div>Atomic Pathshala Academic Operations • All Rights Reserved</div>
      <div>Questions or doubts? Reach out via Academic Doubt Solver</div>
    </div>
  </div>

</body>
</html>`;
}
