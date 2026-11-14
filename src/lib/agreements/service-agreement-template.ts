/**
 * ATOMIC PATHSHALA EDUCATION
 * Document 02: Educator Service Agreement Engine
 * 
 * Complies with strict legal identity & statutory rules:
 * - Enterprise: ATOMIC PATHSHALA EDUCATION
 * - Brand: Atomic Pathshala
 * - First Party: Firoz Ali, Founder & Proprietor, Rampur, Uttar Pradesh, India.
 * - Second Party: Educator
 * - Indian Contract Act, 1872 (Section 27 non-compete compliance)
 * - Indian Copyright Act, 1957 (commissioned vs pre-existing IP)
 * - Arbitration & Conciliation Act, 1996 (Seat/Jurisdiction: Rampur, Uttar Pradesh)
 * - Zero fake CIN, GSTIN, Udyam, MSME, or personal PAN.
 */

export interface ServiceAgreementVariables {
  agreementReference: string; // AP-AGR-YYYY-XXXX
  executionDate: string;
  effectiveDate: string;
  contractEndDate: string;
  
  // Educator Details
  educatorName: string;
  educatorId: string;
  address: string;
  panNumber: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  subject: string;
  engagementType: string;

  // Academic Assignment
  assignedBatch: string;
  teachingMedium: string;
  workLocation: string;
  reportingAuthority: string;
  workingSchedule: string;
  academicSession: string;

  // Compensation & Deliverables (Annexure A)
  compensationType: string;
  annualSalary?: string;
  monthlySalary?: string;
  perLectureRate?: string;
  perHourRate?: string;
  teachingHoursMonthly?: string;
  doubtHoursMonthly?: string;
  noticePeriodDays?: string;
  paymentCycleDay?: string;
  applicableDeductions?: string;

  // Annexure C (Special Conditions)
  specialConditions?: string;

  // e-Stamp Details (if attached)
  stampCertificateNo?: string;
  stampDutyAmount?: string;
  stampState?: string;
}

export function generateServiceAgreementId(count: number = 1): string {
  const year = new Date().getFullYear();
  const padded = String(count).padStart(6, "0");
  return `AP-AGR-${year}-${padded}`;
}

export function compileServiceAgreementText(vars: ServiceAgreementVariables): string {
  const stampSection = vars.stampCertificateNo
    ? `

[AUTHENTIC STATE GOVERNMENT E-STAMP CERTIFICATE ATTACHED]
Certificate Number : ${vars.stampCertificateNo}
Issuing State      : ${vars.stampState || "Uttar Pradesh"}
Stamp Duty Paid    : INR ${vars.stampDutyAmount || "100"} /-
Description        : Non-Judicial e-Stamp Certificate (Verified)

`
    : "";

  return `
                           EDUCATOR SERVICE AGREEMENT

${stampSection}
Agreement Reference : ${vars.agreementReference}
Execution Date      : ${vars.executionDate}
Effective Date      : ${vars.effectiveDate}
Term Expiry Date    : ${vars.contractEndDate}

THIS EDUCATOR SERVICE AGREEMENT (hereinafter referred to as the "Agreement") is entered 
into on this ${vars.executionDate} at Rampur, Uttar Pradesh, India, by and between:

PARTIES TO THIS AGREEMENT:

1. FIRST PARTY / PLATFORM OWNER:
   FIROZ ALI, an individual carrying on educational and academic tutoring business 
   under the enterprise name ATOMIC PATHSHALA EDUCATION and operating under the brand 
   name Atomic Pathshala, having its business location at Rampur, Uttar Pradesh, India 
   (hereinafter referred to as the "Platform Owner" or "Atomic Pathshala", which expression 
   shall, unless repugnant to the context or meaning thereof, include his legal heirs, 
   successors, representatives, and permitted assigns) of the FIRST PART;

AND

2. SECOND PARTY / EDUCATOR:
   ${vars.educatorName.toUpperCase()}, residing at ${vars.address || "Rampur, Uttar Pradesh, India"}, 
   bearing PAN ${vars.panNumber || "NOT_PROVIDED"} and Educator ID ${vars.educatorId} 
   (hereinafter referred to as the "Educator", which expression shall, unless repugnant 
   to the context or meaning thereof, include their legal heirs, executors, and administrators) 
   of the SECOND PART.

The Platform Owner and the Educator shall individually be referred to as a "Party" 
and collectively as the "Parties".

WHEREAS:
A. The Platform Owner operates an advanced digital learning platform and academic tutoring 
   ecosystem under the brand name "Atomic Pathshala", providing structured coaching, live 
   interactive classes, recorded courses, and academic assessments for competitive 
   examinations including NEET, JEE, and Board examinations.
B. The Educator possesses requisite academic qualifications, pedagogical competence, 
   and specialized domain expertise in the subject of ${vars.subject || vars.department}.
C. The Parties desire to enter into this Agreement to define the contractual terms, 
   duties, compensation, intellectual property rights, and code of conduct governing 
   the Educator's engagement with Atomic Pathshala.

NOW, THEREFORE, in consideration of the mutual covenants, representations, and valuable 
consideration contained herein, the Parties agree as follows:


CLAUSE 1 — DEFINITIONS AND INTERPRETATION

1.1 Definitions:
    a) "Academic Materials" means all course handouts, handwritten lecture notes, slides, 
       syllabi, formula compilations, DPPs, tests, and answer keys prepared for courses.
    b) "Agreement Term" means the duration commencing from the Effective Date (${vars.effectiveDate}) 
       until the Expiry Date (${vars.contractEndDate}), unless terminated earlier pursuant to Clause 19.
    c) "Confidential Information" means all non-public technical, student, academic, or financial 
       data, including student contact lists, faculty compensation, question banks, and platform code.
    d) "DPP" means Daily Practice Problems provided to students for topic revision.
    e) "Educator Content" means lectures, video recordings, whiteboard drawings, and written 
       materials delivered or prepared by the Educator pursuant to this Agreement.
    f) "Intellectual Property" means copyrights, trademarks, pedagogical methods, software, 
       and database rights, whether registered or unregistered.
    g) "Live Classes" means real-time digital classroom streaming sessions conducted on the Platform.
    h) "Platform" means the Atomic Pathshala web portals, mobile apps, LMS, and digital tools.
    i) "Question Bank" means the proprietary repository of practice questions, solutions, and PYQs.
    j) "Student Data" means any personally identifiable information of enrolled students or parents.
1.2 Interpretation: Headings are for convenience only and do not affect construction.


CLAUSE 2 — APPOINTMENT AND NATURE OF ENGAGEMENT

2.1 Appointment: The Platform Owner hereby engages the Educator as ${vars.designation} 
    in the Department of ${vars.department}, and the Educator accepts such engagement.
2.2 Engagement Model: The Educator is engaged under the ${vars.engagementType} engagement model.
2.3 Relationship: The relationship between the Parties is defined by the actual scope of 
    work and deliverables specified in Annexure A and Annexure B.


CLAUSE 3 — SCOPE OF SERVICES

3.1 The Educator shall provide high-quality teaching, academic mentoring, and content creation services.
3.2 Specific deliverables include:
    a) Conducting scheduled live interactive classes with academic rigor.
    b) Preparing clear handwritten lecture notes and whiteboard summaries.
    c) Authoring or reviewing Daily Practice Problems (DPPs) with step-by-step solutions.
    d) Resolving student academic doubts across designated platform doubt resolution channels.
    e) Participating in curriculum design, academic reviews, and student feedback calibrations.


CLAUSE 4 — TEACHING SCHEDULE AND DELIVERABLES

4.1 The Educator shall deliver approximately ${vars.teachingHoursMonthly || "70 to 80"} hours 
    of live/recorded teaching per month, as detailed in the official Academic Timetable.
4.2 Timely syllabus completion in accordance with the pre-published Academic Calendar is an 
    essential obligation of the Educator.


CLAUSE 5 — ATTENDANCE, PUNCTUALITY AND RESCHEDULING

5.1 Class Punctuality: The Educator must join scheduled live sessions at least 5 minutes 
    prior to commencement to verify audio/visual feeds and digital whiteboard equipment.
5.2 Planned Leave: The Educator shall provide written notice of at least 24 to 48 hours for 
    any anticipated absence to enable orderly rescheduling without student inconvenience.
5.3 Emergency Absence: In case of unforeseen emergencies, the Educator must notify the 
    Academic Coordinator promptly. All missed lectures must be recovered within 7 days.


CLAUSE 6 — COMPENSATION AND PAYMENT TERMS

6.1 Remuneration: In consideration of the satisfactory performance of services, the Platform 
    Owner shall pay the Educator compensation as set forth in Annexure A.
6.2 Disbursement Cycle: Remuneration shall be processed on or before the ${vars.paymentCycleDay || "7th"} 
    day of each calendar month for services rendered in the preceding month.
6.3 Statutory Deductions: All payments shall be subject to applicable Indian Tax Deducted at 
    Source (TDS) under the Income Tax Act, 1961, and GST where applicable.


CLAUSE 7 — ACADEMIC QUALITY AND TEACHING STANDARDS

7.1 Standards: The Educator shall strictly adhere to NCERT, NEET, and JEE guidelines.
7.2 Professional Accuracy: The Educator shall exercise reasonable professional skill, care, 
    and pedagogical diligence in lecture preparation and problem-solving.
7.3 Timely Error Rectification: Any conceptual or computational error occurring during a class 
    shall be rectified by the Educator via an errata note or explanatory message within 24 hours.


CLAUSE 8 — INTELLECTUAL PROPERTY RIGHTS

8.1 Pre-Existing Materials: Proprietary notes, self-authored books, or pedagogical frameworks 
    created by the Educator prior to this engagement remain the personal IP of the Educator.
8.2 Platform-Commissioned Content: All live class recordings, specialized video modules, 
    curated DPPs, question bank contributions, and digital whiteboard snapshots created 
    specifically for Atomic Pathshala during this engagement constitute platform educational assets.
8.3 Licensing & Archival Rights: The Educator grants Atomic Pathshala an irrevocable, worldwide, 
    royalty-free license to host, stream, display, and archive all recorded lectures delivered 
    during the term, ensuring enrolled students have unbroken access throughout their academic cycle.
8.4 Moral Rights & Attribution: Atomic Pathshala shall ensure the Educator is duly attributed 
    as the author/instructor across published course modules.


CLAUSE 9 — CONFIDENTIALITY AND NON-DISCLOSURE

9.1 Protection: The Educator agrees to hold all Confidential Information in strictest confidence.
9.2 Exclusions: Information that is publicly known through no fault of the Educator is excluded.
9.3 Survival: Confidentiality obligations survive the termination of this Agreement indefinitely.


CLAUSE 10 — STUDENT DATA PROTECTION AND PRIVACY

10.1 Prohibition on Scraping: The Educator shall not download, scrape, screenshot, or store 
     student contact records, phone numbers, or parent details.
10.2 Zero Commercial Misuse: Student information shall never be sold, distributed, or utilized 
     for personal marketing, private tutoring solicitation, or third-party platforms.
10.3 Compliance: The Educator shall comply with the Digital Personal Data Protection Act, 2023.


CLAUSE 11 — PLATFORM USAGE AND DIGITAL SECURITY

11.1 Credential Integrity: Account credentials for the LMS, Live Classroom, and Test Portal 
     are strictly personal and non-transferable. Sharing credentials is a material breach.
11.2 Prohibited Actions: Reverse engineering, automated data scraping, or security bypassing 
     across any Atomic Pathshala digital asset is strictly forbidden.


CLAUSE 12 — STUDENT COMMUNICATION POLICY

12.1 Official Channels: Student interactions must occur exclusively through official platform 
     forums, live chat, or authorized Telegram academic groups.
12.2 Financial Prohibition: The Educator shall NEVER solicit, accept, or process private tuition 
     fees, UPI payments, or financial contributions from students or parents.


CLAUSE 13 — PROFESSIONAL CONDUCT AND ETHICS

13.1 Dignified Atmosphere: The Educator must maintain an inspiring, encouraging, and respectful tone.
13.2 Zero Harassment: Harassment or discrimination of any kind is subject to immediate termination.
13.3 Attire & Decorum: Modest, professional attire must be maintained during all video streams.


CLAUSE 14 — BRAND AND MARKETING REPRESENTATION

14.1 Authorized Branding: The Educator may use the Atomic Pathshala name and logo only for 
     approved course promotion and authorized academic presentations.
14.2 Public Statements: The Educator shall refrain from making defamatory or disparaging public 
     statements regarding Atomic Pathshala or its staff on social media.


CLAUSE 15 — EXCLUSIVITY (DURING ACTIVE TERM)

15.1 If designated as Full-Time, the Educator shall not teach parallel competitive coaching 
     batches for competing online EdTech platforms during the active term without prior consent.
15.2 In accordance with Section 27 of the Indian Contract Act, 1872, no post-termination 
     restraint on lawful trade or profession is imposed.


CLAUSE 16 — NON-SOLICITATION

16.1 During the term and for 12 months thereafter, the Educator shall not directly solicit 
     actively enrolled Atomic Pathshala students away from the Platform using confidential data.


CLAUSE 17 — REPRESENTATIONS AND WARRANTIES

17.1 Qualifications: The Educator represents possessing the academic credentials and competence claimed.
17.2 Originality: All newly created content provided by the Educator is original and non-infringing.


CLAUSE 18 — TERM AND RENEWAL

18.1 This Agreement is effective from ${vars.effectiveDate} until ${vars.contractEndDate}.
18.2 Extension or renewal may be executed upon mutually agreed written terms prior to expiry.


CLAUSE 19 — TERMINATION

19.1 Convenience: Either Party may terminate this Agreement by serving ${vars.noticePeriodDays || "60"} 
     days prior written notice to the other Party.
19.2 Immediate Cause: The Platform Owner may terminate immediately for gross academic misconduct, 
     confidentiality breach, theft of student data, or prolonged unapproved absence.


CLAUSE 20 — STUDENT CONTINUITY AND ACADEMIC HANDOVER

20.1 Upon notice of termination, the Educator must complete ongoing course chapters or prepare 
     structured handover notes to the successor faculty to safeguard student academic progress.


CLAUSE 21 — POST-TERMINATION OBLIGATIONS

21.1 The Educator shall return all platform assets, cease using internal credentials, and 
     abide by surviving confidentiality and non-solicitation covenants.


CLAUSE 22 — LIMITATION OF LIABILITY

22.1 To the extent permitted by law, neither Party shall be liable for indirect, incidental, 
     or consequential damages arising out of this Agreement.


CLAUSE 23 — FORCE MAJEURE

23.1 Neither Party shall be held in breach for failure of performance caused by acts of God, 
     pandemics, state-wide internet blackouts, war, or governmental orders.


CLAUSE 24 — DISPUTE RESOLUTION AND ARBITRATION

24.1 Amicable Settlement: The Parties shall endeavor to settle disputes amicably within 30 days.
24.2 Arbitration: Any unresolved dispute shall be referred to arbitration in accordance with 
     the Arbitration and Conciliation Act, 1996, by a sole arbitrator appointed mutually.
24.3 Seat & Jurisdiction: The seat and venue of arbitration shall be Rampur, Uttar Pradesh, 
     India. The courts at Rampur, Uttar Pradesh shall have exclusive jurisdiction.
24.4 Language: The language of arbitration proceedings shall be English.


CLAUSE 25 — GENERAL PROVISIONS

25.1 Entire Agreement: This Agreement, along with Annexures A, B, and C, constitutes the entire 
     understanding between the Parties and supersedes all prior oral or written discussions.
25.2 Amendments: Any amendment must be in writing and signed by both Parties.
25.3 Severability: If any provision is found invalid, remaining clauses remain enforceable.
25.4 Electronic Execution: This Agreement may be executed electronically via digital signature, 
     and such electronic execution is legally valid and binding under the Information Technology Act, 2000.



                                  ANNEXURE A
                       COMPENSATION AND DELIVERABLES

A.1 Compensation Model      : ${vars.compensationType}
A.2 Annual Compensation     : ${vars.annualSalary || "INR 7,20,000 /- per annum"}
A.3 Monthly Remuneration    : ${vars.monthlySalary || "INR 60,000 /- per month"}
A.4 Per Lecture / Hour Rate : ${vars.perLectureRate || vars.perHourRate || "Included in Monthly Remuneration"}
A.5 Monthly Teaching Hours  : ${vars.teachingHoursMonthly || "70 to 80 Hours"}
A.6 Doubt Resolution Hours  : ${vars.doubtHoursMonthly || "15 Hours per month"}
A.7 DPP Responsibilities    : Authoring / reviewing 30 DPP sets per academic term
A.8 Test Series Delivery    : Contributing questions for Monthly Unit Tests & Full Mock Tests
A.9 Payment Due Date        : On or before the ${vars.paymentCycleDay || "7th"} of each calendar month
A.10 Statutory Deductions   : TDS under Indian Income Tax Act; GST where applicable



                                  ANNEXURE B
                             ACADEMIC ASSIGNMENT

B.1 Department              : ${vars.department}
B.2 Assigned Subject        : ${vars.subject || vars.department}
B.3 Assigned Batches        : ${vars.assignedBatch || "Comprehensive NEET / JEE Batches"}
B.4 Teaching Medium         : ${vars.teachingMedium || "English / Bilingual (Hinglish)"}
B.5 Work Location           : ${vars.workLocation || "Rampur, Uttar Pradesh, India / Digital Streaming Studio"}
B.6 Reporting Authority     : ${vars.reportingAuthority || "Founder & Proprietor"}
B.7 Academic Session        : ${vars.academicSession || "2025-2026 Academic Session"}



                                  ANNEXURE C
                             SPECIAL CONDITIONS

${vars.specialConditions || "No additional special conditions stipulated. Standard institutional terms apply."}



                              SIGNATURE PAGE

IN WITNESS WHEREOF, the Parties hereto have caused this Educator Service Agreement 
to be duly executed by their authorized representatives as of the date first above written.

FIRST PARTY (PLATFORM OWNER):


FIROZ ALI
Founder & Proprietor
ATOMIC PATHSHALA EDUCATION
Brand: Atomic Pathshala
Rampur, Uttar Pradesh, India
Website: https://atomicpathshala.in


SECOND PARTY (EDUCATOR):


${vars.educatorName.toUpperCase()}
Designation : ${vars.designation}
Educator ID : ${vars.educatorId}
Date        : ${vars.executionDate}
`;
}
