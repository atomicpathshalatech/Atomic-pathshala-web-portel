"use client";

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { parseGlobalRole } from "@/lib/rbac/permissions";
import {
  EXAM_OPTIONS,
  CLASS_OPTIONS as TEACHER_CLASS_OPTIONS,
  LANGUAGE_OPTIONS,
  EXPERIENCE_OPTIONS,
} from "@/lib/validation/teacher";

export type ProfileUserType = "student" | "teacher" | "user" | "self";

export interface ProfileQualificationItem {
  degree: string;
  institution: string;
  year?: string;
}

export interface ProfileExperienceItem {
  organization: string;
  designation: string;
  startYear?: string;
  endYear?: string;
  description?: string;
}

export interface AdminEditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: any) => void;
  targetId: string;
  userType: ProfileUserType;
  initialData: {
    // Identity
    id?: string;
    userId?: string;
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
    qualifications?: ProfileQualificationItem[];
    experienceList?: ProfileExperienceItem[];
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

const STANDARD_SUBJECT_PRESETS = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "Zoology",
  "Botany",
  "General Science",
];

const STUDENT_CLASS_OPTIONS = ["Class 9", "Class 10", "Class 11", "Class 12", "Dropper"];
const STUDENT_TARGET_EXAM_OPTIONS = ["NEET", "JEE Main", "JEE Advanced", "Foundation", "Board Exam"];
const GENDER_OPTIONS = ["MALE", "FEMALE", "OTHER"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "APPROVAL_PENDING"];

function resolveInitialRole(data: any): string {
  const raw = data.roleName || data.role || (data.user && (data.user.role?.name || data.user.role)) || "";
  const parsed = parseGlobalRole(raw);
  if (parsed) return parsed;
  if (raw === "NONE" || data.removeRole) return "NONE";
  return "TEACHER";
}

function parseArraySafely(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

function parseQualifications(val: any): ProfileQualificationItem[] {
  const arr = parseArraySafely(val);
  return arr.map((item: any) => ({
    degree: item?.degree || "",
    institution: item?.institution || "",
    year: item?.year || "",
  }));
}

function parseExperience(val: any): ProfileExperienceItem[] {
  const arr = parseArraySafely(val);
  return arr.map((item: any) => ({
    organization: item?.organization || "",
    designation: item?.designation || "",
    startYear: item?.startYear || "",
    endYear: item?.endYear || "",
    description: item?.description || "",
  }));
}

export function AdminEditProfileModal({
  isOpen,
  onClose,
  onSuccess,
  targetId,
  userType,
  initialData,
}: AdminEditProfileModalProps) {
  const isStudent = userType === "student";
  const [activeTab, setActiveTab] = useState<"identity" | "org" | "scope" | "experience" | "student_academic">(
    isStudent ? "identity" : "identity"
  );
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states - Identity
  const [name, setName] = useState(initialData.name || "");
  const [displayName, setDisplayName] = useState(initialData.displayName || "");
  const [email, setEmail] = useState(initialData.email || "");
  const [phone, setPhone] = useState(initialData.phone || "");
  const [photoUrl, setPhotoUrl] = useState(initialData.photoUrl || "");
  const [dob, setDob] = useState(
    initialData.dob ? new Date(initialData.dob).toISOString().split("T")[0] : ""
  );

  // Student specific
  const [studentClass, setStudentClass] = useState(initialData.class || "Class 11");
  const [targetExam, setTargetExam] = useState(initialData.targetExam || "NEET");
  const [fatherName, setFatherName] = useState(initialData.fatherName || "");
  const [motherName, setMotherName] = useState(initialData.motherName || "");
  const [gender, setGender] = useState(initialData.gender || "MALE");
  const [school, setSchool] = useState(initialData.school || "");
  const [city, setCity] = useState(initialData.city || "");
  const [state, setState] = useState(initialData.state || "");
  const [address, setAddress] = useState(initialData.address || "");
  const [bloodGroup, setBloodGroup] = useState(initialData.bloodGroup || "");
  const [emergencyContact, setEmergencyContact] = useState(initialData.emergencyContact || "");
  const [academicStatus, setAcademicStatus] = useState(initialData.academicStatus || "ACTIVE");
  const [board, setBoard] = useState(initialData.board || "");

  // Staff & Org
  const [roleName, setRoleName] = useState(() => resolveInitialRole(initialData));
  const [position, setPosition] = useState(() => {
    const p = initialData.position || "";
    const r = initialData.roleName || (initialData as any).role || "";
    if (!p && r && !parseGlobalRole(r)) return r;
    return p;
  });
  const [department, setDepartment] = useState(initialData.department || "Academic");
  const [employeeCode, setEmployeeCode] = useState(initialData.employeeCode || "");
  const [status, setStatus] = useState(initialData.status || "ACTIVE");
  const [contractType, setContractType] = useState(initialData.contractType || "FULL_TIME");
  const [contractEnd, setContractEnd] = useState(
    initialData.contractEnd ? new Date(initialData.contractEnd).toISOString().split("T")[0] : ""
  );

  // Teacher Academic Scope
  const [subjects, setSubjects] = useState<string[]>(initialData.subjects || []);
  const [subjectInput, setSubjectInput] = useState("");
  const [targetExams, setTargetExams] = useState<string[]>(initialData.targetExams || []);
  const [classes, setClasses] = useState<string[]>(initialData.classes || []);
  const [languages, setLanguages] = useState<string[]>(
    initialData.languages && initialData.languages.length > 0
      ? initialData.languages
      : ["Hindi", "English"]
  );
  const [experienceYears, setExperienceYears] = useState(initialData.experienceYears || "");
  const [bio, setBio] = useState(initialData.bio || "");

  // Qualifications & Experience lists
  const [qualifications, setQualifications] = useState<ProfileQualificationItem[]>(() =>
    parseQualifications(initialData.qualifications)
  );
  const [experienceList, setExperienceList] = useState<ProfileExperienceItem[]>(() =>
    parseExperience(initialData.experienceList)
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync when initialData or modal open state changes
  useEffect(() => {
    setName(initialData.name || "");
    setDisplayName(initialData.displayName || "");
    setEmail(initialData.email || "");
    setPhone(initialData.phone || "");
    setPhotoUrl(initialData.photoUrl || "");
    setDob(initialData.dob ? new Date(initialData.dob).toISOString().split("T")[0] : "");

    setStudentClass(initialData.class || "Class 11");
    setTargetExam(initialData.targetExam || "NEET");
    setFatherName(initialData.fatherName || "");
    setMotherName(initialData.motherName || "");
    setGender(initialData.gender || "MALE");
    setSchool(initialData.school || "");
    setCity(initialData.city || "");
    setState(initialData.state || "");
    setAddress(initialData.address || "");
    setBloodGroup(initialData.bloodGroup || "");
    setEmergencyContact(initialData.emergencyContact || "");
    setAcademicStatus(initialData.academicStatus || "ACTIVE");
    setBoard(initialData.board || "");

    setRoleName(resolveInitialRole(initialData));
    const p = initialData.position || "";
    const r = initialData.roleName || (initialData as any).role || "";
    setPosition(!p && r && !parseGlobalRole(r) ? r : p);
    setDepartment(initialData.department || "Academic");
    setEmployeeCode(initialData.employeeCode || "");
    setStatus(initialData.status || "ACTIVE");
    setContractType(initialData.contractType || "FULL_TIME");
    setContractEnd(
      initialData.contractEnd ? new Date(initialData.contractEnd).toISOString().split("T")[0] : ""
    );

    setSubjects(initialData.subjects || []);
    setTargetExams(initialData.targetExams || []);
    setClasses(initialData.classes || []);
    setLanguages(
      initialData.languages && initialData.languages.length > 0
        ? initialData.languages
        : ["Hindi", "English"]
    );
    setExperienceYears(initialData.experienceYears || "");
    setBio(initialData.bio || "");
    setQualifications(parseQualifications(initialData.qualifications));
    setExperienceList(parseExperience(initialData.experienceList));

    setError(null);
    setActiveTab(userType === "student" ? "identity" : "identity");
  }, [initialData, isOpen, userType]);

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

  function toggleArrayItem(currentList: string[], item: string, setter: (val: string[]) => void) {
    if (currentList.includes(item)) {
      setter(currentList.filter((x) => x !== item));
    } else {
      setter([...currentList, item]);
    }
  }

  function handleAddSubject() {
    const val = subjectInput.trim();
    if (val && !subjects.includes(val)) {
      setSubjects([...subjects, val]);
    }
    setSubjectInput("");
  }

  function handleRemoveSubject(subjectToRemove: string) {
    setSubjects(subjects.filter((s) => s !== subjectToRemove));
  }

  function addQualification() {
    setQualifications([...qualifications, { degree: "", institution: "", year: "" }]);
  }

  function updateQualification(index: number, field: keyof ProfileQualificationItem, val: string) {
    const next = [...qualifications];
    const current = next[index] || { degree: "", institution: "", year: "" };
    next[index] = {
      degree: current.degree,
      institution: current.institution,
      year: current.year,
      [field]: val,
    };
    setQualifications(next);
  }

  function removeQualification(index: number) {
    setQualifications(qualifications.filter((_, i) => i !== index));
  }

  function addExperience() {
    setExperienceList([
      ...experienceList,
      { organization: "", designation: "", startYear: "", endYear: "Present", description: "" },
    ]);
  }

  function updateExperience(index: number, field: keyof ProfileExperienceItem, val: string) {
    const next = [...experienceList];
    const current = next[index] || { organization: "", designation: "", startYear: "", endYear: "", description: "" };
    next[index] = {
      organization: current.organization,
      designation: current.designation,
      startYear: current.startYear,
      endYear: current.endYear,
      description: current.description,
      [field]: val,
    };
    setExperienceList(next);
  }

  function removeExperience(index: number) {
    setExperienceList(experienceList.filter((_, i) => i !== index));
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
      const sanitizedRole = roleName === "NONE" ? "NONE" : parseGlobalRole(roleName) || "TEACHER";

      const cleanedQuals = qualifications.filter((q) => q.degree.trim() || q.institution.trim());
      const cleanedExp = experienceList.filter((exp) => exp.organization.trim() || exp.designation.trim());

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
        payload = {
          ...payload,
          displayName: displayName.trim() || null,
          employeeCode: employeeCode.trim() || undefined,
          department: department.trim() || "Academic",
          subjects,
          targetExams,
          classes,
          languages,
          experienceYears: experienceYears.trim() || null,
          qualifications: cleanedQuals,
          experienceList: cleanedExp,
          bio: bio.trim() || null,
          dob: dob ? new Date(dob).toISOString() : null,
          roleName: sanitizedRole,
          position: position.trim() || undefined,
          status,
          contractType,
          contractEnd: contractEnd ? new Date(contractEnd).toISOString() : null,
        };
      } else if (userType === "self") {
        url = "/api/team/profile";
        payload = {
          ...payload,
          displayName: displayName.trim() || null,
          subjects,
          targetExams,
          classes,
          languages,
          experienceYears: experienceYears.trim() || null,
          qualifications: cleanedQuals,
          experienceList: cleanedExp,
          bio: bio.trim() || null,
        };
      } else {
        // userType === "user"
        url = `/api/team/users/${targetId}`;
        payload = {
          ...payload,
          status,
          roleName: sanitizedRole,
          department: department.trim() || undefined,
          position: position.trim() || undefined,
          contractType: contractType || undefined,
          contractEnd: contractEnd ? new Date(contractEnd).toISOString() : null,
          employeeCode: employeeCode.trim() || undefined,
          displayName: displayName.trim() || null,
          subjects,
          targetExams,
          classes,
          languages,
          experienceYears: experienceYears.trim() || null,
          qualifications: cleanedQuals,
          experienceList: cleanedExp,
          bio: bio.trim() || null,
          dob: dob ? new Date(dob).toISOString() : null,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">manage_accounts</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#031635] dark:text-white">
                Edit {userType === "self" ? "My" : userType === "student" ? "Student" : "Team Member / Educator"} Profile
              </h3>
              <p className="text-xs text-slate-500">
                Configure identity, roles, subjects, exams, qualifications, and employment history.
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("identity")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "identity"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-sm">badge</span>
            <span>1. Basic Identity</span>
          </button>

          {!isStudent && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("org")}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "org"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-sm">domain</span>
                <span>2. Role &amp; Organization</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("scope")}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "scope"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-sm">menu_book</span>
                <span>3. Academic Scope</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("experience")}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "experience"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-sm">history_edu</span>
                <span>4. Qualifications &amp; Experience</span>
              </button>
            </>
          )}

          {isStudent && (
            <button
              type="button"
              onClick={() => setActiveTab("student_academic")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "student_academic"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-sm">school</span>
              <span>2. Academic &amp; Personal Info</span>
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
          {/* TAB 1: BASIC IDENTITY */}
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
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-xs disabled:opacity-50 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">upload</span>
                      <span>{uploadingPhoto ? "Uploading…" : "Upload Photo"}</span>
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

              {/* Identity Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Rahul Sharma"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                {!isStudent && (
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Display Name / Headline
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Senior Chemistry Faculty | NEET Mentor"
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
                    placeholder="educator@atomicpathshala.com"
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

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                {isStudent && (
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300">Academic Status</label>
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

          {/* TAB 2: ROLE & ORGANIZATION (STAFF / TEACHER) */}
          {activeTab === "org" && !isStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Role (System RBAC)</span>
                    <span className="text-[10px] font-normal text-slate-400">Permissions</span>
                  </label>
                  <select
                    value={roleName}
                    disabled={userType === "self"}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white disabled:opacity-60"
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
                    disabled={userType === "self"}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-60"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Employee Code</label>
                  <input
                    type="text"
                    value={employeeCode}
                    disabled={userType === "self"}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    placeholder="e.g. EMP-2026-001"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Department</label>
                  <input
                    type="text"
                    value={department}
                    disabled={userType === "self"}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Academic / Physics / Operations"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Position / Public Designation</span>
                    <span className="text-[10px] font-normal text-slate-400">Public Title</span>
                  </label>
                  <input
                    type="text"
                    value={position}
                    disabled={userType === "self"}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Founder &amp; Senior Chemistry Educator"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Contract Type</label>
                  <select
                    value={contractType}
                    disabled={userType === "self"}
                    onChange={(e) => setContractType(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-60"
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
                    disabled={userType === "self"}
                    onChange={(e) => setContractEnd(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACADEMIC SCOPE (STAFF / TEACHER) */}
          {activeTab === "scope" && !isStudent && (
            <div className="space-y-4">
              {/* Subjects Taught */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Subjects Taught
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STANDARD_SUBJECT_PRESETS.map((sub) => {
                    const active = subjects.includes(sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleArrayItem(subjects, sub, setSubjects)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                          active
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                        }`}
                      >
                        {active ? `✓ ${sub}` : `+ ${sub}`}
                      </button>
                    );
                  })}
                </div>

                {subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {subjects.map((s) => (
                      <span
                        key={s}
                        className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5"
                      >
                        <span>{s}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubject(s)}
                          className="hover:text-rose-600 transition"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom subject (press Enter or click Add)"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubject();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold hover:bg-slate-300 transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Target Exams */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Target Exams / Educator Specialization
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {EXAM_OPTIONS.map((exam) => {
                    const active = targetExams.includes(exam);
                    return (
                      <button
                        key={exam}
                        type="button"
                        onClick={() => toggleArrayItem(targetExams, exam, setTargetExams)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          active
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                        }`}
                      >
                        {active ? `✓ ${exam}` : `+ ${exam}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Classes */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Target Classes / Grade Levels
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TEACHER_CLASS_OPTIONS.map((cls) => {
                    const active = classes.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleArrayItem(classes, cls, setClasses)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          active
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                        }`}
                      >
                        {active ? `✓ ${cls}` : `+ ${cls}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Teaching Languages */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Teaching Languages
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGE_OPTIONS.map((lang) => {
                    const active = languages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleArrayItem(languages, lang, setLanguages)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          active
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                        }`}
                      >
                        {active ? `✓ ${lang}` : `+ ${lang}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Teaching Experience & Bio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Total Teaching Experience
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    <select
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                    >
                      <option value="">Select experience level…</option>
                      {EXPERIENCE_OPTIONS.map((exp) => (
                        <option key={exp} value={exp}>
                          {exp}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="Or enter custom, e.g. 8+ Years in Kota"
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    About Educator (Bio / Teaching Philosophy)
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Enter personal introduction, teaching philosophy, or mentoring background..."
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: QUALIFICATIONS & EXPERIENCE (STAFF / TEACHER) */}
          {activeTab === "experience" && !isStudent && (
            <div className="space-y-5">
              {/* Educational Qualifications */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      Educational Qualifications
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Degrees, certifications, and universities attended.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addQualification}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-600 hover:text-white transition"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Add Qualification</span>
                  </button>
                </div>

                {qualifications.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No educational qualifications added yet. Click &quot;Add Qualification&quot; above.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {qualifications.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                      >
                        <div className="sm:col-span-5">
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Degree / Qualification *
                          </label>
                          <input
                            type="text"
                            value={q.degree}
                            onChange={(e) => updateQualification(idx, "degree", e.target.value)}
                            placeholder="e.g. M.Sc. Chemistry or B.Tech"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Institution / University *
                          </label>
                          <input
                            type="text"
                            value={q.institution}
                            onChange={(e) => updateQualification(idx, "institution", e.target.value)}
                            placeholder="e.g. University of Delhi / IIT"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Year (Optional)
                          </label>
                          <input
                            type="text"
                            value={q.year || ""}
                            onChange={(e) => updateQualification(idx, "year", e.target.value)}
                            placeholder="2020"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeQualification(idx)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                            title="Remove"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Professional Work Experience */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      Professional Work Experience
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Previous and current institutes (e.g. Ex-Allen, Ex-Unacademy, Atomic Pathshala).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addExperience}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-600 hover:text-white transition"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Add Experience</span>
                  </button>
                </div>

                {experienceList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No work experience entries added yet. Click &quot;Add Experience&quot; above.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {experienceList.map((exp, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2.5"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                          <div className="sm:col-span-4">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              Organization / Institute *
                            </label>
                            <input
                              type="text"
                              value={exp.organization}
                              onChange={(e) => updateExperience(idx, "organization", e.target.value)}
                              placeholder="e.g. Ex-Allen / Atomic Pathshala"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              Designation / Role *
                            </label>
                            <input
                              type="text"
                              value={exp.designation}
                              onChange={(e) => updateExperience(idx, "designation", e.target.value)}
                              placeholder="e.g. Senior Chemistry Faculty"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                            />
                          </div>
                          <div className="sm:col-span-1.5">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              Start *
                            </label>
                            <input
                              type="text"
                              value={exp.startYear || ""}
                              onChange={(e) => updateExperience(idx, "startYear", e.target.value)}
                              placeholder="2020"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                            />
                          </div>
                          <div className="sm:col-span-1.5">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              End *
                            </label>
                            <input
                              type="text"
                              value={exp.endYear || ""}
                              onChange={(e) => updateExperience(idx, "endYear", e.target.value)}
                              placeholder="Present"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                            />
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeExperience(idx)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                              title="Remove"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Description / Key Highlights (Optional)
                          </label>
                          <input
                            type="text"
                            value={exp.description || ""}
                            onChange={(e) => updateExperience(idx, "description", e.target.value)}
                            placeholder="e.g. Mentored 1000+ students for NEET with 95% qualification rate"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STUDENT ACADEMIC & PERSONAL INFO */}
          {activeTab === "student_academic" && isStudent && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Class / Grade</label>
                  <select
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    {STUDENT_CLASS_OPTIONS.map((c) => (
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
                    {STUDENT_TARGET_EXAM_OPTIONS.map((ex) => (
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
                  <label className="font-bold text-slate-700 dark:text-slate-300">School / College</label>
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

          {/* Modal Footer / Save Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
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
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  <span>Saving Profile…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
