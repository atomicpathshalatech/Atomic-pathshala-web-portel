"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { uploadFileToR2 } from "@/lib/storage/upload-client";
import { ImageUploadField } from "./ImageUploadField";
import { BlogContent } from "@/components/blog/BlogContent";

export type AdminBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  content: string;
  category: string | null;
  authorName: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  updatedAt: string;
};

type Draft = Omit<AdminBlogPost, "id" | "publishedAt" | "updatedAt" | "excerpt" | "coverImageUrl" | "category" | "authorName" | "seoTitle" | "metaDescription"> & {
  excerpt: string;
  coverImageUrl: string;
  category: string;
  authorName: string;
  seoTitle: string;
  metaDescription: string;
};

const EMPTY: Draft = { slug: "", title: "", excerpt: "", coverImageUrl: "", content: "", category: "", authorName: "", status: "DRAFT", seoTitle: "", metaDescription: "" };

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s-]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

const input = "w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "mb-1 block text-xs font-semibold text-slate-700";

/** Team → Website → Blog: write, publish, edit and delete blog posts. */
export function BlogManager({ initialPosts }: { initialPosts: AdminBlogPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inserting, setInserting] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function startNew() {
    setEditingId(null);
    setDraft(EMPTY);
    setSlugTouched(false);
    setPreview(false);
    setOpen(true);
  }

  function startEdit(p: AdminBlogPost) {
    setEditingId(p.id);
    setDraft({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? "",
      coverImageUrl: p.coverImageUrl ?? "",
      content: p.content,
      category: p.category ?? "",
      authorName: p.authorName ?? "",
      status: p.status,
      seoTitle: p.seoTitle ?? "",
      metaDescription: p.metaDescription ?? "",
    });
    setSlugTouched(true);
    setPreview(false);
    setOpen(true);
  }

  // Upload an image and insert it into the content at the cursor as Markdown.
  async function insertImage(file: File) {
    setInserting(true);
    try {
      const res = await uploadFileToR2(file, { fileType: "IMAGE", prefix: "course-thumbnails", visibility: "PUBLIC" });
      if (!res.url) throw new Error("Upload succeeded but no public URL returned.");
      const md = `\n![${file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "")}](${res.url})\n`;
      const el = contentRef.current;
      const at = el ? el.selectionStart : draft.content.length;
      set("content", draft.content.slice(0, at) + md + draft.content.slice(at));
      toast.success("Image added to the post.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setInserting(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  }

  async function save(status: Draft["status"]) {
    const body = { ...draft, status, slug: draft.slug || slugify(draft.title) };
    if (!body.title.trim()) return toast.error("Title is required.");
    if (!body.slug) return toast.error("Add a URL (slug) using English letters or numbers.");
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/admin/blog/${editingId}` : "/api/admin/blog", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not save the post.");
      const saved = json.data.post as AdminBlogPost;
      setPosts((list) => [saved, ...list.filter((p) => p.id !== saved.id)]);
      toast.success(status === "PUBLISHED" ? "Post published." : "Draft saved.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the post.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: AdminBlogPost) {
    if (!window.confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/blog/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((list) => list.filter((x) => x.id !== p.id));
      toast.success("Post deleted.");
    } else {
      toast.error("Could not delete the post.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{posts.length} post{posts.length === 1 ? "" : "s"}</p>
        <button type="button" onClick={() => (open ? setOpen(false) : startNew())} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700">
          {open ? "Close editor" : "+ New Post"}
        </button>
      </div>

      {open && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">{editingId ? "Edit post" : "New post"}</h3>
          <div>
            <label className={labelCls}>Title *</label>
            <input
              value={draft.title}
              maxLength={200}
              onChange={(e) => {
                const title = e.target.value;
                setDraft((d) => ({ ...d, title, slug: slugTouched ? d.slug : slugify(title) }));
              }}
              placeholder="e.g. How to revise Organic Chemistry for NEET in 30 days"
              className={input}
            />
          </div>
          <div>
            <label className={labelCls}>Post URL</label>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span className="shrink-0">/blog/</span>
              <input
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
                placeholder="neet-organic-chemistry-revision"
                className={input}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">English letters, numbers and hyphens. Hindi titles: type a short English URL here.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Category</label>
              <input value={draft.category} maxLength={60} onChange={(e) => set("category", e.target.value)} placeholder="e.g. NEET, JEE, Boards, Study Tips" className={input} />
            </div>
            <div>
              <label className={labelCls}>Author name</label>
              <input value={draft.authorName} maxLength={80} onChange={(e) => set("authorName", e.target.value)} placeholder="e.g. Atomic Pathshala Team" className={input} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Short summary (shown on blog cards)</label>
            <textarea value={draft.excerpt} maxLength={400} rows={2} onChange={(e) => set("excerpt", e.target.value)} className={input} />
          </div>
          <ImageUploadField label="Cover image (16:9)" hint="Shown on the blog card and at the top of the post." value={draft.coverImageUrl} onChange={(v) => set("coverImageUrl", v)} />

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">Content</label>
              <div className="flex gap-2">
                <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && insertImage(e.target.files[0])} />
                <button type="button" disabled={inserting} onClick={() => imgInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  <ImagePlus className="h-3.5 w-3.5" /> {inserting ? "Uploading…" : "Insert image"}
                </button>
                <button type="button" onClick={() => setPreview((p) => !p)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                  {preview ? "Edit" : "Preview"}
                </button>
              </div>
            </div>
            {preview ? (
              <div className="min-h-[240px] rounded-xl border border-slate-200 p-4">
                <BlogMarkdownPreview content={draft.content} />
              </div>
            ) : (
              <textarea
                ref={contentRef}
                value={draft.content}
                rows={16}
                onChange={(e) => set("content", e.target.value)}
                placeholder={"Write your post here.\n\n## Heading\nNormal paragraph text.\n\n- Point one\n- Point two\n\n**Bold text**, [link text](https://example.com)"}
                className={`${input} font-mono leading-relaxed`}
              />
            )}
            <p className="mt-1 text-[11px] text-slate-500">Formatting: <code>## Heading</code>, <code>**bold**</code>, <code>- list item</code>, <code>[link](https://…)</code>. Use “Insert image” to add pictures.</p>
          </div>

          <details className="rounded-xl bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">SEO (optional)</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className={labelCls}>SEO title</label>
                <input value={draft.seoTitle} maxLength={200} onChange={(e) => set("seoTitle", e.target.value)} placeholder="Defaults to the post title" className={input} />
              </div>
              <div>
                <label className={labelCls}>Meta description</label>
                <textarea value={draft.metaDescription} maxLength={300} rows={2} onChange={(e) => set("metaDescription", e.target.value)} placeholder="Defaults to the short summary" className={input} />
              </div>
            </div>
          </details>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" disabled={saving} onClick={() => save("PUBLISHED")} className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving…" : "Publish"}
            </button>
            <button type="button" disabled={saving} onClick={() => save("DRAFT")} className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {editingId && draft.status === "PUBLISHED" ? "Unpublish (save as draft)" : "Save draft"}
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {posts.length === 0 && <li className="p-6 text-center text-xs text-slate-500">No posts yet. Click “+ New Post” to write the first one.</li>}
        {posts.map((p) => (
          <li key={p.id} className="flex items-center gap-3 p-4">
            {p.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
              <img src={p.coverImageUrl} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="h-12 w-20 shrink-0 rounded-lg bg-slate-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{p.title}</p>
              <p className="text-[11px] text-slate-500">
                <span className={p.status === "PUBLISHED" ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>{p.status === "PUBLISHED" ? "Published" : "Draft"}</span>
                {" · /blog/"}
                {p.slug}
                {p.category ? ` · ${p.category}` : ""}
              </p>
            </div>
            {p.status === "PUBLISHED" && (
              <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="View post">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button type="button" onClick={() => startEdit(p)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Edit post">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => remove(p)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Delete post">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlogMarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) return <p className="text-xs text-slate-400">Nothing to preview yet.</p>;
  return <BlogContent content={content} />;
}
