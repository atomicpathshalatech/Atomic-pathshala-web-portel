export interface SlideTemplate {
  id: string;
  name: string;
  category: "brand" | "ruled" | "math" | "science" | "custom";
  description: string;
  backgroundValue: string; // CSS keyword, or URL (/templates/slides/...)
  thumbnailBg: string;
  icon: string;
}

export const INBUILT_SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: "atomic_dark",
    name: "Atomic Dark Pro",
    category: "brand",
    description: "High-contrast dark teaching theme with Atomic header bar",
    backgroundValue: "atomic_dark",
    thumbnailBg: "bg-[#0d0f17] border-orange-500/40",
    icon: "dark_mode",
  },
  {
    id: "atomic_white",
    name: "Atomic White Crisp",
    category: "brand",
    description: "Classic branded white teaching slide",
    backgroundValue: "atomic_white",
    thumbnailBg: "bg-white text-slate-800 border-orange-500/40",
    icon: "light_mode",
  },
  {
    id: "atomic_ruled",
    name: "Atomic Ruled Notebook",
    category: "ruled",
    description: "Lined paper with header for handwritten notes & derivations",
    backgroundValue: "atomic_ruled",
    thumbnailBg: "bg-amber-50/80 text-slate-800 border-slate-300",
    icon: "format_align_left",
  },
  {
    id: "ruled",
    name: "Classic Ruled Lines",
    category: "ruled",
    description: "Clean standard lined notebook sheet",
    backgroundValue: "ruled",
    thumbnailBg: "bg-white text-slate-800 border-slate-300",
    icon: "subject",
  },
  {
    id: "grid",
    name: "Squared Math Grid",
    category: "math",
    description: "20px squared grid for geometry, algebra & graphs",
    backgroundValue: "grid",
    thumbnailBg: "bg-slate-50 text-slate-800 border-indigo-400/40",
    icon: "grid_4x4",
  },
  {
    id: "coordinate",
    name: "XY Coordinate Graph",
    category: "math",
    description: "Centered XY Cartesian axis with fine grid",
    backgroundValue: "coordinate",
    thumbnailBg: "bg-slate-900 text-blue-400 border-blue-500/40",
    icon: "show_chart",
  },
  {
    id: "dotted",
    name: "Dotted Bullet Matrix",
    category: "math",
    description: "Minimalist dotted matrix for flexible sketching",
    backgroundValue: "dotted",
    thumbnailBg: "bg-slate-100 text-slate-800 border-slate-300",
    icon: "apps",
  },
  {
    id: "dark",
    name: "Pure Dark Studio",
    category: "brand",
    description: "Deep charcoal matte background for eye comfort",
    backgroundValue: "dark",
    thumbnailBg: "bg-[#1a1b23] text-white border-slate-700",
    icon: "desktop_windows",
  },
  {
    id: "light",
    name: "Pure White Clean",
    category: "brand",
    description: "Pure blank canvas for versatile drawings",
    backgroundValue: "light",
    thumbnailBg: "bg-white text-slate-900 border-slate-300",
    icon: "crop_square",
  },
];
