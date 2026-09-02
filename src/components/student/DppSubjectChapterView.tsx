"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export interface DPPItem {
  id: string;
  dppNumber: number;
  title: string;
  questionCount: number;
  durationMins: number;
  totalMarks: number;
  difficulty: "Fundamental" | "Moderate" | "NEET Booster";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  score?: number | null;
  pdfUrl?: string | null;
  solutionUrl?: string | null;
  testId?: string | null;
}

export interface ChapterDPPGroup {
  id: string;
  chapterNumber: number;
  title: string;
  dpps: DPPItem[];
}

export interface SubjectDPPData {
  id: string;
  name: "Physics" | "Chemistry" | "Biology";
  icon: string;
  color: string;
  gradient: string;
  badgeBg: string;
  chapters: ChapterDPPGroup[];
}

const DEFAULT_SUBJECTS_DATA: SubjectDPPData[] = [
  {
    id: "phy",
    name: "Physics",
    icon: "bolt",
    color: "text-blue-500",
    gradient: "from-blue-600 to-indigo-600",
    badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    chapters: [
      {
        id: "phy-ch1",
        chapterNumber: 1,
        title: "Units & Dimensions and Measurement",
        dpps: [
          { id: "p-1-1", dppNumber: 1, title: "Dimensional Analysis & Principle of Homogeneity", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "COMPLETED", score: 56 },
          { id: "p-1-2", dppNumber: 2, title: "Significant Figures & Error Propagation", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "p-1-3", dppNumber: 3, title: "Vernier Calipers & Screw Gauge Vernier", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "phy-ch2",
        chapterNumber: 2,
        title: "Motion in a Straight Line (Kinematics 1D)",
        dpps: [
          { id: "p-2-1", dppNumber: 1, title: "Speed, Average Velocity & Instantaneous Acceleration", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "COMPLETED", score: 48 },
          { id: "p-2-2", dppNumber: 2, title: "Kinematic Equations for Uniform Acceleration", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "IN_PROGRESS" },
          { id: "p-2-3", dppNumber: 3, title: "Motion Under Gravity & Reaction Time Problems", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
          { id: "p-2-4", dppNumber: 4, title: "Position-Time (x-t) & Velocity-Time (v-t) Graph Analysis", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "phy-ch3",
        chapterNumber: 3,
        title: "Motion in a Plane (Vectors & Projectile Motion)",
        dpps: [
          { id: "p-3-1", dppNumber: 1, title: "Vector Operations, Dot & Cross Product in Cartesian Coordinates", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "PENDING" },
          { id: "p-3-2", dppNumber: 2, title: "Oblique Projectile Motion: Range, Height & Time of Flight", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "p-3-3", dppNumber: 3, title: "Relative Motion in 2D (Rain-Man & River-Boat Problems)", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "phy-ch4",
        chapterNumber: 4,
        title: "Laws of Motion & Friction",
        dpps: [
          { id: "p-4-1", dppNumber: 1, title: "Free Body Diagrams (FBD) & Newton's Second Law", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "PENDING" },
          { id: "p-4-2", dppNumber: 2, title: "Connected Pulley-Block Systems & Pseudo Force", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "p-4-3", dppNumber: 3, title: "Static, Limiting & Kinetic Friction on Inclined Planes", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "phy-ch5",
        chapterNumber: 5,
        title: "Work, Energy and Power",
        dpps: [
          { id: "p-5-1", dppNumber: 1, title: "Work done by Constant & Variable Forces", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "PENDING" },
          { id: "p-5-2", dppNumber: 2, title: "Work-Energy Theorem & Conservation of Mechanical Energy", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "p-5-3", dppNumber: 3, title: "Power & 1D/2D Elastic and Inelastic Collisions", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "phy-ch6",
        chapterNumber: 6,
        title: "Ray Optics and Optical Instruments",
        dpps: [
          { id: "p-6-1", dppNumber: 1, title: "Reflection at Spherical Mirrors & Mirror Formula", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "PENDING" },
          { id: "p-6-2", dppNumber: 2, title: "Refraction, Total Internal Reflection (TIR) & Prism Dispersion", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "p-6-3", dppNumber: 3, title: "Lens Maker Formula & Optical Instruments (Microscope/Telescope)", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
    ],
  },
  {
    id: "chem",
    name: "Chemistry",
    icon: "science",
    color: "text-amber-500",
    gradient: "from-amber-500 to-orange-600",
    badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    chapters: [
      {
        id: "chem-ch1",
        chapterNumber: 1,
        title: "Some Basic Concepts of Chemistry (Mole Concept)",
        dpps: [
          { id: "c-1-1", dppNumber: 1, title: "Molar Mass, Mole Conversions & Number of Molecules", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "COMPLETED", score: 60 },
          { id: "c-1-2", dppNumber: 2, title: "Empirical & Molecular Formula Calculations", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "c-1-3", dppNumber: 3, title: "Stoichiometry, Limiting Reagent & Percentage Yield", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
          { id: "c-1-4", dppNumber: 4, title: "Concentration Terms: Molarity, Molality, Mole Fraction & ppm", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "chem-ch2",
        chapterNumber: 2,
        title: "Structure of Atom",
        dpps: [
          { id: "c-2-1", dppNumber: 1, title: "Photoelectric Effect & Bohr's Model Calculations", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "COMPLETED", score: 52 },
          { id: "c-2-2", dppNumber: 2, title: "de-Broglie Wavelength & Heisenberg Uncertainty Principle", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "c-2-3", dppNumber: 3, title: "Quantum Numbers, Aufbau Principle & Pauli's Exclusion", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "chem-ch3",
        chapterNumber: 3,
        title: "Chemical Bonding and Molecular Structure",
        dpps: [
          { id: "c-3-1", dppNumber: 1, title: "Lewis Dot Structures & Formal Charge Calculations", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "PENDING" },
          { id: "c-3-2", dppNumber: 2, title: "VSEPR Theory & Molecular Geometry Prediction", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "c-3-3", dppNumber: 3, title: "Hybridization ($sp, sp^2, sp^3, sp^3d$) & Dipole Moments", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
          { id: "c-3-4", dppNumber: 4, title: "Molecular Orbital Theory (MOT) & Bond Order Analysis", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "chem-ch4",
        chapterNumber: 4,
        title: "Organic Chemistry: Principles & Techniques (GOC)",
        dpps: [
          { id: "c-4-1", dppNumber: 1, title: "IUPAC Nomenclature of Multifunctional Organic Compounds", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "PENDING" },
          { id: "c-4-2", dppNumber: 2, title: "Structural Isomerism & Geometrical/Optical Stereoisomerism", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "c-4-3", dppNumber: 3, title: "Electronic Effects: Inductive (+I/-I) & Resonance (+M/-M)", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
          { id: "c-4-4", dppNumber: 4, title: "Carbocation, Carbanion & Free Radical Stability with Acidic/Basic Strength", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "chem-ch5",
        chapterNumber: 5,
        title: "Hydrocarbons & Aromatic Benzene Chemistry",
        dpps: [
          { id: "c-5-1", dppNumber: 1, title: "Alkanes & Free Radical Halogenation Mechanism", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Fundamental", status: "PENDING" },
          { id: "c-5-2", dppNumber: 2, title: "Alkenes: Markovnikov vs Anti-Markovnikov & Ozonolysis", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "Moderate", status: "PENDING" },
          { id: "c-5-3", dppNumber: 3, title: "Benzene: Electrophilic Aromatic Substitution (Nitration, Friedel-Crafts)", questionCount: 15, durationMins: 45, totalMarks: 60, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
    ],
  },
  {
    id: "bio",
    name: "Biology",
    icon: "biotech",
    color: "text-emerald-500",
    gradient: "from-emerald-500 to-teal-600",
    badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    chapters: [
      {
        id: "bio-ch1",
        chapterNumber: 1,
        title: "The Living World & Biological Classification",
        dpps: [
          { id: "b-1-1", dppNumber: 1, title: "Taxonomical Hierarchy, Herbarium & Binomial Nomenclature", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Fundamental", status: "COMPLETED", score: 76 },
          { id: "b-1-2", dppNumber: 2, title: "Kingdom Monera: Archaebacteria, Eubacteria & Cyanobacteria", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Moderate", status: "PENDING" },
          { id: "b-1-3", dppNumber: 3, title: "Kingdom Protista, Fungi (Classes) & Lichens / Viruses", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "bio-ch2",
        chapterNumber: 2,
        title: "Cell: The Unit of Life & Cell Cycle",
        dpps: [
          { id: "b-2-1", dppNumber: 1, title: "Plasma Membrane Fluid Mosaic Model & Cell Wall", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Fundamental", status: "COMPLETED", score: 80 },
          { id: "b-2-2", dppNumber: 2, title: "Endomembrane System: ER, Golgi Apparatus, Lysosomes & Vacuoles", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Moderate", status: "IN_PROGRESS" },
          { id: "b-2-3", dppNumber: 3, title: "Mitochondria, Plastids, Ribosomes & Cytoskeleton", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Moderate", status: "PENDING" },
          { id: "b-2-4", dppNumber: 4, title: "Mitosis, Meiosis Stages & Crossing Over in Pachytene", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "bio-ch3",
        chapterNumber: 3,
        title: "Human Physiology: Breathing & Exchange of Gases",
        dpps: [
          { id: "b-3-1", dppNumber: 1, title: "Human Respiratory System Anatomy & Mechanism of Breathing", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Fundamental", status: "PENDING" },
          { id: "b-3-2", dppNumber: 2, title: "Respiratory Volumes: TV, IRV, ERV, RV, VC & TLC", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Moderate", status: "PENDING" },
          { id: "b-3-3", dppNumber: 3, title: "Oxygen-Hemoglobin Dissociation Curve & Respiratory Disorders", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "bio-ch4",
        chapterNumber: 4,
        title: "Human Physiology: Body Fluids & Circulation",
        dpps: [
          { id: "b-4-1", dppNumber: 1, title: "Formed Elements of Blood, ABO & Rh Blood Grouping", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Fundamental", status: "PENDING" },
          { id: "b-4-2", dppNumber: 2, title: "Human Heart Structure, Cardiac Cycle & Double Circulation", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Moderate", status: "PENDING" },
          { id: "b-4-3", dppNumber: 3, title: "Electrocardiogram (ECG) Waves Analysis & Cardiovascular Disorders", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
      {
        id: "bio-ch5",
        chapterNumber: 5,
        title: "Molecular Basis of Inheritance (Genetics)",
        dpps: [
          { id: "b-5-1", dppNumber: 1, title: "DNA Double Helix Structure & Nucleosome Packaging", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Fundamental", status: "PENDING" },
          { id: "b-5-2", dppNumber: 2, title: "Griffith & Hershey-Chase Genetic Material Experiments", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "Moderate", status: "PENDING" },
          { id: "b-5-3", dppNumber: 3, title: "DNA Replication Fork Enzymes & Semiconservative Mechanism", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "NEET Booster", status: "PENDING" },
          { id: "b-5-4", dppNumber: 4, title: "Transcription, Genetic Code, Translation & Lac Operon", questionCount: 20, durationMins: 40, totalMarks: 80, difficulty: "NEET Booster", status: "PENDING" },
        ],
      },
    ],
  },
];

export function DppSubjectChapterView({
  dbDpps = [],
}: {
  dbDpps?: any[];
}) {
  const [selectedSubject, setSelectedSubject] = useState<"Physics" | "Chemistry" | "Biology">("Physics");
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({
    "phy-ch1": true,
    "chem-ch1": true,
    "bio-ch1": true,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const activeSubjectData = DEFAULT_SUBJECTS_DATA.find((s) => s.name === selectedSubject) || DEFAULT_SUBJECTS_DATA[0]!;

  // Filter chapters by search
  const filteredChapters = activeSubjectData.chapters.filter((ch) =>
    ch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.dpps.some((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Overall Stats
  const totalDppsInActiveSubject = activeSubjectData.chapters.reduce((sum, ch) => sum + ch.dpps.length, 0);
  const completedDppsInActiveSubject = activeSubjectData.chapters.reduce(
    (sum, ch) => sum + ch.dpps.filter((d) => d.status === "COMPLETED").length,
    0
  );

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. HORIZONTAL SUBJECT SELECTOR TABS (PHYSICS, CHEMISTRY, BIOLOGY)         */}
      {/* ========================================================================= */}
      <div className="bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-3xl p-2.5 shadow-sm">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {DEFAULT_SUBJECTS_DATA.map((subj) => {
            const isSelected = selectedSubject === subj.name;
            const totalCount = subj.chapters.reduce((sum, ch) => sum + ch.dpps.length, 0);
            const doneCount = subj.chapters.reduce((sum, ch) => sum + ch.dpps.filter((d) => d.status === "COMPLETED").length, 0);

            return (
              <button
                key={subj.id}
                type="button"
                onClick={() => setSelectedSubject(subj.name)}
                className={`relative flex flex-col sm:flex-row items-center justify-center sm:justify-between p-3 sm:px-5 sm:py-3.5 rounded-2xl transition-all duration-200 text-center sm:text-left ${
                  isSelected
                    ? `bg-gradient-to-r ${subj.gradient} text-white shadow-lg shadow-primary/20 scale-[1.02]`
                    : "bg-surface-container-low dark:bg-slate-800/60 hover:bg-surface-container text-on-surface hover:text-primary border border-outline-variant/20"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-2xl ${isSelected ? "text-white" : subj.color}`}>
                    {subj.icon}
                  </span>
                  <div>
                    <h3 className="font-headline-sm text-sm sm:text-base font-bold leading-tight">
                      {subj.name}
                    </h3>
                    <p className={`text-[10px] sm:text-xs ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                      {subj.chapters.length} Chapters
                    </p>
                  </div>
                </div>

                {/* Progress Mini Badge */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold mt-2 sm:mt-0">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${isSelected ? "bg-white/20 text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                    {doneCount}/{totalCount} Done
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUBJECT HEADER & QUICK SEARCH / STATS BAR                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className={`material-symbols-outlined text-3xl ${activeSubjectData.color}`}>
            {activeSubjectData.icon}
          </span>
          <div>
            <h2 className="font-headline-md text-lg font-bold text-on-surface">
              {activeSubjectData.name} — Chapterwise DPP Repository
            </h2>
            <p className="text-xs text-on-surface-variant">
              Targeted daily practice problems categorized strictly by NCERT chapters.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chapter or topic..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low dark:bg-slate-800 border border-outline-variant/40 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CHAPTERS LIST WITH CHAPTERWISE DPP CARDS                               */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {filteredChapters.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant space-y-2">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/50">search_off</span>
            <p className="font-bold text-sm text-on-surface">No chapters found</p>
            <p className="text-xs">No chapter matches your search query &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          filteredChapters.map((chapter) => {
            const isExpanded = !!expandedChapters[chapter.id];
            const chapterCompleted = chapter.dpps.filter((d) => d.status === "COMPLETED").length;

            return (
              <div
                key={chapter.id}
                className="bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-3xl overflow-hidden shadow-sm transition-all"
              >
                {/* Chapter Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-surface-container-low dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                      {chapter.chapterNumber}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface truncate">
                        Chapter {chapter.chapterNumber}: {chapter.title}
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        {chapter.dpps.length} Practice Papers &middot; {chapterCompleted}/{chapter.dpps.length} Completed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      chapterCompleted === chapter.dpps.length && chapter.dpps.length > 0
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}>
                      {chapterCompleted === chapter.dpps.length && chapter.dpps.length > 0 ? "All Done" : `${chapterCompleted}/${chapter.dpps.length}`}
                    </span>
                    <span className={`material-symbols-outlined text-xl text-on-surface-variant transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                      keyboard_arrow_down
                    </span>
                  </div>
                </button>

                {/* Chapter DPP Cards Grid */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 border-t border-outline-variant/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                      {chapter.dpps.map((dpp) => {
                        return (
                          <div
                            key={dpp.id}
                            className="bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 rounded-2xl p-4 flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all group"
                          >
                            <div className="space-y-2">
                              {/* DPP Badges Header */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary font-black text-xs">
                                  DPP {dpp.dppNumber < 10 ? `0${dpp.dppNumber}` : dpp.dppNumber}
                                </span>

                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    dpp.difficulty === "Fundamental"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      : dpp.difficulty === "Moderate"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-extrabold"
                                  }`}
                                >
                                  {dpp.difficulty}
                                </span>
                              </div>

                              {/* Title */}
                              <h4 className="font-bold text-xs sm:text-sm text-on-surface leading-snug line-clamp-2">
                                {dpp.title}
                              </h4>

                              {/* Meta Details */}
                              <div className="flex items-center gap-3 text-[11px] text-on-surface-variant pt-1">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm text-primary">quiz</span>
                                  {dpp.questionCount} Qs
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm text-primary">timer</span>
                                  {dpp.durationMins} Mins
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm text-primary">military_tech</span>
                                  {dpp.totalMarks} Marks
                                </span>
                              </div>
                            </div>

                            {/* Actions & Status Footer */}
                            <div className="pt-4 mt-2 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                              {dpp.status === "COMPLETED" ? (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                  <span className="material-symbols-outlined text-base">check_circle</span>
                                  <span>Score: {dpp.score}/{dpp.totalMarks}</span>
                                </div>
                              ) : dpp.status === "IN_PROGRESS" ? (
                                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
                                  <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                                  <span>In Progress</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-on-surface-variant font-medium">
                                  Not Started
                                </span>
                              )}

                              <div className="flex items-center gap-1.5">
                                {/* Download PDF Action */}
                                <button
                                  type="button"
                                  onClick={() => toast.success(`Downloading DPP ${dpp.dppNumber} PDF Worksheet...`)}
                                  className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container text-on-surface-variant hover:text-primary transition"
                                  title="Download DPP PDF Worksheet"
                                >
                                  <span className="material-symbols-outlined text-sm">download</span>
                                </button>

                                {/* Attempt / Practice Button */}
                                <Link
                                  href={`/practice?subject=${activeSubjectData.name.toLowerCase()}&chapter=${chapter.chapterNumber}&dpp=${dpp.dppNumber}`}
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-sm ${
                                    dpp.status === "COMPLETED"
                                      ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                                      : "bg-primary text-on-primary hover:opacity-90 active:scale-95"
                                  }`}
                                >
                                  {dpp.status === "COMPLETED" ? "Re-attempt" : dpp.status === "IN_PROGRESS" ? "Resume" : "Attempt Now"}
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
