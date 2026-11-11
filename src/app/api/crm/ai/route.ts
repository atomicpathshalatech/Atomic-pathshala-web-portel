import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getLeadById } from "@/lib/crm/crm-service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const aiRequestSchema = z.object({
  leadId: z.string().min(1),
  action: z.enum(["summarize", "suggest_reply", "predict_conversion", "counselling_prep"]),
  notes: z.string().optional(),
});

function getGeminiClient(): GoogleGenerativeAI | null {
  const raw = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS;
  if (!raw) return null;
  const key = raw.split(",")[0].trim();
  return key ? new GoogleGenerativeAI(key) : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const body = await req.json();
    const { leadId, action, notes } = aiRequestSchema.parse(body);

    const lead = await getLeadById(leadId);
    if (!lead) throw new Error("Lead not found");

    const genAI = getGeminiClient();

    // Default heuristic fallbacks if AI provider is unavailable
    if (!genAI) {
      return apiSuccess({
        action,
        insight: getHeuristicInsight(action, lead),
        conversionProbability: Math.min(95, Math.max(15, lead.score + 5)),
        source: "rule_engine",
      });
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
You are an expert EdTech Admissions & CRM Specialist for "Atomic Pathshala" (NEET & JEE Coaching Institute).
Context of Lead:
- Name: ${lead.name}
- Class: ${lead.studentClass || "Unknown"}
- Target Exam: ${lead.targetExam || "NEET"}
- Target Year: ${lead.targetYear || "2026"}
- Preferred Medium: ${lead.medium || "Hindi/English"}
- City/State: ${lead.city || ""}, ${lead.state || ""}
- Status: ${lead.status}
- Priority: ${lead.priority} (Score: ${lead.score}/100)
- Recent Activities: ${lead.activities.map((a) => a.title).slice(0, 5).join(", ")}
- Recent Call Notes: ${lead.callRecords.map((c) => c.notes).filter(Boolean).slice(0, 3).join("; ")}
${notes ? `- Additional Counsellor Query: ${notes}` : ""}

Task: Perform ${action}.
Rules:
- Be concise, professional, and actionable for an EdTech counsellor.
- If suggest_reply: Provide a friendly WhatsApp message template in Hindi/Hinglish and English suitable for this student.
- If predict_conversion: Provide estimated conversion % and top 2 conversion drivers.
- If summarize: Give 3 bullet points summarizing intent, friction points, and recommended next action.
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return apiSuccess({
        action,
        insight: text,
        conversionProbability: Math.min(95, Math.max(15, lead.score + 5)),
        source: "gemini_1.5_flash",
      });
    } catch (aiError) {
      console.warn("[CRM_AI_FALLBACK_TRIGGERED]", aiError);
      return apiSuccess({
        action,
        insight: getHeuristicInsight(action, lead),
        conversionProbability: Math.min(95, Math.max(15, lead.score + 5)),
        source: "rule_engine_fallback",
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function getHeuristicInsight(action: string, lead: any): string {
  if (action === "suggest_reply") {
    return `Namaste ${lead.name}! 🌟 Atomic Pathshala mein aapka swagat hai. NEET ${lead.targetYear || 2026} ke liye hamare Selection Pro Batch mein top faculty ke saath structured lectures, daily DPPs aur test series shuru ho chuke hain. Kya aap free demo class schedule karna chahenge? Humse judne ke liye reply karein.`;
  }
  if (action === "predict_conversion") {
    return `Conversion Likelihood: ${lead.score}%. High intent student targeting ${lead.targetExam || "NEET"}. Best next step is booking a 15-minute 1-on-1 academic counselling call with parent.`;
  }
  return `• High Intent Aspirant: ${lead.name} is preparing for ${lead.targetExam || "NEET"} (${lead.studentClass || "Class 12"}).\n• Engagement: Current priority is ${lead.priority} with score ${lead.score}/100.\n• Recommended Action: Schedule counselling or send demo lecture link via WhatsApp.`;
}
