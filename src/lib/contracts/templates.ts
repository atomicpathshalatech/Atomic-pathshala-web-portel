/**
 * Atomic Pathshala Contract & Legal Agreement Engine
 * Based on official EdTech Plus Educator Agreement & Indian Stamp Act standards
 */

export type ContractVariables = {
  contractId: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  address: string;
  panNumber: string;
  effectiveDate: string;
  contractEndDate: string;
  salaryAnnual: string;
  salaryMonthly: string;
  teachingHoursMonthly: string;
  paymentCycleDay: string;
  noticePeriodDays: string;
  lockInMonths: string;
  workLocation: string;
  companyName: string;
  companyCin: string;
  companyAddress: string;
  companyGstin: string;
  companyPan: string;
  authorizedSignatoryName: string;
  authorizedSignatoryDesignation: string;
  stampCertificateNo?: string;
  stampDutyAmount?: string;
};

export const DEFAULT_COMPANY_DETAILS = {
  companyName: "Atomic Pathshala",
  companyCin: "U80904UP2026PTC123456",
  companyAddress: "Plot 42, Knowledge Park III, Institutional Area, Greater Noida, UP - 201308, India",
  companyGstin: "07AAACA1234A1Z5",
  companyPan: "AAACA1234A",
  authorizedSignatoryName: "Firoz Ali",
  authorizedSignatoryDesignation: "Founder & Director",
};

export function generateContractId(index: number = 1): string {
  const year = new Date().getFullYear();
  const padded = String(index).padStart(6, "0");
  return `AP-CON-${year}-${padded}`;
}

export function compileContractAgreement(vars: ContractVariables): string {
  return `
================================================================================
                    GOVERNMENT OF INDIA / STATE e-STAMP
================================================================================
Certificate No.             : ${vars.stampCertificateNo || `IN-UP${Date.now()}A`}
Certificate Issued Date     : ${vars.effectiveDate}
Account Reference           : NONACC/ atomic08/ NOIDA/ UP
Unique Doc. Reference       : SUBIN-UPATOMIC0851509223708115W
Purchased By                : ${vars.companyName}
Description of Document     : Article 5(J) Agreement (Educator & Service Terms)
First Party                 : ${vars.employeeName} ("Educator")
Second Party                : ${vars.companyName}
Stamp Duty Amount (Rs.)     : ${vars.stampDutyAmount || "500 (Five Hundred only)"}
Contract ID                 : ${vars.contractId}
================================================================================

                           PLUS EDUCATOR AGREEMENT

This Plus Educator Agreement ("Agreement") is made and entered into on ${vars.effectiveDate} ("Effective Date").

BY AND BETWEEN:

${vars.employeeName}, an individual, aged adult, Indian citizen, residing at ${vars.address} bearing PAN No. ${vars.panNumber} (hereinafter referred to as the "Educator", which expression shall, unless it be repugnant to the context or meaning thereof, be deemed to mean and include his/her heirs, executors, legal and authorized representatives) of the FIRST PART;

AND

${vars.companyName}, a company incorporated under the provisions of the Companies Act, 2013 bearing CIN ${vars.companyCin} and having its registered office at ${vars.companyAddress} (hereinafter referred to as "Atomic Pathshala", which expression shall, unless repugnant to the meaning or context thereof, be deemed to include its Affiliates, subsidiaries and assigns) of the SECOND PART.

The Educator and Atomic Pathshala shall hereinafter be individually referred to as "Party" and collectively as "Parties".

WHEREAS:
(A) Atomic Pathshala is a premier online education technology platform providing high-quality concept-first coaching, live interactive classes, tests, and study materials for NEET, JEE, and Board exam aspirants.
(B) The Educator represents and warrants that they are adequately qualified, competent, and hold the requisite subject expertise in ${vars.department} to conduct live streaming courses, recorded lectures, and mentorship programs exclusively on the Atomic Pathshala platform.

NOW THEREFORE, IT IS MUTUALLY AGREED AS FOLLOWS:

1. DEFINITIONS AND INTERPRETATIONS
1.1. "Applicable Law(s)" means any statute, law, regulation, ordinance, rule, judgment, or order of Indian courts.
1.2. "Educator Content" means all lectures, live streams, recorded sessions, DPPs, test questions, handwritten notes, and curriculum materials developed by the Educator for Atomic Pathshala.
1.3. "Platform" means the Atomic Pathshala website, mobile applications, and official learning channels.
1.4. "Confidential Information" means all non-public technical, financial, student, and business information disclosed by Atomic Pathshala.

2. LICENSE AND ACCESS TO PLATFORM
2.1. Atomic Pathshala grants the Educator access to the Platform to conduct live-stream courses, special classes, and upload recorded sessions.
2.2. The Educator Content shall be licensed to Atomic Pathshala for a period of five (5) years from the date of publishing ("License Period").

3. CLASS SCHEDULE & DELIVERABLES
3.1. The Educator shall strictly adhere to the pre-approved timetable and schedule of live classes.
3.2. Monthly teaching deliverable: ${vars.teachingHoursMonthly} of dedicated instruction and doubt clearing.

4. CONSIDERATION & PAYMENT TERMS
4.1. Base Pay: The Educator shall be paid a fixed gross consideration of ${vars.salaryAnnual} (equivalent to ${vars.salaryMonthly}), subject to applicable TDS deductions and statutory compliance.
4.2. Payment Cycle: Payment for deliverables completed in any given month shall be disbursed on or before the ${vars.paymentCycleDay}.

5. RESCHEDULING POLICY & ATTENDANCE
5.1. Any rescheduling of live classes must be intimated at least 24 hours in advance. Unscheduled class cancellations without emergency reasons may attract rescheduling administration fees.

6. REPRESENTATIONS AND WARRANTIES
6.1. The Educator confirms that all content, lectures, and explanations delivered are 100% original, error-free, and comply strictly with the latest NCERT and NTA NEET/JEE syllabus.
6.2. The Educator guarantees a high-speed stable internet connection (>10 Mbps) and professional audio-visual setup for delivering uninterrupted live classes.

7. INTELLECTUAL PROPERTY RIGHTS
7.1. All trademarks, software, curriculum frameworks, and brand assets remain the exclusive intellectual property of Atomic Pathshala.
7.2. Educator Content created under this Agreement is licensed exclusively to Atomic Pathshala for dissemination to enrolled learners.

8. STRICT CONFIDENTIALITY & NON-DISCLOSURE
8.1. The Educator shall maintain absolute secrecy regarding student databases, internal compensation structures, analytics data, and business strategies during and after the tenure of this Agreement.

9. NON-DISPARAGEMENT & SOCIAL CODE OF CONDUCT
9.1. The Educator agrees not to make any disparaging, defamatory, or harmful statements against Atomic Pathshala, its management, faculty peers, or students across social media or public forums.

10. EXCLUSIVITY & NON-COMPETE
10.1. During the active term of this Agreement and for a period of six (6) months thereafter, the Educator shall not teach, consult, or provide live coaching services to any direct competitor EdTech platform without prior written consent from Atomic Pathshala.

11. NON-SOLICITATION
11.1. For a period of two (2) years post-termination, the Educator shall not solicit or induce any employee, faculty, or student of Atomic Pathshala to leave the platform.

12. TERM & TERMINATION
12.1. Term: This Agreement is effective from ${vars.effectiveDate} and shall remain valid until ${vars.contractEndDate} ("Term").
12.2. Lock-In Period: The initial ${vars.lockInMonths} months from the Effective Date constitute a lock-in period to ensure syllabus continuity for enrolled students.
12.3. Notice Period: Either party may terminate this agreement outside the lock-in period by providing a written notice of ${vars.noticePeriodDays}.

13. GOVERNING LAW & ARBITRATION
13.1. This Agreement shall be governed by the laws of India. Any disputes arising hereunder shall be resolved through arbitration in accordance with the Arbitration and Conciliation Act, 1996, with jurisdiction at Delhi NCR / Noida.

================================================================================
                                   ANNEXURE A
                  CONSIDERATION, DELIVERABLES & PAYMENT TERMS
================================================================================
1. Annual Gross CTC          : ${vars.salaryAnnual}
2. Monthly Payout            : ${vars.salaryMonthly}
3. Monthly Teaching Hours    : ${vars.teachingHoursMonthly}
4. Payment Disbursement Date : By ${vars.paymentCycleDay}
5. Reporting Department      : ${vars.department} (${vars.designation})
6. Work Location             : ${vars.workLocation}

================================================================================
                               EXECUTION & SIGNATURES
================================================================================
IN WITNESS WHEREOF, the Parties have executed this Plus Educator Agreement on the date first written above.

FOR EDUCATOR:
Name       : ${vars.employeeName}
Designation: ${vars.designation}
PAN        : ${vars.panNumber}

FOR ATOMIC PATHSHALA:
Authorized Signatory: ${vars.authorizedSignatoryName}
Designation         : ${vars.authorizedSignatoryDesignation}
Company             : ${vars.companyName}
================================================================================
`;
}
