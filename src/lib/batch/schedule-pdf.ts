import "server-only";
import { prisma } from "@/lib/db";
import { getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";
import { cleanBatchName } from "@/lib/academic/canonical-courses";

/**
 * Subject-wise class schedule of one batch as a printable page — built from
 * the batch timetable each time it is opened, so it is always up to date.
 * Newest class on top; each row says whether its class notes are there.
 */

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const IST = "Asia/Kolkata";
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit", month: "short", year: "numeric" });
const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short" });
const fmtTime = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });

export type BatchScheduleSubject = { subject: string; classes: number; lastClassAt: string | null };

/** Subjects that have classes in this batch's timetable. */
export async function batchScheduleSubjects(batchId: string): Promise<BatchScheduleSubject[]> {
  const rows = await prisma.batchSchedule.findMany({
    where: { batchId, type: "LIVE_CLASS" },
    select: { subject: true, startsAt: true, chapter: { select: { subject: { select: { title: true } } } } },
  });
  const map = new Map<string, BatchScheduleSubject>();
  for (const r of rows) {
    const subject = (r.chapter?.subject?.title || r.subject || "General").trim();
    const cur = map.get(subject) ?? { subject, classes: 0, lastClassAt: null };
    cur.classes++;
    const at = r.startsAt.toISOString();
    if (!cur.lastClassAt || at > cur.lastClassAt) cur.lastClassAt = at;
    map.set(subject, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject));
}

export async function buildBatchScheduleHtml(
  batchId: string,
  subject: string | null,
  logoUrl: string | null
): Promise<{ html: string; fileName: string } | null> {
  const batch = await prisma.batch.findUnique({ where: { id: batchId }, select: { name: true, code: true } });
  if (!batch) return null;
  const all = await prisma.batchSchedule.findMany({
    where: { batchId, type: "LIVE_CLASS" },
    select: {
      id: true,
      title: true,
      subject: true,
      status: true,
      type: true,
      startsAt: true,
      endsAt: true,
      rescheduleCount: true,
      previousStartsAt: true,
      teacher: { select: { displayName: true, user: { select: { name: true } } } },
      chapter: { select: { title: true, subject: { select: { title: true } } } },
      liveWhiteboardSession: {
        select: { status: true, livePhase: true, actualStartedAt: true, pdfStatus: true, youtubeVideoId: true, videoTransport: true },
      },
    },
    orderBy: { startsAt: "desc" },
  });
  const subjectOf = (r: (typeof all)[number]) => (r.chapter?.subject?.title || r.subject || "General").trim();
  const rows = subject ? all.filter((r) => subjectOf(r).toLowerCase() === subject.toLowerCase()) : all;
  const now = new Date();

  let done = 0;
  let upcoming = 0;
  let notesMissing = 0;
  const body = rows
    .map((r, i) => {
      const eff = getEffectiveScheduleStatus(
        { id: r.id, startsAt: r.startsAt, endsAt: r.endsAt, status: r.status, type: r.type, liveWhiteboardSession: r.liveWhiteboardSession } as never,
        now
      );
      const hasNotes = r.liveWhiteboardSession?.pdfStatus === "READY";
      let statusLabel = "Upcoming";
      let statusCls = "up";
      let notes = "—";
      let notesCls = "";
      if (eff === "COMPLETED") {
        statusLabel = "Completed";
        statusCls = "ok";
        done++;
        if (hasNotes) {
          notes = "Available";
          notesCls = "ok";
        } else {
          notes = "Missing";
          notesCls = "bad";
          notesMissing++;
        }
      } else if (eff === "CANCELLED") {
        statusLabel = "Missed / Cancelled";
        statusCls = "bad";
      } else if (eff === "LIVE") {
        statusLabel = "Live now";
        statusCls = "live";
      } else upcoming++;
      const remark =
        r.rescheduleCount > 0 && r.previousStartsAt
          ? `Updated — rescheduled from ${fmtDate(r.previousStartsAt)}, ${fmtTime(r.previousStartsAt)}`
          : "";
      const chapter = r.chapter?.title ?? "";
      const title = chapter && r.title.startsWith(chapter) ? r.title.slice(chapter.length).replace(/^\s*[—\-:]\s*/, "") || r.title : r.title;
      return `<tr>
        <td class="n">${rows.length - i}</td>
        <td class="d"><b>${esc(fmtDate(r.startsAt))}</b><span>${esc(fmtDay(r.startsAt))}</span></td>
        <td class="t">${esc(fmtTime(r.startsAt))} – ${esc(fmtTime(r.endsAt))}</td>
        <td class="c">${chapter ? `<span class="ch">${esc(chapter)}</span>` : ""}<b>${esc(title)}</b>${remark ? `<span class="rm">${esc(remark)}</span>` : ""}</td>
        ${subject ? "" : `<td>${esc(subjectOf(r))}</td>`}
        <td>${esc(r.teacher?.user?.name || r.teacher?.displayName || "—")}</td>
        <td><span class="pill ${statusCls}">${statusLabel}</span></td>
        <td><span class="pill ${notesCls}">${notes}</span></td>
      </tr>`;
    })
    .join("");

  const batchName = cleanBatchName(batch.name);
  const heading = subject ? `${subject} — Class Schedule` : "Class Schedule";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(heading)} · ${esc(batchName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tinos:wght@400;700&family=Noto+Serif+Devanagari:wght@400;600&display=swap" rel="stylesheet">
<style>
  /* Plain and readable: Times New Roman (Tinos on the server), regular weight, no stretched letters. */
  @page { size: A4; margin: 12mm 11mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Times New Roman', 'Tinos', 'Noto Serif Devanagari', serif; color: #222; font-size: 11pt; font-weight: 400; }
  @media screen { body { max-width: 210mm; margin: 0 auto; padding: 12mm 11mm; } }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 0 8px; border-bottom: 1.5px solid #222; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand img { width: 38px; height: 38px; }
  .brand b { font-size: 15pt; font-weight: 700; display: block; color: #222; }
  .brand span { font-size: 10pt; color: #c2410c; }
  .head .upd { text-align: right; font-size: 9pt; color: #666; }
  .head .upd b { display: block; color: #222; font-size: 10pt; font-weight: 400; }
  h1 { font-size: 16pt; font-weight: 700; margin: 12px 0 2px; }
  .sub { color: #555; font-size: 10pt; }
  .stats { display: flex; gap: 18px; margin: 8px 0 10px; font-size: 10pt; color: #555; }
  .stat b { font-weight: 700; color: #222; margin-right: 3px; }
  .stat span { }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { text-align: left; font-size: 10pt; font-weight: 700; color: #222; padding: 6px 7px; border-top: 1px solid #222; border-bottom: 1px solid #222; }
  td { padding: 6px 7px; border-bottom: 1px solid #ddd; vertical-align: top; font-weight: 400; }
  tr { break-inside: avoid; }
  td.n { color: #777; width: 26px; }
  td.d b { display: block; white-space: nowrap; font-weight: 400; }
  td.d span { color: #777; font-size: 9.5pt; }
  td.t { white-space: nowrap; }
  td.c b { display: block; font-weight: 400; }
  .ch { display: block; color: #c2410c; font-size: 10pt; }
  .rm { display: block; color: #92400e; font-size: 9.5pt; margin-top: 2px; }
  .pill { display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 9.5pt; background: #f1f1f1; color: #444; white-space: nowrap; }
  .pill.ok { background: #e8f6ec; color: #166534; }
  .pill.bad { background: #fdecec; color: #991b1b; }
  .pill.up { background: #eaf1ff; color: #1d4ed8; }
  .pill.live { background: #e8f6ec; color: #15803d; }
  .empty { text-align: center; color: #777; padding: 40px 0; }
  .foot { margin-top: 10px; font-size: 9pt; color: #777; text-align: center; }
</style></head><body>
  <div class="head">
    <div class="brand">${logoUrl ? `<img src="${esc(logoUrl)}" alt="">` : ""}<div><b>ATOMIC PATHSHALA</b><span>${esc(batchName)}</span></div></div>
    <div class="upd">Updated on<b>${esc(fmtDate(now))}, ${esc(fmtTime(now))}</b></div>
  </div>
  <h1>${esc(heading)}</h1>
  <div class="sub">${esc(batchName)} · ${esc(batch.code)} · latest class first</div>
  <div class="stats">
    <div class="stat"><b>${rows.length}</b><span>Classes</span></div>
    <div class="stat"><b>${done}</b><span>Completed</span></div>
    <div class="stat"><b>${upcoming}</b><span>Upcoming</span></div>
    <div class="stat"><b>${notesMissing}</b><span>Notes missing</span></div>
  </div>
  ${
    rows.length
      ? `<table><thead><tr><th>#</th><th>Date</th><th>Time (IST)</th><th>Chapter / Lecture</th>${subject ? "" : "<th>Subject</th>"}<th>Teacher</th><th>Status</th><th>Notes</th></tr></thead><tbody>${body}</tbody></table>`
      : `<div class="empty">No classes in this schedule yet.</div>`
  }
  <div class="foot">This schedule updates automatically as classes are added, moved or completed · atomicpathshala.in</div>
</body></html>`;
  const safe = (s: string) => s.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return { html, fileName: `${safe(batchName)} - ${safe(subject || "All Subjects")} Schedule.pdf` };
}
