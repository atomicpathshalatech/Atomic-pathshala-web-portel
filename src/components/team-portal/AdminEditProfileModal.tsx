"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { parseGlobalRole } from "@/lib/rbac/permissions";

export type ProfileUserType = "student" | "teacher" | "user" | "self";

export interface AdminEditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: any) => void;
  targetId: string;
  userType: ProfileUserType;
  initialData: {
    // Identity
    name?: string;
    email?: string;
    phone?: string | null;
    photoUrl?: string | null;

    // Student fields
    studentId?: string;
    class?: string;
    targetExam?: string;
    fatherName?: string;
    motherName?: string;
    dob?: string | Date | null;
    gender?: "MALE" | "FEMALE" | "OTHER" | string;
    school?: string;
    city?: string;
    state?: string;
    address?: string | null;
    bloodGroup?: string | null;
    emergencyContact?: string | null;
    academicStatus?: string;
    board?: string | null;

    // Teacher fields
    teacherId?: string;
    displayName?: string | null;
    employeeCode?: string | null;
    department?: string | null;
    subjects?: string[];
    targetExams?: string[];
    classes?: string[];
    languages?: string[];
    experienceYears?: string | null;
    bio?: string | null;

    // Staff fields
    role?: string | null;
    roleName?: string | null;
    position?: string | null;
    status?: string | null;
    contractType?: string | null;
    contractStart?: string | Date | null;
    contractEnd?: string | Date | null;
    contractNote?: string | null;
  };
}

export const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin (Full Access)" },
  { value: "FOUNDER", label: "Founder (Executive Access)" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUB_ADMIN", label: "Sub Admin" },
  { value: "ACADEMIC_HEAD", label: "Academic Head" },
  { value: "DEPARTMENT_HEAD", label: "Department Head" },
  { value: "TEACHER", label: "Teacher / Educator" },
  { value: "SME", label: "Subject Matter Expert (SME)" },
  { value: "CONTENT_CREATOR", label: "Content Creator" },
  { value: "CONTENT_TEAM", label: "Content Team" },
  { value: "QUESTION_TEAM", label: "Question Team" },
  { value: "SALES", label: "Sales & CRM" },
  { value: "SUPPORT", label: "Support & Helpdesk" },
  { value: "FINANCE", label: "Finance" },
  { value: "HR", label: "Human Resources (HR)" },
  { value: "MARKETING", label: "Marketing" },
  { value: "DESIGNER", label: "Designer" },
  { value: "VIDEO_EDITOR", label: "Video Editor" },
  { value: "STUDENT", label: "Student" },
  { value: "PARENT", label: "Parent" },
  { value: "NONE", label: "No Role (Former Staff / Revoke Access)" },
];

function resolveInitialRole(data: any): string {
  const raw = data.roleName || data.role || "";
  const parsed = parseGlobalRole(raw);
  if (parsed) return parsed;
  if (raw === "NONE" || data.removeRole) return "NONE";
  return "TEACHER";
}

const CLASS_OPTIONS = ["Class 9", "Class 10", "Class 11", "Class 12", "Dropper"];
const TARGET_EXAM_OPTIONS = ["NEET", "JEE Main", "JEE Advanced", "Foundation", "Board Exam"];
const GENDER_OPTIONS = ["MALE", "FEMALE", "OTHER"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "APPROVAL_PENDING"];

export function AdminEditProfileModal({
  isOpen,
  onClose,
  onSuccess,
  targetId,
  userType,
  initialData,
}: AdminEditProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"identity" | "specific" | "org">("identity");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(initialData.name || "");
  const [email, setEmail] = useState(initialData.email || "");
  const [phone, setPhone] = useState(initialData.phone || "");
  const [photoUrl, setPhotoUrl] = useState(initialData.photoUrl || "");

  // Student specific
  const [studentClass, setStudentClass] = useState(initialData.class || "Class 11");
  const [targetExam, setTargetExam] = useState(initialData.targetExam || "NEET");
  const [fatherName, setFatherName] = useState(initialData.fatherName || "");
  const [motherName, setMotherName] = useState(initialData.motherName || "");
  const [dob, setDob] = useState(
    initialData.dob ? new Date(initialData.dob).toISOString().split("T")[0] : ""
  );
  const [gender, setGender] = useState(initialData.gender || "MALE");
  const [school, setSchool] = useState(initialData.school || "");
  const [city, setCity] = useState(initialData.city || "");
  const [state, setState] = useState(initialData.state || "");
  const [address, setAddress] = useState(initialData.address || "");
  const [bloodGroup, setBloodGroup] = useState(initialData.bloodGroup || "");
  const [emergencyContact, setEmergencyContact] = useState(initialData.emergencyContact || "");
  const [academicStatus, setAcademicStatus] = useState(initialData.academicStatus || "ACTIVE");
  const [board, setBoard] = useState(initialData.board || "");

  // Teacher specific
  const [displayName, setDisplayName] = useState(initialData.displayName || "");
  const [employeeCode, setEmployeeCode] = useState(initialData.employeeCode || "");
  const [department, setDepartment] = useState(initialData.department || "Academic");
  const [subjectsStr, setSubjectsStr] = useState((initialData.subjects || []).join(", "));
  const [experienceYears, setExperienceYears] = useState(initialData.experienceYears || "");
  const [bio, setBio] = useState(initialData.bio || "");

  // Staff specific
  const [roleName, setRoleName] = useState(() => resolveInitialRole(initialData));
  const [position, setPosition] = useState(() => {
    const p = initialData.position || "";
    const r = initialData.roleName || (initialData as any).role || "";
    if (!p && r && !parseGlobalRole(r)) return r;
    return p;
  });
  const [status, setStatus] = useState(initialData.status || "ACTIVE");
  const [contractType, setContractType] = useState(initialData.contractType || "FULL_TIME");
  const [contractEnd, setContractEnd] = useState(
    initialData.contractEnd ? new Date(initialData.contractEnd).toISOString().split("T")[0] : ""
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when initialData changes
  useEffect(() => {
    setName(initialData.name || "");
    setEmail(initialData.email || "");
    setPhone(initialData.phone || "");
    setPhotoUrl(initialData.photoUrl || "");
    setStudentClass(initialData.class || "Class 11");
    setTargetExam(initialData.targetExam || "NEET");
    setFatherName(initialData.fatherName || "");
    setMotherName(initialData.motherName || "");
    setDob(initialData.dob ? new Date(initialData.dob).toISOString().split("T")[0] : "");
    setGender(initialData.gender || "MALE");
    setSchool(initialData.school || "");
    setCity(initialData.city || "");
    setState(initialData.state || "");
    setAddress(initialData.address || "");
    setBloodGroup(initialData.bloodGroup || "");
    setEmergencyContact(initialData.emergencyContact || "");
    setAcademicStatus(initialData.academicStatus || "ACTIVE");
    setBoard(initialData.board || "");
    setDisplayName(initialData.displayName || "");
    setEmployeeCode(initialData.employeeCode || "");
    setDepartment(initialData.department || "Academic");
    setSubjectsStr((initialData.subjects || []).join(", "));
    setExperienceYears(initialData.experienceYears || "");
    setBio(initialData.bio || "");
    const resolvedRole = resolveInitialRole(initialData);
    setRoleName(resolvedRole);
    const initialPos = initialData.position || "";
    const rawRole = initialData.roleName || (initialData as any).role || "";
    if (!initialPos && rawRole && !parseGlobalRole(rawRole)) {
      setPosition(rawRole);
    } else {
      setPosition(initialPos);
    }
    setStatus(initialData.status || "ACTIVE");
    setContractType(initialData.contractType || "FULL_TIME");
    setContractEnd(
      initialData.contractEnd ? new Date(initialData.contractEnd).toISOString().split("T")[0] : ""
    );
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload image");
      }
      setPhotoUrl(data.data.url);
      toast.success("Profile photo uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "");
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setSaving(true);
    try {
      let url = "";
      let payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone || null,
        photoUrl: photoUrl || null,
      };

      if (userType === "student") {
        url = `/api/team/students/${targetId}`;
        payload = {
          ...payload,
          class: studentClass,
          targetExam,
          fatherName: fatherName.trim(),
          motherName: motherName.trim(),
          dob: dob ? new Date(dob).toISOString() : null,
          gender,
          school: school.trim(),
          city: city.trim(),
          state: state.trim(),
          address: address.trim() || null,
          bloodGroup: bloodGroup || null,
          emergencyContact: emergencyContact.trim() || null,
          academicStatus,
          board: board.trim() || null,
        };
      } else if (userType === "teacher") {
        url = `/api/team/faculty/${targetId}`;
        const subjects = subjectsStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        payload = {
          ...payload,
          displayName: displayName.trim() || null,
          employeeCode: employeeCode.trim(),
          department,
          subjects,
          experienceYears: experienceYears.trim() || null,
          bio: bio.trim() || null,
          dob: dob ? new Date(dob).toISOString() : null,
        };
      } else if (userType === "self") {
        url = "/api/team/profile";
        if (initialData.teacherId) {
          const subjects = subjectsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          payload = {
            ...payload,
            displayName: displayName.trim() || null,
            subjects,
            experienceYears: experienceYears.trim() || null,
            bio: bio.trim() || null,
          };
        }
      } else {
        // userType === "user"
        url = `/api/team/users/${targetId}`;
        const sanitizedRole =
          roleName === "NONE" ? "NONE" : parseGlobalRole(roleName) || "TEACHER";
        payload = {
          ...payload,
          status,
          roleName: sanitizedRole,
          department: department.trim() || undefined,
          position: position.trim() || undefined,
          contractType: contractType || undefined,
          contractEnd: contractEnd ? new Date(contractEnd).toISOString() : null,
        };
      }

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Failed to update profile.");
      }

      toast.success("Profile updated successfully!");
      onSuccess(json.data || json.user || json.student || json.teacher || payload);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving profile.");
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  const hasSpecificTab = userType === "student" || userType === "teacher" || Boolean(initialData.teacherId);
  const hasOrgTab = userType === "user";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">manage_accounts</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#031635] dark:text-white">
                Edit {userType === "self" ? "My" : userType.charAt(0).toUpperCase() + userType.slice(1)} Profile
              </h3>
              <p className="text-xs text-slate-500">
                Update account details, identity, and profile parameters.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-black dark:hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("identity")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === "identity"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-sm">badge</span>
            <span>Basic Identity</span>
          </button>

          {hasSpecificTab && (
            <button
              type="button"
              onClick={() => setActiveTab("specific")}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                activeTab === "specific"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {userType === "student" ? "school" : "co_present"}
              </span>
              <span>{userType === "student" ? "Academic Info" : "Faculty Info"}</span>
            </button>
          )}

          {hasOrgTab && (
            <button
              type="button"
              onClick={() => setActiveTab("org")}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                activeTab === "org"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-sm">domain</span>
              <span>Organization &amp; Contract</span>
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* TAB 1: IDENTITY */}
          {activeTab === "identity" && (
            <div className="space-y-4">
              {/* Photo Upload & Avatar */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500/30 bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-slate-500">
                      {name ? name.charAt(0).toUpperCase() : "?"}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Profile Photo</p>
                  <p className="text-[11px] text-slate-500">
                    PNG, JPG or WEBP up to 5MB. Appears in chat, session header, and ID cards.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-xs disabled:opacity-50"
                    >
                      {uploadingPhoto ? "Uploading…" : "Upload New Photo"}
                    </button>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoUrl("")}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-[11px] transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                {(userType === "teacher" || initialData.teacherId) && (
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Display Name / Title
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Dr. R. Sharma (Physics Guru)"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@atomicpathshala.com"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Mobile Number
                  </label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold border border-slate-200 dark:border-slate-700">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit number"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium font-mono text-xs"
                    />
                  </div>
                </div>

                {userType === "student" && (
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Academic Status
                    </label>
                    <select
                      value={academicStatus}
                      onChange={(e) => setAcademicStatus(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                      <option value="GRADUATED">GRADUATED</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SPECIFIC (STUDENT OR TEACHER) */}
          {activeTab === "specific" && userType === "student" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Class / Grade</label>
                  <select
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Target Exam</label>
                  <select
                    value={targetExam}
                    onChange={(e) => setTargetExam(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    {TARGET_EXAM_OPTIONS.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Father&apos;s Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Father's full name"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Mother&apos;s Name</label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="Mother's full name"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">School</label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="School / College name"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Board</label>
                  <input
                    type="text"
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                    placeholder="e.g. CBSE / ICSE / State Board"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Kota / Delhi"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Rajasthan / Uttar Pradesh"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="">Select blood group…</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Emergency Contact</label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Emergency phone number"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Full Address</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Residential address details"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SPECIFIC (TEACHER) */}
          {activeTab === "specific" && (userType === "teacher" || initialData.teacherId) && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Employee Code</label>
                  <input
                    type="text"
                    required
                    disabled={userType === "self"}
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    placeholder="EMP-1001"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Department</label>
                  <input
                    type="text"
                    required
                    disabled={userType === "self"}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Physics / Chemistry"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Subjects (comma separated)
                  </label>
                  <input
                    type="text"
                    value={subjectsStr}
                    onChange={(e) => setSubjectsStr(e.target.value)}
                    placeholder="Physics, Optics, Mechanics"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Teaching Experience</label>
                  <input
                    type="text"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="e.g. 7+ years in NEET/JEE coaching"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Bio / About</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief introduction and teaching philosophy"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORGANIZATION & CONTRACT (STAFF / USER) */}
          {activeTab === "org" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Role (System RBAC)</span>
                    <span className="text-[10px] font-normal text-slate-400">Permissions</span>
                  </label>
                  <select
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    System permissions &amp; administrative access level.
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Account Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Academic, Operations, Marketing"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Position / Designation</span>
                    <span className="text-[10px] font-normal text-slate-400">Public Title</span>
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Founder and Senior Chemistry Educator"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Job title or public designation (e.g. Founder &amp; Senior Chemistry Educator).
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Contract Type</label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="FREELANCER">Freelancer</option>
                    <option value="CONSULTANT">Consultant</option>
                    <option value="INTERNSHIP">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Contract End Date</label>
                  <input
                    type="date"
                    value={contractEnd}
                    onChange={(e) => setContractEnd(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
