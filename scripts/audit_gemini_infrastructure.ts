import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// Load environment variables manually
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();

function maskKey(key: string) {
  if (!key || key.length < 8) return "****";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
];

async function main() {
  console.log("==================================================================");
  console.log("       ATOMIC PATHSHALA — GEMINI AI INFRASTRUCTURE AUDIT          ");
  console.log("==================================================================");

  const rawKeys = [env.GEMINI_API_KEYS, env.GEMINI_API_KEY, env.GEMINI_FREE_KEYS, env.GEMINI_PAID_KEYS]
    .filter(Boolean)
    .join(",")
    .split(/[\s,;]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 20 && !k.includes("your_gemini_api_key"));

  const uniqueKeys = Array.from(new Set(rawKeys));
  console.log(`Discovered ${uniqueKeys.length} unique Gemini API Key(s) in environment.`);

  const keyReports: any[] = [];

  for (let i = 0; i < uniqueKeys.length; i++) {
    const key = uniqueKeys[i]!;
    const masked = maskKey(key);
    console.log(`\n--- Testing Key #${i + 1}: ${masked} ---`);
    const genAI = new GoogleGenerativeAI(key);

    const modelResults: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    for (const modelName of CANDIDATE_MODELS) {
      const start = Date.now();
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: "Hello, reply with only the word OK" }] }],
        });
        const text = res.response.text();
        const latencyMs = Date.now() - start;
        modelResults[modelName] = { status: "SUCCESS", latencyMs, error: text.trim().slice(0, 30) };
        console.log(`  ✓ ${modelName.padEnd(24)} -> SUCCESS (${latencyMs}ms) [${text.trim().slice(0, 15)}]`);
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        const msg = String(err?.message || err);
        let status = "ERROR";
        if (msg.includes("404") || msg.includes("not found")) status = "404_NOT_FOUND";
        else if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) status = "429_QUOTA";
        else if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) status = "403_DENIED";
        else if (msg.includes("401") || msg.includes("UNAUTHENTICATED")) status = "401_INVALID";
        else if (msg.includes("503") || msg.includes("overloaded")) status = "503_OVERLOAD";

        modelResults[modelName] = { status, latencyMs, error: msg.slice(0, 150) };
        console.log(`  ✗ ${modelName.padEnd(24)} -> ${status} (${latencyMs}ms): ${msg.slice(0, 80)}`);
      }
    }

    keyReports.push({ index: i + 1, masked, keyLength: key.length, modelResults });
  }

  // Summary analysis
  console.log("\n==================================================================");
  console.log("                     AUDIT SUMMARY RESULTS                        ");
  console.log("==================================================================");
  for (const report of keyReports) {
    const successModels = Object.entries(report.modelResults)
      .filter(([_, r]: any) => r.status === "SUCCESS")
      .map(([m]) => m);
    const quotaModels = Object.entries(report.modelResults)
      .filter(([_, r]: any) => r.status === "429_QUOTA")
      .map(([m]) => m);
    const notFoundModels = Object.entries(report.modelResults)
      .filter(([_, r]: any) => r.status === "404_NOT_FOUND")
      .map(([m]) => m);

    console.log(`Key #${report.index} (${report.masked}):`);
    console.log(`  Working Models:    ${successModels.length ? successModels.join(", ") : "NONE"}`);
    console.log(`  Quota Exceeded:    ${quotaModels.length ? quotaModels.join(", ") : "None"}`);
    console.log(`  Not Found (404):   ${notFoundModels.length ? notFoundModels.join(", ") : "None"}`);
  }

  const outReportPath = path.join(process.cwd(), "gemini-audit-results.json");
  fs.writeFileSync(outReportPath, JSON.stringify(keyReports, null, 2));
  console.log(`\nDetailed report written to ${outReportPath}`);
}

main().catch(console.error);
