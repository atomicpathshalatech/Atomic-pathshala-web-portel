import { CourseData } from "./CourseCard";

// Plain data module (no "use client") so both server components (e.g. batch/checkout
// pages that call .find()/.filter() on this at request time) and client components
// (CourseListingMasterView) can import it directly. Keeping this array inside a
// "use client" file breaks server-side array method calls -- Next.js wraps every
// export of a client module in an opaque client reference, and invoking .find()
// on that reference from a Server Component throws "Attempted to call find() from
// the server but find is on the client."
export const SAMPLE_COURSES: CourseData[] = [
  {
    id: "c-yodha-chem-2027",
    slug: "yodha-chemistry-neet-2027",
    title: "YODHA Chemistry Batch for NEET 2027",
    subtitle: "Complete NCERT Class 11 & 12 Chemistry preparation with structured live + recorded classes.",
    exam: "NEET",
    examYear: "2027",
    subject: "Chemistry",
    courseType: "Full Syllabus",
    language: "Hinglish",
    educators: "By Sonu Bhaiya & Dr. Priya Sharma",
    duration: "12 Months",
    classesCount: 128,
    testsCount: 21,
    studentsCount: 805,
    price: 4700,
    originalPrice: 5500,
    discountPercentage: 15,
    isNewBatch: true,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD7YAZXVaHigh3RrfotJ1dphorsBl-gSAYvezYpMeV9rQSbQKvPk-AIGgvAUIs_j2OwoO9mv1RtVt-gCvSEP_621X3MnJUCxljXh4RIY-I6RaAwuw1s2rbJcbhRmE4zZjf-Kggrln5NK6LDAzGkCCjaRiQg-wlkb4AQglZ6CtSX0C6SOktuBjAPPjgF7jbnrTLR698i6gAjdpvYGjyIQzSwQYShpDlSqaTeKmUrHC3GKWAEUHK02G85AQ",
  },
  {
    id: "c-prahar-phy-2026",
    slug: "prahar-physics-jee-2026",
    title: "PRAHAR Physics Batch for JEE 2026",
    subtitle: "Advanced Mechanics, Electromagnetism, Optics & Modern Physics with JEE Advanced problem-solving.",
    exam: "JEE Mains",
    examYear: "2026",
    subject: "Physics",
    courseType: "Full Syllabus",
    language: "English",
    educators: "By Rajeev Sir",
    duration: "18 Months",
    classesCount: 150,
    testsCount: 30,
    studentsCount: 1240,
    price: 5200,
    originalPrice: 6000,
    discountPercentage: 13,
    isNewBatch: true,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC5ktTrIRpcdo4b2S3Rb-l69bUtwaKMLFyvDWFclrVX1_J6NTPOe4HC03SFr12Dd-yNYK5YnecJET1c5K2kU4Y3-sa1QbBJ5b0k2LO9li5qbqq87FcJHKrsZ0PySNYtVCNNMg_lHoS5pYpKnNW3xdjs8M-dO1DWGdwNEOWsoc4zTIRFcMSXQrwISZiZOtRZGnA5HxIEaIXsBBeCleS7Yc31vnDtIG2a80rCnn3OXtInJ0HoGkG2z-Jw0w",
  },
  {
    id: "c-victor-bio-2027",
    slug: "victor-biology-neet-2027",
    title: "VICTOR Complete Biology for NEET 2027",
    subtitle: "100% NCERT Line-by-Line Botany & Zoology with Diagram mastery and 360/360 target roadmap.",
    exam: "NEET",
    examYear: "2027",
    subject: "Biology",
    courseType: "Full Syllabus",
    language: "Hinglish",
    educators: "By Dr. Ananya Verma",
    duration: "12 Months",
    classesCount: 140,
    testsCount: 25,
    studentsCount: 950,
    price: 4500,
    originalPrice: 5500,
    discountPercentage: 18,
    isNewBatch: false,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA55rkd5wCltZobTytnsHzMyuy8waC1hw-J_L-zUTj5m0d0y1tJ19GdKzVawO1-j1UY4Ig2rH6TApo6BSKTsKzwZR9e25Gv9-dfkNm3vXfQRFMCGe8pSK6wq-hksTUzspyp3E0H22n8Ni8Kez8nEppOr_ahBNRCqwyZRdZTvMFzrlzd5cR_zERfcsvwnS0O24Q1ZWn5gkixq1MM_5B4OraSGu7fdEvScZz8rc6jps0X0suSHy_TR9jVuw",
  },
  {
    id: "c-sankalp-math-2027",
    slug: "sankalp-mathematics-jee-2027",
    title: "SANKALP Mathematics for JEE 2027",
    subtitle: "Complete Algebra, Calculus, Coordinate Geometry & Vectors with shortcut tricks.",
    exam: "JEE Mains",
    examYear: "2027",
    subject: "Mathematics",
    courseType: "Full Syllabus",
    language: "Hinglish",
    educators: "By Amit Sir",
    duration: "12 Months",
    classesCount: 135,
    testsCount: 24,
    studentsCount: 680,
    price: 4800,
    originalPrice: 5800,
    discountPercentage: 17,
    isNewBatch: true,
    thumbnailUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuASsGXjxZqFMcdUTyW5GdJI6W5tJItNmN_IF4AhjwHvjK9V05a2ge4zc_mW93P5kbIcmx3kLLS28KT-lUTUMFnGmzs8gdQ8CPVjtXxUxiACaVR_--I7NloIj2j-aQMG3hY-WulS4IFD0LvaLOlCGexgOLSooKFB9a3gNrUjKPxDBCUuq4qA7CoOeQgcMn_1ivGeCWZ0hoe6LMMye8FIAJZgXwBtle5AEwPAcRd_5BZIwbySN1azeRsOHA",
  },
];
