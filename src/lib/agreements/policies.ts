/**
 * ATOMIC PATHSHALA EDUCATION
 * Centralized Organizational Policies Management
 * 
 * 10 Master Organizational Policies applicable to all Educators & Faculty:
 * Policy A - Academic Quality
 * Policy B - Teaching and Attendance
 * Policy C - Content and Intellectual Property
 * Policy D - Confidentiality
 * Policy E - Student Data Protection
 * Policy F - Platform Security
 * Policy G - Professional Conduct
 * Policy H - Brand and Social Media
 * Policy I - Student Communication
 * Policy J - Termination and Exit
 */

import { prisma } from "@/lib/db";

export interface MasterPolicyDefinition {
  policyCode: string;
  title: string;
  description: string;
  detailedRules: string;
  version: string;
  applicableTo: string[];
  acknowledgement: boolean;
}

export const MASTER_POLICIES: MasterPolicyDefinition[] = [
  {
    policyCode: "POLICY_A",
    title: "Policy A — Academic Quality & Teaching Standards",
    description: "Defines strict NCERT, NEET, JEE, and State Board academic rigor, lecture preparation, and error-correction standards.",
    detailedRules: `1. Syllabus & Curriculum Alignment: All teaching and pedagogical deliveries must strictly align with current NCERT textbooks, the official NTA/NEET syllabus, JEE Mains/Advanced guidelines, and relevant State Board curricula as assigned.
2. Lecture Preparation & Depth: The Educator must adequately prepare structured lesson plans, illustrative diagrams, numerical problem sets, and conceptual derivations prior to every scheduled session.
3. Reasonable Professional Accuracy: The Educator shall uphold reasonable professional accuracy in problem-solving and conceptual exposition.
4. Timely Error Rectification: In the event of an inadvertent conceptual or mathematical slip during a live or recorded class, the Educator shall promptly issue an errata note or pin an explanatory clarification for students within 24 hours.
5. Student Learning Outcomes: Teaching delivery must be paced to accommodate diverse learning speeds, emphasizing foundational clarity before transitioning to advanced competitive problem-solving.`,
    version: "1.0",
    applicableTo: ["ALL", "FULL_TIME", "PART_TIME", "VISITING_FACULTY", "CONTENT_CREATOR"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_B",
    title: "Policy B — Teaching, Punctuality & Attendance",
    description: "Establishes guidelines for class punctuality, advance notice for leaves, emergency cancellations, and missed lecture recovery.",
    detailedRules: `1. Punctuality: The Educator must join the digital classroom environment at least 5 minutes prior to the scheduled start time to test audio, video, stylus input, and digital whiteboard readiness.
2. Advance Notice for Leave: For planned leaves or personal commitments, the Educator must provide written notice to the Academic Coordinator at least 24 to 48 hours in advance to enable rescheduling without student disruption.
3. Emergency Absence: In case of medical or unforeseen emergencies, the Educator must notify the platform authority immediately.
4. Rescheduling & Missed Lecture Recovery: Any canceled or missed lecture must be compensated within the same academic week through a mutually agreed makeup session.
5. Substitute Arrangements: Where prolonged absence is unavoidable, the Educator shall assist the Academic Head in briefing an authorized substitute faculty to maintain unbroken student syllabus continuity.`,
    version: "1.0",
    applicableTo: ["ALL", "FULL_TIME", "PART_TIME", "VISITING_FACULTY"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_C",
    title: "Policy C — Content Creation & Intellectual Property",
    description: "Delineates pre-existing educator materials vs newly commissioned Atomic Pathshala content and copyright licensing.",
    detailedRules: `1. Distinction of Content:
   A. Pre-Existing IP: Proprietary teaching materials, authored books, or personal notes created by the Educator prior to engagement remain the personal intellectual property of the Educator.
   B. Newly Commissioned Content: All live class recordings, specialized DPPs, module chapters, recorded video lectures, question bank contributions, and whiteboard snapshots specifically commissioned and paid for by Atomic Pathshala Education constitute platform educational assets.
2. Platform Licensing: Where pre-existing materials are incorporated into Atomic Pathshala courses, the Educator grants an irrevocable, non-exclusive, royalty-free, worldwide license to host, display, stream, archive, and distribute such content to enrolled students.
3. Archival & Student Access: Live recordings and course modules delivered during the engagement shall remain accessible to enrolled students for the complete duration of their academic session, even after the Educator's disengagement.
4. Moral Rights: Atomic Pathshala shall ensure the Educator is duly credited as the author/instructor across published course materials.`,
    version: "1.0",
    applicableTo: ["ALL", "FULL_TIME", "PART_TIME", "VISITING_FACULTY", "CONTENT_CREATOR"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_D",
    title: "Policy D — Confidentiality & Non-Disclosure",
    description: "Protects proprietary business strategies, student contact records, compensation agreements, and academic test banks.",
    detailedRules: `1. Scope of Confidential Information: Encompasses all non-public technical, financial, and academic information, including but not limited to student databases, enrollment metrics, internal test banks, unreleased course curriculums, faculty compensation terms, and software source code.
2. Non-Disclosure Obligations: The Educator agrees never to disclose, reproduce, or disseminate confidential information to any third party, competing educational entity, or public forum without prior written authorization from the Founder & Proprietor.
3. Faculty Compensation Confidentiality: Remuneration packages, honorariums, and revenue-sharing percentages are strictly confidential between the Educator and Atomic Pathshala.
4. Survival: Confidentiality obligations survive the termination or expiration of this agreement indefinitely as permitted under applicable Indian law.`,
    version: "1.0",
    applicableTo: ["ALL"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_E",
    title: "Policy E — Student Data Protection & Privacy",
    description: "Prohibits unauthorized harvesting, sharing, personal marketing, or external transfer of student contact details.",
    detailedRules: `1. Prohibition on Data Harvesting: The Educator shall not download, scrape, screenshot, or compile personal student databases, phone numbers, email addresses, or parent contact details.
2. Zero Commercial Exploitation: Student details shall never be sold, leased, or utilized for personal marketing, private tuition solicitation, or promotional campaigns for competing coaching centers.
3. Incident Reporting: Any inadvertent exposure, security vulnerability, or data leakage must be immediately reported to the Platform Security team within 4 hours of discovery.
4. Legal Compliance: The Educator must comply with the Digital Personal Data Protection Act, 2023 (DPDP Act) and all prevailing Indian privacy regulations.`,
    version: "1.0",
    applicableTo: ["ALL"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_F",
    title: "Policy F — Platform Usage & Digital Security",
    description: "Rules governing LMS access, live classroom software, digital whiteboard, question bank, and credential security.",
    detailedRules: `1. Credential Security: Account credentials, passwords, and multi-factor authentication tokens issued for the Educator Portal and Live Classroom are strictly personal and non-transferable.
2. Unauthorized Access: The Educator shall not share login credentials with assistants, family members, or third parties.
3. Security Bypassing: Reverse engineering, unauthorized bot usage, automated web scraping, or attempting to bypass platform RBAC restrictions is strictly prohibited.
4. Safe Computing Environment: The Educator is responsible for maintaining an updated anti-malware environment on their primary teaching machine to prevent streaming disruptions or malware propagation.`,
    version: "1.0",
    applicableTo: ["ALL"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_G",
    title: "Policy G — Professional Conduct & Ethics",
    description: "Establishes standards for academic integrity, zero-harassment, respectful dialogue, and non-discrimination.",
    detailedRules: `1. Dignified Communication: The Educator must maintain a respectful, inspiring, and professional tone in all verbal, written, and chat interactions with students and academic staff.
2. Zero Tolerance for Harassment & Discrimination: Any form of discrimination based on religion, caste, gender, region, physical disability, or academic capability is strictly prohibited.
3. Academic Integrity: The Educator shall not endorse cheating, paper leaks, or unfair academic practices, and shall inspire ethical scientific rigor.
4. Modesty & Decorum: Appropriate corporate or modest academic attire must be maintained during all live-streaming and recorded video sessions.`,
    version: "1.0",
    applicableTo: ["ALL"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_H",
    title: "Policy H — Brand Representation & Social Media",
    description: "Rules for authorized logo usage, public statements, social media behavior, and official brand promotion.",
    detailedRules: `1. Official Brand Identity: The enterprise name is ATOMIC PATHSHALA EDUCATION and the brand name is Atomic Pathshala.
2. Authorized Logo Usage: The Atomic Pathshala logo, banners, and typography may only be used for approved course promotions and official academic presentations.
3. Social Media Etiquette: The Educator shall not make disparaging, defamatory, or misleading public statements regarding Atomic Pathshala, its students, or peer educators on YouTube, Instagram, Telegram, LinkedIn, or other public platforms.
4. Public Pricing & Discount Statements: The Educator shall not announce arbitrary fee discounts or promise admissions without formal management approval.`,
    version: "1.0",
    applicableTo: ["ALL"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_I",
    title: "Policy I — Student Communication & Boundaries",
    description: "Guidelines on official communication channels, student doubt support, and prohibition on unauthorized financial collections.",
    detailedRules: `1. Official Channels: All student academic interactions, doubt discussions, and assignment feedback must take place through authorized Atomic Pathshala channels (LMS, Live Chat, Platform Doubt Portal, official Telegram community).
2. Financial Transactions: The Educator shall NEVER solicit or accept direct payments, course fees, UPI transfers, or gifts from students or parents under any circumstances.
3. Professional Boundaries: Personal one-on-one relationships, informal offline gatherings without institutional knowledge, and invasive private messaging are strictly forbidden.`,
    version: "1.0",
    applicableTo: ["ALL"],
    acknowledgement: true,
  },
  {
    policyCode: "POLICY_J",
    title: "Policy J — Termination, Academic Handover & Exit",
    description: "Outlines notice period, student syllabus handover, return of platform assets, and final settlement procedures.",
    detailedRules: `1. Notice Period: As stipulated in the Educator Service Agreement (standard 30 to 60 days), either party may initiate disengagement by providing formal written notice.
2. Student Course Continuity: During the notice period, the Educator must diligently complete ongoing chapter commitments or provide structured handoff notes to the successor faculty to prevent student disruption.
3. Platform Access Revocation: Platform administrative rights, question bank upload permissions, and portal credentials will be deactivated on the official last working day.
4. Final Settlement: Full and final remuneration settlement, subject to applicable statutory deductions (TDS), will be processed upon satisfactory completion of academic handovers and verification of no outstanding assets.`,
    version: "1.0",
    applicableTo: ["ALL"],
    acknowledgement: true,
  },
];

/**
 * Seed or ensure all master policies exist in the database
 */
export async function ensureMasterPoliciesSeeded() {
  for (const pol of MASTER_POLICIES) {
    await prisma.organizationalPolicy.upsert({
      where: { policyCode: pol.policyCode },
      update: {
        title: pol.title,
        description: pol.description,
        detailedRules: pol.detailedRules,
      },
      create: {
        policyCode: pol.policyCode,
        title: pol.title,
        description: pol.description,
        detailedRules: pol.detailedRules,
        version: pol.version,
        applicableTo: pol.applicableTo,
        acknowledgement: pol.acknowledgement,
      },
    });
  }
}

/**
 * Retrieve all active organizational policies
 */
export async function getActiveOrganizationalPolicies() {
  await ensureMasterPoliciesSeeded().catch(() => {});
  return prisma.organizationalPolicy.findMany({
    orderBy: { policyCode: "asc" },
  });
}
