/**
 * Official Test Syllabus Engine for Atomic Pathshala
 * Generates an official, printable and downloadable Syllabus Document (Direct PDF & HTML)
 * containing institute header, batch details, test schedule, chapters and topic breakdown.
 */

import { jsPDF } from "jspdf";
import { getLogoDataUri } from "@/lib/logo";
import { formatISTDateTime } from "@/lib/date-utils";

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
  logoUri?: string | null;
  chapters: TestSyllabusChapterItem[];
  generatedAt?: Date | string;
}

/**
 * Generates authentic vector PDF buffer directly for downloadable Syllabus files.
 */
export async function generateTestSyllabusPdfBuffer(data: TestSyllabusData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header: Institute Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(12, 62, 164); // #0c3ea4
  doc.text("ATOMIC PATHSHALA", margin, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Learn • Explore • Excel", margin, y + 10);

  // Badge on right: OFFICIAL TEST SYLLABUS
  doc.setFillColor(12, 62, 164);
  doc.roundedRect(pageWidth - margin - 52, y, 52, 7.5, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("OFFICIAL TEST SYLLABUS", pageWidth - margin - 50, y + 5.2);

  y += 16;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Test Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(12, 62, 164);
  const splitTitle = doc.splitTextToSize(data.testName, contentWidth);
  doc.text(splitTitle, margin, y + 4);
  y += splitTitle.length * 5.5 + 2;

  // Meta: Schedule & Exam Type
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const scheduleText = data.openTime ? formatISTDateTime(data.openTime) : "To be announced";
  const metaLine = `Scheduled: ${scheduleText}  |  Exam: ${data.examType || "Standard"} (${data.durationMin} Mins)${
    data.batchName ? `  |  Batch: ${data.batchName}` : ""
  }`;
  doc.text(metaLine, margin, y + 2);
  y += 7;
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Group chapters by subject
  const subjectsMap: Record<string, TestSyllabusChapterItem[]> = {};
  for (const ch of data.chapters || []) {
    const sub = ch.subject || "General";
    if (!subjectsMap[sub]) subjectsMap[sub] = [];
    subjectsMap[sub].push(ch);
  }

  const subjectEntries = Object.entries(subjectsMap);
  if (subjectEntries.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Full Syllabus Assessment covering all topics according to the latest pattern.",
      margin,
      y + 5
    );
  } else {
    for (const [subject, chapters] of subjectEntries) {
      // Check page break
      if (y > pageHeight - 35) {
        doc.addPage();
        y = margin;
      }

      // Subject Header (Clean blue title with underline)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(12, 62, 164);
      doc.text(`${subject.toUpperCase()}  (${chapters.length} Chapter${chapters.length > 1 ? "s" : ""})`, margin, y + 4);
      y += 6;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + 60, y);
      y += 5;

      for (const ch of chapters) {
        if (y > pageHeight - 25) {
          doc.addPage();
          y = margin;
        }

        // Chapter bullet (bold chapter name, same font size as topics, clean text, no box line)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate-900

        const chapterLine = `•  ${ch.chapterTitle}`;
        const splitChapter = doc.splitTextToSize(chapterLine, contentWidth - 4);
        doc.text(splitChapter, margin + 2, y + 3);
        y += splitChapter.length * 4.2 + 1;

        // Subtopics (if any, and not complete chapter)
        if (!ch.isComplete && ch.topics && ch.topics.length > 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);

          for (const topic of ch.topics) {
            if (y > pageHeight - 20) {
              doc.addPage();
              y = margin;
            }
            const topicLine = `   –  ${topic}`;
            const splitTopic = doc.splitTextToSize(topicLine, contentWidth - 10);
            doc.text(splitTopic, margin + 6, y + 3);
            y += splitTopic.length * 3.8 + 0.5;
          }
        }

        // Custom topics
        if (ch.customTopics && ch.customTopics.length > 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);

          for (const cTopic of ch.customTopics) {
            if (y > pageHeight - 20) {
              doc.addPage();
              y = margin;
            }
            const cTopicLine = `   –  [Special] ${cTopic}`;
            const splitCTopic = doc.splitTextToSize(cTopicLine, contentWidth - 10);
            doc.text(splitCTopic, margin + 6, y + 3);
            y += splitCTopic.length * 3.8 + 0.5;
          }
        }

        y += 2;
      }

      y += 4;
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.text("Atomic Pathshala Academic Operations • All Rights Reserved", margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 18, pageHeight - 7);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/**
 * Generates clean, pure white HTML document for browser preview.
 */
export function generateTestSyllabusHtml(data: TestSyllabusData): string {
  const logoDataUri = data.logoUri || getLogoDataUri();

  const testScheduleStr = data.openTime
    ? formatISTDateTime(data.openTime)
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
        .map((ch) => {
          const topicsList =
            ch.topics && ch.topics.length > 0 && !ch.isComplete
              ? `<ul style="margin:4px 0 6px 28px; padding:0; list-style-type:circle; font-size:13px; color:#475569; line-height:1.6;">
                  ${ch.topics.map((t) => `<li style="margin-bottom:2px;">${t}</li>`).join("")}
                 </ul>`
              : "";

          const customTopicsList =
            ch.customTopics && ch.customTopics.length > 0
              ? `<div style="margin:4px 0 6px 28px;">
                  <span style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase;">Special Topics:</span>
                  <ul style="margin:2px 0 4px 18px; padding:0; list-style-type:circle; font-size:13px; color:#1e293b;">
                    ${ch.customTopics.map((ct) => `<li style="margin-bottom:2px; font-weight:600;">${ct}</li>`).join("")}
                  </ul>
                 </div>`
              : "";

          return `
            <div style="padding:4px 0;">
              <div style="font-size:13px; line-height:1.6; color:#0f172a;">
                <span style="color:#0c3ea4; margin-right:6px;">•</span>
                <strong style="font-weight:700;">${ch.chapterTitle}</strong>
              </div>
              ${topicsList}
              ${customTopicsList}
            </div>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom:24px; padding-bottom:12px; border-bottom:1px solid #f1f5f9;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
            <div style="width:4px; height:16px; background:#0c3ea4; border-radius:2px;"></div>
            <h3 style="margin:0; font-size:14px; font-weight:800; color:#0c3ea4; text-transform:uppercase; letter-spacing:0.5px;">
              ${subject} <span style="font-size:12px; font-weight:600; color:#64748b; text-transform:none;">(${chapters.length} Chapter${chapters.length > 1 ? "s" : ""})</span>
            </h3>
          </div>
          <div style="padding-left:12px;">
            ${chaptersList}
          </div>
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
      background: #ffffff;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px 32px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
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
      .sheet { border: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="no-print">
    <a href="javascript:window.close()" class="btn btn-outline">← Back</a>
    <a href="?download=true" class="btn btn-primary">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
      Direct Download PDF
    </a>
  </div>

  <div class="sheet">
    <!-- Header with Branding -->
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:16px; margin-bottom:20px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <img src="${logoDataUri}" alt="Atomic Pathshala" onerror="this.onerror=null;this.src='/brand/logo.png';" style="height:48px; width:48px; object-fit:contain;" />
        <div>
          <h1 style="margin:0; font-size:20px; font-weight:900; color:#0c3ea4; letter-spacing:-0.5px; line-height:1.2;">ATOMIC PATHSHALA</h1>
          <p style="margin:2px 0 0 0; font-size:11px; font-weight:600; color:#64748b;">Learn • Explore • Excel</p>
        </div>
      </div>
      <div style="text-align:right;">
        <span style="display:inline-block; background:#0c3ea4; color:#fff; font-size:10px; font-weight:800; padding:4px 10px; border-radius:4px; letter-spacing:0.5px; text-transform:uppercase;">
          OFFICIAL TEST SYLLABUS
        </span>
      </div>
    </div>

    <!-- Test Meta Details Card -->
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; margin-bottom:20px;">
      <h2 style="margin:0 0 6px 0; font-size:18px; font-weight:900; color:#0c3ea4; letter-spacing:-0.3px; line-height:1.2;">
        ${data.testName}
      </h2>
      <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px 16px; font-size:12px; color:#475569;">
        ${
          data.batchName
            ? `<span style="font-weight:700; color:#0c3ea4;">Batch: ${data.batchName}</span>`
            : ""
        }
        <div><strong>Scheduled:</strong> ${testScheduleStr}</div>
        <div><strong>Exam:</strong> ${data.examType || "Standard"} • ${data.durationMin} Mins</div>
      </div>
    </div>

    <!-- Syllabus Sections Breakdown -->
    <div>
      ${
        data.chapters && data.chapters.length > 0
          ? subjectsHtml
          : `<div style="text-align:center; padding:24px 16px; color:#64748b; font-size:13px;">
              Full Syllabus test covering all topics of the curriculum according to latest NTA / exam pattern.
             </div>`
      }
    </div>

    <!-- Footer Notice -->
    <div style="margin-top:24px; padding-top:12px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#94a3b8;">
      <div>Atomic Pathshala Academic Operations • All Rights Reserved</div>
      <div>Questions or doubts? Reach out via Academic Doubt Solver</div>
    </div>
  </div>

</body>
</html>`;
}
