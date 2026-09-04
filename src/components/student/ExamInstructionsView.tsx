"use client";

import React, { useState } from "react";
import { TestPdfDownloadModal } from "@/components/test-portal/TestPdfDownloadModal";

interface ExamInstructionsViewProps {
  testId?: string;
  testTitle: string;
  durationMin: number;
  totalQuestions: number;
  targetExam?: string;
  defaultLanguage: "en" | "hi";
  onProceed: () => void;
}

export function ExamInstructionsView({
  testId,
  testTitle,
  durationMin,
  totalQuestions,
  targetExam = "NEET UG",
  defaultLanguage,
  onProceed,
}: ExamInstructionsViewProps) {
  const [declared, setDeclared] = useState(false);

  const durationHours = (durationMin / 60).toFixed(durationMin % 60 === 0 ? 0 : 1);
  const maxMarks = totalQuestions * 4;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm my-6 animate-in fade-in duration-300">
      {/* Title Header with PDF Download Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="text-center sm:text-left space-y-1">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
            महत्वपूर्ण निर्देश : Important Instructions
          </h1>
          <p className="text-xs text-slate-500 font-bold">
            {testTitle} • {targetExam}
          </p>
        </div>

        {testId && (
          <TestPdfDownloadModal
            testId={testId}
            testName={testTitle}
            triggerButton={
              <button
                type="button"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                <span>Download Test Paper PDF</span>
              </button>
            }
          />
        )}
      </div>

      {/* Section 1: Hindi Instructions */}
      <div className="space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
          सामान्य निर्देश :
        </h3>

        <ol className="space-y-2.5 list-decimal pl-5">
          <li>
            इस परीक्षा की कुल अवधि {durationHours} घंटे है। इसमें कुल {totalQuestions} प्रश्न हैं — प्रत्येक सही उत्तर के 4 अंक मिलेंगे, प्रत्येक गलत उत्तर पर 1 अंक कटेंगे। अधिकतम अंक {maxMarks} हैं।
          </li>
          <li>
            घड़ी सर्वर पर सेट है। स्क्रीन पर दिख रहा टाइमर बचा हुआ समय दिखाता है। समय समाप्त होने पर परीक्षा अपने आप समाप्त हो जाएगी — आपको स्वयं जमा (Submit) करने की आवश्यकता नहीं होगी।
          </li>
          <li>
            <span>Question Palette पर हर प्रश्न की स्थिति निम्न रंगों से दिखाई जाती है:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 not-italic">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[#e2e8f0] dark:bg-slate-700 border border-slate-300 shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">आपने अभी तक इस प्रश्न को देखा नहीं है।</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[#ef4444] text-white shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">आपने इस प्रश्न का उत्तर नहीं दिया है।</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[#22c55e] text-white shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">आपने इस प्रश्न का उत्तर दे दिया है।</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[#9333ea] text-white shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">आपने उत्तर नहीं दिया, लेकिन इसे समीक्षा के लिए चिह्नित किया है।</span>
              </div>
              <div className="flex items-center gap-2.5 sm:col-span-2">
                <span className="w-5 h-5 rounded-md bg-[#9333ea] border-2 border-[#22c55e] shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">उत्तर दिया गया और समीक्षा के लिए चिह्नित — मूल्यांकन में शामिल होगा।</span>
              </div>
            </div>
          </li>
          <li>
            मोबाइल स्क्रीन पर, ऊपर दिए &ldquo;Palette&rdquo; बटन से Question Palette को खोला/बंद किया जा सकता है।
          </li>
          <li>
            हर प्रश्न के ऊपर दिए भाषा-बटन से उस प्रश्न की भाषा अलग से बदली जा सकती है — अगला प्रश्न आपकी डिफ़ॉल्ट भाषा में ही दिखेगा।
          </li>
        </ol>

        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white pt-2">
          प्रश्न का उत्तर देना :
        </h3>

        <ol className="space-y-2 list-decimal pl-5">
          <li>किसी विकल्प पर क्लिक करते ही उत्तर अपने आप सेव हो जाता है।</li>
          <li><strong>Save &amp; Next</strong> — उत्तर सेव करके अगले प्रश्न पर जाने के लिए।</li>
          <li><strong>Clear</strong> — चुना हुआ उत्तर हटाने के लिए।</li>
          <li><strong>Save &amp; Mark for Review</strong> — उत्तर सेव करें, समीक्षा के लिए चिह्नित करें, और इसी प्रश्न पर रहें।</li>
          <li><strong>Mark for Review &amp; Next</strong> — समीक्षा के लिए चिह्नित करके अगले प्रश्न पर जाने के लिए।</li>
          <li>Question Palette में किसी भी प्रश्न संख्या पर क्लिक करके सीधे उस प्रश्न पर जाया जा सकता है।</li>
          <li>टैब बदलना, विंडो मिनिमाइज़ करना, या फुल-स्क्रीन से बाहर निकलना दर्ज किया जाएगा और चेतावनी दी जाएगी — बार-बार ऐसा करने पर परीक्षा अपने आप जमा हो सकती है।</li>
        </ol>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800" />

      {/* Section 2: English Instructions */}
      <div className="space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
          General Instructions :
        </h3>

        <ol className="space-y-2.5 list-decimal pl-5">
          <li>
            Total duration of this test is {durationHours} hours. It has {totalQuestions} questions — each correct answer gets 4 marks, each incorrect answer deducts 1 mark. Maximum marks are {maxMarks}.
          </li>
          <li>
            The clock is set on the server. The countdown timer on screen shows the time remaining. When the timer reaches zero, the exam will end by itself — you will not be required to end or submit it yourself.
          </li>
          <li>
            <span>The Question Palette shows the status of each question using these colours:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 not-italic">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[#e2e8f0] dark:bg-slate-700 border border-slate-300 shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">You have not visited the question yet.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[#ef4444] text-white shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">You have not answered the question.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[#22c55e] text-white shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">You have answered the question.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-[#9333ea] text-white shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">You have NOT answered the question, but marked it for review.</span>
              </div>
              <div className="flex items-center gap-2.5 sm:col-span-2">
                <span className="w-5 h-5 rounded-md bg-[#9333ea] border-2 border-[#22c55e] shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">Answered and Marked for Review — will be considered for evaluation.</span>
              </div>
            </div>
          </li>
          <li>
            On mobile screens, use the &ldquo;Palette&rdquo; button at the top to open/close the Question Palette.
          </li>
          <li>
            Use the language button above each question to switch that question&apos;s language individually — the next question will revert to your default language.
          </li>
        </ol>

        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white pt-2">
          Answering a Question :
        </h3>

        <ol className="space-y-2 list-decimal pl-5">
          <li>Clicking an option saves your answer automatically.</li>
          <li><strong>Save &amp; Next</strong> — saves your answer and moves to the next question.</li>
          <li><strong>Clear</strong> — removes your selected answer.</li>
          <li><strong>Save &amp; Mark for Review</strong> — saves your answer, marks for review, and stays on the same question.</li>
          <li><strong>Mark for Review &amp; Next</strong> — marks the question for review and moves to the next one.</li>
          <li>Click any question number in the Question Palette to jump directly to that question.</li>
          <li>Switching tabs, minimizing the window, or exiting fullscreen will be logged and shown as a warning. Repeated violations may auto-submit your test.</li>
        </ol>
      </div>

      {/* Translation Notice Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#fdf2f2] dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 space-y-1.5">
        <span className="text-xs font-black uppercase text-red-700 dark:text-red-400 tracking-wider block">
          Translation Notice
        </span>
        <p className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-300">
          किसी भी प्रश्न के अनुवाद में अस्पष्टता की स्थिति में, अंग्रेज़ी संस्करण को ही अंतिम माना जाएगा।
        </p>
        <p className="text-[11px] sm:text-xs font-medium text-red-500 dark:text-red-400">
          In case of any ambiguity in translation of any question, English version shall be treated as final.
        </p>
      </div>

      {/* Mandatory Student Declaration Checkbox */}
      <div className="pt-2 space-y-6">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={declared}
            onChange={(e) => setDeclared(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            मैंने उपरोक्त सभी निर्देशों को पढ़ और समझ लिया है। मैं घोषणा करता/करती हूँ कि परीक्षा के दौरान मेरे पास/मैं पहन/उपयोग नहीं कर रहा/रही हूं कोई मोबाइल फ़ोन, ब्लूटूथ डिवाइस या कोई अन्य वर्जित सामग्री। मैं सहमत हूं कि निर्देशों का पालन न करने की स्थिति में मुझे इस परीक्षा से वंचित किया जा सकता है और/या अनुशासनात्मक कार्रवाई की जा सकती है, जिसमें भविष्य की परीक्षाओं से प्रतिबंध भी शामिल हो सकता है।
          </span>
        </label>

        {/* Proceed Button */}
        <button
          type="button"
          disabled={!declared}
          onClick={onProceed}
          className="w-full py-4 rounded-2xl bg-[#84b59f] hover:bg-[#6fa58e] text-white font-black text-base shadow-lg shadow-emerald-700/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          आगे बढ़ें
        </button>
      </div>
    </div>
  );
}
