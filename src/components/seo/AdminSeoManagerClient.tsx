"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

interface SeoSettings {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgTitle: string | null;
  defaultOgDescription: string | null;
  defaultOgImage: string;
  twitterCard: string;
  canonicalPolicy: string;
  orgName: string;
  orgLogoUrl: string;
  orgDescription: string;
  contactEmail: string;
  contactPhone: string;
  addressCountry: string;
  addressLocality: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  robotsDefault: string;
  gscVerificationCode: string | null;
  bingVerificationCode: string | null;
}

interface TeacherSeoItem {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  department: string;
  subjects: string[];
  targetExams: string[];
  slug: string;
  isPublicProfileEnabled: boolean;
  isSeoIndexed: boolean;
  customSeoTitle: string;
  customMetaDescription: string;
  targetKeywords: string[];
  hindiKeywords: string[];
  englishKeywords: string[];
  verifiedBio: string;
  teachingPhilosophy: string;
  canonicalUrl: string;
  completenessScore: number;
}

interface KeywordItem {
  id: string;
  keyword: string;
  cluster: string;
  searchIntent: string;
  language: string;
  targetExam?: string | null;
  targetSubject?: string | null;
  targetClass?: string | null;
  targetUrl: string;
  priority: string;
  status: string;
  notes?: string | null;
}

interface ArticleItem {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  summary: string;
  content: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  status: string;
  isIndexed: boolean;
  authorName: string;
  publishedAt?: string | null;
  canonicalUrl?: string | null;
}

interface AuditIssueItem {
  id: string;
  url: string;
  issueType: string;
  severity: string;
  title: string;
  description: string;
  recommendedFix: string;
  status: string;
}

interface Props {
  initialSettings: SeoSettings;
  initialTeachers: TeacherSeoItem[];
  initialKeywords: KeywordItem[];
  initialArticles: ArticleItem[];
  initialIssues: AuditIssueItem[];
  initialHealthScore: number;
  stats: {
    totalPublishedPages: number;
    totalVerifiedPyqs: number;
    activeBatchesCount: number;
  };
}

export function AdminSeoManagerClient({
  initialSettings,
  initialTeachers,
  initialKeywords,
  initialArticles,
  initialIssues,
  initialHealthScore,
  stats,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "settings" | "teachers" | "keywords" | "content" | "audit" | "local" | "performance"
  >("dashboard");

  // Settings State
  const [settings, setSettings] = useState<SeoSettings>(initialSettings);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Teachers State
  const [teachers, setTeachers] = useState<TeacherSeoItem[]>(initialTeachers);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherSeoItem | null>(
    initialTeachers.find((t) => t.slug === "firoz-ali") || initialTeachers[0] || null
  );
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);

  // Keywords State
  const [keywords, setKeywords] = useState<KeywordItem[]>(initialKeywords);
  const [newKeyword, setNewKeyword] = useState({
    keyword: "",
    cluster: "NEET",
    searchIntent: "INFORMATIONAL",
    language: "en",
    targetUrl: "https://atomicpathshala.in/neet",
    priority: "HIGH",
  });
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);

  // Content Studio State
  const [articles, setArticles] = useState<ArticleItem[]>(initialArticles);
  const [aiTopic, setAiTopic] = useState("");
  const [aiKeyword, setAiKeyword] = useState("");
  const [aiExam, setAiExam] = useState("NEET");
  const [aiSubject, setAiSubject] = useState("Chemistry");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  // Audit State
  const [issues, setIssues] = useState<AuditIssueItem[]>(initialIssues);
  const [healthScore, setHealthScore] = useState(initialHealthScore);
  const [isScanning, setIsScanning] = useState(false);

  // Save Global Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/team/seo/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      toast.success("Global SEO settings saved to database!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Save Teacher SEO Profile
  const handleSaveTeacher = async () => {
    if (!selectedTeacher) return;
    setIsSavingTeacher(true);
    try {
      const res = await fetch("/api/team/seo/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selectedTeacher.id,
          slug: selectedTeacher.slug,
          isPublicProfileEnabled: selectedTeacher.isPublicProfileEnabled,
          isSeoIndexed: selectedTeacher.isSeoIndexed,
          customSeoTitle: selectedTeacher.customSeoTitle,
          customMetaDescription: selectedTeacher.customMetaDescription,
          targetKeywords: selectedTeacher.targetKeywords,
          hindiKeywords: selectedTeacher.hindiKeywords,
          englishKeywords: selectedTeacher.englishKeywords,
          verifiedBio: selectedTeacher.verifiedBio,
          teachingPhilosophy: selectedTeacher.teachingPhilosophy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save teacher profile");
      toast.success(`SEO profile for ${selectedTeacher.name} updated!`);

      // Update in local state list
      setTeachers((prev) =>
        prev.map((t) => (t.id === selectedTeacher.id ? { ...selectedTeacher } : t))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to save teacher");
    } finally {
      setIsSavingTeacher(false);
    }
  };

  // Add Keyword
  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.keyword.trim() || !newKeyword.targetUrl.trim()) {
      toast.error("Keyword and Target URL are required");
      return;
    }
    setIsAddingKeyword(true);
    try {
      const res = await fetch("/api/team/seo/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKeyword),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add keyword");
      toast.success("Keyword added to cluster!");
      setKeywords((prev) => [data.keyword, ...prev]);
      setNewKeyword({
        keyword: "",
        cluster: "NEET",
        searchIntent: "INFORMATIONAL",
        language: "en",
        targetUrl: "https://atomicpathshala.in/neet",
        priority: "HIGH",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add keyword");
    } finally {
      setIsAddingKeyword(false);
    }
  };

  // Delete Keyword
  const handleDeleteKeyword = async (id: string) => {
    try {
      const res = await fetch(`/api/team/seo/keywords?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete keyword");
      setKeywords((prev) => prev.filter((k) => k.id !== id));
      toast.success("Keyword deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Run Automated Scan
  const handleRunScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/team/seo/audit", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run scan");
      toast.success(`Scan completed: inspected ${data.scannedPages} pages!`);

      // Reload issues
      const issuesRes = await fetch("/api/team/seo/audit");
      const issuesData = await issuesRes.json();
      if (issuesData.issues) {
        setIssues(issuesData.issues);
        setHealthScore(issuesData.healthScore);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to run scan");
    } finally {
      setIsScanning(false);
    }
  };

  // Generate AI Draft
  const handleGenerateDraft = async () => {
    if (!aiTopic.trim() || !aiKeyword.trim()) {
      toast.error("Please enter a topic and primary keyword");
      return;
    }
    setIsGeneratingDraft(true);
    try {
      const res = await fetch("/api/team/seo/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic,
          primaryKeyword: aiKeyword,
          targetExam: aiExam,
          targetSubject: aiSubject,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate draft");
      toast.success("AI draft generated successfully!");

      // Save article as Draft
      const saveRes = await fetch("/api/team/seo/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.draft.title,
          summary: data.draft.summary,
          content: data.draft.content,
          primaryKeyword: aiKeyword,
          secondaryKeywords: data.draft.secondaryKeywords,
          targetExam: aiExam,
          targetSubject: aiSubject,
          status: "DRAFT",
          faqs: data.draft.faqs,
        }),
      });
      const savedArticle = await saveRes.json();
      if (savedArticle.article) {
        setArticles((prev) => [savedArticle.article, ...prev]);
        setAiTopic("");
        setAiKeyword("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate draft");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const navTabs = [
    { id: "dashboard", label: "Dashboard", icon: "space_dashboard" },
    { id: "settings", label: "Global Settings", icon: "tune" },
    { id: "teachers", label: "Faculty SEO", icon: "school" },
    { id: "keywords", label: "Keyword Manager", icon: "key" },
    { id: "content", label: "Content Studio", icon: "auto_stories" },
    { id: "audit", label: "SEO Scanner", icon: "bug_report" },
    { id: "local", label: "Local SEO & GBP", icon: "store" },
    { id: "performance", label: "Search Console", icon: "query_stats" },
  ] as const;

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
              Technical SEO &amp; AI Visibility Engine
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
              Live Apex: atomicpathshala.in
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            SEO Management Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time control over Google Knowledge Graph, Teacher Profiles, PYQs, Canonical Policies, and Organic Search Visibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="https://atomicpathshala.in"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            <span>Live Site</span>
          </Link>
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isScanning ? "animate-spin" : ""}`}>
              refresh
            </span>
            <span>{isScanning ? "Scanning..." : "Run SEO Scan"}</span>
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Health Score Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  SEO Health Score
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {healthScore}/100
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  Calculated from real audit checks
                </div>
              </div>
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border ${
                  healthScore >= 80
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                }`}
              >
                {healthScore}
              </div>
            </div>

            <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Eligible SEO Faculty
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {teachers.filter((t) => t.isPublicProfileEnabled).length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Dynamic profiles at /teachers/[slug]
              </div>
            </div>

            <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Verified PYQ Database
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {stats.totalVerifiedPyqs}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                NEET &amp; JEE past papers with solutions
              </div>
            </div>

            <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Keywords Monitored
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {keywords.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Across 8 academic topic clusters
              </div>
            </div>
          </div>

          {/* Infrastructure Health Matrix */}
          <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">verified</span>
              <span>Technical SEO Infrastructure Status</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Canonical Domain</span>
                  <span className="text-emerald-600 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Active
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                  https://atomicpathshala.in
                </div>
                <div className="text-[11px] text-slate-400">Apex domain enforced (subdomain fixed)</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Dynamic Sitemap</span>
                  <span className="text-emerald-600 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Active
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                  /sitemap.xml
                </div>
                <div className="text-[11px] text-slate-400">Includes courses, teachers &amp; PYQs</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Robots Configuration</span>
                  <span className="text-emerald-600 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Protected
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                  /robots.txt
                </div>
                <div className="text-[11px] text-slate-400">Private admin &amp; student routes protected</div>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts to Academic Hubs */}
          <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">public</span>
              <span>Published Academic Hubs &amp; Topic Silos</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {[
                { name: "NEET UG", path: "/neet" },
                { name: "IIT-JEE", path: "/jee" },
                { name: "Chemistry", path: "/chemistry" },
                { name: "Physics", path: "/physics" },
                { name: "Biology", path: "/biology" },
                { name: "Class 10", path: "/class-10" },
                { name: "Class 11", path: "/class-11" },
                { name: "Class 12", path: "/class-12" },
                { name: "Boards", path: "/boards" },
                { name: "Modules", path: "/modules" },
                { name: "PYQ Library", path: "/pyq" },
                { name: "Teachers", path: "/teachers" },
              ].map((hub) => (
                <Link
                  key={hub.path}
                  href={hub.path}
                  target="_blank"
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-center text-xs font-bold transition-all text-slate-800 dark:text-slate-200 hover:text-blue-600"
                >
                  <div>{hub.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{hub.path}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL SETTINGS */}
      {activeTab === "settings" && (
        <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Global SEO &amp; Brand Settings</h2>
              <p className="text-xs text-slate-500">Configured values persist in database and inform site-wide metadata.</p>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              <span>{isSavingSettings ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Website Name</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Canonical Website URL</label>
              <input
                type="text"
                value={settings.siteUrl}
                onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Default Meta Title</label>
              <input
                type="text"
                value={settings.defaultTitle}
                onChange={(e) => setSettings({ ...settings, defaultTitle: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Default Meta Description</label>
              <textarea
                rows={3}
                value={settings.defaultDescription}
                onChange={(e) => setSettings({ ...settings, defaultDescription: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Default OG Image URL</label>
              <input
                type="text"
                value={settings.defaultOgImage}
                onChange={(e) => setSettings({ ...settings, defaultOgImage: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Twitter Card Type</label>
              <select
                value={settings.twitterCard}
                onChange={(e) => setSettings({ ...settings, twitterCard: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              >
                <option value="summary_large_image">summary_large_image (Recommended)</option>
                <option value="summary">summary</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Organization Name</label>
              <input
                type="text"
                value={settings.orgName}
                onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Contact Email</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FACULTY SEO */}
      {activeTab === "teachers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teacher List */}
          <div className="bg-white dark:bg-[#111625] rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Approved Faculty List</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {teachers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeacher(t)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    selectedTeacher?.id === t.id
                      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{t.department} · /{t.slug}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.isPublicProfileEnabled
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {t.isPublicProfileEnabled ? "Public" : "Disabled"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Teacher SEO Editor & SERP Preview */}
          {selectedTeacher && (
            <div className="lg:col-span-2 space-y-6">
              {/* Google SERP Snippet Preview */}
              <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Google Search Snippet Preview
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 font-sans">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <img src="/brand/logo.png" alt="Atomic" className="w-4 h-4 rounded-full" />
                    <span>atomicpathshala.in</span>
                    <span>›</span>
                    <span>teachers</span>
                    <span>›</span>
                    <span className="font-mono">{selectedTeacher.slug}</span>
                  </div>
                  <div className="text-base text-blue-700 dark:text-blue-400 font-medium hover:underline cursor-pointer">
                    {selectedTeacher.customSeoTitle || `${selectedTeacher.name} — ${selectedTeacher.department} Faculty | Atomic Pathshala`}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {selectedTeacher.customMetaDescription || selectedTeacher.verifiedBio || `Learn with ${selectedTeacher.name} at Atomic Pathshala.`}
                  </div>
                </div>
              </div>

              {/* Editor Form */}
              <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit SEO: {selectedTeacher.name}
                  </h3>
                  <button
                    onClick={handleSaveTeacher}
                    disabled={isSavingTeacher}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <span>{isSavingTeacher ? "Saving..." : "Save Teacher SEO"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Profile URL Slug</label>
                    <input
                      type="text"
                      value={selectedTeacher.slug}
                      onChange={(e) => setSelectedTeacher({ ...selectedTeacher, slug: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Public Visibility</label>
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedTeacher.isPublicProfileEnabled}
                          onChange={(e) => setSelectedTeacher({ ...selectedTeacher, isPublicProfileEnabled: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Public Profile</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedTeacher.isSeoIndexed}
                          onChange={(e) => setSelectedTeacher({ ...selectedTeacher, isSeoIndexed: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Index in Google</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Custom SEO Title</label>
                    <input
                      type="text"
                      value={selectedTeacher.customSeoTitle}
                      onChange={(e) => setSelectedTeacher({ ...selectedTeacher, customSeoTitle: e.target.value })}
                      placeholder={`${selectedTeacher.name} — ${selectedTeacher.department} Faculty | Atomic Pathshala`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Custom Meta Description</label>
                    <textarea
                      rows={2}
                      value={selectedTeacher.customMetaDescription}
                      onChange={(e) => setSelectedTeacher({ ...selectedTeacher, customMetaDescription: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Keywords (comma-separated)</label>
                    <input
                      type="text"
                      value={selectedTeacher.targetKeywords.join(", ")}
                      onChange={(e) =>
                        setSelectedTeacher({
                          ...selectedTeacher,
                          targetKeywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: KEYWORD MANAGER */}
      {activeTab === "keywords" && (
        <div className="space-y-6">
          {/* Add Keyword Form */}
          <form
            onSubmit={handleAddKeyword}
            className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add New Target Keyword</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Keyword (e.g. NEET Chemistry PYQ)"
                value={newKeyword.keyword}
                onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs"
              />
              <select
                value={newKeyword.cluster}
                onChange={(e) => setNewKeyword({ ...newKeyword, cluster: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs"
              >
                <option value="NEET">NEET</option>
                <option value="JEE">JEE</option>
                <option value="CHEMISTRY">Chemistry</option>
                <option value="PHYSICS">Physics</option>
                <option value="BIOLOGY">Biology</option>
                <option value="TEACHER">Teacher</option>
                <option value="BRAND">Brand</option>
                <option value="PYQ">PYQ</option>
                <option value="BOARDS">Boards</option>
              </select>
              <input
                type="text"
                placeholder="Target URL"
                value={newKeyword.targetUrl}
                onChange={(e) => setNewKeyword({ ...newKeyword, targetUrl: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              />
              <button
                type="submit"
                disabled={isAddingKeyword}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {isAddingKeyword ? "Adding..." : "Add Keyword"}
              </button>
            </div>
          </form>

          {/* Keywords Table */}
          <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tracked Keywords ({keywords.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="pb-3 font-bold">Keyword</th>
                    <th className="pb-3 font-bold">Cluster</th>
                    <th className="pb-3 font-bold">Target URL</th>
                    <th className="pb-3 font-bold">Priority</th>
                    <th className="pb-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {keywords.map((kw) => (
                    <tr key={kw.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-3 font-bold text-slate-900 dark:text-white">{kw.keyword}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                          {kw.cluster}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-blue-600 dark:text-blue-400 truncate max-w-xs">
                        {kw.targetUrl}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 font-bold text-[10px]">
                          {kw.priority}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDeleteKeyword(kw.id)}
                          className="text-red-500 hover:text-red-600 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CONTENT STUDIO */}
      {activeTab === "content" && (
        <div className="space-y-6">
          {/* AI Content Generator Card */}
          <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 rounded-3xl p-6 border border-blue-500/20 space-y-4">
            <div>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-xs font-bold">
                AI Search Intent &amp; Outline Studio
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                Generate Verified Educational SEO Content Draft
              </h3>
              <p className="text-xs text-slate-500">
                Grounded in Atomic Pathshala faculty, courses, and PYQs. Free of fabricated claims.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Topic (e.g. General Organic Chemistry Revision)"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
              <input
                type="text"
                placeholder="Primary Keyword"
                value={aiKeyword}
                onChange={(e) => setAiKeyword(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
              <select
                value={aiExam}
                onChange={(e) => setAiExam(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="NEET">NEET UG</option>
                <option value="JEE">JEE Main</option>
                <option value="BOARDS">Boards</option>
              </select>
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={isGeneratingDraft}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {isGeneratingDraft ? "Generating Draft..." : "Generate AI Draft"}
              </button>
            </div>
          </div>

          {/* Articles List */}
          <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">SEO Articles &amp; Guides ({articles.length})</h3>
            {articles.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs border border-dashed rounded-2xl">
                No articles created yet. Use the AI Generator above to draft your first educational guide!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {articles.map((art) => (
                  <div key={art.id} className="py-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{art.title}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">/blog/{art.slug}</span>
                        <span>·</span>
                        <span className="font-semibold text-blue-600">{art.primaryKeyword}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 font-bold text-xs">
                      {art.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT SCANNER */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Automated SEO Inspection Matrix</h3>
                <p className="text-xs text-slate-500">Live health scan results across internal public routes.</p>
              </div>
              <button
                onClick={handleRunScan}
                disabled={isScanning}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {isScanning ? "Scanning..." : "Re-Scan Website"}
              </button>
            </div>

            <div className="space-y-3">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          issue.severity === "CRITICAL"
                            ? "bg-red-500/10 text-red-600 border border-red-500/20"
                            : issue.severity === "HIGH"
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                        }`}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{issue.title}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        issue.status === "RESOLVED"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {issue.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{issue.description}</div>
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Fix: {issue.recommendedFix}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">{issue.url}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: LOCAL SEO & GOOGLE BUSINESS PROFILE */}
      {activeTab === "local" && (
        <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Local SEO &amp; Google Business Profile</h2>
            <p className="text-xs text-slate-500">
              Ensure physical center and regional search consistency across Google Maps and regional searchers.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>Google Business Profile API Status: Manual Workflow Configured</span>
            </div>
            <p>
              Direct Google My Business API credentials are not linked. Maintain consistent Name, Address, and Phone (NAP) details manually on your Google Business Profile dashboard.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">NAP Consistency Checklist</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="py-3 flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Official Brand Name</span>
                <span className="font-bold text-slate-900 dark:text-white">Atomic Pathshala</span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Primary Category</span>
                <span className="font-bold text-slate-900 dark:text-white">Coaching Center / Educational Institution</span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Website URL</span>
                <span className="font-mono text-blue-600">https://atomicpathshala.in</span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Contact Number</span>
                <span className="font-bold text-slate-900 dark:text-white">+91 8958900405</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: SEARCH CONSOLE & PERFORMANCE */}
      {activeTab === "performance" && (
        <div className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Search Console &amp; Webmaster Integrations</h2>
            <p className="text-xs text-slate-500">
              Verify domain ownership with Google Search Console and Bing Webmaster Tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Google Search Console</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600">
                  Ready for Verification
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Add your verification code or upload your HTML file to verify ownership of <code>https://atomicpathshala.in</code>.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Google Site Verification Token
                </label>
                <input
                  type="text"
                  placeholder="google-site-verification token"
                  value={settings.gscVerificationCode || ""}
                  onChange={(e) => setSettings({ ...settings, gscVerificationCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Bing Webmaster Tools</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600">
                  Ready for Verification
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect Bing Webmaster Tools to ensure fast indexing on Bing Search and Copilot answer engines.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Bing Verification Token
                </label>
                <input
                  type="text"
                  placeholder="msvalidate.01 token"
                  value={settings.bingVerificationCode || ""}
                  onChange={(e) => setSettings({ ...settings, bingVerificationCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              <span>{isSavingSettings ? "Saving..." : "Save Verification Tokens"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
