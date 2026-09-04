import "server-only";
import { prisma } from "@/lib/db";
import { renderFormulaContent } from "@/lib/test-portal/formula";

export interface TestExportOptions {
  withSolution: boolean;
  watermarkText?: string;
  brandName?: string;
  logoUrl?: string | null;
  targetCourse?: string;
  testPattern?: string;
}

export interface FormattedQuestionOption {
  key: string; // "1", "2", "3", "4" or "A", "B", "C", "D"
  label: string;
  textEn: string;
  textHi: string;
  isCorrect: boolean;
}

export interface FormattedExportQuestion {
  number: number;
  id: string;
  subject: string;
  sectionName: string;
  statementEn: string;
  statementHi: string;
  options: FormattedQuestionOption[];
  correctOptionKey: string;
  correctOptionLabel: string;
  solutionEn: string;
  solutionHi: string;
  imageUrl?: string | null;
}

export interface FormattedExportSection {
  id: string;
  name: string;
  subject: string;
  order: number;
  targetCount: number;
  marksPerQuestion: number;
  negativeMarks: number;
  questions: FormattedExportQuestion[];
}

export interface FormattedExportTest {
  id: string;
  name: string;
  code: string;
  examType: string;
  durationMin: number;
  totalMarks: number;
  totalQuestions: number;
  correctMarks: number;
  incorrectMarks: number;
  description: string;
  instructions: string;
  createdAt: Date;
  sections: FormattedExportSection[];
  allQuestions: FormattedExportQuestion[];
}

function normalizeOptions(
  enOptionsRaw: any,
  hiOptionsRaw: any,
  correctOptionIdsRaw: any
): { options: FormattedQuestionOption[]; correctKey: string; correctLabel: string } {
  const keys = ["A", "B", "C", "D"];
  const numLabels = ["(1)", "(2)", "(3)", "(4)"];
  const options: FormattedQuestionOption[] = [];

  let correctKeys: string[] = [];
  if (Array.isArray(correctOptionIdsRaw)) {
    correctKeys = correctOptionIdsRaw.map((k) => String(k).trim().toUpperCase());
  } else if (typeof correctOptionIdsRaw === "string") {
    try {
      const parsed = JSON.parse(correctOptionIdsRaw);
      if (Array.isArray(parsed)) correctKeys = parsed.map((k) => String(k).trim().toUpperCase());
      else correctKeys = [String(correctOptionIdsRaw).trim().toUpperCase()];
    } catch {
      correctKeys = [correctOptionIdsRaw.trim().toUpperCase()];
    }
  }

  // Parse EN Options
  let enMap: Record<string, string> = {};
  if (enOptionsRaw && typeof enOptionsRaw === "object") {
    if (Array.isArray(enOptionsRaw)) {
      enOptionsRaw.forEach((opt, idx) => {
        const k = keys[idx] || String(idx + 1);
        enMap[k] = typeof opt === "string" ? opt : opt?.text || opt?.statement || "";
      });
    } else {
      enMap = { ...enOptionsRaw };
    }
  }

  // Parse HI Options
  let hiMap: Record<string, string> = {};
  if (hiOptionsRaw && typeof hiOptionsRaw === "object") {
    if (Array.isArray(hiOptionsRaw)) {
      hiOptionsRaw.forEach((opt, idx) => {
        const k = keys[idx] || String(idx + 1);
        hiMap[k] = typeof opt === "string" ? opt : opt?.text || opt?.statement || "";
      });
    } else {
      hiMap = { ...hiOptionsRaw };
    }
  }

  const allKeys = Array.from(
    new Set([...Object.keys(enMap), ...Object.keys(hiMap), "A", "B", "C", "D"])
  ).slice(0, 4);

  let primaryCorrectKey = "1";
  let primaryCorrectLabel = "(1)";

  allKeys.forEach((key, idx) => {
    const numKey = String(idx + 1);
    const numLabel = numLabels[idx] || `(${idx + 1})`;
    const textEn = enMap[key] || enMap[numKey] || "";
    const textHi = hiMap[key] || hiMap[numKey] || textEn || "";
    const isCorrect =
      correctKeys.includes(key.toUpperCase()) ||
      correctKeys.includes(numKey) ||
      correctKeys.includes(numLabel);

    if (isCorrect) {
      primaryCorrectKey = numKey;
      primaryCorrectLabel = numLabel;
    }

    options.push({
      key: numKey,
      label: numLabel,
      textEn,
      textHi,
      isCorrect,
    });
  });

  return {
    options,
    correctKey: primaryCorrectKey,
    correctLabel: primaryCorrectLabel,
  };
}

export async function fetchCanonicalTestData(testId: string): Promise<FormattedExportTest | null> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      template: true,
      batchSchedule: { include: { batch: true } },
      testSeries: true,
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              question: {
                include: {
                  translations: true,
                  assets: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!test) return null;

  let globalQuestionNumber = 0;
  const allQuestions: FormattedExportQuestion[] = [];

  const formattedSections: FormattedExportSection[] = test.sections.map((section) => {
    const questions: FormattedExportQuestion[] = section.questions.map((sq) => {
      globalQuestionNumber++;
      const q = sq.question;
      const enTrans = q.translations.find((t) => t.language === "ENGLISH" || t.language === "en") || q.translations[0];
      const hiTrans = q.translations.find((t) => t.language === "HINDI" || t.language === "hi") || enTrans;

      const { options, correctKey, correctLabel } = normalizeOptions(
        enTrans?.options,
        hiTrans?.options,
        enTrans?.correctOptionIds || hiTrans?.correctOptionIds
      );

      const imageUrl = q.imageUrl || q.assets?.find((a) => a.type === "DIAGRAM" || a.type === "REFERENCE")?.publicUrl;

      const formattedQ: FormattedExportQuestion = {
        number: globalQuestionNumber,
        id: q.id,
        subject: section.subject || q.subject || "General",
        sectionName: section.name,
        statementEn: enTrans?.statement || "",
        statementHi: hiTrans?.statement || enTrans?.statement || "",
        options,
        correctOptionKey: correctKey,
        correctOptionLabel: correctLabel,
        solutionEn: enTrans?.solution || q.solution || "",
        solutionHi: hiTrans?.solution || enTrans?.solution || q.solution || "",
        imageUrl: imageUrl || null,
      };

      allQuestions.push(formattedQ);
      return formattedQ;
    });

    return {
      id: section.id,
      name: section.name,
      subject: section.subject,
      order: section.order,
      targetCount: section.targetCount || questions.length,
      marksPerQuestion: section.marksPerQuestion ?? test.correctMarks ?? 4,
      negativeMarks: section.negativeMarks ?? Math.abs(test.incorrectMarks ?? 1),
      questions,
    };
  });

  const totalQuestions = allQuestions.length;
  const totalMarks = formattedSections.reduce(
    (sum, s) => sum + s.questions.reduce((qSum) => qSum + s.marksPerQuestion, 0),
    0
  ) || (totalQuestions * 4);

  return {
    id: test.id,
    name: test.name,
    code: test.code || `AP-TEST-${test.id.slice(-6).toUpperCase()}`,
    examType: test.examType || "NEET(UG)",
    durationMin: test.durationMin || 180,
    totalMarks,
    totalQuestions,
    correctMarks: test.correctMarks || 4,
    incorrectMarks: test.incorrectMarks || -1,
    description: test.description || "",
    instructions: test.instructions || "",
    createdAt: test.createdAt,
    sections: formattedSections,
    allQuestions,
  };
}

/**
 * Generates the complete, high-fidelity printable HTML document for the test paper.
 */
export function generateTestPaperHtml(
  test: FormattedExportTest,
  options: TestExportOptions
): string {
  const { withSolution, brandName = "ATOMIC PATHSHALA" } = options;

  const durationHours = Math.floor(test.durationMin / 60);
  const durationRemainder = test.durationMin % 60;
  const durationText = durationHours > 0 
    ? `${durationHours} Hour${durationHours > 1 ? "s" : ""}${durationRemainder > 0 ? ` ${durationRemainder} Mins` : ""}`
    : `${test.durationMin} Minutes`;

  const currentDateStr = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(test.createdAt || new Date());

  // Render Front Cover
  const frontCoverHtml = `
    <div class="page cover-page">
      <div class="cover-border">
        <!-- Top Barcode & Header Details -->
        <div class="cover-top-header">
          <div class="cover-top-left">
            <span class="barcode-pill">(${test.code})</span>
            <div class="lang-tag">Hindi + English</div>
          </div>
          <div class="cover-top-center">
            <div class="brand-logo-text">⚡ ATOMIC PATHSHALA</div>
            <div class="brand-sub-program">DISTANCE LEARNING PROGRAMME / ALL INDIA TEST SERIES</div>
            <div class="academic-session">(Academic Session : 2026 - 2027)</div>
          </div>
          <div class="cover-top-right">
            <div class="test-pattern-badge">Test Pattern</div>
            <div class="test-pattern-name">${test.examType}</div>
            <div class="test-pattern-type">MAJOR TEST</div>
            <div class="test-pattern-date">${currentDateStr}</div>
          </div>
        </div>

        <!-- Target Course Banner -->
        <div class="target-banner">
          PRE-MEDICAL & PRE-ENGINEERING : LEADER & ACHIEVER TEST SERIES
        </div>

        <div class="candidate-level-pill">
          12th Undergoing / Pass / Dropper Student
        </div>

        <!-- Test Name Box -->
        <div class="test-name-box">
          <div class="test-type-label">Test Name : <span class="test-type-value">${test.name.toUpperCase()}</span></div>
        </div>

        <!-- Warning Subtitle -->
        <div class="cover-warning-notice">
          <div class="line-1">This Booklet contains section-wise questions for <strong>${test.sections.map((s) => s.subject).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</strong>.</div>
          <div class="line-2">इस परीक्षा पुस्तिका को तब तक न खोलें जब तक कहा न जाए। / <strong>Do not open this Test Booklet until you are asked to do so.</strong></div>
          <div class="line-3">इस परीक्षा पुस्तिका के पिछले आवरण पर दिए निर्देशों को ध्यान से पढ़ें। / <strong>Read carefully the Instructions on the Back Cover of this Test Booklet.</strong></div>
        </div>

        <!-- 2-Column Instructions Table -->
        <div class="instructions-box-table">
          <div class="inst-col inst-col-left">
            <div class="inst-heading">महत्वपूर्ण निर्देश :</div>
            <ol class="inst-list">
              <li>उत्तर पत्र पर ध्यानपूर्वक केवल <strong>नीले / काले बॉल पॉइंट पेन</strong> से विवरण भरें।</li>
              <li>परीक्षा की अवधि <strong>${durationHours} घंटे</strong> है एवं परीक्षा पुस्तिका में <strong>${test.totalQuestions} प्रश्न</strong> हैं। प्रत्येक प्रश्न <strong>${test.correctMarks} अंक</strong> का है। प्रत्येक सही उत्तर के लिए ${test.correctMarks} अंक दिए जाएंगे। प्रत्येक गलत उत्तर के लिए <strong>${Math.abs(test.incorrectMarks)} अंक</strong> काटा जाएगा। अधिकतम अंक <strong>${test.totalMarks}</strong> हैं।</li>
              <li>इस पृष्ठ पर विवरण अंकित करने एवं उत्तर पत्र पर निशान लगाने के लिए केवल नीले / काले बॉल पॉइंट पेन का प्रयोग करें।</li>
              <li>रफ कार्य इस परीक्षा पुस्तिका में निर्धारित <strong>SPACE FOR ROUGH WORK</strong> वाले पृष्ठों पर ही करें।</li>
              <li>परीक्षा सम्पन्न होने पर, परीक्षार्थी कक्ष/हॉल छोड़ने से पूर्व उत्तर पत्र कक्ष निरीक्षक को अवश्य सौंप दें।</li>
              <li>परीक्षार्थी सुनिश्चित करें कि उत्तर पत्र को मोड़ा न जाए एवं उस पर कोई अन्य अवांछित निशान न लगाएं।</li>
              <li>उत्तर पत्र पर किसी प्रकार के संशोधन हेतु व्हाइट फ्लूइड / ब्लेड के प्रयोग की अनुमति नहीं है।</li>
            </ol>
          </div>
          <div class="inst-col inst-col-right">
            <div class="inst-heading">Important Instructions :</div>
            <ol class="inst-list">
              <li>On the Answer Sheet, fill in the particulars carefully with <strong>blue / black ball point pen</strong> only.</li>
              <li>The test is of <strong>${durationText}</strong> duration and this Test Booklet contains <strong>${test.totalQuestions} questions</strong>. Each question carries <strong>${test.correctMarks} marks</strong>. For each correct response, ${test.correctMarks} marks will be given. For each incorrect response, <strong>${Math.abs(test.incorrectMarks)} mark</strong> will be deducted from the total scores. The maximum marks are <strong>${test.totalMarks}</strong>.</li>
              <li>Use <strong>Blue / Black Ball Point Pen</strong> only for writing particulars on this page and marking responses.</li>
              <li>Rough work is to be done in the space provided for this purpose (<strong>SPACE FOR ROUGH WORK</strong>) in the Test Booklet only.</li>
              <li>On completion of the test, the candidate must hand over the Answer Sheet to the Invigilator before leaving the Examination Hall.</li>
              <li>The candidates should ensure that the Answer Sheet is not folded or defaced. Do not make any stray marks.</li>
              <li>Use of white fluid or eraser for correction is <strong>strictly prohibited</strong>.</li>
            </ol>
          </div>
        </div>

        <!-- Ambiguity Rule -->
        <div class="ambiguity-banner">
          <div>प्रश्नों के अनुवाद में किसी अस्पष्टता की स्थिति में, अंग्रेजी संस्करण को ही अंतिम माना जाएगा।</div>
          <div class="ambiguity-en">In case of any ambiguity in translation of any question, English version shall be treated as final.</div>
        </div>

        <!-- Candidate Particulars Box -->
        <div class="candidate-particulars-box">
          <div class="part-row">
            <span class="part-label">परीक्षार्थी का नाम (बड़े अक्षरों में) / Name of Candidate (in Capitals) :</span>
            <span class="part-line"></span>
          </div>
          <div class="part-row-grid">
            <div class="grid-cell">
              <span class="part-label">फॉर्म / रोल नम्बर (अंकों में) / Roll No. (in figures) :</span>
              <span class="part-line"></span>
            </div>
            <div class="grid-cell">
              <span class="part-label">शब्दों में / in words :</span>
              <span class="part-line"></span>
            </div>
          </div>
          <div class="part-row">
            <span class="part-label">परीक्षा केन्द्र (बड़े अक्षरों में) / Centre of Examination (in Capitals) :</span>
            <span class="part-line"></span>
          </div>
          <div class="part-row-grid pt-2">
            <div class="grid-cell">
              <span class="part-label">परीक्षार्थी के हस्ताक्षर / Candidate's Signature :</span>
              <span class="part-line sig-line"></span>
            </div>
            <div class="grid-cell">
              <span class="part-label">निरीक्षक के हस्ताक्षर / Invigilator's Signature :</span>
              <span class="part-line sig-line"></span>
            </div>
          </div>
        </div>

        <!-- Bottom Motto Banner -->
        <div class="bottom-target-motto">
          ⚡ Your Target is to secure Top AIR in ${test.examType} with Atomic Pathshala ⚡
        </div>
      </div>
    </div>
  `;

  // Render Questions Section-wise
  let questionPagesHtml = "";
  test.sections.forEach((section, sIdx) => {
    const sectionBanner = `
      <div class="section-divider-banner">
        <div class="section-banner-title">${section.subject.toUpperCase()} — ${section.name.toUpperCase()}</div>
        <div class="section-banner-meta">
          <span>Questions: <strong>${section.questions.length}</strong></span>
          <span>Correct: <strong>+${section.marksPerQuestion}</strong></span>
          <span>Incorrect: <strong>-${section.negativeMarks}</strong></span>
        </div>
      </div>
    `;

    const questionsChunkHtml = section.questions.map((q) => {
      const statementEnHtml = renderFormulaContent(q.statementEn);
      const statementHiHtml = renderFormulaContent(q.statementHi);

      const optionsHtml = q.options.map((opt) => {
        const optEn = renderFormulaContent(opt.textEn);
        const optHi = renderFormulaContent(opt.textHi);
        return `
          <div class="q-option-row">
            <div class="q-option-col hi-opt">
              <span class="opt-label">${opt.label}</span>
              <span class="opt-text">${optHi}</span>
            </div>
            <div class="q-option-col en-opt">
              <span class="opt-label">${opt.label}</span>
              <span class="opt-text">${optEn}</span>
            </div>
          </div>
        `;
      }).join("");

      const imageHtml = q.imageUrl ? `
        <div class="q-diagram-container">
          <img src="${q.imageUrl}" alt="Diagram for Question ${q.number}" class="q-diagram-img" />
        </div>
      ` : "";

      return `
        <div class="question-block" id="q-${q.number}">
          <div class="q-header-row">
            <span class="q-num-badge">Q.${q.number}</span>
          </div>
          <div class="q-statement-row">
            <div class="q-statement-col hi-text">
              ${statementHiHtml}
            </div>
            <div class="q-statement-col en-text">
              ${statementEnHtml}
            </div>
          </div>
          ${imageHtml}
          <div class="q-options-container">
            ${optionsHtml}
          </div>
        </div>
      `;
    }).join("");

    questionPagesHtml += `
      <div class="page content-page">
        <div class="page-running-header">
          <span class="header-left">SUBJECT : <strong>${section.subject.toUpperCase()}</strong></span>
          <span class="header-center">${brandName} — ${test.examType}</span>
          <span class="header-right">CODE : <strong>${test.code}</strong></span>
        </div>
        
        <div class="content-body">
          ${sectionBanner}
          <div class="questions-stream">
            ${questionsChunkHtml}
          </div>
        </div>

        <div class="page-running-footer">
          <span class="footer-left">${test.code} · ${currentDateStr}</span>
          <span class="footer-center">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</span>
          <span class="footer-right">PHASE - ALL</span>
        </div>
      </div>
    `;

    // Add intermediate rough page after middle section
    if (sIdx === 1 && test.sections.length >= 3) {
      questionPagesHtml += `
        <div class="page rough-page">
          <div class="page-running-header">
            <span class="header-left">${brandName}</span>
            <span class="header-center">ROUGH WORK</span>
            <span class="header-right">CODE : <strong>${test.code}</strong></span>
          </div>
          <div class="rough-page-content">
            <div class="rough-watermark">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</div>
            <div class="rough-grid-canvas"></div>
          </div>
          <div class="page-running-footer">
            <span class="footer-left">${test.code} · ${currentDateStr}</span>
            <span class="footer-center">SPACE FOR ROUGH WORK</span>
            <span class="footer-right">ATOMIC PATHSHALA</span>
          </div>
        </div>
      `;
    }
  });

  // Dedicated End-of-Paper Rough Pages (2 Pages)
  const finalRoughPagesHtml = `
    <div class="page rough-page">
      <div class="page-running-header">
        <span class="header-left">${brandName}</span>
        <span class="header-center">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</span>
        <span class="header-right">CODE : <strong>${test.code}</strong></span>
      </div>
      <div class="rough-page-content">
        <div class="rough-watermark">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</div>
        <div class="rough-grid-canvas"></div>
      </div>
      <div class="page-running-footer">
        <span class="footer-left">${test.code}</span>
        <span class="footer-center">SPACE FOR ROUGH WORK</span>
        <span class="footer-right">ATOMIC PATHSHALA</span>
      </div>
    </div>

    <div class="page rough-page">
      <div class="page-running-header">
        <span class="header-left">${brandName}</span>
        <span class="header-center">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</span>
        <span class="header-right">CODE : <strong>${test.code}</strong></span>
      </div>
      <div class="rough-page-content">
        <div class="rough-watermark">SPACE FOR ROUGH WORK / रफ कार्य के लिए जगह</div>
        <div class="rough-grid-canvas"></div>
      </div>
      <div class="page-running-footer">
        <span class="footer-left">${test.code}</span>
        <span class="footer-center">SPACE FOR ROUGH WORK</span>
        <span class="footer-right">ATOMIC PATHSHALA</span>
      </div>
    </div>
  `;

  // Back Cover Page
  const backCoverHtml = `
    <div class="page back-cover-page">
      <div class="back-cover-border">
        <div class="back-cover-table">
          <div class="back-col back-col-hi">
            <div class="back-heading">महत्वपूर्ण निर्देश :</div>
            <ol class="back-list">
              <li>पूछे जाने पर प्रत्येक परीक्षार्थी, निरीक्षक को अपना <strong>पहचान पत्र (Atomic Pathshala ID Card / Admit Card)</strong> दिखाएं।</li>
              <li>निरीक्षक की विशेष अनुमति के बिना कोई परीक्षार्थी अपना स्थान न छोड़े।</li>
              <li>कार्यरत निरीक्षक को अपना उत्तर पत्र दिए बिना कोई परीक्षार्थी परीक्षा हॉल नहीं छोड़े।</li>
              <li>इलेक्ट्रॉनिक / हस्तचलित परिकलक (Calculator) या किसी अन्य डिजिटल उपकरण का उपयोग सर्वथा <strong>वर्जित</strong> है।</li>
              <li>परीक्षा हॉल में आचरण के लिए परीक्षार्थी परीक्षा के सभी नियमों एवं विनियमों द्वारा नियमित है। अनुचित साधन (Unfair Means) के सभी मामलों का फैसला परीक्षा के नियमों एवं विनियमों के अनुसार होगा।</li>
              <li>किसी हालात में परीक्षा पुस्तिका और उत्तर पत्र का कोई भाग अलग न करें।</li>
              <li>परीक्षा पुस्तिका / उत्तर-पत्र में परीक्षार्थी अपना सही नाम व फॉर्म / रोल नम्बर अवश्य लिखें।</li>
            </ol>
          </div>
          <div class="back-col back-col-en">
            <div class="back-heading">Important Instructions :</div>
            <ol class="back-list">
              <li>Each candidate must show on demand his/her <strong>Atomic Pathshala ID Card / Admit Card</strong> to the Invigilator.</li>
              <li>No candidate, without special permission of the Invigilator, would leave his/her seat.</li>
              <li>The candidates should not leave the Examination Hall without handing over their Answer Sheet to the Invigilator on duty.</li>
              <li>Use of <strong>Electronic / Manual Calculator or any smart device</strong> is strictly prohibited.</li>
              <li>The candidates are governed by all Rules and Regulations of the examination with regard to their conduct in the Examination Hall. All cases of unfair means will be dealt with as per Examination Rules.</li>
              <li>No part of the Test Booklet and Answer Sheet shall be detached under any circumstances.</li>
              <li>The candidates will write the Correct Name and Form / Roll No. in the Test Booklet / Answer Sheet.</li>
            </ol>
          </div>
        </div>

        <div class="back-corporate-footer">
          <div class="corp-brand-title">⚡ ATOMIC PATHSHALA PRIVATE LIMITED</div>
          <div class="corp-address">Registered Office & Online Learning Portal | Kota / New Delhi, India</div>
          <div class="corp-contacts">
            <span>Website: <strong>www.atomicpathshala.com</strong></span>
            <span>·</span>
            <span>Support: <strong>support@atomicpathshala.com</strong></span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Optional: Answer Key Grid & Detailed Solutions
  let solutionsSectionHtml = "";
  if (withSolution) {
    const totalQ = test.allQuestions.length;
    const itemsPerCol = Math.ceil(totalQ / 4);
    const col1 = test.allQuestions.slice(0, itemsPerCol);
    const col2 = test.allQuestions.slice(itemsPerCol, itemsPerCol * 2);
    const col3 = test.allQuestions.slice(itemsPerCol * 2, itemsPerCol * 3);
    const col4 = test.allQuestions.slice(itemsPerCol * 3);

    let answerKeyRowsHtml = "";
    for (let r = 0; r < itemsPerCol; r++) {
      const q1 = col1[r];
      const q2 = col2[r];
      const q3 = col3[r];
      const q4 = col4[r];

      answerKeyRowsHtml += `
        <tr>
          <td class="ak-qno">${q1 ? `Q.${q1.number}` : ""}</td>
          <td class="ak-ans">${q1 ? `<strong>${q1.correctOptionKey}</strong>` : ""}</td>
          <td class="ak-sep"></td>
          <td class="ak-qno">${q2 ? `Q.${q2.number}` : ""}</td>
          <td class="ak-ans">${q2 ? `<strong>${q2.correctOptionKey}</strong>` : ""}</td>
          <td class="ak-sep"></td>
          <td class="ak-qno">${q3 ? `Q.${q3.number}` : ""}</td>
          <td class="ak-ans">${q3 ? `<strong>${q3.correctOptionKey}</strong>` : ""}</td>
          <td class="ak-sep"></td>
          <td class="ak-qno">${q4 ? `Q.${q4.number}` : ""}</td>
          <td class="ak-ans">${q4 ? `<strong>${q4.correctOptionKey}</strong>` : ""}</td>
        </tr>
      `;
    }

    const answerKeyPageHtml = `
      <div class="page answer-key-page">
        <div class="page-running-header">
          <span class="header-left">ANSWER KEY</span>
          <span class="header-center">${brandName} — ${test.name}</span>
          <span class="header-right">CODE : <strong>${test.code}</strong></span>
        </div>

        <div class="ak-header-banner">
          <div class="ak-main-title">OFFICIAL ANSWER KEY — ${test.examType}</div>
          <div class="ak-sub-title">Test Code: <strong>${test.code}</strong> | Total Questions: <strong>${totalQ}</strong> | Max Marks: <strong>${test.totalMarks}</strong></div>
        </div>

        <div class="ak-table-container">
          <table class="ak-grid-table">
            <thead>
              <tr>
                <th>Q.No</th>
                <th>Ans</th>
                <th class="ak-sep"></th>
                <th>Q.No</th>
                <th>Ans</th>
                <th class="ak-sep"></th>
                <th>Q.No</th>
                <th>Ans</th>
                <th class="ak-sep"></th>
                <th>Q.No</th>
                <th>Ans</th>
              </tr>
            </thead>
            <tbody>
              ${answerKeyRowsHtml}
            </tbody>
          </table>
        </div>

        <div class="page-running-footer">
          <span class="footer-left">${test.code}</span>
          <span class="footer-center">ANSWER KEY · ATOMIC PATHSHALA</span>
          <span class="footer-right">PHASE - ALL</span>
        </div>
      </div>
    `;

    const solutionsListHtml = test.sections.map((section) => {
      const solQuestionsHtml = section.questions.map((q) => {
        const solEnHtml = renderFormulaContent(q.solutionEn || "Detailed explanation provided as per standard textbook principles.");
        const solHiHtml = renderFormulaContent(q.solutionHi || q.solutionEn || "");

        return `
          <div class="sol-item-block">
            <div class="sol-item-header">
              <span class="sol-q-badge">Q.${q.number}</span>
              <span class="sol-correct-badge">Correct Answer: <strong>Option (${q.correctOptionKey})</strong></span>
              <span class="sol-subject-tag">${q.subject}</span>
            </div>
            <div class="sol-statement-brief">
              <div class="sol-stmt-hi">${renderFormulaContent(q.statementHi)}</div>
              <div class="sol-stmt-en">${renderFormulaContent(q.statementEn)}</div>
            </div>
            <div class="sol-explanation-box">
              <div class="sol-heading">💡 Hint & Step-by-Step Solution :</div>
              <div class="sol-body-content">
                <div class="sol-en">${solEnHtml}</div>
                ${q.solutionHi && q.solutionHi !== q.solutionEn ? `<div class="sol-hi">${solHiHtml}</div>` : ""}
              </div>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="sol-section-group">
          <div class="sol-section-title">HINTS & SOLUTIONS : ${section.subject.toUpperCase()} (${section.name.toUpperCase()})</div>
          ${solQuestionsHtml}
        </div>
      `;
    }).join("");

    const detailedSolutionsPageHtml = `
      <div class="page solutions-page">
        <div class="page-running-header">
          <span class="header-left">HINTS & SOLUTIONS</span>
          <span class="header-center">${brandName} — ${test.name}</span>
          <span class="header-right">CODE : <strong>${test.code}</strong></span>
        </div>

        <div class="content-body">
          <div class="sol-main-header">
            <h2>HINTS & STEP-BY-STEP SOLUTIONS</h2>
            <p>Comprehensive pedagogical explanations with formulas, derivations and concept breakdown.</p>
          </div>
          ${solutionsListHtml}
        </div>

        <div class="page-running-footer">
          <span class="footer-left">${test.code}</span>
          <span class="footer-center">HINTS & SOLUTIONS · ATOMIC PATHSHALA</span>
          <span class="footer-right">END OF SOLUTIONS</span>
        </div>
      </div>
    `;

    solutionsSectionHtml = answerKeyPageHtml + detailedSolutionsPageHtml;
  }

  // Full Document Assembly
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${test.name} - ${test.code} | ${brandName}</title>
  
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" crossorigin="anonymous">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Noto+Sans+Devanagari:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 8mm 8mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      margin: 0;
      padding: 0;
      background: #e2e8f0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      font-size: 11pt;
      line-height: 1.4;
    }

    .doc-container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm 12mm;
      position: relative;
      background: white;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
    }

    @media print {
      body {
        background: white;
      }
      .doc-container {
        max-width: none;
        margin: 0;
      }
      .page {
        margin: 0;
        box-shadow: none;
        width: 100%;
        min-height: 100vh;
        padding: 8mm 10mm;
      }
      .no-print {
        display: none !important;
      }
    }

    .print-bar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f172a;
      color: white;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .print-bar h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .print-bar-btn {
      background: #4f46e5;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .print-bar-btn:hover {
      background: #4338ca;
    }

    .page-running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 8px;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .page-running-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1.5px solid #0f172a;
      padding-top: 4px;
      margin-top: 8px;
      font-size: 8pt;
      color: #334155;
      font-weight: 600;
    }

    .cover-page {
      padding: 8mm;
      justify-content: flex-start;
    }
    .cover-border {
      border: 2.5px solid #000;
      padding: 6mm 7mm;
      min-height: 275mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .cover-top-header {
      display: grid;
      grid-template-columns: 100px 1fr 120px;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      gap: 8px;
    }
    .cover-top-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .barcode-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      font-weight: 700;
      background: #f1f5f9;
      padding: 2px 4px;
      border: 1px solid #000;
      text-align: center;
    }
    .lang-tag {
      font-size: 8pt;
      font-weight: 700;
      border: 1px solid #000;
      text-align: center;
      padding: 1px 0;
      background: #fff;
    }
    .cover-top-center {
      text-align: center;
    }
    .brand-logo-text {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 1px;
      color: #000;
    }
    .brand-sub-program {
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin-top: 1px;
    }
    .academic-session {
      font-size: 7.5pt;
      font-weight: 700;
      color: #334155;
    }
    .cover-top-right {
      border: 1.5px solid #000;
      text-align: center;
      padding: 2px 4px;
      font-size: 7.5pt;
    }
    .test-pattern-badge {
      font-weight: 700;
      border-bottom: 1px solid #000;
      padding-bottom: 1px;
    }
    .test-pattern-name {
      font-weight: 800;
      font-size: 8.5pt;
    }
    .test-pattern-type {
      font-weight: 700;
    }
    .test-pattern-date {
      font-size: 7pt;
    }

    .target-banner {
      background: #000;
      color: #fff;
      text-align: center;
      padding: 4px 6px;
      font-size: 9.5pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 6px 0;
    }
    .candidate-level-pill {
      background: #000;
      color: #fff;
      text-align: center;
      padding: 2px 8px;
      font-size: 8.5pt;
      font-weight: 700;
      width: fit-content;
      margin: 0 auto 6px auto;
      border-radius: 3px;
    }
    .test-name-box {
      border: 1.5px solid #000;
      border-radius: 18px;
      text-align: center;
      padding: 5px 12px;
      margin: 0 auto 6px auto;
      width: 90%;
    }
    .test-type-label {
      font-size: 11pt;
      font-weight: 800;
    }
    .test-type-value {
      color: #000;
    }
    .cover-warning-notice {
      text-align: center;
      font-size: 8.5pt;
      line-height: 1.35;
      margin-bottom: 6px;
    }

    .instructions-box-table {
      border: 1.5px solid #000;
      border-radius: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin-bottom: 6px;
      background: #fff;
    }
    .inst-col {
      padding: 5px 8px;
    }
    .inst-col-left {
      border-right: 1.5px solid #000;
      font-family: 'Noto Sans Devanagari', sans-serif;
    }
    .inst-col-right {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .inst-heading {
      font-size: 9pt;
      font-weight: 800;
      margin-bottom: 4px;
      text-decoration: underline;
    }
    .inst-list {
      margin: 0;
      padding-left: 14px;
      font-size: 7.5pt;
      line-height: 1.3;
    }
    .inst-list li {
      margin-bottom: 3px;
    }

    .ambiguity-banner {
      border: 1.5px solid #000;
      border-radius: 8px;
      text-align: center;
      padding: 4px 6px;
      font-size: 7.5pt;
      font-weight: 700;
      margin-bottom: 6px;
      background: #f8fafc;
    }

    .candidate-particulars-box {
      border: 1px solid #000;
      padding: 5px 8px;
      font-size: 7.8pt;
      display: flex;
      flex-direction: column;
      gap: 5px;
      background: #fff;
    }
    .part-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
    }
    .part-row-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .grid-cell {
      display: flex;
      align-items: flex-end;
      gap: 6px;
    }
    .part-label {
      white-space: nowrap;
      font-weight: 700;
      font-size: 7.5pt;
    }
    .part-line {
      flex: 1;
      border-bottom: 1px dotted #000;
      height: 12px;
    }
    .sig-line {
      border-bottom: 1px solid #000;
    }
    .bottom-target-motto {
      background: #000;
      color: #fff;
      text-align: center;
      font-size: 9pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 4px;
      margin-top: 6px;
    }

    .section-divider-banner {
      background: #0f172a;
      color: #fff;
      padding: 4px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9pt;
      font-weight: 800;
      margin-bottom: 8px;
      border-radius: 4px;
    }
    .section-banner-meta {
      font-size: 8pt;
      display: flex;
      gap: 12px;
    }
    .question-block {
      border-bottom: 1px solid #cbd5e1;
      padding: 6px 0 8px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .q-header-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }
    .q-num-badge {
      font-size: 9.5pt;
      font-weight: 800;
      color: #000;
      background: #f1f5f9;
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid #94a3b8;
    }
    .q-statement-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 8.8pt;
      line-height: 1.35;
      margin-bottom: 4px;
    }
    .q-statement-col {
      word-break: break-word;
    }
    .hi-text {
      font-family: 'Noto Sans Devanagari', sans-serif;
      border-right: 1px dashed #cbd5e1;
      padding-right: 10px;
    }
    .en-text {
      padding-left: 2px;
    }
    .q-diagram-container {
      text-align: center;
      margin: 4px 0;
    }
    .q-diagram-img {
      max-width: 85%;
      max-height: 140px;
      object-fit: contain;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .q-options-container {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 3px;
    }
    .q-option-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 8.5pt;
    }
    .q-option-col {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .hi-opt {
      font-family: 'Noto Sans Devanagari', sans-serif;
      border-right: 1px dashed #cbd5e1;
      padding-right: 10px;
    }
    .en-opt {
      padding-left: 2px;
    }
    .opt-label {
      font-weight: 700;
      min-width: 20px;
    }
    .opt-text {
      flex: 1;
    }

    .rough-page-content {
      flex: 1;
      border: 1.5px dashed #94a3b8;
      margin: 10px 0;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
    }
    .rough-watermark {
      font-size: 16pt;
      font-weight: 800;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-align: center;
      pointer-events: none;
    }

    .back-cover-page {
      padding: 8mm;
    }
    .back-cover-border {
      border: 2px solid #000;
      padding: 8mm;
      min-height: 275mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .back-cover-table {
      border: 1.5px solid #000;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .back-col {
      padding: 10px;
    }
    .back-col-hi {
      border-right: 1.5px solid #000;
      font-family: 'Noto Sans Devanagari', sans-serif;
    }
    .back-heading {
      font-size: 11pt;
      font-weight: 800;
      margin-bottom: 8px;
      text-decoration: underline;
    }
    .back-list {
      margin: 0;
      padding-left: 18px;
      font-size: 9pt;
      line-height: 1.5;
    }
    .back-list li {
      margin-bottom: 8px;
    }
    .back-corporate-footer {
      border-top: 2px solid #000;
      padding-top: 10px;
      text-align: center;
    }
    .corp-brand-title {
      font-size: 12pt;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .corp-address {
      font-size: 8.5pt;
      color: #334155;
      margin-top: 2px;
    }
    .corp-contacts {
      font-size: 8pt;
      margin-top: 4px;
      display: flex;
      justify-content: center;
      gap: 10px;
    }

    .ak-header-banner {
      background: #0f172a;
      color: #fff;
      padding: 8px 12px;
      text-align: center;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .ak-main-title {
      font-size: 12pt;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .ak-sub-title {
      font-size: 8.5pt;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .ak-grid-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      text-align: center;
    }
    .ak-grid-table th {
      background: #1e293b;
      color: #fff;
      font-weight: 800;
      padding: 4px 6px;
      border: 1px solid #334155;
    }
    .ak-grid-table td {
      border: 1px solid #cbd5e1;
      padding: 3px 6px;
    }
    .ak-qno {
      font-weight: 700;
      background: #f8fafc;
      width: 11%;
    }
    .ak-ans {
      font-weight: 800;
      color: #1e40af;
      width: 11%;
    }
    .ak-sep {
      background: #0f172a;
      width: 4px;
      padding: 0 !important;
      border: none !important;
    }

    .sol-main-header {
      background: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .sol-main-header h2 {
      margin: 0;
      font-size: 12pt;
      font-weight: 800;
    }
    .sol-main-header p {
      margin: 2px 0 0 0;
      font-size: 8pt;
      color: #475569;
    }
    .sol-section-title {
      background: #1e293b;
      color: white;
      padding: 4px 10px;
      font-size: 9pt;
      font-weight: 800;
      border-radius: 4px;
      margin: 12px 0 6px 0;
    }
    .sol-item-block {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
      background: #fff;
    }
    .sol-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .sol-q-badge {
      font-size: 9pt;
      font-weight: 800;
      background: #0f172a;
      color: #fff;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .sol-correct-badge {
      font-size: 8.5pt;
      color: #047857;
      font-weight: 700;
    }
    .sol-subject-tag {
      font-size: 7.5pt;
      color: #64748b;
      margin-left: auto;
      font-weight: 600;
    }
    .sol-statement-brief {
      font-size: 8.2pt;
      color: #334155;
      border-left: 2px solid #cbd5e1;
      padding-left: 6px;
      margin-bottom: 6px;
    }
    .sol-explanation-box {
      background: #f8fafc;
      border-radius: 4px;
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
    }
    .sol-heading {
      font-size: 8pt;
      font-weight: 700;
      color: #4f46e5;
      margin-bottom: 3px;
    }
    .sol-body-content {
      font-size: 8.5pt;
      line-height: 1.4;
      color: #0f172a;
    }
    .sol-en {
      margin-bottom: 4px;
    }
    .sol-hi {
      font-family: 'Noto Sans Devanagari', sans-serif;
      color: #1e293b;
      border-top: 1px dashed #e2e8f0;
      padding-top: 3px;
    }
  </style>
</head>
<body>

  <div class="print-bar no-print">
    <div>
      <h1>${brandName} — ${test.name}</h1>
      <div style="font-size: 11px; opacity: 0.8;">${test.code} · ${withSolution ? "With Complete Solutions & Answer Key" : "Without Solution (Exam Paper)"}</div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" class="print-bar-btn">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
        <span>Print or Save as PDF</span>
      </button>
    </div>
  </div>

  <div class="doc-container">
    ${frontCoverHtml}
    ${questionPagesHtml}
    ${finalRoughPagesHtml}
    ${backCoverHtml}
    ${solutionsSectionHtml}
  </div>

</body>
</html>`;
}
