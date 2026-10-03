/**
 * Homepage templates for Team → Website → Website Builder.
 *
 * Every homepage section is one of these templates. The builder shows a
 * simple form generated from `fields` (no JSON), the public homepage renders
 * the published list in order (src/components/public-home/HomeSections.tsx),
 * and DEFAULT_LAYOUT is what the site shows until something is published.
 * Shared by the admin (client) and the public page (server) — no secrets here.
 */

export type Audience = "ALL" | "GUEST" | "STUDENT" | "FREE" | "PAID";

export const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "ALL", label: "Sabko (everyone)" },
  { value: "GUEST", label: "Sirf bina login wale visitors" },
  { value: "STUDENT", label: "Sirf login students (free + paid)" },
  { value: "FREE", label: "Sirf free students (koi paid batch/plan nahi)" },
  { value: "PAID", label: "Sirf paid students (batch ya plan liya hai)" },
];

export type OptionSource = "batches" | "teachers" | "testSeries" | "materialTypes" | "pyqExams";

export type Field =
  | { key: string; label: string; type: "text" | "textarea" | "url"; placeholder?: string; hint?: string }
  | { key: string; label: string; type: "image"; hint?: string }
  | { key: string; label: string; type: "number"; min?: number; max?: number; hint?: string }
  | { key: string; label: string; type: "toggle"; hint?: string; defaultOn?: boolean }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; hint?: string }
  | { key: string; label: string; type: "checks"; source: OptionSource; hint?: string }
  | { key: string; label: string; type: "list"; itemLabel: string; fields: { key: string; label: string; type: "text" | "textarea" | "url" | "icon"; placeholder?: string }[]; hint?: string }
  | { key: string; label: string; type: "textList"; itemLabel: string; hint?: string };

export type TemplateGroup = "top" | "learning" | "people" | "info";

export type Template = {
  type: string;
  label: string;
  description: string;
  icon: string;
  group: TemplateGroup;
  /** Shows the common Eyebrow / Title / Subtitle inputs. */
  header: boolean;
  fields: Field[];
  /** Note shown at the top of the form (where the data comes from). */
  note?: string;
};

export const GROUP_LABELS: Record<TemplateGroup, string> = {
  top: "Sabse upar (Top of page)",
  learning: "Free padhai & practice",
  people: "Courses, teachers & videos",
  info: "Trust, info & custom",
};

const linkCardFields = [
  { key: "title", label: "Title", type: "text" as const },
  { key: "text", label: "Short text", type: "text" as const },
  { key: "href", label: "Link (e.g. /practice)", type: "url" as const, placeholder: "/study-material" },
  { key: "icon", label: "Icon", type: "icon" as const },
];

export const TEMPLATES: Template[] = [
  // ── Top of page ─────────────────────────────────────────────────────────
  {
    type: "HERO",
    label: "Hero (sabse upar wala hissa)",
    description: "Badi heading, text, 2 buttons, points aur beech/right wali image.",
    icon: "web_asset",
    group: "top",
    header: false,
    fields: [
      { key: "badge", label: "Chhota badge text", type: "text", placeholder: "NEET • JEE • BOARDS" },
      { key: "heading", label: "Heading (pehla hissa)", type: "text", placeholder: "Learn Better." },
      { key: "highlight", label: "Heading ka blue hissa", type: "text", placeholder: "Practice More." },
      { key: "headingEnd", label: "Heading ka aakhri hissa", type: "text", placeholder: "Score Higher." },
      { key: "subheading", label: "Neeche ka text", type: "textarea" },
      { key: "ctaText", label: "Blue button ka text", type: "text", placeholder: "Explore Free Resources" },
      { key: "ctaUrl", label: "Blue button ka link", type: "url", placeholder: "/register" },
      { key: "secondaryCtaText", label: "White button ka text", type: "text", placeholder: "Explore Courses" },
      { key: "secondaryCtaUrl", label: "White button ka link", type: "url", placeholder: "/courses" },
      { key: "bullets", label: "Chhote points", type: "textList", itemLabel: "Point" },
      { key: "imageUrl", label: "Image (desktop)", type: "image", hint: "Khali chhodein to Homepage Hero Image page wali image ya built-in drawing dikhegi." },
      { key: "mobileImageUrl", label: "Image (mobile, optional)", type: "image" },
      { key: "imageAlt", label: "Image description", type: "text" },
    ],
    note: "Koi field khali chhodenge to wahan default text dikhega.",
  },
  {
    type: "BANNER_SLIDER",
    label: "Banner slider",
    description: "Banners page ke saare Active banners ek slider mein.",
    icon: "view_carousel",
    group: "top",
    header: false,
    fields: [{ key: "limit", label: "Kitne banner (max)", type: "number", min: 1, max: 8 }],
    note: "Banner add/Active karne ke liye: Team → App & Web Banners.",
  },
  {
    type: "ANNOUNCEMENT",
    label: "Announcement patti",
    description: "Ek line ki patti — jaise “New batch 15 Oct se”.",
    icon: "campaign",
    group: "top",
    header: false,
    fields: [
      { key: "message", label: "Message", type: "text" },
      { key: "ctaText", label: "Button text (optional)", type: "text" },
      { key: "ctaUrl", label: "Button link", type: "url" },
    ],
  },
  {
    type: "IMAGE_BANNER",
    label: "Ek badi image",
    description: "Ek poori-width image, click karne par link khule.",
    icon: "image",
    group: "top",
    header: false,
    fields: [
      { key: "imageUrl", label: "Image", type: "image", hint: "16:9 ya chaudi image best rahegi." },
      { key: "mobileImageUrl", label: "Mobile image (optional)", type: "image" },
      { key: "alt", label: "Image description", type: "text" },
      { key: "ctaUrl", label: "Click par link (optional)", type: "url" },
    ],
  },

  // ── Free learning ───────────────────────────────────────────────────────
  {
    type: "EXAM_SELECTOR",
    label: "Exam / class chuno (cards)",
    description: "Class 10, 11, 12, NEET, JEE jaise cards.",
    icon: "school",
    group: "learning",
    header: true,
    fields: [{ key: "items", label: "Cards", type: "list", itemLabel: "Card", fields: linkCardFields, hint: "Khali chhodein to default 5 cards dikhenge." }],
  },
  {
    type: "SEARCH",
    label: "Search box",
    description: "“What are you looking for?” search aur quick links.",
    icon: "search",
    group: "learning",
    header: true,
    fields: [],
  },
  {
    type: "FREE_RESOURCES",
    label: "Free resources cards",
    description: "Free PYQs, Notes, Tests, DPPs… ke cards.",
    icon: "redeem",
    group: "learning",
    header: true,
    fields: [
      {
        key: "items",
        label: "Cards",
        type: "list",
        itemLabel: "Card",
        fields: [...linkCardFields, { key: "cta", label: "Button text", type: "text" }],
        hint: "Khali chhodein to default 8 cards (asli counts ke saath) dikhenge.",
      },
    ],
  },
  {
    type: "PYQ_HUB",
    label: "PYQ section",
    description: "NEET / JEE / Board PYQ tabs, subject aur top chapters.",
    icon: "history_edu",
    group: "learning",
    header: true,
    fields: [{ key: "exams", label: "Kaun se exam tabs dikhane hain", type: "checks", source: "pyqExams", hint: "Kuch na chunein to saare dikhenge." }],
  },
  {
    type: "STUDY_MATERIAL",
    label: "Study material / Modules / Books",
    description: "Modules, notes, mind maps, formula sheets, NCERT, PYQ papers.",
    icon: "menu_book",
    group: "learning",
    header: true,
    fields: [{ key: "types", label: "Kaun se type dikhane hain", type: "checks", source: "materialTypes", hint: "Kuch na chunein to saare (jinmein file hai) dikhenge." }],
  },
  {
    type: "FREE_TESTS",
    label: "Free tests",
    description: "Public (free) test series ke cards.",
    icon: "timer",
    group: "learning",
    header: true,
    fields: [{ key: "seriesIds", label: "Kaun si test series", type: "checks", source: "testSeries", hint: "Sirf PUBLIC test series yahan aati hain. Kuch na chunein to saari." }],
  },
  {
    type: "TODAY_SCHEDULE",
    label: "Aaj ka schedule",
    description: "Aaj ki live classes, DPP aur tests (apne-aap).",
    icon: "today",
    group: "learning",
    header: true,
    fields: [],
  },

  // ── Courses, people, video ──────────────────────────────────────────────
  {
    type: "BATCH_GRID",
    label: "Courses / Batches",
    description: "Running aur upcoming batches ke cards.",
    icon: "auto_stories",
    group: "people",
    header: true,
    fields: [
      { key: "batchIds", label: "Kaun se batch", type: "checks", source: "batches", hint: "Kuch na chunein to saare running/upcoming." },
      { key: "limit", label: "Kitne dikhane hain (max)", type: "number", min: 1, max: 24 },
      { key: "showPrice", label: "Price dikhana hai", type: "toggle", defaultOn: true },
    ],
  },
  {
    type: "TEACHER_GRID",
    label: "Teachers / Faculty",
    description: "Teachers ke cards, profile link ke saath.",
    icon: "groups",
    group: "people",
    header: true,
    fields: [
      { key: "teacherSlugs", label: "Kaun se teachers", type: "checks", source: "teachers", hint: "Kuch na chunein to saare." },
      { key: "limit", label: "Kitne dikhane hain (max)", type: "number", min: 1, max: 40 },
    ],
  },
  {
    type: "ATOMIC_GURU",
    label: "Atomic Guru (doubt)",
    description: "“Stuck on a question?” — Atomic Guru ka section.",
    icon: "psychology",
    group: "people",
    header: true,
    fields: [
      { key: "ctaText", label: "Button text", type: "text", placeholder: "Try Atomic Guru" },
      { key: "ctaUrl", label: "Button link", type: "url", placeholder: "/guru" },
    ],
  },
  {
    type: "YOUTUBE",
    label: "YouTube channel",
    description: "YouTube channel ka link aur chips.",
    icon: "smart_display",
    group: "people",
    header: true,
    fields: [
      { key: "channelUrl", label: "Channel link", type: "url", hint: "Khali chhodein to Footer settings wala YouTube link." },
      { key: "chips", label: "Chips", type: "textList", itemLabel: "Chip" },
      { key: "ctaText", label: "Button text", type: "text" },
    ],
  },
  {
    type: "VIDEO",
    label: "Ek YouTube video",
    description: "Kisi bhi YouTube video ko homepage par chalaiye.",
    icon: "play_circle",
    group: "people",
    header: true,
    fields: [{ key: "videoUrl", label: "YouTube video link", type: "url", placeholder: "https://www.youtube.com/watch?v=..." }],
  },
  {
    type: "TESTIMONIALS",
    label: "Student reviews",
    description: "Student Feedback / Reviews page ke approved reviews.",
    icon: "rate_review",
    group: "people",
    header: true,
    fields: [{ key: "limit", label: "Kitne dikhane hain (max)", type: "number", min: 1, max: 12 }],
    note: "Reviews add/approve karne ke liye: Team → Student Feedback / Reviews.",
  },

  // ── Trust & info ────────────────────────────────────────────────────────
  {
    type: "WHY_US",
    label: "Why Atomic Pathshala",
    description: "Learn → Practice → Test → Improve jaise steps.",
    icon: "workspace_premium",
    group: "info",
    header: true,
    fields: [
      {
        key: "items",
        label: "Steps",
        type: "list",
        itemLabel: "Step",
        fields: [
          { key: "title", label: "Title", type: "text" },
          { key: "text", label: "Text", type: "text" },
          { key: "icon", label: "Icon", type: "icon" },
        ],
        hint: "Khali chhodein to default 4 steps.",
      },
    ],
  },
  {
    type: "TRUST",
    label: "Trust / numbers",
    description: "Asli numbers (students, questions, tests) aur promises.",
    icon: "verified",
    group: "info",
    header: true,
    fields: [
      { key: "showNumbers", label: "Asli numbers dikhane hain (database se)", type: "toggle", defaultOn: true },
      { key: "items", label: "Promises", type: "list", itemLabel: "Promise", fields: [{ key: "text", label: "Text", type: "text" }, { key: "icon", label: "Icon", type: "icon" }] },
    ],
  },
  {
    type: "APP_DOWNLOAD",
    label: "App install",
    description: "App install karne ka banner.",
    icon: "install_mobile",
    group: "info",
    header: true,
    fields: [
      { key: "ctaText", label: "Button text", type: "text", placeholder: "Install the app" },
      { key: "ctaUrl", label: "Button link", type: "url", placeholder: "/install" },
    ],
  },
  {
    type: "BLOG",
    label: "Latest blogs",
    description: "Blog page ki latest published posts.",
    icon: "article",
    group: "info",
    header: true,
    fields: [{ key: "limit", label: "Kitni posts (max)", type: "number", min: 1, max: 9 }],
    note: "Post likhne ke liye: Team → Blog.",
  },
  {
    type: "FAQ",
    label: "FAQs",
    description: "FAQs page ke sawal-jawab.",
    icon: "help_center",
    group: "info",
    header: false,
    fields: [],
    note: "Sawal-jawab badalne ke liye: Team → FAQs.",
  },
  {
    type: "TEXT_IMAGE",
    label: "Text + image",
    description: "Ek taraf text, doosri taraf image.",
    icon: "view_quilt",
    group: "info",
    header: true,
    fields: [
      { key: "body", label: "Text", type: "textarea" },
      { key: "imageUrl", label: "Image", type: "image" },
      { key: "imagePosition", label: "Image kis taraf", type: "select", options: [{ value: "right", label: "Right" }, { value: "left", label: "Left" }] },
      { key: "ctaText", label: "Button text (optional)", type: "text" },
      { key: "ctaUrl", label: "Button link", type: "url" },
    ],
  },
  {
    type: "CTA",
    label: "Call to action",
    description: "Heading + ek bada button (jaise “Register Now”).",
    icon: "ads_click",
    group: "info",
    header: true,
    fields: [
      { key: "ctaText", label: "Button text", type: "text", placeholder: "Start Learning Free" },
      { key: "ctaUrl", label: "Button link", type: "url", placeholder: "/register" },
    ],
  },
  {
    type: "STATISTICS",
    label: "Numbers (khud likhein)",
    description: "Apne numbers likhiye — sirf sahi aur sach numbers daalein.",
    icon: "query_stats",
    group: "info",
    header: true,
    fields: [{ key: "items", label: "Numbers", type: "list", itemLabel: "Number", fields: [{ key: "value", label: "Number (e.g. 5,000+)", type: "text" }, { key: "label", label: "Label", type: "text" }] }],
  },
  {
    type: "CONTACT",
    label: "Contact / Helpline",
    description: "Phone, email aur address.",
    icon: "call",
    group: "info",
    header: true,
    fields: [
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "address", label: "Address", type: "textarea" },
    ],
  },
  {
    type: "CUSTOM_HTML",
    label: "Custom HTML (advanced)",
    description: "Sirf technical logon ke liye — apna HTML.",
    icon: "code",
    group: "info",
    header: false,
    fields: [{ key: "html", label: "HTML", type: "textarea" }],
  },
];

export const TEMPLATE_BY_TYPE: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.type, t]));

/** Section types added for the template builder (also in the HomeSectionType enum migration). */
export const NEW_TEMPLATE_TYPES = ["BANNER_SLIDER", "EXAM_SELECTOR", "SEARCH", "FREE_RESOURCES", "PYQ_HUB", "STUDY_MATERIAL", "FREE_TESTS", "TODAY_SCHEDULE", "ATOMIC_GURU", "YOUTUBE", "WHY_US", "TRUST"] as const;

export const MATERIAL_TYPE_LABELS: Record<string, string> = {
  MODULE: "Chapter Notes & Modules",
  SHORT_NOTES: "Revision Notes",
  MIND_MAP: "Mind Maps",
  FORMULA_SHEET: "Formula Sheets",
  NCERT_HIGHLIGHTED: "NCERT Highlighted",
  NCERT_EXEMPLAR: "NCERT Exemplar",
  NEET_PYQ: "NEET Previous Year Papers",
  JEE_PYQ: "JEE Previous Year Papers",
};

export const PYQ_EXAM_OPTIONS = ["NEET", "JEE Main", "JEE Advanced", "CBSE", "State Boards"];

export type LayoutSection = {
  id?: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  visible?: boolean;
  visibleDesktop?: boolean;
  visibleMobile?: boolean;
  config: Record<string, unknown>;
  background?: string | null;
  padding?: string | null;
};

/** The homepage as shipped — shown until a Website Builder version is published, and the starting point in the builder. */
export const DEFAULT_LAYOUT: LayoutSection[] = [
  "HERO",
  "BANNER_SLIDER",
  "EXAM_SELECTOR",
  "SEARCH",
  "FREE_RESOURCES",
  "PYQ_HUB",
  "STUDY_MATERIAL",
  "FREE_TESTS",
  "TODAY_SCHEDULE",
  "BATCH_GRID",
  "ATOMIC_GURU",
  "TEACHER_GRID",
  "YOUTUBE",
  "WHY_US",
  "TRUST",
  "APP_DOWNLOAD",
  "BLOG",
  "FAQ",
].map((type) => ({ type, title: null, subtitle: null, config: {} }));
