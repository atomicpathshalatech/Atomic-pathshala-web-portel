import { prisma } from "@/lib/db";
import c11Phys from "./c11-physics.json";
import c11Chem from "./c11-chemistry.json";
import c11Bio from "./c11-biology.json";
import c11Math from "./c11-maths.json";
import c12Phys from "./c12-physics.json";
import c12Chem from "./c12-chemistry.json";
import c12Bio from "./c12-biology.json";
import c12Math from "./c12-maths.json";

const DATASETS = [
  { classNum: 11, data: c11Bio },
  { classNum: 11, data: c11Phys },
  { classNum: 11, data: c11Chem },
  { classNum: 11, data: c11Math },
  { classNum: 12, data: c12Bio },
  { classNum: 12, data: c12Phys },
  { classNum: 12, data: c12Chem },
  { classNum: 12, data: c12Math },
];

export async function syncNcertTaxonomy(): Promise<{ classesSynced: number; subjectsSynced: number; chaptersSynced: number }> {
  let classesSynced = 0;
  let subjectsSynced = 0;
  let chaptersSynced = 0;

  for (const ds of DATASETS) {
    const classNum = ds.classNum;
    const className = `Class ${classNum}`;

    const academicClass = await prisma.academicClass.upsert({
      where: { numericValue: classNum },
      update: { name: className, isActive: true },
      create: { name: className, numericValue: classNum, order: classNum === 11 ? 1 : 2, isActive: true },
    });
    classesSynced++;

    const subjectName = ds.data.name;
    const subjectNameHindi = ds.data.nameHindi || null;
    const subjectCode = ds.data.code || `${subjectName.slice(0, 3).toUpperCase()}-${classNum}`;

    const academicSubject = await prisma.academicSubject.upsert({
      where: {
        classId_name: {
          classId: academicClass.id,
          name: subjectName,
        },
      },
      update: {
        nameHindi: subjectNameHindi,
        code: subjectCode,
        isActive: true,
      },
      create: {
        classId: academicClass.id,
        name: subjectName,
        nameHindi: subjectNameHindi,
        code: subjectCode,
        isActive: true,
      },
    });
    subjectsSynced++;

    // Process chapters
    for (const ch of ds.data.chapters) {
      await prisma.academicChapter.upsert({
        where: {
          subjectId_chapterNumber: {
            subjectId: academicSubject.id,
            chapterNumber: ch.chapterNumber,
          },
        },
        update: {
          title: ch.title,
          titleHindi: ch.titleHindi || null,
          displayOrder: ch.chapterNumber,
          isActive: true,
        },
        create: {
          subjectId: academicSubject.id,
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          titleHindi: ch.titleHindi || null,
          displayOrder: ch.chapterNumber,
          isActive: true,
        },
      });
      chaptersSynced++;
    }
  }

  return { classesSynced, subjectsSynced, chaptersSynced };
}
