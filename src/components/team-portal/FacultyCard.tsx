"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";

export function FacultyCard({
  teacher,
  canDelete,
}: {
  teacher: {
    id: string;
    employeeCode: string;
    department: string;
    subjects: string[];
    user: { name: string };
  };
  canDelete: boolean;
}) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div className="relative group">
      <Link
        href={`/team/faculty/${teacher.id}/edit`}
        className="glass-card rounded-2xl p-6 space-y-3 hover:shadow-lg hover:-translate-y-0.5 transition-all block"
      >
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
          {teacher.user.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface">{teacher.user.name}</h3>
          <p className="text-label-sm font-label-sm text-primary">{teacher.department}</p>
        </div>
        <p className="text-label-sm text-on-surface-variant">Code: {teacher.employeeCode}</p>
        {teacher.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {teacher.subjects.map((s) => (
              <span key={s} className="bg-surface-container-high px-2 py-0.5 rounded text-[11px]">
                {s}
              </span>
            ))}
          </div>
        )}
      </Link>

      {canDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowDelete(true);
          }}
          aria-label="Delete teacher"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-900/90 border border-rose-200 dark:border-rose-900 text-rose-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-50"
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      )}

      {showDelete && (
        <SecureDeleteResourceModal
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          resourceId={teacher.employeeCode}
          resourceTitle={teacher.user.name}
          resourceType="TEACHER"
          deleteEndpoint={`/api/team/faculty/${teacher.id}`}
          method="DELETE"
          onDeleted={() => {
            setShowDelete(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
