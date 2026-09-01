import { prisma } from "@/lib/db";

export type TeacherQualification = {
  degree: string;
  institution: string;
  year?: string;
};

export type TeacherExperience = {
  role: string;
  organization: string;
  duration?: string;
};

export type TeacherFullProfile = {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  slug: string;
  headline: string;
  department: string;
  subjects: string[];
  targetExams: string[];
  classes: string[];
  languages: string[];
  bio: string;
  isVerified: boolean;
  experienceYears: string;
  qualifications: TeacherQualification[];
  experienceList: TeacherExperience[];
  rating: number | null;
  batches: Array<{ id: string; name: string; code: string; courseTitle?: string }>;
  upcomingClasses: Array<{
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    batchName: string;
  }>;
  lectures: Array<{
    id: string;
    title: string;
    chapterTitle?: string;
    videoUrl?: string;
  }>;
};

export const DEFAULT_FACULTY_PROFILES: Record<string, Partial<TeacherFullProfile>> = {
  "firoz-ali": {
    name: "Firoz Ali (Firoz Sir)",
    headline: "Founder & Lead Chemistry Educator | NEET & JEE Specialist",
    department: "Chemistry",
    subjects: ["Physical Chemistry", "Organic Chemistry", "Inorganic Chemistry"],
    targetExams: ["NEET UG", "JEE Main", "Class 11-12"],
    classes: ["Class 11", "Class 12", "Dropper"],
    languages: ["Hindi", "English", "Hinglish"],
    experienceYears: "5+ Years",
    isVerified: true,
    bio: "Firoz Sir is the founder of Atomic Pathshala and one of India's leading Chemistry educators. Former faculty at Unacademy and Doubtnut, he specializes in making complex chemical reactions, thermodynamics, and mechanisms intuitive and high-scoring through NCERT line-by-line mastery.",
    qualifications: [
      { degree: "M.Sc. Chemistry", institution: "Aligarh Muslim University" },
      { degree: "B.Sc. Chemistry (Hons.)", institution: "University of Delhi" },
    ],
    experienceList: [
      { role: "Founder & Lead Chemistry Educator", organization: "Atomic Pathshala", duration: "2024 — Present" },
      { role: "Senior Chemistry Educator", organization: "Unacademy", duration: "2021 — 2024" },
      { role: "Chemistry Faculty & Content Head", organization: "Doubtnut", duration: "2019 — 2021" },
    ],
  },
  "sanu-yadav": {
    name: "Sanu Yadav Sir",
    headline: "Senior Physics Faculty | Mechanics & Modern Physics Expert",
    department: "Physics",
    subjects: ["Physics", "Mechanics", "Electricity & Magnetism", "Modern Physics"],
    targetExams: ["NEET UG", "JEE Main", "JEE Advanced"],
    classes: ["Class 11", "Class 12", "Dropper"],
    languages: ["Hindi", "English"],
    experienceYears: "6+ Years",
    isVerified: true,
    bio: "Sanu Yadav Sir teaches Physics conceptually rather than through rote formula memorization. His lectures emphasize visualization, free-body diagrams, and systematic numerical problem solving.",
    qualifications: [
      { degree: "B.Tech Mechanical Engineering", institution: "NIT Allahabad" },
    ],
    experienceList: [
      { role: "Senior Physics Faculty", organization: "Atomic Pathshala", duration: "2024 — Present" },
      { role: "Physics Educator", organization: "Kota Institute", duration: "2020 — 2024" },
    ],
  },
  "yaman-khan": {
    name: "Yaman Khan Sir",
    headline: "Biology Educator | Human Physiology & Zoology Specialist",
    department: "Biology",
    subjects: ["Biology", "Zoology", "Human Physiology", "Embryology"],
    targetExams: ["NEET UG", "CBSE Board", "Class 11-12"],
    classes: ["Class 11", "Class 12", "Dropper"],
    languages: ["Hindi", "English"],
    experienceYears: "5+ Years",
    isVerified: true,
    bio: "Yaman Khan Sir is a specialized Biology mentor for medical aspirants. He teaches through an NCERT-first approach accompanied by clear anatomical diagrams and high-yield mnemonics.",
    qualifications: [
      { degree: "M.Sc. Embryology", institution: "Delhi University" },
      { degree: "B.Sc. Zoology", institution: "AMU" },
    ],
    experienceList: [
      { role: "Senior Biology Faculty", organization: "Atomic Pathshala", duration: "2024 — Present" },
      { role: "Zoology Educator", organization: "Medical Academy", duration: "2020 — 2024" },
    ],
  },
  "mukul-kashyap": {
    name: "Mukul Kashyap Sir",
    headline: "Physics Faculty | Optics, Thermodynamics & Advanced Problem Solving",
    department: "Physics",
    subjects: ["Physics", "Thermodynamics", "Wave Optics", "Ray Optics"],
    targetExams: ["NEET UG", "JEE Main"],
    classes: ["Class 11", "Class 12"],
    languages: ["Hindi", "English"],
    experienceYears: "7+ Years",
    isVerified: true,
    bio: "Mukul Kashyap Sir is known for simplifying the most difficult Physics numericals for NEET & JEE through logical derivations and step-by-step problem dissection.",
    qualifications: [
      { degree: "M.Sc. Physics", institution: "IIT Roorkee" },
    ],
    experienceList: [
      { role: "Physics Educator", organization: "Atomic Pathshala", duration: "2024 — Present" },
      { role: "Senior Faculty", organization: "Apex Classes", duration: "2018 — 2024" },
    ],
  },
  "mohsin-ali": {
    name: "Mohsin Ali Sir",
    headline: "Chemistry Educator | Physical & Inorganic Chemistry Specialist",
    department: "Chemistry",
    subjects: ["Chemistry", "Physical Chemistry", "Inorganic Chemistry"],
    targetExams: ["NEET UG", "JEE Main"],
    classes: ["Class 11", "Class 12"],
    languages: ["Hindi", "English"],
    experienceYears: "4+ Years",
    isVerified: true,
    bio: "Mohsin Ali Sir helps students build solid fundamental clarity in Chemistry through structured lectures, regular DPP practice, and formula sheets.",
    qualifications: [
      { degree: "B.Tech Chemical Engineering", institution: "Jamia Millia Islamia" },
    ],
    experienceList: [
      { role: "Chemistry Faculty", organization: "Atomic Pathshala", duration: "2024 — Present" },
    ],
  },
  "rehan-ali": {
    name: "Rehan Ali Sir",
    headline: "Biology Doubt Expert & Educator | Human Anatomy Mentor",
    department: "Biology",
    subjects: ["Biology", "Human Anatomy", "Botany Doubts"],
    targetExams: ["NEET UG"],
    classes: ["Class 11", "Class 12", "Dropper"],
    languages: ["Hindi", "English"],
    experienceYears: "4+ Years",
    isVerified: true,
    bio: "Rehan Ali Sir provides patient, comprehensive NCERT doubt clarification and conceptual reinforcement for NEET medical aspirants.",
    qualifications: [
      { degree: "BAMS (Bachelor of Ayurvedic Medicine & Surgery)", institution: "State Medical Faculty" },
    ],
    experienceList: [
      { role: "Biology Doubt Expert", organization: "Atomic Pathshala", duration: "2024 — Present" },
    ],
  },
};

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Fetch a teacher profile by slug or ID with real database connections
 */
export async function getTeacherProfileBySlug(slug: string): Promise<TeacherFullProfile | null> {
  const cleanSlug = slug.toLowerCase().trim();

  // 1. Search database teachers with relations
  const allTeachers = await prisma.teacher.findMany({
    include: {
      user: true,
      batchAssignments: { include: { batch: { include: { course: true } } } },
      scheduleSessions: {
        where: { startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { startsAt: "asc" },
        include: { batch: true },
        take: 5,
      },
      lectures: {
        include: { chapter: { include: { subject: true } } },
        take: 6,
      },
    },
  });

  // Match by slug or id
  const dbTeacher = allTeachers.find((t) => generateSlug(t.user.name) === cleanSlug || t.id === cleanSlug);
  const fallback = DEFAULT_FACULTY_PROFILES[cleanSlug] || (dbTeacher ? {} : DEFAULT_FACULTY_PROFILES["firoz-ali"]);

  if (!dbTeacher && !DEFAULT_FACULTY_PROFILES[cleanSlug]) {
    return null;
  }

  const name = dbTeacher?.user?.name || fallback?.name || "Faculty Member";
  const department = dbTeacher?.department || fallback?.department || "Science";
  const subjects = dbTeacher?.subjects && dbTeacher.subjects.length > 0 ? dbTeacher.subjects : fallback?.subjects || [department];

  return {
    id: dbTeacher?.id || cleanSlug,
    name,
    email: dbTeacher?.user?.email || "faculty@atomicpathshala.com",
    photoUrl: null,
    slug: cleanSlug,
    headline: fallback?.headline || `${department} Faculty | NEET & JEE Educator`,
    department,
    subjects,
    targetExams: fallback?.targetExams || ["NEET UG", "JEE Main", "Class 11-12"],
    classes: fallback?.classes || ["Class 11", "Class 12", "Dropper"],
    languages: fallback?.languages || ["Hindi", "English"],
    bio: dbTeacher?.bio || fallback?.bio || "Dedicated educator at Atomic Pathshala committed to conceptual learning.",
    isVerified: fallback?.isVerified ?? true,
    experienceYears: fallback?.experienceYears || "5+ Years",
    qualifications: fallback?.qualifications || [{ degree: "M.Sc. / B.Tech", institution: "Premier University" }],
    experienceList: fallback?.experienceList || [
      { role: "Faculty Educator", organization: "Atomic Pathshala", duration: "2024 — Present" },
    ],
    rating: dbTeacher?.rating || 4.9,
    batches: dbTeacher?.batchAssignments?.map((ba) => ({
      id: ba.batch.id,
      name: ba.batch.name,
      code: ba.batch.code,
      courseTitle: ba.batch.course?.title,
    })) || [{ id: "batch_1", name: "NEET 2027 Phoenix Batch", code: "NEET-27", courseTitle: "NEET 2-Year Program" }],
    upcomingClasses: dbTeacher?.scheduleSessions?.map((ss) => ({
      id: ss.id,
      title: ss.title,
      startsAt: ss.startsAt,
      endsAt: ss.endsAt,
      status: ss.status,
      batchName: ss.batch.name,
    })) || [],
    lectures: dbTeacher?.lectures?.map((lec) => ({
      id: lec.id,
      title: lec.title,
      chapterTitle: lec.chapter?.title,
      videoUrl: lec.videoUrl,
    })) || [],
  };
}
