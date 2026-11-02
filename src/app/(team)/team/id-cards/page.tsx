import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { GlobalRole, Prisma } from "@prisma/client";
import { requireTeamSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canManageCards } from "@/lib/id-card/admin";
import { isMissingTable, teamDesignation } from "@/lib/id-card/data";
import { formatCardDate } from "@/lib/id-card/format";
import { formatEnrollmentNumber } from "@/lib/utils/id-generator";
import { AdminIdCardActions } from "@/components/id-card/AdminIdCardActions";
import { TeamCardDetailsEditor } from "@/components/id-card/TeamCardDetailsEditor";
import { SendIdCardsButton } from "@/components/id-card/SendIdCardsButton";

/** A stored date as yyyy-mm-dd in IST, for a date input. */
const istYmd = (d: Date | null | undefined) => (d ? new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10) : "");

export const metadata: Metadata = { title: "ID Cards" };
export const dynamic = "force-dynamic";

const PAGE = 50;
const NON_TEAM = ["STUDENT", "PARENT", "GUEST"] as GlobalRole[];
const cardSelect = { select: { status: true, issuedAt: true, reissuedAt: true, lastDownloadedAt: true, employeeCode: true } } as const;

type Search = { tab?: string; q?: string; filter?: string; page?: string };

/** Runs with the ID-card columns; before the migration is applied, runs again without them. */
async function withCards<T>(run: (cards: boolean) => Promise<T>): Promise<{ data: T; cardsReady: boolean }> {
  try {
    return { data: await run(true), cardsReady: true };
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    return { data: await run(false), cardsReady: false };
  }
}

export default async function IdCardsAdminPage({ searchParams }: { searchParams: Search }) {
  const { user } = await requireTeamSession();
  const [canTeam, canStudents] = await Promise.all([canManageCards(user.id, "TEAM"), canManageCards(user.id, "STUDENT")]);
  if (!canTeam && !canStudents) redirect("/team");

  const tab = searchParams.tab === "students" || !canTeam ? "students" : "team";
  const q = searchParams.q?.trim() || "";
  const filter = searchParams.filter || "all";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const th = "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-on-surface-variant whitespace-nowrap";
  const td = "px-3 py-2 text-xs text-on-surface align-top";
  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams({ tab, ...(q ? { q } : {}), filter, page: String(page), ...patch } as Record<string, string>);
    return `/team/id-cards?${p.toString()}`;
  };

  let rows: React.ReactNode = null;
  let summary: { label: string; value: number }[] = [];
  let total = 0;
  let cardsReady = true;

  if (tab === "team") {
    const where: Prisma.UserWhereInput = {
      role: { name: { notIn: NON_TEAM } },
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      ...(filter === "nophoto" ? { photoUrl: null } : {}),
      ...(filter === "revoked" ? { idCards: { some: { kind: "TEAM", status: "REVOKED" } } } : {}),
    };
    const res = await withCards((cards) =>
      Promise.all([
        prisma.user.findMany({
          where: cards ? where : { ...where, idCards: undefined },
          orderBy: { name: "asc" },
          skip: (page - 1) * PAGE,
          take: PAGE,
          select: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
            status: true,
            position: true,
            department: true,
            contractStart: true,
            role: { select: { label: true } },
            teacher: { select: { employeeCode: true, subjects: true, department: true, dob: true } },
            ...(cards ? { idCards: { where: { kind: "TEAM" as const }, ...cardSelect } } : {}),
          },
        }),
        prisma.user.count({ where: cards ? where : { ...where, idCards: undefined } }),
        prisma.user.count({ where: { role: { name: { notIn: NON_TEAM } } } }),
        prisma.user.count({ where: { role: { name: { notIn: NON_TEAM } }, photoUrl: { not: null } } }),
        cards ? prisma.idCard.count({ where: { kind: "TEAM", status: "REVOKED" } }) : Promise.resolve(0),
      ])
    );
    cardsReady = res.cardsReady;
    const [list, count, all, withPhoto, revoked] = res.data;
    total = count;
    summary = [
      { label: "Team members", value: all },
      { label: "With photo", value: withPhoto },
      { label: "Photo missing", value: all - withPhoto },
      { label: "Revoked cards", value: revoked },
    ];
    rows = list.map((u) => {
      const card = ("idCards" in u ? (u.idCards as { status: "ACTIVE" | "REVOKED"; issuedAt: Date; lastDownloadedAt: Date | null; employeeCode: string | null }[]) : [])[0] ?? null;
      const empId = u.teacher?.employeeCode || card?.employeeCode || null;
      const designation = teamDesignation(u.position, u.teacher?.subjects);
      const missing = [!u.photoUrl && "photo", !empId && "employee ID", !designation && "designation", !u.contractStart && "joining date"].filter(Boolean) as string[];
      const active = u.status === "ACTIVE";
      return (
        <tr key={u.id}>
          <td className={td}>
            <div className="flex items-center gap-2">
              {u.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded photo on object storage
                <img src={u.photoUrl} alt="" className="w-8 h-10 rounded object-cover border border-outline-variant/40" />
              ) : (
                <span className="w-8 h-10 rounded bg-amber-100 text-amber-700 flex items-center justify-center material-symbols-outlined text-[16px]">no_photography</span>
              )}
              <div>
                <p className="font-semibold">{u.name}</p>
                <p className="text-on-surface-variant">{u.role?.label ?? "—"}</p>
              </div>
            </div>
          </td>
          <td className={td}>{empId ?? "—"}</td>
          <td className={td}>
            {designation ?? "—"}
            <p className="text-on-surface-variant mt-0.5">Joined {u.contractStart ? formatCardDate(u.contractStart) : <span className="text-amber-700 font-semibold">not set</span>}</p>
          </td>
          <td className={td}>{active ? "Active" : <span className="text-rose-700 font-semibold">{u.status}</span>}</td>
          <td className={td}>
            {!cardsReady ? "—" : card ? <span className={card.status === "REVOKED" ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>{card.status === "REVOKED" ? "Revoked" : "Active"}</span> : "Not issued"}
            {card && <p className="text-on-surface-variant">Issued {formatCardDate(card.issuedAt)}</p>}
            {card?.lastDownloadedAt && <p className="text-on-surface-variant">Downloaded {formatCardDate(card.lastDownloadedAt)}</p>}
          </td>
          <td className={td}>{missing.length ? <span className="text-amber-700 font-semibold">{missing.join(", ")}</span> : <span className="text-emerald-700">Complete</span>}</td>
          <td className={td}>
            <div className="space-y-1.5">
              <TeamCardDetailsEditor
                userId={u.id}
                name={u.name}
                joiningDate={istYmd(u.contractStart)}
                designation={u.position ?? ""}
                dob={istYmd(u.teacher?.dob)}
                hasTeacherProfile={Boolean(u.teacher)}
              />
              {cardsReady && active && (
                <AdminIdCardActions
                  userId={u.id}
                  kind="TEAM"
                  status={card?.status ?? null}
                  printable={missing.length === 0}
                  canAssignEmployeeId={!empId}
                />
              )}
            </div>
          </td>
        </tr>
      );
    });
  } else {
    const where: Prisma.StudentWhereInput = {
      ...(q
        ? {
            OR: [
              { user: { name: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { enrollmentNumber: { contains: q, mode: "insensitive" } },
              { studentIdCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filter === "nophoto" ? { user: { photoUrl: null } } : {}),
      ...(filter === "revoked" ? { user: { idCards: { some: { kind: "STUDENT", status: "REVOKED" } } } } : {}),
    };
    const res = await withCards((cards) =>
      Promise.all([
        prisma.student.findMany({
          where: cards || filter !== "revoked" ? where : { id: "__none__" },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * PAGE,
          take: PAGE,
          select: {
            id: true,
            userId: true,
            enrollmentNumber: true,
            status: true,
            user: {
              select: {
                name: true,
                email: true,
                photoUrl: true,
                status: true,
                ...(cards ? { idCards: { where: { kind: "STUDENT" as const }, ...cardSelect } } : {}),
              },
            },
          },
        }),
        prisma.student.count({ where: cards || filter !== "revoked" ? where : { id: "__none__" } }),
        prisma.student.count(),
        prisma.student.count({ where: { user: { photoUrl: { not: null } } } }),
        cards ? prisma.idCard.count({ where: { kind: "STUDENT", status: "REVOKED" } }) : Promise.resolve(0),
      ])
    );
    cardsReady = res.cardsReady;
    const [list, count, all, withPhoto, revoked] = res.data;
    total = count;
    summary = [
      { label: "Students", value: all },
      { label: "Photo uploaded", value: withPhoto },
      { label: "Photo pending", value: all - withPhoto },
      { label: "Revoked cards", value: revoked },
    ];
    rows = list.map((s) => {
      const card = ("idCards" in s.user ? (s.user.idCards as { status: "ACTIVE" | "REVOKED"; issuedAt: Date; lastDownloadedAt: Date | null }[]) : [])[0] ?? null;
      const eligible = s.user.status === "ACTIVE" && s.status !== "DROPPED";
      return (
        <tr key={s.id}>
          <td className={td}>
            <div className="flex items-center gap-2">
              {s.user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded photo on object storage
                <img src={s.user.photoUrl} alt="" className="w-8 h-10 rounded object-cover border border-outline-variant/40" />
              ) : (
                <span className="w-8 h-10 rounded bg-amber-100 text-amber-700 flex items-center justify-center material-symbols-outlined text-[16px]">no_photography</span>
              )}
              <div>
                <p className="font-semibold">{s.user.name}</p>
                <p className="text-on-surface-variant">{s.user.email}</p>
              </div>
            </div>
          </td>
          <td className={td}>{formatEnrollmentNumber(s.enrollmentNumber)}</td>
          <td className={td}>{s.user.photoUrl ? <span className="text-emerald-700 font-semibold">Uploaded</span> : <span className="text-amber-700 font-semibold">Pending</span>}</td>
          <td className={td}>{eligible ? "Active" : <span className="text-rose-700 font-semibold">{s.user.status !== "ACTIVE" ? s.user.status : s.status}</span>}</td>
          <td className={td}>
            {!cardsReady ? "—" : card ? <span className={card.status === "REVOKED" ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>{card.status === "REVOKED" ? "Revoked" : "Active"}</span> : "Not issued"}
            {card && <p className="text-on-surface-variant">Issued {formatCardDate(card.issuedAt)}</p>}
            {card?.lastDownloadedAt && <p className="text-on-surface-variant">Downloaded {formatCardDate(card.lastDownloadedAt)}</p>}
          </td>
          <td className={td}>
            {cardsReady && eligible && (
              <AdminIdCardActions userId={s.userId} kind="STUDENT" status={card?.status ?? null} printable={Boolean(s.user.photoUrl)} canAssignEmployeeId={false} />
            )}
          </td>
        </tr>
      );
    });
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-black">ID Cards</h1>
        <p className="text-sm text-on-surface-variant">Who has a card, whose photo is missing, and revoke / reissue / print any card.</p>
        <p className="text-xs text-on-surface-variant mt-1">
          New students and team members get their card by email automatically the day after they join (or an &quot;upload your photo&quot; note
          until they add one; the card follows the day after the photo).
        </p>
      </header>

      {cardsReady && (
        <div className="flex flex-wrap items-start gap-3">
          <SendIdCardsButton key={`${tab}-email`} kind={tab === "team" ? "TEAM" : "STUDENT"} channel="email" />
          <SendIdCardsButton key={`${tab}-wa`} kind={tab === "team" ? "TEAM" : "STUDENT"} channel="whatsapp" />
        </div>
      )}

      {!cardsReady && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          The ID-card database migration (<code>20261102120000_id_cards</code>) has not been applied yet — cards can&apos;t be issued until it is.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canTeam && (
          <Link href={`/team/id-cards?tab=team`} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === "team" ? "bg-[#0f3a9e] text-white" : "border border-outline-variant"}`}>
            Team
          </Link>
        )}
        {canStudents && (
          <Link href={`/team/id-cards?tab=students`} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab === "students" ? "bg-[#0f3a9e] text-white" : "border border-outline-variant"}`}>
            Students
          </Link>
        )}
        <form className="flex items-center gap-2 ml-auto" action="/team/id-cards">
          <input type="hidden" name="tab" value={tab} />
          <select name="filter" defaultValue={filter} className="px-2 py-1.5 rounded-lg border border-outline-variant bg-surface text-sm">
            <option value="all">All</option>
            <option value="nophoto">Photo missing</option>
            <option value="revoked">Revoked</option>
          </select>
          <input name="q" defaultValue={q} placeholder={tab === "team" ? "Name or email" : "Name, email, enrollment no."} className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-sm w-56" />
          <button className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[#0f3a9e] text-white">Search</button>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summary.map((c) => (
          <div key={c.label} className="glass-card rounded-xl border border-outline-variant/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{c.label}</p>
            <p className="text-lg font-black tabular-nums mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            {tab === "team" ? (
              <tr>
                <th className={th}>Team member</th>
                <th className={th}>Employee ID</th>
                <th className={th}>Designation</th>
                <th className={th}>Account</th>
                <th className={th}>Card</th>
                <th className={th}>Card data</th>
                <th className={th}>Actions</th>
              </tr>
            ) : (
              <tr>
                <th className={th}>Student</th>
                <th className={th}>Enrollment no.</th>
                <th className={th}>Photo</th>
                <th className={th}>Account</th>
                <th className={th}>Card</th>
                <th className={th}>Actions</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-outline-variant/15">{rows}</tbody>
        </table>
        {total === 0 && <p className="p-6 text-center text-sm text-on-surface-variant">Nobody matches.</p>}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={link({ page: String(page - 1) })} className="font-bold text-primary">← Previous</Link>}
          <span className="text-on-surface-variant">Page {page} of {pages} · {total} people</span>
          {page < pages && <Link href={link({ page: String(page + 1) })} className="font-bold text-primary">Next →</Link>}
        </div>
      )}
    </div>
  );
}
