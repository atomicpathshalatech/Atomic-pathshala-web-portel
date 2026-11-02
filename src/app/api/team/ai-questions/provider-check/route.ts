import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_TEXT_MODELS } from "@/lib/ai/gemini-models";

function cleanKey(raw?: string): string | null {
  if (!raw) return null;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : null;
}

function maskKey(key: string | null): string {
  if (!key) return "NOT CONFIGURED (undefined)";
  if (key.length <= 8) return `${key.slice(0, 3)}*** (${key.length} chars)`;
  return `${key.slice(0, 7)}...${key.slice(-4)} (${key.length} chars)`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawOpenAi = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
    const rawGroq = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
    const rawGemini = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS;

    const openAiKey = cleanKey(rawOpenAi);
    const groqKey = cleanKey(rawGroq);
    const geminiKey = cleanKey(rawGemini?.split(",")[0]);

    const results = {
      environment: {
        nodeEnv: process.env.NODE_ENV || "unknown",
        vercelEnv: process.env.VERCEL_ENV || "local / unmanaged",
        vercelUrl: process.env.VERCEL_URL || null,
      },
      gemini: {
        configured: Boolean(geminiKey),
        masked: maskKey(geminiKey),
        status: "PENDING",
        error: null as string | null,
      },
      openai: {
        configured: Boolean(openAiKey),
        masked: maskKey(openAiKey),
        status: "PENDING",
        error: null as string | null,
      },
      groq: {
        configured: Boolean(groqKey),
        masked: maskKey(groqKey),
        status: "PENDING",
        error: null as string | null,
      },
    };

    // Test Gemini with automatic candidate fallback
    if (geminiKey) {
      // The models the app really uses (the 1.5 / 2.0 ones are retired — their
      // "quota 0" error used to be the only one shown, hiding the real cause).
      const geminiCandidateModels = Array.from(new Set([process.env.GEMINI_MODEL, ...GEMINI_TEXT_MODELS].filter(Boolean) as string[]));

      let geminiSuccess = false;
      const geminiErrs: string[] = [];
      const short = (e: any) => {
        const m = String(e?.message || e);
        if (m.includes("503") || /high demand/i.test(m)) return "busy (503 high demand)";
        if (m.includes("429")) return "per-minute quota used up (429)";
        if (m.includes("404")) return "not available for this key (404)";
        return m.replace(/^[GoogleGenerativeAI Error]:s*/, "").slice(0, 160);
      };

      const genAi = new GoogleGenerativeAI(geminiKey);
      for (const m of geminiCandidateModels) {
        try {
          const model = genAi.getGenerativeModel({ model: m }, { timeout: 12_000 });
          await model.generateContent("Respond with 'OK'");
          results.gemini.status = "CONNECTED";
          (results.gemini as any).activeModel = m;
          geminiSuccess = true;
          break;
        } catch (e: any) {
          geminiErrs.push(`${m}: ${short(e)}`);
        }
      }

      if (!geminiSuccess) {
        results.gemini.status = "ERROR";
        results.gemini.error = `${geminiErrs.join(" · ")} — question writing uses OpenAI / Groq meanwhile.`;
      }
    } else {
      results.gemini.status = "MISSING_KEY";
      results.gemini.error = "GEMINI_API_KEY is not defined in this environment";
    }

    // Test OpenAI
    if (openAiKey) {
      try {
        const client = new OpenAI({ apiKey: openAiKey });
        await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 3,
        });
        results.openai.status = "CONNECTED";
      } catch (e: any) {
        results.openai.status = "ERROR";
        results.openai.error = e?.message || String(e);
      }
    } else {
      results.openai.status = "MISSING_KEY";
      results.openai.error = "OPENAI_API_KEY is not defined in this environment";
    }

    // Test Groq with automatic candidate fallback
    if (groqKey) {
      const groqCandidateModels = [
        process.env.GROQ_MODEL,
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
      ].filter(Boolean) as string[];

      let groqSuccess = false;
      let lastGroqErr = "";

      const client = new OpenAI({
        apiKey: groqKey,
        baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      });

      for (const m of groqCandidateModels) {
        try {
          await client.chat.completions.create({
            model: m,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 3,
          });
          results.groq.status = "CONNECTED";
          (results.groq as any).activeModel = m;
          groqSuccess = true;
          break;
        } catch (e: any) {
          lastGroqErr = e?.message || String(e);
        }
      }

      if (!groqSuccess) {
        results.groq.status = "ERROR";
        results.groq.error = lastGroqErr;
      }
    } else {
      results.groq.status = "MISSING_KEY";
      results.groq.error = "GROQ_API_KEY is not defined in this environment";
    }

    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
