"use client";

import React, { useState } from "react";

interface FormulaInsertToolbarProps {
  onInsert: (snippet: string) => void;
  title?: string;
}

interface FormulaItem {
  label: string;
  display: string;
  latex: string;
}

const MATH_FORMULAS: { category: string; items: FormulaItem[] }[] = [
  {
    category: "Basics & Arithmetic",
    items: [
      { label: "Fraction", display: "a/b", latex: "\\frac{a}{b}" },
      { label: "Exponent", display: "x²", latex: "x^{2}" },
      { label: "Subscript", display: "x₁", latex: "x_{1}" },
      { label: "Square Root", display: "√x", latex: "\\sqrt{x}" },
      { label: "Cube Root", display: "³√x", latex: "\\sqrt[3]{x}" },
      { label: "Plus Minus", display: "±", latex: "\\pm" },
      { label: "Degree", display: "°", latex: "^{\\circ}" },
      { label: "Multiplication", display: "×", latex: "\\times" },
      { label: "Division", display: "÷", latex: "\\div" },
      { label: "Not Equal", display: "≠", latex: "\\neq" },
      { label: "Approx Equal", display: "≈", latex: "\\approx" },
      { label: "Less/Equal", display: "≤", latex: "\\le" },
      { label: "Greater/Equal", display: "≥", latex: "\\ge" },
      { label: "Infinity", display: "∞", latex: "\\infty" },
    ],
  },
  {
    category: "Greek Symbols & Trig",
    items: [
      { label: "Theta", display: "θ", latex: "\\theta" },
      { label: "Alpha", display: "α", latex: "\\alpha" },
      { label: "Beta", display: "β", latex: "\\beta" },
      { label: "Gamma", display: "γ", latex: "\\gamma" },
      { label: "Delta", display: "Δ", latex: "\\Delta" },
      { label: "Lambda", display: "λ", latex: "\\lambda" },
      { label: "Pi", display: "π", latex: "\\pi" },
      { label: "Mu", display: "μ", latex: "\\mu" },
      { label: "Omega", display: "Ω", latex: "\\Omega" },
      { label: "Sin", display: "sin θ", latex: "\\sin\\theta" },
      { label: "Cos", display: "cos θ", latex: "\\cos\\theta" },
      { label: "Tan", display: "tan θ", latex: "\\tan\\theta" },
    ],
  },
  {
    category: "Calculus, Vectors & Matrices",
    items: [
      { label: "Definite Integral", display: "∫ a to b", latex: "\\int_{a}^{b} f(x)\\,dx" },
      { label: "Derivative", display: "dy/dx", latex: "\\frac{dy}{dx}" },
      { label: "Partial Derivative", display: "∂y/∂x", latex: "\\frac{\\partial y}{\\partial x}" },
      { label: "Limit", display: "lim x→0", latex: "\\lim_{x \\to 0}" },
      { label: "Summation", display: "∑ i=1 to n", latex: "\\sum_{i=1}^{n}" },
      { label: "Vector", display: "v⃗", latex: "\\vec{v}" },
      { label: "2x2 Matrix", display: "[2x2]", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
    ],
  },
];

const PHYSICS_FORMULAS: { category: string; items: FormulaItem[] }[] = [
  {
    category: "Kinematics & Mechanics",
    items: [
      { label: "Velocity", display: "v = u + at", latex: "v = u + at" },
      { label: "Displacement", display: "s = ut + ½at²", latex: "s = ut + \\frac{1}{2}at^2" },
      { label: "Velocity Squared", display: "v² = u² + 2as", latex: "v^2 = u^2 + 2as" },
      { label: "Newton's 2nd Law", display: "F = ma", latex: "F = ma" },
      { label: "Kinetic Energy", display: "Ek = ½mv²", latex: "E_k = \\frac{1}{2}mv^2" },
      { label: "Potential Energy", display: "Ep = mgh", latex: "E_p = mgh" },
      { label: "Momentum", display: "p = mv", latex: "p = mv" },
    ],
  },
  {
    category: "Electromagnetism & Waves",
    items: [
      { label: "Ohm's Law", display: "V = IR", latex: "V = IR" },
      { label: "Electric Power", display: "P = VI = I²R", latex: "P = VI = I^2 R" },
      { label: "Capacitance", display: "C = ε₀A/d", latex: "C = \\frac{\\varepsilon_0 A}{d}" },
      { label: "Lorentz Force", display: "F = q(E + v×B)", latex: "\\vec{F} = q(\\vec{E} + \\vec{v} \\times \\vec{B})" },
      { label: "Time Period (Pendulum)", display: "T = 2π√(l/g)", latex: "T = 2\\pi\\sqrt{\\frac{l}{g}}" },
      { label: "Einstein Energy", display: "E = mc²", latex: "E = mc^2" },
      { label: "Photon Energy", display: "E = hν", latex: "E = h\\nu" },
      { label: "de Broglie Wavelength", display: "λ = h/p", latex: "\\lambda = \\frac{h}{p}" },
    ],
  },
  {
    category: "Units & Dimensions",
    items: [
      { label: "Acceleration", display: "m/s²", latex: "\\text{m/s}^2" },
      { label: "Ohm", display: "Ω", latex: "\\Omega" },
      { label: "Microfarad", display: "μF", latex: "\\mu\\text{F}" },
      { label: "Volt", display: "V", latex: "\\text{V}" },
      { label: "Joule", display: "J", latex: "\\text{J}" },
      { label: "Watt", display: "W", latex: "\\text{W}" },
      { label: "Newton", display: "N", latex: "\\text{N}" },
    ],
  },
];

const CHEMISTRY_FORMULAS: { category: string; items: FormulaItem[] }[] = [
  {
    category: "Reaction Arrows & Conditions",
    items: [
      { label: "Reaction Arrow", display: "→", latex: "\\rightarrow" },
      { label: "Equilibrium", display: "⇌", latex: "\\rightleftharpoons" },
      { label: "Heat / Delta", display: "Δ →", latex: "\\xrightarrow{\\Delta}" },
      { label: "Gas Evolution", display: "↑", latex: "\\uparrow" },
      { label: "Precipitate", display: "↓", latex: "\\downarrow" },
      { label: "Catalyst (Ni/H₂)", display: "Ni/H₂ →", latex: "\\xrightarrow{\\text{Ni/H}_2}" },
    ],
  },
  {
    category: "Common Inorganic Compounds",
    items: [
      { label: "Sulfuric Acid", display: "H₂SO₄", latex: "\\text{H}_2\\text{SO}_4" },
      { label: "Water", display: "H₂O", latex: "\\text{H}_2\\text{O}" },
      { label: "Calcium Carbonate", display: "CaCO₃", latex: "\\text{CaCO}_3" },
      { label: "Potassium Permanganate", display: "KMnO₄", latex: "\\text{KMnO}_4" },
      { label: "Nitric Acid", display: "HNO₃", latex: "\\text{HNO}_3" },
      { label: "Hydrochloric Acid", display: "HCl", latex: "\\text{HCl}" },
      { label: "Sodium Hydroxide", display: "NaOH", latex: "\\text{NaOH}" },
    ],
  },
  {
    category: "Ionic Charges & Organic Notation",
    items: [
      { label: "Calcium 2+", display: "Ca²⁺", latex: "\\text{Ca}^{2+}" },
      { label: "Sulfate 2-", display: "SO₄²⁻", latex: "\\text{SO}_4^{2-}" },
      { label: "Sodium +", display: "Na⁺", latex: "\\text{Na}^+" },
      { label: "Chloride -", display: "Cl⁻", latex: "\\text{Cl}^-" },
      { label: "Ferric 3+", display: "Fe³⁺", latex: "\\text{Fe}^{3+}" },
      { label: "Single Bond", display: "C-C", latex: "\\text{C}-\\text{C}" },
      { label: "Double Bond", display: "C=C", latex: "\\text{C}=\\text{C}" },
      { label: "Triple Bond", display: "C≡C", latex: "\\text{C}\\equiv\\text{C}" },
      { label: "Benzene", display: "C₆H₆", latex: "\\text{C}_6\\text{H}_6" },
    ],
  },
];

export function FormulaInsertToolbar({ onInsert, title = "Insert Equation / Symbol" }: FormulaInsertToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"MATH" | "PHYSICS" | "CHEMISTRY">("MATH");

  const handleSelect = (latex: string) => {
    onInsert(latex);
  };

  return (
    <div className="relative inline-block">
      {/* Plus Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={title}
        className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-bold transition flex items-center gap-1 shadow-sm"
      >
        <span className="material-symbols-outlined text-sm">add_circle</span>
        <span>+ Formula &amp; Symbols</span>
      </button>

      {/* Popover Equation Palette */}
      {isOpen && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-12 z-50 sm:w-[480px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-blue-600">functions</span>
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Maths, Physics &amp; Chemistry Formula Palette
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold"
            >
              ✕
            </button>
          </div>

          {/* Subject Tab Switcher */}
          <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("MATH")}
              className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1 ${
                activeTab === "MATH"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">calculate</span>
              <span>Mathematics</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PHYSICS")}
              className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1 ${
                activeTab === "PHYSICS"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              <span>Physics</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CHEMISTRY")}
              className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1 ${
                activeTab === "CHEMISTRY"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">science</span>
              <span>Chemistry</span>
            </button>
          </div>

          {/* Formulas Grid */}
          <div className="max-h-64 overflow-y-auto space-y-3.5 pr-1 text-xs">
            {(activeTab === "MATH"
              ? MATH_FORMULAS
              : activeTab === "PHYSICS"
              ? PHYSICS_FORMULAS
              : CHEMISTRY_FORMULAS
            ).map((sec) => (
              <div key={sec.category} className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {sec.category}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {sec.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleSelect(item.latex)}
                      title={`Insert ${item.latex}`}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 hover:border-blue-300 transition font-mono text-xs flex items-center gap-1"
                    >
                      <span className="font-bold">{item.display}</span>
                      <span className="text-[9px] text-slate-400 font-sans">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800 text-center font-medium">
            Click any symbol or equation above to insert it at cursor position.
          </div>
        </div>
      )}
    </div>
  );
}
