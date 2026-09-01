const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const c11Physics = require('../src/lib/academic/c11-physics.json');
const c11Chemistry = require('../src/lib/academic/c11-chemistry.json');
const c11Biology = require('../src/lib/academic/c11-biology.json');
const c11Maths = require('../src/lib/academic/c11-maths.json');
const c12Physics = require('../src/lib/academic/c12-physics.json');
const c12Chemistry = require('../src/lib/academic/c12-chemistry.json');
const c12Biology = require('../src/lib/academic/c12-biology.json');
const c12Maths = require('../src/lib/academic/c12-maths.json');

async function run() {
  console.log('=== STARTING NCERT ACDEMIC SEEDING ===');

  const class11 = await prisma.academicClass.upsert({
    where: { numericValue: 11 },
    update: { name: 'Class 11', order: 1, isActive: true },
    create: { name: 'Class 11', numericValue: 11, order: 1, isActive: true },
  });

  const class12 = await prisma.academicClass.upsert({
    where: { numericValue: 12 },
    update: { name: 'Class 12', order: 2, isActive: true },
    create: { name: 'Class 12', numericValue: 12, order: 2, isActive: true },
  });

  const classPayloads = [
    { classRecord: class11, subjects: [c11Physics, c11Chemistry, c11Biology, c11Maths] },
    { classRecord: class12, subjects: [c12Physics, c12Chemistry, c12Biology, c12Maths] },
  ];

  let totalChapters = 0;
  let totalTopics = 0;

  for (const { classRecord, subjects } of classPayloads) {
    console.log('Seeding ' + classRecord.name + '...');

    for (const sub of subjects) {
      const subjectRecord = await prisma.academicSubject.upsert({
        where: {
          classId_name: {
            classId: classRecord.id,
            name: sub.name,
          },
        },
        update: {
          nameHindi: sub.nameHindi,
          code: sub.code,
          isSystem: true,
          isActive: true,
        },
        create: {
          classId: classRecord.id,
          name: sub.name,
          nameHindi: sub.nameHindi,
          code: sub.code,
          isSystem: true,
          isActive: true,
        },
      });

      const bookMap = new Map();
      for (const b of sub.books) {
        const bookRecord = await prisma.academicBook.findFirst({
          where: { subjectId: subjectRecord.id, partNumber: b.partNumber },
        });
        if (bookRecord) {
          bookMap.set(b.partNumber, bookRecord.id);
        } else {
          const created = await prisma.academicBook.create({
            data: {
              subjectId: subjectRecord.id,
              title: b.title,
              titleHindi: b.titleHindi,
              partNumber: b.partNumber,
              editionYear: '2024-25 Rationalised',
              isSystem: true,
            },
          });
          bookMap.set(b.partNumber, created.id);
        }
      }

      for (const ch of sub.chapters) {
        const bookId = ch.bookPart ? bookMap.get(ch.bookPart) || null : null;

        const chapterRecord = await prisma.academicChapter.upsert({
          where: {
            subjectId_chapterNumber: {
              subjectId: subjectRecord.id,
              chapterNumber: ch.chapterNumber,
            },
          },
          update: {
            title: ch.title,
            titleHindi: ch.titleHindi,
            bookId,
            displayOrder: ch.chapterNumber,
            isSystem: true,
            isRationalised: true,
            isActive: true,
          },
          create: {
            subjectId: subjectRecord.id,
            bookId,
            chapterNumber: ch.chapterNumber,
            title: ch.title,
            titleHindi: ch.titleHindi,
            displayOrder: ch.chapterNumber,
            isSystem: true,
            isRationalised: true,
            isActive: true,
          },
        });
        totalChapters++;

        let tOrder = 1;
        for (const top of ch.topics) {
          await prisma.academicTopic.upsert({
            where: {
              chapterId_topicNumber_title: {
                chapterId: chapterRecord.id,
                topicNumber: top.topicNumber,
                title: top.title,
              },
            },
            update: {
              titleHindi: top.titleHindi,
              displayOrder: tOrder,
              isSystem: true,
              isActive: true,
            },
            create: {
              chapterId: chapterRecord.id,
              topicNumber: top.topicNumber,
              title: top.title,
              titleHindi: top.titleHindi,
              displayOrder: tOrder,
              isSystem: true,
              isActive: true,
            },
          });
          totalTopics++;
          tOrder++;
        }

        // Program Mappings
        if (['Physics', 'Chemistry', 'Biology'].includes(sub.name)) {
          const existing = await prisma.programMapping.findFirst({
            where: { programName: 'NEET', chapterId: chapterRecord.id, topicId: null }
          });
          if (!existing) {
            await prisma.programMapping.create({
              data: {
                programName: 'NEET',
                classId: classRecord.id,
                subjectId: subjectRecord.id,
                chapterId: chapterRecord.id,
                isActive: true,
              }
            });
          }
        }

        if (['Physics', 'Chemistry', 'Mathematics'].includes(sub.name)) {
          const existing = await prisma.programMapping.findFirst({
            where: { programName: 'JEE_MAIN', chapterId: chapterRecord.id, topicId: null }
          });
          if (!existing) {
            await prisma.programMapping.create({
              data: {
                programName: 'JEE_MAIN',
                classId: classRecord.id,
                subjectId: subjectRecord.id,
                chapterId: chapterRecord.id,
                isActive: true,
              }
            });
          }
        }

        const existingCbse = await prisma.programMapping.findFirst({
          where: { programName: 'CBSE_BOARD', chapterId: chapterRecord.id, topicId: null }
        });
        if (!existingCbse) {
          await prisma.programMapping.create({
            data: {
              programName: 'CBSE_BOARD',
              classId: classRecord.id,
              subjectId: subjectRecord.id,
              chapterId: chapterRecord.id,
              isActive: true,
            }
          });
        }
      }
    }
  }

  console.log('=== NCERT ACADEMIC SEED FINISHED: ' + totalChapters + ' Chapters, ' + totalTopics + ' Topics ===');
}

run().finally(() => prisma.$disconnect());
