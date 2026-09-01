'use client';

import React, { useState, useEffect } from 'react';
import { AcademicSelector, AcademicSelection } from '@/components/academic/AcademicSelector';

export default function AcademicManagementPage() {
  const [selection, setSelection] = useState<AcademicSelection>({
    classId: '',
    subjectId: '',
    chapterId: '',
    topicId: '',
  });
  const [program, setProgram] = useState<'all' | 'NEET' | 'JEE_MAIN' | 'CBSE_BOARD'>('NEET');
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [neetTree, setNeetTree] = useState<any>(null);
  const [loadingNeet, setLoadingNeet] = useState(false);

  useEffect(() => {
    async function loadNeetTree() {
      setLoadingNeet(true);
      try {
        const res = await fetch('/api/academic/neet-mapping?lang=' + lang);
        const json = await res.json();
        if (json.success) {
          setNeetTree(json);
        }
      } catch (err) {
        console.error('Failed to load NEET tree:', err);
      } finally {
        setLoadingNeet(false);
      }
    }
    loadNeetTree();
  }, [lang]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6 text-slate-100">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm border border-amber-500/30">NCERT</span>
            Academic Data & Program Mappings
          </h1>
          <p className="text-sm text-slate-400 mt-1">Single Canonical Source of Truth for Class 11 & 12 NCERT curriculum, NEET & JEE mappings.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
            {(['all', 'NEET', 'JEE_MAIN', 'CBSE_BOARD'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProgram(p)}
                className={'px-3 py-1.5 rounded-md font-medium transition ' + (program === p ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-400 hover:text-white')}
              >
                {p === 'all' ? 'All NCERT' : p.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={'px-3 py-1.5 rounded-md font-medium transition ' + (lang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('hi')}
              className={'px-3 py-1.5 rounded-md font-medium transition ' + (lang === 'hi' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
            >
              हिन्दी
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
            <h2 className="text-base font-semibold text-white mb-3 flex items-center justify-between">
              <span>Cascading Selector</span>
              <span className="text-xs text-amber-400 font-normal">Live Dynamic Filter</span>
            </h2>
            <AcademicSelector
              value={selection}
              onChange={(s) => setSelection(s)}
              program={program}
              language={lang}
              requireTopic={false}
              showLanguageSwitch={false}
            />

            {selection.chapterId && (
              <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5 text-amber-200">
                <div className="font-bold text-amber-400">Selected Hierarchy:</div>
                <div>Subject: <span className="text-white font-medium">{selection.subjectName || 'N/A'}</span></div>
                <div>Chapter: <span className="text-white font-medium">{selection.chapterTitle || 'N/A'}</span></div>
                {selection.topicTitle && (
                  <div>Topic: <span className="text-white font-medium">{selection.topicTitle}</span></div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-amber-400">106</div>
              <div className="text-xs text-slate-400 mt-0.5">NCERT Chapters</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-indigo-400">510</div>
              <div className="text-xs text-slate-400 mt-0.5">Official Topics</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                {program === 'NEET' ? 'NEET UG Curriculum Tree (NCERT Mapped)' : program === 'JEE_MAIN' ? 'JEE Main Curriculum Tree (NCERT Mapped)' : 'NCERT Curriculum Tree'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Canonical NCERT chapters and topics mapped without duplication.
              </p>
            </div>
            {neetTree && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                {neetTree.totalChapters} Chapters Mapped
              </span>
            )}
          </div>

          {loadingNeet ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading mappings...</div>
          ) : neetTree?.data ? (
            <div className="space-y-6 overflow-y-auto max-h-[600px] pr-2">
              {Object.entries(neetTree.data).map(([className, subjects]: [string, any]) => (
                <div key={className} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-amber-400 text-xs font-bold uppercase tracking-wider">
                      {className}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(subjects).map(([subjectName, chapters]: [string, any]) => (
                      <div
                        key={subjectName}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                          <span className="text-xs font-bold text-white">{subjectName}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                            {chapters.length} Chs
                          </span>
                        </div>

                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 text-[11px]">
                          {chapters.map((ch: any) => (
                            <div
                              key={ch.chapterId}
                              className="p-1.5 rounded bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 transition flex items-start gap-1.5"
                            >
                              <span className="text-amber-400 font-mono font-bold text-[10px]">
                                {ch.chapterNumber}.
                              </span>
                              <div className="flex-1 truncate" title={ch.title}>
                                {ch.title}
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono">
                                {ch.topicCount}t
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">No mapping data available</div>
          )}
        </div>
      </div>
    </div>
  );
}