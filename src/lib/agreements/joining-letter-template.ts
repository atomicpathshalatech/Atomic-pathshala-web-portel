/**
 * ATOMIC PATHSHALA EDUCATION
 * Document 01: Educator Appointment / Joining Letter Engine
 * 
 * Complies with strict identity rules:
 * - Enterprise: ATOMIC PATHSHALA EDUCATION
 * - Brand: Atomic Pathshala
 * - Founder: Firoz Ali
 * - Designation: Founder & Proprietor
 * - Location: Rampur, Uttar Pradesh, India
 * - Zero fake CIN, GSTIN, Udyam, MSME, or personal PAN.
 */

export interface JoiningLetterVariables {
  letterReference: string; // AP-JL-YYYY-XXXX
  issueDate: string;
  educatorName: string;
  educatorId: string;
  designation: string;
  department: string;
  subject: string;
  engagementType: string;
  dateOfJoining: string;
  assignedBatch?: string;
  teachingMedium?: string;
  workLocation?: string;
  reportingAuthority?: string;
  workingSchedule?: string;
  monthlyRemuneration?: string;
  email: string;
  phone?: string;
  address?: string;
  policiesAcknowledged?: string[];
}

export function generateJoiningLetterId(count: number = 1): string {
  const year = new Date().getFullYear();
  const padded = String(count).padStart(6, "0");
  return `AP-JL-${year}-${padded}`;
}

export function compileJoiningLetterText(vars: JoiningLetterVariables): string {
  return `OFFICIAL LETTER OF APPOINTMENT

Document Reference: ${vars.letterReference}
Date of Issue: ${vars.issueDate}

To,
${vars.educatorName}
${vars.educatorId ? `Educator ID: ${vars.educatorId}` : ""}
${vars.address ? `Address: ${vars.address}` : ""}
Email: ${vars.email}
${vars.phone ? `Phone: ${vars.phone}` : ""}

Subject: Official Letter of Appointment as ${vars.designation} (${vars.department})

Dear ${vars.educatorName},

We are pleased to formally welcome you to the academic family of Atomic Pathshala. Following our thorough assessment of your academic credentials, teaching pedigree, and pedagogical expertise, we are honored to appoint you as ${vars.designation} in the Department of ${vars.department} at ATOMIC PATHSHALA EDUCATION, operating under the brand name Atomic Pathshala.

This appointment is subject to the mutually agreed terms, operational expectations, and institutional policies outlined below.


1. APPOINTMENT SUMMARY & CREDENTIALS
Educator Name: ${vars.educatorName}
Educator ID: ${vars.educatorId || "Pending Generation"}
Academic Designation: ${vars.designation}
Department: ${vars.department}
Subject Area: ${vars.subject || vars.department}
Engagement Model: ${vars.engagementType.replace(/_/g, " ")}
Date of Joining: ${vars.dateOfJoining}
${vars.assignedBatch ? `Assigned Batch(es): ${vars.assignedBatch}` : ""}
Teaching Medium: ${vars.teachingMedium || "English / Bilingual (Hinglish)"}
Work Location: ${vars.workLocation || "Rampur, Uttar Pradesh, India / Digital Studio"}
Reporting Authority: ${vars.reportingAuthority || "Founder & Proprietor"}
${vars.workingSchedule ? `Teaching Schedule: ${vars.workingSchedule}` : ""}
${vars.monthlyRemuneration ? `Monthly Remuneration: ${vars.monthlyRemuneration}` : ""}


2. ROLES AND ACADEMIC RESPONSIBILITIES
As a valued educator at Atomic Pathshala, you shall be responsible for:
a) Delivering engaging, high-impact scheduled live interactive classes with academic rigor.
b) Recording high-definition conceptual modules, video solutions, and topic revisions when assigned.
c) Preparing concise handwritten lecture notes, formula sheets, and digital whiteboard summaries.
d) Contributing high-quality Daily Practice Problems (DPPs), question bank problems, and full-length test series.
e) Fostering an inspiring and supportive learning environment by promptly resolving student academic doubts.
f) Following the institutional academic calendar, course pacing guides, and lecture schedules.
g) Maintaining academic accuracy aligned with the latest NCERT, NEET, and JEE syllabi.
h) Actively participating in internal faculty reviews, pedagogical calibrations, and curriculum enhancements.
i) Exhibiting highest standards of personal integrity, decorum, and student empathy.


3. INSTITUTIONAL POLICY ACKNOWLEDGEMENT & COMPLIANCE
Your appointment is governed by Atomic Pathshala's centralized institutional policies. By accepting this appointment and executing the accompanying Service Agreement, you agree to strictly comply with:

Policy A — Academic Quality & Teaching Standards: Upholding NCERT/NEET/JEE syllabus alignment, rigorous lecture preparation, and immediate rectification of conceptual slips.
Policy B — Teaching, Punctuality & Attendance: Maintaining strict class punctuality and providing 24-48 hours advance notice for leaves to prevent student disruption.
Policy C — Content Creation & Intellectual Property: Recognizing that platform-commissioned lectures, recordings, and test materials constitute institutional assets, while your pre-existing IP remains yours.
Policy D — Confidentiality & Non-Disclosure: Guarding institutional strategies, faculty compensation, internal test banks, and platform trade secrets.
Policy E — Student Data Protection & Privacy: Strictly prohibiting unauthorized scraping, downloading, personal marketing, or external sharing of student contact records.
Policy F — Platform Usage & Digital Security: Ensuring non-transferable credential security, zero credential sharing, and safe computing hygiene across all Atomic Pathshala portals.
Policy G — Professional Conduct & Ethics: Fostering a respectful, non-discriminatory, and harassment-free educational atmosphere.
Policy H — Brand Representation & Social Media: Using official Atomic Pathshala logos and banners only for authorized promotions, and refraining from disparaging statements.
Policy I — Student Communication & Boundaries: Interacting through official institutional platforms only, and never soliciting or accepting private financial payments from students.
Policy J — Termination, Handover & Exit: Complying with agreed notice periods, student syllabus completion commitments, and formal handover procedures.


4. COMPREHENSIVE SERVICE AGREEMENT
This Joining Letter serves as an official formal record of appointment. The detailed legal rights, intellectual property terms, dispute resolution, compensation disbursement mechanisms, and contractual obligations governing this relationship are set forth in the separate Educator Service Agreement executed concurrently herewith.


5. FORMAL WELCOME & CLOSING
We look forward to an enriching, inspiring, and mutually rewarding academic collaboration. We trust that your passion for teaching and dedication to student excellence will illuminate thousands of aspiring minds at Atomic Pathshala.

Welcome aboard!

Yours Sincerely,

Issued By:
FIROZ ALI
Founder & Proprietor
ATOMIC PATHSHALA EDUCATION
Brand: Atomic Pathshala
Rampur, Uttar Pradesh, India
Website: https://atomicpathshala.in


EDUCATOR ACCEPTANCE
I, ${vars.educatorName}, hereby accept the appointment as ${vars.designation} at ATOMIC PATHSHALA EDUCATION under the brand name Atomic Pathshala, on the terms and conditions specified herein and in the accompanying Educator Service Agreement. I solemnly confirm that I have reviewed and agree to uphold all ten institutional policies cited above.

Educator Name: ${vars.educatorName}
${vars.educatorId ? `Educator ID: ${vars.educatorId}` : ""}
Acceptance Date: ${vars.issueDate}
`;
}
