import { prisma } from '@/lib/db';
import { ProgramName } from '@prisma/client';
import c11Phys from './c11-physics.json';
import c11Chem from './c11-chemistry.json';
import c11Bio from './c11-biology.json';
import c11Math from './c11-maths.json';
import c12Phys from './c12-physics.json';
import c12Chem from './c12-chemistry.json';
import c12Bio from './c12-biology.json';
import c12Math from './c12-maths.json';

const datasets = [
  { classNum: 11, data: c11Phys },
  { classNum: 11, data: c11Chem },
  { classNum: 11, data: c11Bio },
  { classNum: 11, data: c11Math },
  { classNum: 12, data: c12Phys },
  { classNum: 12, data: c12Chem },
  { classNum: 12, data: c12Bio },
  { classNum: 12, data: c12Math },
];

export async function seedAcademicHierarchy() {
  console.log('--- Starting NCERT Master Academic Hierarchy Seeding ---');

  for (const item of datasets) {
    const classNum = item.classNum;
    const ds = item.data;
    const className = `Class ${classNum}`;

    const academicClass = await prisma.academicClass.upsert({
      where: { numericValue: classNum },
      update: { name: className },
      create: {
        name: className,
        numericValue: classNum,
      },
    });

    const subject = await prisma.academicSubject.upsert({
      where: {
        classId_name: {
          classId: academicClass.id,
          name: ds.name,
        },
      },
      update: {
        nameHindi: ds.nameHindi || null,
        isSystem: true,
        order: ds.name === 'Physics' ? 1 : ds.name === 'Chemistry' ? 2 : ds.name === 'Biology' ? 3 : 4,
      },
      create: {
        classId: academicClass.id,
        name: ds.name,
        nameHindi: ds.nameHindi || null,
        code: ds.code || `${ds.name.substring(0, 3).toUpperCase()}_C${classNum}`,
        isSystem: true,
        order: ds.name === 'Physics' ? 1 : ds.name === 'Chemistry' ? 2 : ds.name === 'Biology' ? 3 : 4,
      },
    });

    const bookMap = new Map<number, string>();
    for (const bookInfo of ds.books) {
      const book = await prisma.academicBook.upsert({
        where: {
          id: `${subject.id}_part_${bookInfo.partNumber}`,
        },
        update: {
          title: bookInfo.title,
          titleHindi: bookInfo.titleHindi || null,
        },
        create: {
          id: `${subject.id}_part_${bookInfo.partNumber}`,
          subjectId: subject.id,
          title: bookInfo.title,
          titleHindi: bookInfo.titleHindi || null,
          partNumber: bookInfo.partNumber,
        },
      });
      bookMap.set(bookInfo.partNumber, book.id);
    }

    let chDisplayOrder = 1;
    for (const chData of ds.chapters) {
      const bookId = chData.bookPart ? bookMap.get(chData.bookPart) || null : null;

      const chapter = await prisma.academicChapter.upsert({
        where: {
          subjectId_chapterNumber: {
            subjectId: subject.id,
            chapterNumber: chData.chapterNumber,
          },
        },
        update: {
          title: chData.title,
          titleHindi: chData.titleHindi || null,
          bookId,
          displayOrder: chDisplayOrder,
          isSystem: true,
        },
        create: {
          subjectId: subject.id,
          bookId,
          chapterNumber: chData.chapterNumber,
          title: chData.title,
          titleHindi: chData.titleHindi || null,
          displayOrder: chDisplayOrder,
          isSystem: true,
        },
      });
      chDisplayOrder++;

      let topicOrder = 1;
      for (const tData of chData.topics) {
        await prisma.academicTopic.upsert({
          where: {
            chapterId_topicNumber_title: {
              chapterId: chapter.id,
              topicNumber: tData.topicNumber,
              title: tData.title,
            },
          },
          update: {
            titleHindi: tData.titleHindi || null,
            displayOrder: topicOrder,
            isSystem: true,
          },
          create: {
            chapterId: chapter.id,
            topicNumber: tData.topicNumber,
            title: tData.title,
            titleHindi: tData.titleHindi || null,
            displayOrder: topicOrder,
            isSystem: true,
          },
        });
        topicOrder++;
      }

      const isNeetEligible = ['Physics', 'Chemistry', 'Biology'].includes(ds.name);
      if (isNeetEligible) {
        await prisma.programMapping.upsert({
          where: {
            programName_chapterId_topicId: {
              programName: ProgramName.NEET,
              chapterId: chapter.id,
              topicId: '',
            },
          },
          update: {
            classId: academicClass.id,
            subjectId: subject.id,
          },
          create: {
            programName: ProgramName.NEET,
            classId: academicClass.id,
            subjectId: subject.id,
            chapterId: chapter.id,
            topicId: '',
          },
        });
      }

      const isJeeEligible = ['Physics', 'Chemistry', 'Mathematics'].includes(ds.name);
      if (isJeeEligible) {
        await prisma.programMapping.upsert({
          where: {
            programName_chapterId_topicId: {
              programName: ProgramName.JEE_MAIN,
              chapterId: chapter.id,
              topicId: '',
            },
          },
          update: {
            classId: academicClass.id,
            subjectId: subject.id,
          },
          create: {
            programName: ProgramName.JEE_MAIN,
            classId: academicClass.id,
            subjectId: subject.id,
            chapterId: chapter.id,
            topicId: '',
          },
        });
      }

      await prisma.programMapping.upsert({
        where: {
          programName_chapterId_topicId: {
            programName: ProgramName.CBSE_BOARD,
            chapterId: chapter.id,
            topicId: '',
          },
        },
        update: {
          classId: academicClass.id,
          subjectId: subject.id,
        },
        create: {
          programName: ProgramName.CBSE_BOARD,
          classId: academicClass.id,
          subjectId: subject.id,
          chapterId: chapter.id,
          topicId: '',
        },
      });
    }
  }

  console.log('--- NCERT Master Academic Hierarchy Seeding Completed! ---');
}