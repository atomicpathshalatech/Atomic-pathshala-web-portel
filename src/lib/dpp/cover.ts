import "server-only";
import { prisma } from "@/lib/db";
import { getDppBrand } from "@/lib/dpp/brand";
import { buildDppCoverQrs, renderDppCoverHtml } from "@/lib/dpp/cover-html";
import { dppNumberLabel } from "@/lib/dpp/hierarchy";

const DPP_TEST_PREFIX = "DPPT-";

/** Front page for a DPP, or null if the DPP doesn't exist. */
export async function buildDppCoverHtml(dppId: string, opts: { logoUrl: string | null; solutions: boolean }): Promise<string | null> {
  const dpp = await prisma.dpp.findUnique({
    where: { id: dppId },
    include: { _count: { select: { questions: true } } },
  });
  if (!dpp) return null;
  const brand = await getDppBrand();
  const qrs = await buildDppCoverQrs(brand);
  return renderDppCoverHtml(
    {
      dppNumberLabel: dppNumberLabel(dpp),
      name: dpp.name,
      subject: dpp.subject,
      className: dpp.className,
      exam: dpp.exam,
      chapter: dpp.chapter && dpp.chapter !== "Unclassified" ? dpp.chapter : null,
      topic: dpp.topic ?? (dpp.topics.length === 1 ? dpp.topics[0] : dpp.topics.join(", ") || null),
      subTopic: dpp.subTopic,
      questionCount: dpp._count.questions,
      difficulty: dpp.difficulty,
      teacher: dpp.facultyName,
      durationMin: dpp.estimatedTimeMin,
      correctMarks: dpp.correctMarks,
      incorrectMarks: dpp.negativeMarkingEnabled ? dpp.incorrectMarks : 0,
      solutions: opts.solutions,
    },
    brand,
    qrs,
    opts.logoUrl
  );
}

/** Same, for a DPP's backing test (code "DPPT-<dpp id>"); null for any other test. */
export async function buildDppCoverForTestCode(code: string | null | undefined, opts: { logoUrl: string | null; solutions: boolean }) {
  if (!code?.startsWith(DPP_TEST_PREFIX)) return null;
  return buildDppCoverHtml(code.slice(DPP_TEST_PREFIX.length), opts).catch((err) => {
    console.error("[dpp_cover_error]", err);
    return null;
  });
}
