import { cardHtml, type LoadedCard } from "@/lib/id-card/data";
import { formatCardDate } from "@/lib/id-card/format";
import { IdCardPreview } from "./IdCardPreview";
import { IdPhotoUploader } from "./IdPhotoUploader";
import { PhotoVisibilityToggle } from "./PhotoVisibilityToggle";

function Notice({ tone, icon, title, children }: { tone: "info" | "warn" | "bad"; icon: string; title: string; children?: React.ReactNode }) {
  const cls =
    tone === "bad"
      ? "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100 dark:border-rose-800"
      : tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-800"
      : "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-100 dark:border-sky-800";
  return (
    <div className={`rounded-2xl border p-4 flex gap-3 ${cls}`}>
      <span className="material-symbols-outlined text-[24px] shrink-0">{icon}</span>
      <div className="text-sm space-y-1">
        <p className="font-bold">{title}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * The ID card section of a portal: the card (or what is still missing),
 * download / print / verify actions, photo upload and the public-photo choice.
 */
export function IdCardWorkspace({ loaded }: { loaded: LoadedCard }) {
  const kindParam = loaded.kind === "TEAM" ? "team" : "student";
  const pdfHref = `/api/id-card/pdf?kind=${kindParam}`;
  const selfMissing = loaded.missing.filter((m) => m.who === "self");
  const adminMissing = loaded.missing.filter((m) => m.who === "admin");
  const revoked = loaded.card?.status === "REVOKED";

  if (loaded.ineligible) {
    return <Notice tone="bad" icon="block" title={loaded.ineligible} />;
  }
  if (!loaded.card) {
    return (
      <Notice tone="info" icon="hourglass_top" title="ID cards are being set up">
        <p>Your ID card will be available here shortly. Please check back later.</p>
      </Notice>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr] items-start">
      <div>
        {loaded.model ? (
          <IdCardPreview html={cardHtml(loaded.model, "screen")} pdfHref={pdfHref} verifyUrl={loaded.model.verifyUrl} canDownload={!revoked} />
        ) : (
          <div className="rounded-[22px] border-2 border-dashed border-[#1d4ed8]/40 bg-gradient-to-b from-[#0f3a9e]/5 to-transparent aspect-[54/85.6] max-w-[340px] mx-auto flex flex-col items-center justify-center text-center p-6 gap-3">
            <span className="material-symbols-outlined text-[48px] text-[#1d4ed8]/60">badge</span>
            <p className="font-bold text-on-surface">Your ID card is almost ready</p>
            <p className="text-sm text-on-surface-variant">It will appear here as soon as the items on the right are complete.</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {revoked && (
          <Notice tone="bad" icon="gpp_bad" title="This ID card has been revoked">
            <p>It no longer verifies and cannot be downloaded. Please contact the Atomic Pathshala office.</p>
          </Notice>
        )}

        {selfMissing.some((m) => m.key === "photo") && (
          <div id="photo" className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-3 scroll-mt-24">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <span className="font-bold">Your profile photo is pending.</span>{" "}
              {loaded.kind === "STUDENT"
                ? "Please upload your photo to generate your Atomic Pathshala Student ID Card."
                : "Please upload your photo to generate your Atomic Pathshala Team ID Card."}
            </p>
            <ul className="text-xs text-amber-900/80 dark:text-amber-100/80 list-disc pl-5 space-y-0.5">
              <li>A clear, recent, front-facing photo — like a passport photo (no government passport needed).</li>
              <li>Plain background, good light, no sunglasses or caps. JPG, PNG or WEBP, up to 3 MB.</li>
            </ul>
            <IdPhotoUploader />
          </div>
        )}

        {adminMissing.length > 0 && (
          <Notice tone="warn" icon="pending_actions" title="Waiting for the office">
            <p>These details are set by HR / admin, so you can&apos;t change them yourself:</p>
            <ul className="list-disc pl-5">
              {adminMissing.map((m) => (
                <li key={m.key}>{m.label}</li>
              ))}
            </ul>
            <p>Please ask your administrator to complete them.</p>
          </Notice>
        )}

        {loaded.model && (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-on-surface">Card status</p>
                <p className="text-xs text-on-surface-variant">
                  Issued {formatCardDate(loaded.card.issuedAt)}
                  {loaded.card.reissuedAt ? ` · reissued ${formatCardDate(loaded.card.reissuedAt)}` : ""}
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  revoked ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {revoked ? "Revoked" : "Active"}
              </span>
            </div>

            <div className="border-t border-outline-variant/30 pt-4 space-y-2">
              <p className="text-sm font-bold text-on-surface">Photo</p>
              <div className="flex items-center gap-3">
                {loaded.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded photo on object storage
                  <img src={loaded.photoUrl} alt="" className="w-12 h-[60px] rounded-lg object-cover border border-outline-variant/40" />
                )}
                <IdPhotoUploader label="Change photo" compact />
              </div>
            </div>

            <div className="border-t border-outline-variant/30 pt-4">
              <PhotoVisibilityToggle kind={loaded.kind} initial={loaded.card.showPhotoPublicly} />
            </div>

            {loaded.context.rankSource && (
              <p className="border-t border-outline-variant/30 pt-4 text-xs text-on-surface-variant">
                <span className="font-semibold text-on-surface">Test Rank</span> on your card is your rank in your latest test on Atomic
                Pathshala ({loaded.context.rankSource}). It updates by itself as more students submit and as you take new tests. It is
                not an official NEET All India Rank.
              </p>
            )}

            <p className="border-t border-outline-variant/30 pt-4 text-xs text-on-surface-variant">
              Everything on the card comes from your profile and updates by itself. To correct your name, date of birth
              {loaded.kind === "TEAM" ? ", designation, department or joining date" : ", course or batch"}, please contact the office.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
