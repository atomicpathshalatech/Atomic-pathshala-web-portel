"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { X, UserPlus, AlertCircle } from "lucide-react";
import type { CounsellorOption, CourseOption, BatchOption } from "./types";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
  counselors: CounsellorOption[];
  courses: CourseOption[];
  batches: BatchOption[];
}

export function AddLeadModal({
  isOpen,
  onClose,
  onLeadCreated,
  counselors,
  courses,
  batches,
}: AddLeadModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [studentClass, setStudentClass] = useState("Class 12");
  const [targetExam, setTargetExam] = useState("NEET");
  const [medium, setMedium] = useState("HINDI");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Uttar Pradesh");
  const [source, setSource] = useState("WEBSITE");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [preferredCourse, setPreferredCourse] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone) {
      toast.error("Student Name and Mobile number are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          studentClass,
          targetExam,
          medium,
          city: city || undefined,
          state: state || undefined,
          source,
          assignedUserId: assignedUserId || undefined,
          preferredCourse: preferredCourse || undefined,
          notes: notes || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Lead ${json.data.lead.leadCode} created successfully!`);
        onLeadCreated();
        onClose();
      } else {
        toast.error(json.error || "Failed to create lead");
      }
    } catch {
      toast.error("Network error while creating lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl max-w-xl w-full shadow-2xl border border-outline-variant/20 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-on-surface">Create New Lead</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-on-surface-variant hover:bg-surface-container">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">
                Student Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
                required
              />
            </div>
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
              />
            </div>
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">Target Exam</label>
              <select
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface font-semibold"
              >
                <option value="NEET">NEET UG</option>
                <option value="JEE">IIT JEE</option>
                <option value="BOARDS">Class 12 Boards</option>
                <option value="FOUNDATION">Foundation (9th/10th)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">Class</label>
              <select
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
              >
                <option value="Class 11">Class 11</option>
                <option value="Class 12">Class 12</option>
                <option value="Dropper">Dropper / Repeater</option>
                <option value="Foundation">Class 9 / 10</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">Medium</label>
              <select
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
              >
                <option value="HINDI">Hindi Medium</option>
                <option value="ENGLISH">English Medium</option>
                <option value="BILINGUAL">Hinglish / Bilingual</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
              >
                <option value="WEBSITE">Website Enquiry</option>
                <option value="WHATSAPP">WhatsApp Inbound</option>
                <option value="META_ADS">Meta / Facebook Ads</option>
                <option value="GOOGLE_ADS">Google Search Ads</option>
                <option value="YOUTUBE">YouTube Video</option>
                <option value="REFERRAL">Student Referral</option>
                <option value="OFFLINE_COUNSELLING">Walk-in / Offline</option>
                <option value="MANUAL_ENTRY">Manual Entry</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Lucknow / Patna"
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
              />
            </div>
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Uttar Pradesh"
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">
                Assign to Counsellor
              </label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
              >
                <option value="">Unassigned</option>
                {counselors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-on-surface-variant block mb-1">
                Preferred Course
              </label>
              <select
                value={preferredCourse}
                onChange={(e) => setPreferredCourse(e.target.value)}
                className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
              >
                <option value="">-- Choose Course --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.title}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-on-surface-variant block mb-1">
              Initial Notes & Background
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Student enquired about physics live classes and test series..."
              className="w-full p-2 rounded-lg border border-outline-variant/30 bg-surface"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-outline-variant/30 font-medium hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
            >
              {submitting ? "Creating Lead..." : "Save Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
