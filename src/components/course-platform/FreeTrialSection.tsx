"use client";

import React, { useState } from "react";
import Link from "next/link";

export function FreeTrialSection() {
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const trialClasses = [
    {
      id: "trial-1",
      title: "VSEPR Theory & Molecular Geometry Simplified",
      subject: "Chemical Bonding",
      teacher: "Sonu Bhaiya",
      duration: "45 mins",
      views: "14.2K students watched",
      thumbnail:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuD7YAZXVaHigh3RrfotJ1dphorsBl-gSAYvezYpMeV9rQSbQKvPk-AIGgvAUIs_j2OwoO9mv1RtVt-gCvSEP_621X3MnJUCxljXh4RIY-I6RaAwuw1s2rbJcbhRmE4zZjf-Kggrln5NK6LDAzGkCCjaRiQg-wlkb4AQglZ6CtSX0C6SOktuBjAPPjgF7jbnrTLR698i6gAjdpvYGjyIQzSwQYShpDlSqaTeKmUrHC3GKWAEUHK02G85AQ",
    },
    {
      id: "trial-2",
      title: "Mole Concept — 3 Easy Tricks to Solve any Problem in 30 Seconds",
      subject: "Some Basic Concepts",
      teacher: "Sonu Bhaiya",
      duration: "38 mins",
      views: "22.8K students watched",
      thumbnail:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA55rkd5wCltZobTytnsHzMyuy8waC1hw-J_L-zUTj5m0d0y1tJ19GdKzVawO1-j1UY4Ig2rH6TApo6BSKTsKzwZR9e25Gv9-dfkNm3vXfQRFMCGe8pSK6wq-hksTUzspyp3E0H22n8Ni8Kez8nEppOr_ahBNRCqwyZRdZTvMFzrlzd5cR_zERfcsvwnS0O24Q1ZWn5gkixq1MM_5B4OraSGu7fdEvScZz8rc6jps0X0suSHy_TR9jVuw",
    },
    {
      id: "trial-3",
      title: "GOC — Inductive Effect & Carbocation Stability",
      subject: "Organic Chemistry",
      teacher: "Dr. Priya Sharma",
      duration: "52 mins",
      views: "18.5K students watched",
      thumbnail:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuC5ktTrIRpcdo4b2S3Rb-l69bUtwaKMLFyvDWFclrVX1_J6NTPOe4HC03SFr12Dd-yNYK5YnecJET1c5K2kU4Y3-sa1QbBJ5b0k2LO9li5qbqq87FcJHKrsZ0PySNYtVCNNMg_lHoS5pYpKnNW3xdjs8M-dO1DWGdwNEOWsoc4zTIRFcMSXQrwISZiZOtRZGnA5HxIEaIXsBBeCleS7Yc31vnDtIG2a80rCnn3OXtInJ0HoGkG2z-Jw0w",
    },
  ];

  return (
    <section id="trial" className="bg-gradient-to-br from-[#031635] via-[#1a2b4b] to-[#031635] text-white rounded-3xl p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#9ff5c1] text-[#005231] font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              100% Free Access
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
            Try Before You Buy — Free Full Lectures
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Experience our interactive teaching pedagogy without any payment or credit card.
          </p>
        </div>

        <span className="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full self-start sm:self-auto">
          No Login Required
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {trialClasses.map((cls) => (
          <div
            key={cls.id}
            className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col justify-between group hover:border-white/30 transition"
          >
            <div>
              <div className="aspect-video relative bg-slate-900 overflow-hidden">
                <img
                  src={cls.thumbnail}
                  alt={cls.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 text-[#031635] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">play_arrow</span>
                  </div>
                </div>

                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                  {cls.duration}
                </span>
              </div>

              <div className="p-4 space-y-1.5">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  {cls.subject}
                </span>
                <h4 className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug">
                  {cls.title}
                </h4>
                <p className="text-[11px] text-slate-300">By {cls.teacher}</p>
              </div>
            </div>

            <div className="p-4 pt-0">
              <Link
                href={`/watch/${cls.id}`}
                className="w-full py-2 rounded-xl bg-white text-[#031635] font-extrabold text-xs hover:bg-slate-100 transition shadow flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">play_circle</span>
                <span>Watch Free Lecture</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Video Modal Player (Simulated) */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Free Demo Player — Atomic Pathshala</h4>
              <button
                type="button"
                onClick={() => setPlayingVideo(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="aspect-video bg-black rounded-2xl flex items-center justify-center relative overflow-hidden border border-slate-800">
              <div className="text-center p-6 space-y-2">
                <span className="material-symbols-outlined text-5xl text-purple-400 animate-pulse">
                  play_circle
                </span>
                <p className="text-sm text-slate-300 font-bold">
                  Streaming 1080p Interactive Demo Lecture...
                </p>
                <p className="text-xs text-slate-500">
                  Adaptive HLS bitrate streaming with high-fidelity whiteboard integration.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}