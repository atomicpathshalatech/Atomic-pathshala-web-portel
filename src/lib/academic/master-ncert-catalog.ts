/**
 * Master NCERT Catalog
 * Single source of truth for NCERT Class 11 & Class 12 Syllabus
 * Directly sourced from official NCERT datasets and Question Bank Hierarchical structure.
 */

import c11Phys from "./c11-physics.json";
import c11Chem from "./c11-chemistry.json";
import c11Bio from "./c11-biology.json";
import c11Math from "./c11-maths.json";
import c12Phys from "./c12-physics.json";
import c12Chem from "./c12-chemistry.json";
import c12Bio from "./c12-biology.json";
import c12Math from "./c12-maths.json";

export interface MasterNcertSubject {
  id: string;
  name: string;
  nameHindi: string;
}

export interface MasterNcertChapter {
  id: string;
  title: string;
  titleHindi?: string | null;
  chapterNumber: number;
  classNumber: number;
  className: string;
  displayTitle: string; // e.g. "Ch 1: The Living World (Class 11)"
}

export interface MasterNcertTopic {
  id: string;
  title: string;
  titleHindi?: string | null;
  topicNumber?: string;
  subtopics: string[];
}

const ncertDatasets = [
  { classNum: 11, data: c11Phys },
  { classNum: 11, data: c11Chem },
  { classNum: 11, data: c11Bio },
  { classNum: 11, data: c11Math },
  { classNum: 12, data: c12Phys },
  { classNum: 12, data: c12Chem },
  { classNum: 12, data: c12Bio },
  { classNum: 12, data: c12Math },
];

/**
 * Returns all distinct subjects across NCERT Class 11 & 12
 */
export function getMasterNcertSubjects(): MasterNcertSubject[] {
  return [
    { id: "Biology", name: "Biology", nameHindi: "जीव विज्ञान" },
    { id: "Physics", name: "Physics", nameHindi: "भौतिक विज्ञान" },
    { id: "Chemistry", name: "Chemistry", nameHindi: "रसायन विज्ञान" },
    { id: "Mathematics", name: "Mathematics", nameHindi: "गणित" },
  ];
}

/**
 * Returns all chapters for a given subject across Class 11 and Class 12
 */
export function getMasterNcertChapters(subjectName: string): MasterNcertChapter[] {
  const norm = subjectName.trim().toLowerCase();
  const matchedDatasets = ncertDatasets.filter(
    (ds) => ds.data.name.toLowerCase() === norm || norm.includes(ds.data.name.toLowerCase())
  );

  const chapters: MasterNcertChapter[] = [];

  for (const ds of matchedDatasets) {
    const classNum = ds.classNum;
    const className = `Class ${classNum}`;

    for (const ch of ds.data.chapters) {
      const displayTitle = `[${className}] Ch ${ch.chapterNumber}: ${ch.title}`;
      chapters.push({
        id: `ncert-c${classNum}-${ds.data.name.toLowerCase()}-ch${ch.chapterNumber}`,
        title: ch.title,
        titleHindi: ch.titleHindi || null,
        chapterNumber: ch.chapterNumber,
        classNumber: classNum,
        className,
        displayTitle,
      });
    }
  }

  // Sort by Class then Chapter number
  chapters.sort((a, b) => {
    if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber;
    return a.chapterNumber - b.chapterNumber;
  });

  return chapters;
}

/**
 * Returns all NCERT topics for a given subject and chapter
 */
export function getMasterNcertTopics(
  subjectName: string,
  chapterName: string
): MasterNcertTopic[] {
  const normSub = subjectName.trim().toLowerCase();
  const normChap = chapterName.trim().toLowerCase();

  // Strip prefix like "[Class 11] Ch 1: " or "Ch 1: " if passed from displayTitle
  const cleanChap = normChap
    .replace(/^\[class\s*\d+\]\s*/i, "")
    .replace(/^ch\s*\d+:\s*/i, "")
    .replace(/^\d+[\.:\s-]+/i, "")
    .trim();

  const matchedDatasets = ncertDatasets.filter(
    (ds) => ds.data.name.toLowerCase() === normSub || normSub.includes(ds.data.name.toLowerCase())
  );

  const topics: MasterNcertTopic[] = [];

  for (const ds of matchedDatasets) {
    for (const ch of ds.data.chapters) {
      const chClean = ch.title.trim().toLowerCase();
      // Match chapter title
      if (
        chClean === cleanChap ||
        cleanChap.includes(chClean) ||
        chClean.includes(cleanChap)
      ) {
        for (const t of ch.topics) {
          topics.push({
            id: `ncert-top-${t.topicNumber || t.title}`,
            title: t.title,
            titleHindi: t.titleHindi || null,
            topicNumber: t.topicNumber,
            subtopics: [],
          });
        }
      }
    }
  }

  return topics;
}
