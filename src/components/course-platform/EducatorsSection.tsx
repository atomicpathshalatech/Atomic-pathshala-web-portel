"use client";

import React from "react";
import Link from "next/link";

export function EducatorsSection() {
  const educators = [
    {
      name: "Sonu Bhaiya",
      slug: "sonu-bhaiya",
      role: "Physical & Inorganic Chemistry Expert",
      experience: "10+ Years Teaching Experience",
      students: "59K+ Students Mentored",
      bio: "Master of simplifying tough physical chemistry concepts and reaction mechanisms for NEET/JEE top rankers.",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCZKdBj2IsPErKfQTp48yFowzht10U7RsBVEP1U5h0Izibw6Klo_fTxxtujK1GLIdUzoL0Z3inGUyIwoU1gNbDzHjsLxJM7bQ1T7BKLwe1UlxyQji3uGylVRl_HcQZVz471X5WWRrJK29I-_t4fPPxOPvIeV9-e8IjVrUWAGTmsaQHQfV0E9kHtg9gP1sYF9QYZ1N6jPdAxfCDMA7V3WNABSygvaoqUOkmsM9I8QDfQOVYZhWjPvrTsZA",
      stats: ["AIR 14 (NEET 2023)", "AIR 89 (NEET 2024)"],
    },
    {
      name: "Dr. Priya Sharma",
      slug: "dr-priya-sharma",
      role: "Organic Chemistry Specialist",
      experience: "8+ Years Teaching Experience",
      students: "42K+ Students Mentored",
      bio: "Ph.D. in Organic Chemistry with a renowned visual approach for IUPAC, stereochemistry, and multi-step conversions.",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCZcBKhTrZHr_TYOLdy0dmPQKHFuenw4ezk2LWQOdptsS40fosVNLgW8nJilUc947BMllnDM_z7qAvYHeLJbLL7_aNsQEh-2hBdYp6huZDtn9JakqYdgtPV04vggH-nxyUU6sJc9q65yhBjzntQzloV5IkxnlQK3bO1ruPtQFXJf_jM6QdbU6YYFEl3-t-E5KVUm0MUQx7QkV-_loVgYXlzOouHlXM1thgezR-xHWTMe2ZRXEVb_hQy1A",
      stats: ["Ph.D. CSIR-NET", "Top Faculty Award"],
    },
  ];

  return (
    <section id="educators" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-600">psychology</span>
          <span>Learn From Expert Educators</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          India&apos;s leading chemistry faculty with proven track records of AIR top-100 results.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {educators.map((edu) => (
          <div
            key={edu.name}
            className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={edu.imageUrl}
                  alt={edu.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
                />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#031635]">{edu.name}</h3>
                  <p className="text-xs text-[#6b46c1] font-bold">{edu.role}</p>
                  <p className="text-[11px] text-slate-500">{edu.experience}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{edu.bio}</p>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#e7eeff] text-[#031635]">
                  {edu.students}
                </span>
                {edu.stats.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#9ff5c1] text-[#005231]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Free trial class available</span>
              <button
                type="button"
                className="text-xs font-bold text-[#6b46c1] hover:text-[#5b3da5] flex items-center gap-1"
              >
                <span>View Profile</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}