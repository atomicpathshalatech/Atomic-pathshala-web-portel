import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils/date";

export default async function ProfilePage() {
  const { student } = await requireStudentSession();
  const { user } = student;

  const initials = (user.name || "Student")
    .split(" ")
    .map((part: string) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const statusLabel: Record<string, string> = {
    ACTIVE: "Active",
    ON_HOLD: "On Hold",
    GRADUATED: "Graduated",
    DROPPED: "Dropped",
  };

  return (
    <div className="space-y-stack-lg">
      {/* Profile header */}
      <section className="glass-card rounded-xl p-8 md:p-12">
        <div className="flex flex-col md:flex-row items-center gap-stack-lg md:gap-12">
          {/* Photo */}
          <div className="relative group shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-xl overflow-hidden bg-primary/10 flex items-center justify-center">
              {user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display-lg text-display-lg text-primary">{initials}</span>
              )}
            </div>
            <Link
              href="/settings"
              title="Change profile photo"
              className="absolute bottom-1 right-1 bg-primary text-on-primary p-2.5 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            </Link>
          </div>

          {/* Identity */}
          <div className="flex-grow text-center md:text-left space-y-2">
            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">{user.name}</h1>
              {user.emailVerified && (
                <span className="bg-tertiary-container/10 text-tertiary px-4 py-1 rounded-full text-label-md font-label-md border border-tertiary/20 w-fit mx-auto md:mx-0">
                  Verified Student
                </span>
              )}
            </div>
            <p className="text-on-surface-variant font-body-lg text-body-lg">
              {student.targetExam} Aspirant &middot; Class {student.class}
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest rounded-lg">
                <span className="material-symbols-outlined text-primary text-[18px]">badge</span>
                <span className="font-label-md text-label-md">{student.studentIdCode}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest rounded-lg">
                <span className="material-symbols-outlined text-primary text-[18px]">event_available</span>
                <span className="font-label-md text-label-md">
                  {statusLabel[student.status] ?? student.status}
                </span>
              </div>
            </div>
          </div>

          {/* Member since */}
          <div className="flex flex-col items-center justify-center p-6 bg-white/50 border border-primary/10 rounded-2xl shadow-inner min-w-[160px] shrink-0">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>
              calendar_month
            </span>
            <p className="mt-2 font-label-md text-label-md text-primary text-center">Member Since</p>
            <p className="text-[13px] text-on-surface-variant text-center">
              {formatDate(student.createdAt)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-lg">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-stack-lg">
          {/* Personal Details */}
          <InfoCard icon="person" title="Personal Details">
            <Field label="Full Name" value={user.name || "—"} />
            <Field label="Email Address" value={user.email || "—"} />
            <Field label="Phone Number" value={user.phone ?? "—"} />
            <Field label="Date of Birth" value={formatDate(student.dob)} />
            <Field label="Gender" value={capitalize(student.gender)} />
            <Field label="Blood Group" value={student.bloodGroup ?? "—"} />
            <Field label="State / City" value={student.state && student.city ? `${student.state}, ${student.city}` : student.state || student.city || "—"} full />
            {student.address && <Field label="Address" value={student.address} full />}
          </InfoCard>

          {/* Academic Details */}
          <InfoCard icon="school" title="Academic Details">
            <Field label="School / Institution" value={student.school || "—"} full />
            <Field label="Class" value={student.class ? `Class ${student.class}` : "—"} />
            <Field label="Target Exam" value={student.targetExam || "NEET"} />
            <Field label="Enrollment Number" value={student.enrollmentNumber || "—"} />
            <Field label="Student ID" value={student.studentIdCode || "—"} />
          </InfoCard>

          {/* Guardian Details */}
          <InfoCard icon="family_restroom" title="Guardian Details">
            <Field label="Father's Name" value={student.fatherName} />
            <Field label="Mother's Name" value={student.motherName} />
            {student.emergencyContact && (
              <Field label="Emergency Contact" value={student.emergencyContact} />
            )}
          </InfoCard>
        </div>

        {/* Right column */}
        <div className="space-y-stack-lg">
          <section className="glass-card rounded-xl p-stack-lg">
            <h3 className="font-headline-md text-headline-md mb-4">Quick Links</h3>
            <div className="space-y-3">
              <SidebarLink href="/id-card" icon="badge" label="Digital ID Card" />
              <SidebarLink href="/courses" icon="video_library" label="My Courses" />
              <SidebarLink href="/tests" icon="quiz" label="Test Series" />
            </div>
          </section>

          <section className="glass-card rounded-xl p-stack-lg text-center space-y-2">
            <span className="material-symbols-outlined text-primary/40" style={{ fontSize: 36 }}>
              insights
            </span>
            <p className="font-label-md text-label-md text-on-surface-variant">
              Test performance, activity history, and achievement badges will appear here once the
              Course and Test modules are live.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card rounded-xl p-stack-lg">
      <div className="flex items-center gap-2 mb-stack-md">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <h2 className="font-headline-md text-headline-md">{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">{children}</div>
    </section>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "md:col-span-2" : ""}`}>
      <p className="text-on-surface-variant text-label-sm font-label-sm uppercase tracking-wider">
        {label}
      </p>
      <p className="font-body-md text-body-md font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function SidebarLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30 flex items-center justify-between hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <span className="text-label-md font-label-md">{label}</span>
      </div>
      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
        chevron_right
      </span>
    </Link>
  );
}

function capitalize(value: string | null | undefined): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
