"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminEditProfileModal } from "./AdminEditProfileModal";

export interface UserProfileHeaderCardProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    photoUrl?: string | null;
    role: string;
    department?: string | null;
    position?: string | null;
    employeeCode?: string | null;
  };
}

export function UserProfileHeaderCard({ user }: UserProfileHeaderCardProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.name}
              className="w-16 h-16 rounded-2xl object-cover shadow-md border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-2xl flex items-center justify-center shadow-md shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-[#031635] dark:text-white">{user.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-900">
                {user.role.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <span className="font-mono">{user.email}</span>
              {user.phone && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono">{user.phone}</span>
                </>
              )}
              {user.position && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">{user.position}</span>
                </>
              )}
              {user.department && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{user.department}</span>
                </>
              )}
              {user.employeeCode && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-slate-400">ID: {user.employeeCode}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      <AdminEditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
        userType="self"
        targetId={user.id}
        initialData={user}
      />
    </>
  );
}
