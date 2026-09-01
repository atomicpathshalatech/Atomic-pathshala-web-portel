"use client";

import React, { useState } from "react";

export function SyllabusSection() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    physical: true,
    organic: false,
    inorganic: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const units = [
    {
      key: "physical",
      title: "Physical Chemistry",
      meta: "12 Chapters • 45 Lectures • 15 Notes",
      chapters: [
        {
          name: "Some Basic Concepts of Chemistry (Mole Concept)",
          lectures: 6,
          duration: "4h 30m",
          isPreview: true,
          notesCount: 2,
        },
        {
          name: "Structure of Atom & Quantum Numbers",
          lectures: 8,
          duration: "6h 15m",
          isPreview: false,
          notesCount: 3,
        },
        {
          name: "Chemical Thermodynamics & Energetics",
          lectures: 9,
          duration: "7h 00m",
          isPreview: false,
          notesCount: 3,
        },
        {
          name: "Equilibrium (Chemical & Ionic Equilibrium)",
          lectures: 10,
          duration: "8h 15m",
          isPreview: false,
          notesCount: 4,
        },
        {
          name: "Redox Reactions & Electrochemistry",
          lectures: 7,
          duration: "5h 45m",
          isPreview: false,
          notesCount: 2,
        },
        {
          name: "Chemical Kinetics & Surface Chemistry",
          lectures: 5,
          duration: "4h 00m",
          isPreview: false,
          notesCount: 2,
        },
      ],
    },
    {
      key: "inorganic",
      title: "Inorganic Chemistry",
      meta: "8 Chapters • 35 Lectures • 12 Notes",
      chapters: [
        {
          name: "Classification of Elements & Periodicity",
          lectures: 5,
          duration: "3h 45m",
          isPreview: false,
          notesCount: 2,
        },
        {
          name: "Chemical Bonding and Molecular Structure",
          lectures: 10,
          duration: "8h 20m",
          isPreview: true,
          notesCount: 4,
        },
        {
          name: "p-Block Elements (Group 13 to 18)",
          lectures: 8,
          duration: "6h 30m",
          isPreview: false,
          notesCount: 3,
        },
        {
          name: "d & f Block Elements & Coordination Compounds",
          lectures: 12,
          duration: "9h 15m",
          isPreview: false,
          notesCount: 4,
        },
      ],
    },
    {
      key: "organic",
      title: "Organic Chemistry",
      meta: "15 Chapters • 58 Lectures • 20 Notes",
      chapters: [
        {
          name: "General Organic Chemistry (GOC & Reaction Mechanisms)",
          lectures: 14,
          duration: "11h 00m",
          isPreview: true,
          notesCount: 5,
        },
        {
          name: "Hydrocarbons (Alkanes, Alkenes, Alkynes, Arenes)",
          lectures: 8,
          duration: "6h 20m",
          isPreview: false,
          notesCount: 3,
        },
        {
          name: "Haloalkanes and Haloarenes",
          lectures: 6,
          duration: "4h 45m",
          isPreview: false,
          notesCount: 2,
        },
        {
          name: "Alcohols, Phenols and Ethers",
          lectures: 7,
          duration: "5h 30m",
          isPreview: false,
          notesCount: 3,
        },
        {
          name: "Aldehydes, Ketones and Carboxylic Acids",
          lectures: 9,
          duration: "7h 15m",
          isPreview: false,
          notesCount: 3,
        },
        {
          name: "Biomolecules & Principles of Practical Chemistry",
          lectures: 5,
          duration: "3h 50m",
          isPreview: false,
          notesCount: 2,
        },
      ],
    },
  ];

  return (
    <section id="syllabus" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">format_list_bulleted</span>
            <span>Comprehensive Course Syllabus</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Structured strictly according to NCERT Class 11 & 12 + NEET/JEE weightage.
          </p>
        </div>

        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
          35 Chapters • 128 Lectures Total
        </span>
      </div>

      {/* Accordion Units */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200">
        {units.map((unit) => {
          const isOpen = openSections[unit.key];
          return (
            <div key={unit.key} className="bg-white">
              <button
                type="button"
                onClick={() => toggleSection(unit.key)}
                className="w-full flex items-center justify-between p-4 sm:p-5 bg-slate-50/70 hover:bg-slate-100/80 transition text-left"
              >
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-[#031635]">{unit.title}</h3>
                  <span className="text-xs text-slate-500 font-medium">{unit.meta}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined text-slate-500 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </div>
              </button>

              {isOpen && (
                <ul className="divide-y divide-slate-100 bg-white">
                  {unit.chapters.map((ch, idx) => (
                    <li
                      key={ch.name}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`material-symbols-outlined text-base mt-0.5 ${
                            ch.isPreview ? "text-purple-600" : "text-slate-400"
                          }`}
                        >
                          {ch.isPreview ? "play_circle" : "description"}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-[#031635]">
                              {idx + 1}. {ch.name}
                            </span>
                            {ch.isPreview && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#9ff5c1] text-[#005231]">
                                FREE TRIAL
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {ch.lectures} Classes • {ch.duration} • {ch.notesCount} High-Yield Notes
                          </span>
                        </div>
                      </div>

                      {ch.isPreview ? (
                        <a
                          href="#trial"
                          className="px-3 py-1 rounded-full border border-[#031635] text-[#031635] font-bold text-xs hover:bg-[#031635] hover:text-white transition whitespace-nowrap"
                        >
                          Preview
                        </a>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold">
                          <span className="material-symbols-outlined text-sm">lock</span>
                          <span className="hidden sm:inline">Locked</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}