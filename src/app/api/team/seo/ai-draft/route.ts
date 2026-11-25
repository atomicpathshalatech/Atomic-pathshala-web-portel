import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { topic, primaryKeyword, contentType, targetExam, targetSubject, targetClass, language } = body;

    if (!topic || !primaryKeyword) {
      return NextResponse.json({ error: "Topic and primary keyword are required" }, { status: 400 });
    }

    // Pull real database entities to ground AI draft
    const [courses, teachers] = await Promise.all([
      prisma.course.findMany({ select: { title: true, slug: true } }),
      prisma.teacher.findMany({
        where: { onboardingStatus: { not: "REJECTED" } },
        include: { user: { select: { name: true } }, seoProfile: true },
        take: 5,
      }),
    ]);

    const facultyNames = teachers.map((t) => t.user.name).join(", ");
    const courseTitles = courses.map((c) => c.title).join(", ");

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
You are an expert Educational SEO Strategist and Senior Content Architect for "Atomic Pathshala" (https://ap.atomicpathshala.in).
Atomic Pathshala is an premier platform for NEET UG, IIT-JEE, and Class 10-12 Board preparation.
Key faculty includes Founder & Senior Chemistry Educator Firoz Ali (M.Sc Chemistry, MJPRU Bareilly), along with expert teachers in Physics and Biology.
Real Courses: ${courseTitles}
Real Teachers: ${facultyNames}

Generate a comprehensive educational content package in JSON format for:
Topic: "${topic}"
Primary Keyword: "${primaryKeyword}"
Content Type: "${contentType || "BLOG"}"
Target Exam: "${targetExam || "NEET"}"
Target Subject: "${targetSubject || "Chemistry"}"
Target Class: "${targetClass || "11-12"}"
Language: "${language || "en"}"

CRITICAL RULES:
1. Ground all claims in real educational concepts. Absolutely ZERO fake testimonials, fake awards, fake rankings, or fabricated credentials.
2. Structure the content with clear Markdown headings (##, ###), bullet points, key takeaways, and practical student study tips.
3. Include 3-4 realistic, high-value FAQs with concise answers.
4. Suggest internal links to Atomic Pathshala pages (e.g. /chemistry, /neet, /jee, /teachers/firoz-ali, /pyq).

Return ONLY valid JSON with keys:
{
  "title": "Optimized article headline (50-65 chars)",
  "metaTitle": "SEO title for search engines",
  "metaDescription": "SEO meta description (130-155 chars)",
  "searchIntent": "INFORMATIONAL" | "COMMERCIAL" | "NAVIGATIONAL",
  "summary": "2-3 sentence overview of the article",
  "content": "Full markdown text of the article with headings and practical insights",
  "secondaryKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "faqs": [
    { "q": "Question text?", "a": "Direct helpful answer." }
  ],
  "suggestedInternalLinks": ["/neet", "/chemistry", "/teachers/firoz-ali", "/pyq/neet"]
}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ success: true, draft: parsed });
        }
      } catch (geminiErr) {
        console.warn("Gemini generation fallback to local engine:", geminiErr);
      }
    }

    // Fallback Educational Content Generation Engine when API Key is pending or in offline test mode
    const fallbackDraft = {
      title: `${topic}: Complete ${targetExam || "NEET"} Preparation Strategy & Concepts`,
      metaTitle: `${primaryKeyword} — Master ${targetSubject || "Chemistry"} | Atomic Pathshala`,
      metaDescription: `Comprehensive guide to ${topic} for ${targetExam || "NEET"} & Boards. Master core concepts, high-yield formulas, and previous year question strategies with Atomic Pathshala.`,
      searchIntent: "INFORMATIONAL",
      summary: `A thorough, concept-first guide breaking down ${topic} for ${targetExam || "NEET"} aspirants, featuring high-yield problem solving methods and NCERT alignments.`,
      content: `## Introduction to ${topic}

Preparing for **${targetExam || "NEET UG"}** requires a balance of deep conceptual understanding and rigorous question practice. In this guide, our academic faculty breaks down **${topic}**, focusing on the core principles that frequently appear in competitive examinations.

---

### Core Concepts & High-Yield Principles

When studying **${primaryKeyword}**, keep the following key pillars in mind:

1. **First-Principles Understanding:** Do not rely on rote memorization. Understand why each reaction mechanism or physical derivation unfolds the way it does.
2. **NCERT Textual Alignment:** For both NEET and Board exams, questions are drafted directly from the textbook lines, diagrams, and summary tables.
3. **Speed & Accuracy in Numerical Calculations:** Practice solving multi-step questions within the 60-to-90-second exam threshold.

---

### Step-by-Step Problem Solving Approach

To maximize retention and performance on ${topic}:
- **Step 1:** Review fundamental definitions and standard units.
- **Step 2:** Solve chapter-wise verified PYQs from past papers (2015–2024).
- **Step 3:** Highlight high-frequency error points in your personalized formula book.

---

### Mentorship from Senior Faculty

At Atomic Pathshala, our educators—including Senior Chemistry Faculty **Firoz Ali** and the subject team—regularly conduct interactive live problem-solving classes and provide verified step-by-step solutions to ensure no doubts remain unanswered.
`,
      secondaryKeywords: [
        `${primaryKeyword} notes`,
        `${primaryKeyword} PYQ`,
        `${targetExam || "NEET"} ${targetSubject || "Chemistry"} tips`,
        `${topic} formula sheet`,
      ],
      faqs: [
        {
          q: `What is the best way to revise ${topic} for ${targetExam || "NEET"}?`,
          a: `Review NCERT notes line-by-line, summarize key formulas on a single sheet, and solve at least 20–30 previous year questions under timed conditions.`,
        },
        {
          q: `Who can I consult for doubt clearance on ${topic}?`,
          a: `Atomic Pathshala enrolled students can book 1-on-1 doubt sessions and attend live class Q&A with our verified faculty.`,
        },
      ],
      suggestedInternalLinks: ["/neet", "/chemistry", "/teachers/firoz-ali", "/pyq/neet"],
    };

    return NextResponse.json({ success: true, draft: fallbackDraft });
  } catch (error: any) {
    console.error("POST /api/team/seo/ai-draft error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate draft" }, { status: 500 });
  }
}
