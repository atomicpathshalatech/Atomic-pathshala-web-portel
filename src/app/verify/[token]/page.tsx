import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { loadPublicVerification } from "@/lib/id-card/data";
import { VERIFICATION_COPY } from "@/lib/id-card/format";
import { formatISTDateTime } from "@/lib/date-utils";
import { verifyEmployeePublic } from "@/lib/employees/employee-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Official Credential Verification | Atomic Pathshala",
  description: "Official public credential and identity verification system for Atomic Pathshala Education.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyCredentialPage({
  params,
}: {
  params: { token: string };
}) {
  const req = new Request("https://verify.local/", { headers: headers() });
  const clientIp = getClientIp(req);
  const userAgent = headers().get("user-agent") || undefined;

  // Rate limiting to prevent token brute force
  const rl = await checkRateLimit(req, "PUBLIC", `credential-verify:${clientIp}`);
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
            For security purposes, verification requests are temporarily rate-limited. Please wait a moment and scan again.
          </p>
        </div>
      </main>
    );
  }

  const rawToken = params.token;
  const isEmployeePattern = rawToken.toUpperCase().startsWith("AP-EMP-");

  // Attempt Employee verification first if it looks like an employee ID or if we test token
  let employeeResult = null;
  try {
    const empCheck = await verifyEmployeePublic(rawToken, { ip: clientIp, userAgent });
    if (empCheck.officialStatus !== "INVALID_EMPLOYEE_ID" || isEmployeePattern) {
      employeeResult = empCheck;
    }
  } catch (err) {
    console.error("Employee verification check error:", err);
  }

  // If Employee credential matched or token was definitely an AP-EMP- id:
  if (employeeResult) {
    const { officialStatus, statusBadge, employee, enterpriseName, brandName, location, website } = employeeResult;

    const toneClasses = {
      success: {
        bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
        badge: "bg-emerald-600 text-white shadow-emerald-500/20",
        icon: "✓",
        glow: "border-emerald-500/40",
      },
      info: {
        bg: "bg-sky-500/10 border-sky-500/30 text-sky-700",
        badge: "bg-sky-600 text-white shadow-sky-500/20",
        icon: "ℹ",
        glow: "border-sky-500/40",
      },
      warning: {
        bg: "bg-amber-500/10 border-amber-500/30 text-amber-700",
        badge: "bg-amber-500 text-white shadow-amber-500/20",
        icon: "⚠",
        glow: "border-amber-500/40",
      },
      danger: {
        bg: "bg-rose-500/10 border-rose-500/30 text-rose-700",
        badge: "bg-rose-600 text-white shadow-rose-500/20",
        icon: "✕",
        glow: "border-rose-500/40",
      },
    }[statusBadge.tone] || {
      bg: "bg-slate-500/10 border-slate-500/30 text-slate-700",
      badge: "bg-slate-600 text-white shadow-slate-500/20",
      icon: "•",
      glow: "border-slate-500/40",
    };

    return (
      <main className="min-h-[100dvh] bg-gradient-to-b from-[#06173a] via-[#0a2463] to-[#eef4ff] px-4 py-8 flex justify-center items-start sm:items-center">
        <div className="w-full max-w-lg space-y-5">
          {/* Official Enterprise Branding */}
          <div className="flex items-center gap-3.5 text-white px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt={brandName}
              className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md object-contain"
            />
            <div className="min-w-0">
              <h1 className="text-base font-extrabold tracking-tight uppercase leading-tight text-white/95">
                {enterpriseName}
              </h1>
              <p className="text-xs text-blue-200 font-medium">
                {brandName} • Official Employee Verification Portal
              </p>
            </div>
          </div>

          {/* Main Verification Card */}
          <div className="rounded-3xl bg-white shadow-2xl border border-blue-100 overflow-hidden">
            {/* Verification Status Banner */}
            <div className={`px-6 py-4 border-b flex items-center justify-between gap-3 ${toneClasses.bg}`}>
              <div className="flex items-center gap-2.5">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shadow ${toneClasses.badge}`}>
                  {toneClasses.icon}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Official Verification Result
                  </p>
                  <p className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                    {statusBadge.label}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-900 text-white">
                  RECORD VERIFIED
                </span>
              </div>
            </div>

            {/* Description alert */}
            <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-xs text-slate-600 leading-relaxed">
              {statusBadge.description}
            </div>

            {employee ? (
              <div className="p-6 space-y-6">
                {/* Employee Profile Header */}
                <div className="flex items-start gap-4 pb-5 border-b border-slate-100">
                  {employee.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={employee.photoUrl}
                      alt={employee.name}
                      className="w-20 h-24 rounded-2xl object-cover border-2 border-[#0a2463] shadow-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-300 flex items-center justify-center flex-shrink-0 text-slate-400">
                      <span className="text-3xl font-bold uppercase text-slate-400">
                        {employee.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <span className="inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 mb-1">
                      {employee.employmentType}
                    </span>
                    <h2 className="text-xl font-black text-slate-900 leading-tight break-words">
                      {employee.name}
                    </h2>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">
                      {employee.designation}
                    </p>
                    <p className="text-xs text-slate-500">
                      Department: <span className="font-medium text-slate-700">{employee.department}</span>
                    </p>
                  </div>
                </div>

                {/* Official Public Details (Zero Sensitive Info) */}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <dt className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Employee ID</dt>
                    <dd className="font-black text-slate-900 text-sm mt-0.5 tracking-wide font-mono">
                      {employee.employeeId}
                    </dd>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <dt className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Employment Status</dt>
                    <dd className="font-bold text-slate-900 text-sm mt-0.5">
                      {employee.employmentStatus}
                    </dd>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <dt className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Date of Joining</dt>
                    <dd className="font-semibold text-slate-800 text-xs mt-0.5">
                      {employee.dateOfJoining}
                    </dd>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <dt className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Work Location</dt>
                    <dd className="font-semibold text-slate-800 text-xs mt-0.5">
                      {employee.workLocation || location}
                    </dd>
                  </div>

                  {employee.assignedBatch && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
                      <dt className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Assigned Faculty Batch</dt>
                      <dd className="font-semibold text-slate-800 text-xs mt-0.5">
                        {employee.assignedBatch}
                      </dd>
                    </div>
                  )}

                  {employee.lastWorkingDate && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 sm:col-span-2">
                      <dt className="text-rose-600 font-medium uppercase text-[10px] tracking-wider">Last Working Date</dt>
                      <dd className="font-bold text-rose-900 text-xs mt-0.5">
                        {employee.lastWorkingDate}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Issuing Authority Guarantee & Security Seal */}
                <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Issuing Organization:</span>
                    <strong className="text-slate-800 font-bold">{enterpriseName}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Authorized By:</span>
                    <strong className="text-slate-800 font-bold">Firoz Ali (Founder & Proprietor)</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Registered Location:</span>
                    <span className="text-slate-700">{location}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 pt-1 text-[10px]">
                    <span>Verification Timestamp:</span>
                    <span>{formatISTDateTime(new Date())} IST</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-3xl font-black">
                  ✕
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Employee Record Not Found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    The identifier <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">{rawToken}</code> does not match any current or former employee in our database.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Privacy & Anti-Tamper Notice */}
          <div className="text-center space-y-2 text-xs text-slate-300 px-2">
            <p className="leading-relaxed">
              This public verification page strictly displays organizational credential validity. Sensitive private data (compensation, banking, PAN, contact numbers, and residential address) is permanently redacted to protect employee privacy.
            </p>
            <p>
              <Link
                href={website}
                className="text-white hover:text-blue-200 font-semibold underline underline-offset-4"
              >
                atomicpathshala.in
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Fallback to existing student/team ID card verification
  const result = await loadPublicVerification(rawToken);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" className="w-12 h-12 rounded-xl bg-white p-0.5" />
          <div>
            <p className="text-lg font-bold leading-tight">Atomic Pathshala</p>
            <p className="text-xs text-blue-100">ID card verification</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white shadow-xl overflow-hidden">
          {!result ? (
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.photoUrl} alt="" className="w-20 h-[100px] rounded-xl object-cover border-2 border-[#1d4ed8]" />
                  ) : (
                    <div className="w-20 h-[100px] rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[32px] text-slate-400">person</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#1d4ed8]">
                      {result.kind === "TEAM" ? "Team member" : "Student"}
                    </p>
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
