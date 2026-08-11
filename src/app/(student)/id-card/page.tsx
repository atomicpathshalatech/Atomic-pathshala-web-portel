import { requireStudentSession } from "@/lib/auth/session";
import { generateStudentQrDataUrl } from "@/lib/utils/qr";

export default async function IdCardPage() {
  const { student } = await requireStudentSession();
  const qrDataUrl = await generateStudentQrDataUrl(student.studentIdCode);

  const initials = student.user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Digital ID Card</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Show this at the center for verification.
        </p>
      </div>

      <div className="rounded-[1.5rem] overflow-hidden shadow-2xl border border-outline-variant/20">
        <div className="bg-primary text-on-primary px-8 py-6 flex items-center justify-between">
          <div>
            <p className="font-headline-md text-headline-md font-bold">Atomic Pathshala</p>
            <p className="text-label-sm font-label-sm opacity-80">Student Identity Card</p>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
            school
          </span>
        </div>

        <div className="bg-surface p-8 space-y-6">
          <div className="flex items-center gap-5">
            {student.user.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={student.user.photoUrl}
                alt={student.user.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center font-headline-lg text-headline-lg border-2 border-primary/20">
                {initials}
              </div>
            )}
            <div>
              <p className="font-headline-md text-headline-md">{student.user.name}</p>
              <p className="text-label-sm font-label-sm text-on-surface-variant">
                {student.class} &middot; {student.targetExam}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/20 pt-6">
            <IdField label="Enrollment No." value={student.enrollmentNumber} />
            <IdField label="Student ID" value={student.studentIdCode} />
            <IdField label="School" value={student.school} />
            <IdField label="City" value={`${student.city}, ${student.state}`} />
            {student.bloodGroup && <IdField label="Blood Group" value={student.bloodGroup} />}
          </div>

          <div className="flex items-center justify-center pt-4 border-t border-outline-variant/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Student verification QR code" className="w-32 h-32" />
          </div>
        </div>
      </div>

      <p className="text-label-sm font-label-sm text-on-surface-variant text-center">
        This card is regenerated each time you view it and always reflects your current
        enrollment details.
      </p>
    </div>
  );
}

function IdField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label-sm font-label-sm text-on-surface-variant">{label}</p>
      <p className="font-label-md text-label-md text-on-surface">{value}</p>
    </div>
  );
}
