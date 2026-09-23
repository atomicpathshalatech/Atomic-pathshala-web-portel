"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";
import { AdminEditProfileModal } from "./AdminEditProfileModal";

export interface FacultyTeacherItem {
  id: string;
  userId?: string;
  employeeCode: string;
  department: string;
  subjects: string[];
  displayName?: string | null;
  targetExams?: string[];
  classes?: string[];
  languages?: string[];
  experienceYears?: string | null;
  qualifications?: any[];
  experienceList?: any[];
  bio?: string | null;
  dob?: string | null;
  user: {
    id?: string;
    name: string;
    email?: string;
    phone?: string | null;
    photoUrl?: string | null;
    status?: string | null;
    role?: string | null;
    position?: string | null;
    department?: string | null;
    contractType?: string | null;
    contractEnd?: string | null;
  };
}

export function FacultyCard({
  teacher,
  canDelete,
}: {
  teacher: FacultyTeacherItem;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <>
      <div className="relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
        {/* Top bar: Avatar + Basic Identity */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {teacher.user.photoUrl ? (
              <img
                src={teacher.user.photoUrl}
                alt={teacher.user.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/20 shadow-xs"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xl shadow-xs">
                {teacher.user.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            )}
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                {teacher.user.name}
              </h3>
              {teacher.displayName ? (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                  {teacher.displayName}
                </p>
              ) : (
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {teacher.department || "Academic Faculty"}
                </p>
              )}
              <span className="inline-block font-mono text-[11px] text-slate-400 mt-0.5">
                {teacher.employeeCode}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              title="Edit Educator Profile"
              className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-950/40 dark:hover:bg-blue-600 dark:text-blue-300 dark:hover:text-white transition flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                title="Delete Educator"
                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-950/40 dark:hover:bg-rose-600 dark:text-rose-400 dark:hover:text-white transition flex items-center justify-center opacity-70 group-hover:opacity-100"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Subjects taught */}
        {teacher.subjects && teacher.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {teacher.subjects.map((s) => (
              <span
                key={s}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 px-2.5 py-0.5 rounded-lg text-[11px] font-bold"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Quick details */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-slate-400">workspace_premium</span>
            <span>{teacher.experienceYears || "Educator"}</span>
          </span>
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-0.5"
          >
            <span>Edit Profile</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Delete Modal */}
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

      {/* Unified Profile Editor Modal */}
      {isEditOpen && (
        <AdminEditProfileModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => {
            setIsEditOpen(false);
            router.refresh();
          }}
          userType="teacher"
          targetId={teacher.id}
          initialData={{
            teacherId: teacher.id,
            name: teacher.user.name,
            email: teacher.user.email,
            phone: teacher.user.phone,
            photoUrl: teacher.user.photoUrl,
            displayName: teacher.displayName,
            employeeCode: teacher.employeeCode,
            department: teacher.department || teacher.user.department || "Academic",
            subjects: teacher.subjects || [],
            targetExams: teacher.targetExams || [],
            classes: teacher.classes || [],
            languages: teacher.languages || [],
            experienceYears: teacher.experienceYears,
            qualifications: teacher.qualifications || [],
            experienceList: teacher.experienceList || [],
            bio: teacher.bio,
            dob: teacher.dob,
            roleName: teacher.user.role || "TEACHER",
            position: teacher.user.position,
            status: teacher.user.status || "ACTIVE",
            contractType: teacher.user.contractType || "FULL_TIME",
            contractEnd: teacher.user.contractEnd,
          }}
        />
      )}
    </>
  );
}
