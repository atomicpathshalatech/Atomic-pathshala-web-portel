"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Copy,
  Save,
  Download,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { SeoChapterItem, SeoShortsItem, SeoTitleOption } from "@/lib/ai-studio/seo/engine";

interface SeoPackageRow {
  id: string;
  language: string;
  videoType: string;
  channel: string;
  titles: SeoTitleOption[] | null;
  description: string | null;
  tags: string[];
  hashtags: string[];
  chapters: SeoChapterItem[] | null;
  pinnedComment: string | null;
  communityPost: string | null;
  instagramCaption: string | null;
  reelCaption: string | null;
  whatsappMessage: string | null;
  shortsPack: SeoShortsItem[] | null;
  providerUsed: string | null;
  modelUsed: string | null;
}

export function SeoStudioTab({
  projectId,
  defaultTopic,
  defaultSubject,
  defaultChapter,
  activeScriptText,
}: {
  projectId: string;
  defaultTopic?: string | null;
  defaultSubject?: string | null;
  defaultChapter?: string | null;
  activeScriptText?: string;
}) {
  const [packages, setPackages] = useState<SeoPackageRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [topic, setTopic] = useState(defaultTopic || "");
  const [language, setLanguage] = useState("hinglish");
  const [videoType, setVideoType] = useState("YOUTUBE_VIDEO");
  const [channel, setChannel] = useState("MAIN");

  // Editable fields
  const [titles, setTitles] = useState<SeoTitleOption[]>([]);
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [chapters, setChapters] = useState<SeoChapterItem[]>([]);
  const [pinnedComment, setPinnedComment] = useState("");
  const [communityPost, setCommunityPost] = useState("");
  const [instagramCaption, setInstagramCaption] = useState("");
  const [reelCaption, setReelCaption] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [shortsPack, setShortsPack] = useState<SeoShortsItem[]>([]);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const hydrate = (pkg: SeoPackageRow) => {
    setActiveId(pkg.id);
    setTitles(Array.isArray(pkg.titles) ? pkg.titles : []);
    setDescription(pkg.description || "");
    setTagsText((pkg.tags || []).join(", "));
    setHashtagsText((pkg.hashtags || []).join(" "));
    setChapters(Array.isArray(pkg.chapters) ? pkg.chapters : []);
    setPinnedComment(pkg.pinnedComment || "");
    setCommunityPost(pkg.communityPost || "");
    setInstagramCaption(pkg.instagramCaption || "");
    setReelCaption(pkg.reelCaption || "");
    setWhatsappMessage(pkg.whatsappMessage || "");
    setShortsPack(Array.isArray(pkg.shortsPack) ? pkg.shortsPack : []);
  };

  const loadPackages = async () => {
    const res = await fetch(`/api/team/content-studio/projects/${projectId}/seo`);
    const json = await res.json();
    if (json.success) {
      const list: SeoPackageRow[] = json.data.packages || [];
      setPackages(list);
      if (list[0]) hydrate(list[0]);
    }
  };

  useEffect(() => {
    loadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setBusy("generate");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          subject: defaultSubject || undefined,
          chapter: defaultChapter || undefined,
          language,
          videoType,
          channel,
          scriptText: activeScriptText || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "SEO generation failed");
      setMsg("Generated complete YouTube SEO & Social Package.");
      await loadPackages();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "SEO generation failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!activeId) return;
    setBusy("save");
    setErr(null);
    setMsg(null);
    try {
      const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
      const hashtags = hashtagsText.split(/\s+/).map((h) => h.trim()).filter(Boolean);
      const res = await fetch(`/api/team/content-studio/projects/${projectId}/seo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seoPackageId: activeId,
          titles,
          description,
          tags,
          hashtags,
          chapters,
          pinnedComment,
          communityPost,
          instagramCaption,
          reelCaption,
          whatsappMessage,
          shortsPack,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMsg("Saved SEO package edits.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setMsg(`Copied ${label} to clipboard.`);
  };

  const handleExportJson = () => {
    const payload = {
      titles,
      description,
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      hashtags: hashtagsText.split(/\s+/).filter(Boolean),
      chapters,
      pinnedComment,
      communityPost,
      instagramCaption,
      reelCaption,
      whatsappMessage,
      shortsPack,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seo-package-${projectId}.json`;
    a.click();
  };

  const tagsCharCount = tagsText.length;

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* One-Click Generator */}
      <form onSubmit={handleGenerate} className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-on-surface">YouTube SEO & Packaging Generator</h2>
          <span className="text-xs text-on-surface-variant">Using Atomic Pathshala Brand Profile</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input type="text" required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Video topic..." className="sm:col-span-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs" />
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            <option value="hinglish">Hinglish</option>
            <option value="hindi">Hindi</option>
            <option value="english">English</option>
          </select>
          <select value={videoType} onChange={(e) => setVideoType(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            <option value="YOUTUBE_VIDEO">Long Video</option>
            <option value="ONE_SHOT">One Shot</option>
            <option value="PYQ">PYQ Discussion</option>
            <option value="YOUTUBE_SHORT">Shorts</option>
            <option value="LIVE_CLASS">Live Class</option>
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-2 py-2 text-xs">
            <option value="MAIN">Main Channel</option>
            <option value="APP">App Channel</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary">
            <Sparkles className="h-3.5 w-3.5" /> {busy === "generate" ? "Generating Package..." : "Generate Complete SEO Package"}
          </button>
          {activeId && (
            <>
              <button type="button" onClick={handleSave} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3.5 py-2 text-xs font-semibold text-on-secondary">
                <Save className="h-3.5 w-3.5" /> Save Edits
              </button>
              <button type="button" onClick={handleExportJson} className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3.5 py-2 text-xs font-semibold">
                <Download className="h-3.5 w-3.5" /> Export JSON
              </button>
            </>
          )}
        </div>
      </form>

      {packages.length > 0 && (
        <div className="space-y-6">
          {/* Title Comparison Table */}
          <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface">Title Options & Comparison</h3>
              <span className="text-[11px] text-on-surface-variant">
                Scores are AI estimates (not official YouTube metrics)
              </span>
            </div>
            <div className="space-y-2">
              {titles.map((t, idx) => (
                <div key={idx} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary-fixed px-1.5 py-0.5 text-[10px] font-semibold text-on-primary-fixed">{t.type}</span>
                    <input
                      type="text"
                      value={t.title}
                      onChange={(e) => setTitles((prev) => prev.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))}
                      className="flex-1 font-semibold text-on-surface bg-transparent border-b border-outline-variant/40 focus:border-primary focus:outline-none"
                    />
                    <button onClick={() => copyText(t.title, "title")} className="text-primary hover:underline inline-flex items-center gap-1">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
                    <span>Clarity: {t.clarity}/10</span>
                    <span>Search: {t.searchRelevance}/10</span>
                    <span>Audience: {t.audienceRelevance}/10</span>
                    <span>Curiosity: {t.curiosity}/10</span>
                    <span>Misleading Risk: {t.misleadingRisk}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">{t.reasoning}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Description, Tags, Hashtags */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2 text-xs">
              <div className="flex justify-between font-bold">
                <span>YouTube Description</span>
                <button onClick={() => copyText(description, "description")} className="text-primary inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</button>
              </div>
              <textarea rows={10} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-2.5 text-xs" />
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span>Tags ({tagsCharCount}/500 chars)</span>
                  <button onClick={() => copyText(tagsText, "tags")} className="text-primary inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</button>
                </div>
                <textarea rows={3} value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={`w-full rounded-lg border p-2 text-xs ${tagsCharCount > 500 ? "border-error" : "border-outline-variant"}`} />
              </div>

              <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span>Hashtags</span>
                  <button onClick={() => copyText(hashtagsText, "hashtags")} className="text-primary inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</button>
                </div>
                <input type="text" value={hashtagsText} onChange={(e) => setHashtagsText(e.target.value)} className="w-full rounded-lg border border-outline-variant p-2 text-xs" />
              </div>

              {/* Chapters */}
              <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span>Chapters</span>
                  <div className="flex gap-2">
                    <button onClick={() => copyText(chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n"), "chapters")} className="text-primary inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</button>
                    <button onClick={() => setChapters((p) => [...p, { timestamp: "00:00", title: "New Chapter" }])} className="text-secondary inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {chapters.map((ch, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input type="text" value={ch.timestamp} onChange={(e) => setChapters((p) => p.map((x, i) => i === idx ? { ...x, timestamp: e.target.value } : x))} className="w-16 rounded border border-outline-variant px-1.5 py-1" />
                      <input type="text" value={ch.title} onChange={(e) => setChapters((p) => p.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))} className="flex-1 rounded border border-outline-variant px-2 py-1" />
                      <button onClick={() => { if (idx > 0) setChapters((p) => { const c = [...p]; const a = c[idx]; const b = c[idx - 1]; if (a && b) { c[idx] = b; c[idx - 1] = a; } return c; }); }}><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => { if (idx < chapters.length - 1) setChapters((p) => { const c = [...p]; const a = c[idx]; const b = c[idx + 1]; if (a && b) { c[idx] = b; c[idx + 1] = a; } return c; }); }}><ArrowDown className="h-3 w-3" /></button>
                      <button onClick={() => setChapters((p) => p.filter((_, i) => i !== idx))} className="text-error"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Social & Shorts Pack */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 text-xs">
            {[
              { label: "Pinned Comment", val: pinnedComment, set: setPinnedComment },
              { label: "YouTube Community Post", val: communityPost, set: setCommunityPost },
              { label: "Instagram Caption", val: instagramCaption, set: setInstagramCaption },
              { label: "Reel Caption", val: reelCaption, set: setReelCaption },
              { label: "WhatsApp Promo Message", val: whatsappMessage, set: setWhatsappMessage },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2">
                <div className="flex justify-between font-bold">
                  <span>{item.label}</span>
                  <button onClick={() => copyText(item.val, item.label)} className="text-primary inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</button>
                </div>
                <textarea rows={4} value={item.val} onChange={(e) => item.set(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-2" />
              </div>
            ))}
          </div>

          {shortsPack.length > 0 && (
            <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3 text-xs">
              <div className="font-bold text-sm">Shorts Ideas, Hooks & Scripts</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {shortsPack.map((sh, i) => (
                  <div key={i} className="rounded-lg bg-surface-container-low p-3 space-y-1.5">
                    <div className="font-bold text-primary">{sh.idea}</div>
                    <div className="font-semibold">Hook: {sh.hook}</div>
                    <p className="text-on-surface-variant whitespace-pre-wrap">{sh.script}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
