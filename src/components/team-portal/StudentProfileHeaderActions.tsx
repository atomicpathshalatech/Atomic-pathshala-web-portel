"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminEditProfileModal } from "./AdminEditProfileModal";

export function StudentProfileHeaderActions({ student }: { student: any }) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsEditOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition shadow-xs"
      >
        <span className="material-symbols-outlined text-sm text-blue-600">edit</span>
        <span>Edit Profile</span>
      </button>

      <Link
        href={`/team/subscriptions/${student.id}`}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-xs"
      >
        <span className="material-symbols-outlined text-sm">card_membership</span>
        <span>Manage Subscription</span>
      </Link>

      {isEditOpen && (
        <AdminEditProfileModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => {
            router.refresh();
          }}
          targetId={student.id}
          userType="student"
          initialData={{
            name: student.name || "",
            email: student.email || "",
            phone: student.phone || "",
            photoUrl: student.photoUrl || "",
            studentId: student.id,
            class: student.class || "",
            targetExam: student.targetExam || "",
            fatherName: student.fatherName || "",
            motherName: student.motherName || "",
            dob: student.dob || null,
            gender: student.gender || "MALE",
            school: student.school || "",
            city: student.city || "",
            state: student.state || "",
            address: student.address || "",
            bloodGroup: student.bloodGroup || "",
            emergencyContact: student.emergencyContact || "",
            academicStatus: student.academicStatus || "ACTIVE",
            board: student.board || "",
          }}
        />
      )}
    </div>
  );
}
