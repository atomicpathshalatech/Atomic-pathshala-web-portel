import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { loadPublicVerification } from "@/lib/id-card/data";
import { VERIFICATION_COPY } from "@/lib/id-card/format";
import { formatISTDateTime } from "@/lib/date-utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ID Card Verification",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Public page the ID-card QR code opens (no login). The token in the URL is
 * random (128 bits) and is the only key — no database id, no personal data in
 * the QR. Shows only what is needed to confirm identity, and a revoked card
 * or an inactive person never shows as valid.
 */
export default async function VerifyIdCardPage({ params }: { params: { token: string } }) {
  // Per visitor IP, own bucket — slows down anyone trying to guess tokens.
  const req = new Request("https://verify.local/", { headers: headers() });
  const rl = await checkRateLimit(req, "PUBLIC", `id-card-verify:${getClientIp(req)}`);
  const limited = !rl.success;
  const result = limited ? null : await loadPublicVerification(params.token);

  const tone = result ? VERIFICATION_COPY[result.state].tone : "bad";
  const toneCls =
    tone === "ok"
      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
      : tone === "warn"
      ? "bg-amber-50 border-amber-300 text-amber-800"
      : "bg-rose-50 border-rose-300 text-rose-800";
  const icon = tone === "ok" ? "verified" : tone === "warn" ? "info" : "gpp_bad";

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-[#0a2463] via-[#0f3a9e] to-[#eef4ff] px-4 py-8 flex justify-center">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-3 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img src="/brand/logo.png" alt="" className="w-12 h-12 rounded-xl bg-white p-0.5" />
          <div>
            <p className="text-lg font-bold leading-tight">Atomic Pathshala</p>
            <p className="text-xs text-blue-100">ID card verification</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white shadow-xl overflow-hidden">
          {limited ? (
            <div className="p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-[44px] text-amber-500">hourglass_top</span>
              <p className="font-bold text-slate-900">Too many checks right now</p>
              <p className="text-sm text-slate-600">Please wait a minute and scan the card again.</p>
            </div>
          ) : !result ? (
            <div className="p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-[44px] text-rose-500">gpp_bad</span>
              <p className="font-bold text-slate-900">Not a valid Atomic Pathshala ID card</p>
              <p className="text-sm text-slate-600">
                This QR code does not match any current ID card. The card may have been replaced or is not genuine.
              </p>
            </div>
          ) : (
            <>
              <div className={`flex items-center gap-2 px-5 py-3 border-b ${toneCls}`}>
                <span className="material-symbols-outlined text-[24px]">{icon}</span>
                <p className="font-bold text-sm">{VERIFICATION_COPY[result.state].title}</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  {result.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- uploaded photo on object storage
                    <img src={result.photoUrl} alt="" className="w-20 h-[100px] rounded-xl object-cover border-2 border-[#1d4ed8]" />
                  ) : (
                    <div className="w-20 h-[100px] rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[32px] text-slate-400">person</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#1d4ed8]">{result.kind === "TEAM" ? "Team member" : "Student"}</p>
                    <p className="text-xl font-bold text-slate-900 break-words">{result.name}</p>
                  </div>
                </div>
                {result.lines.length > 0 && (
                  <dl className="divide-y divide-slate-100 border-t border-slate-100">
                    {result.lines.map((l) => (
                      <div key={l.label} className="flex justify-between gap-4 py-2 text-sm">
                        <dt className="text-slate-500">{l.label}</dt>
                        <dd className="font-semibold text-slate-900 text-right break-words">{l.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="text-[11px] text-slate-500">Checked {formatISTDateTime(result.checkedAt)} IST</p>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-slate-600 text-center px-4">
          This page only confirms whether an Atomic Pathshala ID card is genuine and currently valid. Personal details are never shown here.
        </p>
        <p className="text-center">
          <Link href="/" className="text-xs font-bold text-[#0f3a9e]">
            atomicpathshala.in
          </Link>
        </p>
      </div>
    </main>
  );
}
