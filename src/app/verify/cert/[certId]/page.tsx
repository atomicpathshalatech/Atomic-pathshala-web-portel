import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { formatISTDateTime } from "@/lib/date-utils";
import { verifyCertificatePublic } from "@/lib/employees/certificate-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Official Certificate Verification | Atomic Pathshala Education",
  description: "Official public verification portal for service letters and certificates issued by Atomic Pathshala Education.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: { certId: string };
}) {
  const req = new Request("https://verify.local/", { headers: headers() });
  const clientIp = getClientIp(req);
  const userAgent = headers().get("user-agent") || undefined;

  const rl = await checkRateLimit(req, "PUBLIC", `cert-verify:${clientIp}`);
  const limited = !rl.success;

  if (limited) {
    return (
      <main className="min-h-[100dvh] bg-gradient-to-b from-[#06173a] via-[#0a2463] to-[#eef4ff] px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 text-center shadow-2xl space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-2xl">
            !
          </div>
          <h2 className="font-bold text-slate-900 text-lg">Too Many Requests</h2>
          <p className="text-sm text-slate-600">
            Please wait a moment and scan the certificate QR code again.
          </p>
        </div>
      </main>
    );
  }

  const rawCertId = params.certId;
  const result = await verifyCertificatePublic(rawCertId, { ip: clientIp, userAgent });

  const toneClasses = {
    success: {
      bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-800",
      badge: "bg-emerald-600 text-white",
      icon: "✓",
    },
    danger: {
      bg: "bg-rose-500/10 border-rose-500/30 text-rose-800",
      badge: "bg-rose-600 text-white",
      icon: "✕",
    },
  }[result.statusBadge.tone] || {
    bg: "bg-slate-500/10 border-slate-500/30 text-slate-800",
    badge: "bg-slate-600 text-white",
    icon: "•",
  };

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-[#06173a] via-[#0a2463] to-[#eef4ff] px-4 py-8 flex justify-center items-start sm:items-center">
      <div className="w-full max-w-lg space-y-5">
        {/* Enterprise Header */}
        <div className="flex items-center gap-3.5 text-white px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt={result.brandName}
            className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight uppercase leading-tight text-white/95">
              {result.enterpriseName}
            </h1>
            <p className="text-xs text-blue-200 font-medium">
              Official Certificate Authenticity & Verification Portal
            </p>
          </div>
        </div>

        {/* Certificate Card */}
        <div className="rounded-3xl bg-white shadow-2xl border border-blue-100 overflow-hidden">
          {/* Status Header */}
          <div className={`px-6 py-4 border-b flex items-center justify-between gap-3 ${toneClasses.bg}`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shadow ${toneClasses.badge}`}>
                {toneClasses.icon}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Verification Status
                </p>
                <p className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                  {result.statusBadge.label}
                </p>
              </div>
            </div>
            <div>
              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-900 text-white">
                OFFICIAL RECORD
              </span>
            </div>
          </div>

          <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-xs text-slate-600 leading-relaxed">
            {result.statusBadge.description}
          </div>

          {result.certificate ? (
            <div className="p-6 space-y-6">
              {/* Document Reference Header */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-100 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                  {result.certificate.certificateType}
                </span>
                <p className="text-lg font-black text-slate-900 font-mono tracking-wide pt-1">
                  {result.certificate.certificateNumber}
                </p>
                <p className="text-xs text-slate-500">
                  Date of Issue: <span className="font-semibold text-slate-800">{result.certificate.issueDate}</span>
                </p>
              </div>

              {/* Recipient Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Issued To & Position
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <dt className="text-slate-400 text-[10px] uppercase tracking-wider">Candidate / Employee</dt>
                    <dd className="font-bold text-slate-900 text-sm mt-0.5">{result.certificate.employeeName}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <dt className="text-slate-400 text-[10px] uppercase tracking-wider">Employee ID</dt>
                    <dd className="font-black text-slate-900 text-sm font-mono mt-0.5">{result.certificate.employeeId}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <dt className="text-slate-400 text-[10px] uppercase tracking-wider">Designation</dt>
                    <dd className="font-semibold text-slate-800 text-xs mt-0.5">{result.certificate.designation}</dd>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <dt className="text-slate-400 text-[10px] uppercase tracking-wider">Department</dt>
                    <dd className="font-semibold text-slate-800 text-xs mt-0.5">{result.certificate.department}</dd>
                  </div>
                </dl>
              </div>

              {/* Digital Signature & Authority */}
              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Authorized Signatory:</span>
                  <span className="font-bold text-slate-900">{result.certificate.issuedBy}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Issuing Enterprise:</span>
                  <span className="font-bold text-slate-900">{result.enterpriseName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Location:</span>
                  <span className="text-slate-700">{result.location}</span>
                </div>
                {result.certificate.pdfHash && (
                  <div className="pt-2">
                    <span className="text-slate-400 block text-[10px]">Document Cryptographic Fingerprint (SHA-256):</span>
                    <span className="font-mono text-[9px] text-slate-600 break-all bg-slate-100 px-1.5 py-0.5 rounded block mt-0.5">
                      {result.certificate.pdfHash}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-400 pt-1 text-[10px]">
                  <span>Verification Checked:</span>
                  <span>{formatISTDateTime(new Date())} IST</span>
                </div>
              </div>

              {/* Security & Verification Notice (Public Downloads Disabled) */}
              <div className="pt-2">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-xs text-slate-500 space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-bold text-xs">
                    <span>✓</span>
                    <span>Authentic Institutional Document Verified</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    This public portal only verifies document authenticity and cryptographic fingerprint. Direct document downloads are restricted to authorized personnel.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-3xl font-black">
                ✕
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Certificate Not Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  The certificate reference or token <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">{rawCertId}</code> is not recorded in our database.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-300">
          <p>
            Official Enterprise Registry of{" "}
            <Link href={result.website} className="text-white hover:underline font-semibold">
              ATOMIC PATHSHALA EDUCATION
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
