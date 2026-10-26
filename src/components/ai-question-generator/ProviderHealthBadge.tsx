"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, X, ShieldCheck } from "lucide-react";

export function ProviderHealthBadge() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/ai-questions/provider-check");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (e) {
      console.error("Provider health check failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const geminiOk = data?.gemini?.status === "CONNECTED";
  const openAiOk = data?.openai?.status === "CONNECTED";
  const groqOk = data?.groq?.status === "CONNECTED";

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white transition backdrop-blur-md"
        title="Check live connectivity status of Gemini, OpenAI, and Groq"
      >
        <span className="font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>AI Health:</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] font-mono">
          <span className={geminiOk ? "text-emerald-400" : "text-amber-400"}>Gemini {geminiOk ? "✓" : "!"}</span>
          <span className="text-white/40">·</span>
          <span className={openAiOk ? "text-emerald-400" : "text-amber-400"}>OpenAI {openAiOk ? "✓" : "!"}</span>
          <span className="text-white/40">·</span>
          <span className={groqOk ? "text-emerald-400" : "text-amber-400"}>Groq {groqOk ? "✓" : "!"}</span>
        </span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">AI Providers Live Connection Status</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Gemini */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>1. Google Gemini (Generation + L1)</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      geminiOk ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {data?.gemini?.status || "CHECKING"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Key: {data?.gemini?.masked || "..."}
                </p>
                {data?.gemini?.error && (
                  <p className="text-[11px] text-rose-600 font-mono">{data.gemini.error}</p>
                )}
              </div>

              {/* OpenAI */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>2. OpenAI GPT-4o (L2 Blind Solve)</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      openAiOk ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {data?.openai?.status || "CHECKING"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Key: {data?.openai?.masked || "..."}
                </p>
                {data?.openai?.error && (
                  <p className="text-[11px] text-rose-600 font-mono">{data.openai.error}</p>
                )}
              </div>

              {/* Groq */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>3. Groq Llama-3.3 (L3 Fast Audit)</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      groqOk ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {data?.groq?.status || "CHECKING"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Key: {data?.groq?.masked || "..."}
                </p>
                {data?.groq?.error && (
                  <p className="text-[11px] text-rose-600 font-mono">{data.groq.error}</p>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Env: {data?.environment?.vercelEnv || "local"}
              </span>
              <button
                type="button"
                onClick={checkHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>{loading ? "Testing..." : "Test Keys Live"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
