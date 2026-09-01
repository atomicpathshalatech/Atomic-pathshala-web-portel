'use client';

import React, { useState, useEffect } from 'react';

export interface AcademicSelection {
  classId: string;
  subjectId: string;
  subjectName?: string;
  chapterId: string;
  chapterTitle?: string;
  topicId?: string;
  topicTitle?: string;
}

interface AcademicSelectorProps {
  value?: Partial<AcademicSelection>;
  onChange: (selection: AcademicSelection) => void;
  program?: 'NEET' | 'JEE_MAIN' | 'CBSE_BOARD' | 'all';
  requireTopic?: boolean;
  language?: 'en' | 'hi';
  disabled?: boolean;
  showLanguageSwitch?: boolean;
}

export function AcademicSelector({
  value = {},
  onChange,
  program = 'all',
  requireTopic = false,
  language: initialLang = 'en',
  disabled = false,
  showLanguageSwitch = true,
}: AcademicSelectorProps) {
  const [lang, setLang] = useState<'en' | 'hi'>(initialLang);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  const [selectedClass, setSelectedClass] = useState<string>(value.classId || '');
  const [selectedSubject, setSelectedSubject] = useState<string>(value.subjectId || '');
  const [selectedChapter, setSelectedChapter] = useState<string>(value.chapterId || '');
  const [selectedTopic, setSelectedTopic] = useState<string>(value.topicId || '');

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [showCustomSubjectModal, setShowCustomSubjectModal] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [customSubjectNameHindi, setCustomSubjectNameHindi] = useState('');
  const [customSubjectError, setCustomSubjectError] = useState('');
  const [submittingSubject, setSubmittingSubject] = useState(false);

  const [showCustomTopicModal, setShowCustomTopicModal] = useState(false);
  const [customTopicNumber, setCustomTopicNumber] = useState('');
  const [customTopicTitle, setCustomTopicTitle] = useState('');
  const [customTopicTitleHindi, setCustomTopicTitleHindi] = useState('');
  const [customTopicError, setCustomTopicError] = useState('');
  const [submittingTopic, setSubmittingTopic] = useState(false);

  useEffect(() => {
    async function fetchClasses() {
      setLoadingClasses(true);
      try {
        const res = await fetch('/api/academic/hierarchy?lang=' + lang);
        const json = await res.json();
        if (json.success) {
          setClasses(json.data || []);
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      } finally {
        setLoadingClasses(false);
      }
    }
    fetchClasses();
  }, [lang]);

  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      setChapters([]);
      setTopics([]);
      return;
    }

    async function fetchSubjects() {
      setLoadingSubjects(true);
      try {
        const url = new URL('/api/academic/hierarchy', window.location.origin);
        url.searchParams.set('classId', selectedClass);
        url.searchParams.set('lang', lang);
        if (program && program !== 'all') {
          url.searchParams.set('program', program);
        }
        const res = await fetch(url.toString());
        const json = await res.json();
        if (json.success) {
          setSubjects(json.data || []);
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    fetchSubjects();
  }, [selectedClass, lang, program]);

  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      setTopics([]);
      return;
    }

    async function fetchChapters() {
      setLoadingChapters(true);
      try {
        const url = new URL('/api/academic/hierarchy', window.location.origin);
        url.searchParams.set('subjectId', selectedSubject);
        url.searchParams.set('lang', lang);
        const res = await fetch(url.toString());
        const json = await res.json();
        if (json.success) {
          setChapters(json.data || []);
        }
      } catch (err) {
        console.error('Failed to load chapters:', err);
      } finally {
        setLoadingChapters(false);
      }
    }
    fetchChapters();
  }, [selectedSubject, lang]);

  useEffect(() => {
    if (!selectedChapter) {
      setTopics([]);
      return;
    }

    async function fetchTopics() {
      setLoadingTopics(true);
      try {
        const url = new URL('/api/academic/hierarchy', window.location.origin);
        url.searchParams.set('chapterId', selectedChapter);
        url.searchParams.set('lang', lang);
        const res = await fetch(url.toString());
        const json = await res.json();
        if (json.success) {
          setTopics(json.data || []);
        }
      } catch (err) {
        console.error('Failed to load topics:', err);
      } finally {
        setLoadingTopics(false);
      }
    }
    fetchTopics();
  }, [selectedChapter, lang]);

  const emitChange = (cId: string, sId: string, chId: string, tId?: string) => {
    const subObj = subjects.find((s) => s.id === sId);
    const chObj = chapters.find((c) => c.id === chId);
    const tObj = topics.find((t) => t.id === tId);

    onChange({
      classId: cId,
      subjectId: sId,
      subjectName: subObj ? subObj.name : '',
      chapterId: chId,
      chapterTitle: chObj ? chObj.title : '',
      topicId: tId || '',
      topicTitle: tObj ? tObj.title : '',
    });
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSubjectName.trim()) {
      setCustomSubjectError('Please enter a subject name');
      return;
    }
    setSubmittingSubject(true);
    setCustomSubjectError('');

    try {
      const res = await fetch('/api/academic/subjects/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClass,
          name: customSubjectName.trim(),
          nameHindi: customSubjectNameHindi.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setCustomSubjectError(json.error || 'Failed to create subject');
        return;
      }

      setSubjects((prev) => [...prev, json.data]);
      setSelectedSubject(json.data.id);
      setSelectedChapter('');
      setSelectedTopic('');
      emitChange(selectedClass, json.data.id, '', '');
      setShowCustomSubjectModal(false);
      setCustomSubjectName('');
      setCustomSubjectNameHindi('');
    } catch (err: any) {
      setCustomSubjectError(err.message || 'Network error');
    } finally {
      setSubmittingSubject(false);
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopicTitle.trim() || !customTopicNumber.trim()) {
      setCustomTopicError('Please enter both topic number (e.g. 1.8) and title');
      return;
    }
    setSubmittingTopic(true);
    setCustomTopicError('');

    try {
      const res = await fetch('/api/academic/topics/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: selectedChapter,
          topicNumber: customTopicNumber.trim(),
          title: customTopicTitle.trim(),
          titleHindi: customTopicTitleHindi.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setCustomTopicError(json.error || 'Failed to create topic');
        return;
      }

      setTopics((prev) => [...prev, json.data]);
      setSelectedTopic(json.data.id);
      emitChange(selectedClass, selectedSubject, selectedChapter, json.data.id);
      setShowCustomTopicModal(false);
      setCustomTopicNumber('');
      setCustomTopicTitle('');
      setCustomTopicTitleHindi('');
    } catch (err: any) {
      setCustomTopicError(err.message || 'Network error');
    } finally {
      setSubmittingTopic(false);
    }
  };

  return (
    <div className="space-y-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            NCERT Academic Hierarchy
          </span>
          {program !== 'all' && (
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs font-medium border border-indigo-500/30">
              {program} Mapped
            </span>
          )}
        </div>

        {showLanguageSwitch && (
          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={'px-1.5 py-0.5 text-xs rounded-md font-medium transition ' + (lang === 'en' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white')}
            >
              ENG
            </button>
            <button
              type="button"
              onClick={() => setLang('hi')}
              className={'px-1.5 py-0.5 text-xs rounded-md font-medium transition ' + (lang === 'hi' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white')}
            >
              HIN
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            {lang === 'hi' ? 'Class (कक्षा)' : 'Academic Class'} <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedClass}
            disabled={disabled || loadingClasses}
            onChange={(e) => {
              const newClass = e.target.value;
              setSelectedClass(newClass);
              setSelectedSubject('');
              setSelectedChapter('');
              setSelectedTopic('');
              emitChange(newClass, '', '', '');
            }}
            className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="">Select Class...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">
              {lang === 'hi' ? 'Subject (विषय)' : 'Subject'} <span className="text-red-400">*</span>
            </label>
            {selectedClass && (
              <button
                type="button"
                onClick={() => setShowCustomSubjectModal(true)}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                + Create Custom Subject
              </button>
            )}
          </div>
          <select
            value={selectedSubject}
            disabled={disabled || !selectedClass || loadingSubjects}
            onChange={(e) => {
              const newSubject = e.target.value;
              setSelectedSubject(newSubject);
              setSelectedChapter('');
              setSelectedTopic('');
              emitChange(selectedClass, newSubject, '', '');
            }}
            className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="">Select Subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {!s.isSystem ? ' (custom)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">
          {lang === 'hi' ? 'NCERT Chapter (अध्याय)' : 'NCERT Chapter'} <span className="text-red-400">*</span>
        </label>
        <select
          value={selectedChapter}
          disabled={disabled || !selectedSubject || loadingChapters}
          onChange={(e) => {
            const newChapter = e.target.value;
            setSelectedChapter(newChapter);
            setSelectedTopic('');
            emitChange(selectedClass, selectedSubject, newChapter, '');
          }}
          className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Select Chapter...</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>
              Chapter {ch.chapterNumber}: {ch.title} {ch.bookName ? '(' + ch.bookName + ')' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-slate-300">
            {lang === 'hi' ? 'Topic (विषय)' : 'NCERT / Academic Topic'} {requireTopic && <span className="text-red-400">*</span>}
          </label>
          {selectedChapter && (
            <button
              type="button"
              onClick={() => setShowCustomTopicModal(true)}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              + Create Custom Topic
            </button>
          )}
        </div>
        <select
          value={selectedTopic}
          disabled={disabled || !selectedChapter || loadingTopics}
          onChange={(e) => {
            const newTopic = e.target.value;
            setSelectedTopic(newTopic);
            emitChange(selectedClass, selectedSubject, selectedChapter, newTopic);
          }}
          className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
        >
          <option value="">Select Topic (covers entire chapter if blank)...</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topicNumber} - {t.title} {!t.isSystem ? ' (custom)' : ''}
            </option>
          ))}
        </select>
      </div>

      {showCustomSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Create Custom Subject</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a new subject under the selected class. Duplicates are automatically prevented.
            </p>

            <form onSubmit={handleCreateSubject} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Subject Name (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biotechnology"
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Subject Name (Hindi - Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. जैव प्रौद्योगिकी"
                  value={customSubjectNameHindi}
                  onChange={(e) => setCustomSubjectNameHindi(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                />
              </div>

              {customSubjectError && (
                <p className="text-xs text-red-400">{customSubjectError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomSubjectModal(false)}
                  className="px-3 py-1.5 text-sm rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSubject}
                  className="px-4 py-1.5 text-sm rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400"
                >
                  {submittingSubject ? 'Creating...' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Create Custom Topic</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a new topic under the selected chapter.
            </p>

            <form onSubmit={handleCreateTopic} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Topic Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1.8"
                  value={customTopicNumber}
                  onChange={(e) => setCustomTopicNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Topic Title (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Applications"
                  value={customTopicTitle}
                  onChange={(e) => setCustomTopicTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Topic Title (Hindi - Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. प्रमुख अनुप्रयोग"
                  value={customTopicTitleHindi}
                  onChange={(e) => setCustomTopicTitleHindi(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-amber-500"
                />
              </div>

              {customTopicError && (
                <p className="text-xs text-red-400">{customTopicError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomTopicModal(false)}
                  className="px-3 py-1.5 text-sm rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTopic}
                  className="px-4 py-1.5 text-sm rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400"
                >
                  {submittingTopic ? 'Creating...' : 'Create Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}