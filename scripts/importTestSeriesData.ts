import fs from "fs";
import path from "path";
import { PrismaClient, QuestionType, Difficulty } from "@prisma/client";
import bcrypt from "bcryptjs";

// Load .env manually
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || "";
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
  }
} catch (e) {}

const TARGET_DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.itronpjlguvyrfwzxijh:AtomicPathshala9812@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const NEON_DB_URL =
  process.env.NEON_DATABASE_URL ||
  "postgresql://neondb_owner:npg_ai18FDPdAYyz@ep-floral-paper-ay3zi0t8-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const targetPrisma = new PrismaClient({
  datasources: { db: { url: TARGET_DB_URL } },
});
const sourcePrisma = new PrismaClient({
  datasources: { db: { url: NEON_DB_URL } },
});

async function main() {
  console.log("==================================================");
  console.log("STARTING ATOMIC TEST SERIES DATA IMPORT");
  console.log("==================================================");

  // 1. Fetch Target Roles
  const roles = await targetPrisma.role.findMany();
  const roleMap: Record<string, string> = {};
  for (const r of roles) {
    roleMap[r.name.toUpperCase()] = r.id;
  }
  const studentRoleId = roleMap["STUDENT"] || roles[0]?.id;
  const teacherRoleId = roleMap["TEACHER"] || roles[0]?.id;
  const superAdminRoleId = roleMap["SUPER_ADMIN"] || roleMap["ADMIN"] || roles[0]?.id;

  console.log("Target roles configured. Student role ID:", studentRoleId);

  // 2. Fetch Users & Students from Neon with automatic wake-up retry
  let neonUsers: any[] = [];
  let neonStudents: any[] = [];
  let neonQuestions: any[] = [];
  let neonSeries: any[] = [];
  let neonTests: any[] = [];

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      console.log(`Attempting to connect to Neon DB (attempt ${attempt}/4)...`);
      neonUsers = await sourcePrisma.user.findMany();
      neonStudents = await sourcePrisma.student.findMany();
      neonQuestions = await sourcePrisma.question.findMany({ include: { translations: true } });
      neonSeries = await sourcePrisma.testSeries.findMany();
      neonTests = await sourcePrisma.test.findMany({
        include: {
          sections: { include: { questions: true } },
          attempts: { include: { answers: true, violations: true, analysis: true } },
        },
      });
      console.log("✓ Connected to Neon DB successfully!");
      break;
    } catch (neonErr: any) {
      console.warn(`! Neon connection attempt ${attempt} failed: ${neonErr.message || neonErr}`);
      if (attempt < 4) {
        console.log("Waiting 3 seconds for Neon compute to spin up...");
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        throw neonErr;
      }
    }
  }

  // Map of old userId to new target userId
  const userIdMap = new Map<string, string>();
  // Map of old studentId to new target studentId
  const studentIdMap = new Map<string, string>();

  for (const u of neonUsers) {
    try {
      let roleId = studentRoleId;
      const isTeacher = u.roleId && (u.email?.includes("teacher") || u.position?.toLowerCase().includes("teacher"));
      const isAdmin = u.email?.includes("admin");
      if (isAdmin) roleId = superAdminRoleId;
      else if (isTeacher) roleId = teacherRoleId;

      const upserted = await targetPrisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          phone: u.phone,
          status: u.status || "ACTIVE",
          lastLoginAt: u.lastLoginAt,
        },
        create: {
          name: u.name,
          email: u.email,
          phone: u.phone,
          passwordHash: u.passwordHash,
          status: u.status || "ACTIVE",
          roleId,
          securityQuestion: u.securityQuestion,
          securityAnswerHash: u.securityAnswerHash,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
        },
      });
      userIdMap.set(u.id, upserted.id);
      console.log(`✓ User imported: ${u.email} (${upserted.id})`);
    } catch (err) {
      console.warn(`! Warning importing user ${u.email}:`, err);
    }
  }

  // Import Students
  for (const s of neonStudents) {
    try {
      const targetUserId = userIdMap.get(s.userId);
      if (!targetUserId) {
        console.warn(`! Student user not found for student ${s.enrollmentNumber}`);
        continue;
      }

      const existingStudent = await targetPrisma.student.findFirst({
        where: {
          OR: [{ userId: targetUserId }, { enrollmentNumber: s.enrollmentNumber }],
        },
      });

      let targetStudentId = "";
      if (existingStudent) {
        const updated = await targetPrisma.student.update({
          where: { id: existingStudent.id },
          data: {
            fatherName: s.fatherName,
            motherName: s.motherName,
            dob: s.dob,
            gender: s.gender,
            class: s.class,
            targetExam: s.targetExam,
            school: s.school,
            city: s.city,
            state: s.state,
            address: s.address,
            bloodGroup: s.bloodGroup,
            emergencyContact: s.emergencyContact,
            xp: s.xp,
            level: s.level,
            currentStreakDays: s.currentStreakDays,
            longestStreakDays: s.longestStreakDays,
          },
        });
        targetStudentId = updated.id;
      } else {
        const created = await targetPrisma.student.create({
          data: {
            userId: targetUserId,
            enrollmentNumber: s.enrollmentNumber,
            studentIdCode: s.studentIdCode,
            fatherName: s.fatherName,
            motherName: s.motherName,
            dob: s.dob,
            gender: s.gender,
            class: s.class,
            targetExam: s.targetExam,
            school: s.school,
            city: s.city,
            state: s.state,
            address: s.address,
            bloodGroup: s.bloodGroup,
            emergencyContact: s.emergencyContact,
            xp: s.xp,
            level: s.level,
            currentStreakDays: s.currentStreakDays,
            longestStreakDays: s.longestStreakDays,
            createdAt: s.createdAt,
          },
        });
        targetStudentId = created.id;
      }
      studentIdMap.set(s.id, targetStudentId);
      console.log(`✓ Student profile imported: ${s.enrollmentNumber} (${targetStudentId})`);
    } catch (err) {
      console.warn(`! Warning importing student ${s.enrollmentNumber}:`, err);
    }
  }

  // 3. Import Extra Demo Students & Teachers from seed
  const defaultHash = await bcrypt.hash("password123", 10);
  const extraSeedUsers = [
    {
      name: "Demo Student",
      email: "student@atp.test",
      enrollment: "AP-DEMO-001",
      city: "Aligarh",
      state: "Uttar Pradesh",
      school: "Atomic Pathshala",
      class: "Dropper 2027",
      targetExam: "NEET",
      roleId: studentRoleId,
    },
    {
      name: "Ananya Sharma",
      email: "ananya@atp.test",
      enrollment: "AP-DEMO-002",
      city: "New Delhi",
      state: "Delhi",
      school: "Allen Institute",
      class: "Dropper 2027",
      targetExam: "NEET",
      roleId: studentRoleId,
    },
    {
      name: "Rahul Verma",
      email: "rahul@atp.test",
      enrollment: "AP-DEMO-003",
      city: "Kota",
      state: "Rajasthan",
      school: "Atomic Pathshala",
      class: "Target 2027",
      targetExam: "NEET",
      roleId: studentRoleId,
    },
    {
      name: "Priya Singh",
      email: "priya@atp.test",
      enrollment: "AP-DEMO-004",
      city: "Lucknow",
      state: "Uttar Pradesh",
      school: "Allen Institute",
      class: "Dropper 2027",
      targetExam: "NEET",
      roleId: studentRoleId,
    },
    {
      name: "Rakesh Sharma",
      email: "physics.teacher@atp.test",
      roleId: teacherRoleId,
    },
  ];

  for (const eu of extraSeedUsers) {
    try {
      const u = await targetPrisma.user.upsert({
        where: { email: eu.email },
        update: { name: eu.name },
        create: {
          name: eu.name,
          email: eu.email,
          passwordHash: defaultHash,
          roleId: eu.roleId,
          status: "ACTIVE",
        },
      });

      if (eu.enrollment) {
        const s = await targetPrisma.student.upsert({
          where: { enrollmentNumber: eu.enrollment },
          update: {
            city: eu.city,
            state: eu.state,
            school: eu.school,
            class: eu.class,
          },
          create: {
            userId: u.id,
            enrollmentNumber: eu.enrollment,
            studentIdCode: eu.enrollment,
            fatherName: "Parent",
            motherName: "Parent",
            city: eu.city,
            state: eu.state,
            school: eu.school,
            class: eu.class,
            targetExam: eu.targetExam,
          },
        });
        studentIdMap.set(eu.email, s.id);
        console.log(`✓ Seed student imported: ${eu.name} (${eu.email})`);
      }
    } catch (seedUserErr) {
      console.warn(`! Warning creating seed user ${eu.email}:`, seedUserErr);
    }
  }

  // 4. Import All Questions to DRAFT
  console.log("\n--- Importing Questions into DRAFT Pool ---");
  console.log(`Using ${neonQuestions.length} questions from source DB.`);

  const questionIdMap = new Map<string, string>();

  // Map to target Prisma QuestionType
  function mapQType(qt: string): QuestionType {
    const u = qt?.toUpperCase() || "";
    if (u.includes("MULTI")) return QuestionType.MULTIPLE_CORRECT;
    if (u.includes("INTEGER") || u.includes("NUMERICAL")) return QuestionType.INTEGER;
    if (u.includes("STATEMENT")) return QuestionType.STATEMENT_BASED;
    if (u.includes("MATCH")) return QuestionType.MATCH_COLUMN;
    if (u.includes("ASSERTION")) return QuestionType.ASSERTION_REASON;
    return QuestionType.SINGLE_CORRECT;
  }

  function mapDiff(df: string): Difficulty {
    const u = df?.toUpperCase() || "";
    if (u === "EASY") return Difficulty.EASY;
    if (u === "HARD" || u === "VERY_HARD" || u === "ULTRA") return Difficulty.HARD;
    return Difficulty.MEDIUM;
  }

  const defaultAdmin = await targetPrisma.user.findFirst({
    where: { role: { name: { in: ["ADMIN", "SUPER_ADMIN"] } } },
  });
  const systemAdminId = defaultAdmin?.id || (await targetPrisma.user.findFirst())?.id || "";

  for (const q of neonQuestions) {
    try {
      const code = q.questionCode || `CBT-${Math.floor(100 + Math.random() * 900)}`;

      // Check if question exists in target
      let targetQ = await targetPrisma.question.findFirst({
        where: {
          OR: [{ questionCode: code }, { id: q.id }],
        },
      });

      if (!targetQ) {
        targetQ = await targetPrisma.question.create({
          data: {
            id: q.id,
            questionCode: code,
            subject: q.subject,
            chapter: q.chapter || "General",
            topic: q.topic || "General",
            subTopic: q.subTopic || null,
            type: mapQType(q.type),
            difficulty: mapDiff(q.difficulty),
            category: "TEST_SERIES_IMPORTED",
            status: "DRAFT", // strictly DRAFT as requested
            solution: q.solution,
            imageUrl: q.imageUrl,
            tags: "TEST_SERIES, IMPORTED, ATOMIC_TEST_PORTAL",
            createdById: systemAdminId,
            translations: {
              create: q.translations.map((t) => ({
                language: t.language.toUpperCase().startsWith("HI") ? "HINDI" : "ENGLISH",
                statement: t.statement,
                options: (t.options as any) || {},
                correctOptionIds: t.correctOptionIds || [],
                solution: t.solution || q.solution || "",
              })),
            },
          },
        });
      } else {
        // Ensure status is DRAFT
        await targetPrisma.question.update({
          where: { id: targetQ.id },
          data: { status: "DRAFT" },
        });
      }

      questionIdMap.set(q.id, targetQ.id);
      console.log(`✓ Question imported as DRAFT: ${code} - ${q.subject} : ${q.chapter} (${targetQ.id})`);
    } catch (qErr) {
      console.warn(`! Warning importing question ${q.id}:`, qErr);
    }
  }

  // Also import seed questions from atomic-test-portal
  const seedQuestions = [
    {
      id: "seed-q1-laws-of-motion",
      code: "PHY-001",
      subject: "Physics",
      topic: "Laws of Motion",
      type: QuestionType.SINGLE_CORRECT,
      difficulty: Difficulty.EASY,
      translations: [
        {
          language: "ENGLISH",
          statement: "Newton's first law is also known as the law of:",
          options: { A: "Inertia", B: "Momentum", C: "Gravitation", D: "Action-Reaction" },
          correctOptionIds: ["A"],
          solution: "Newton's first law states that an object remains in a state of rest or uniform motion unless acted upon by an external force. This property is known as inertia.",
        },
        {
          language: "HINDI",
          statement: "न्यूटन का पहला नियम किस नाम से भी जाना जाता है:",
          options: { A: "जड़त्व", B: "संवेग", C: "गुरुत्वाकर्षण", D: "क्रिया-प्रतिक्रिया" },
          correctOptionIds: ["A"],
          solution: "न्यूटन के प्रथम नियम को जड़त्व का नियम भी कहा जाता है।",
        },
      ],
    },
    {
      id: "seed-q2-periodic-table",
      code: "CHM-001",
      subject: "Chemistry",
      topic: "Periodic Table",
      type: QuestionType.SINGLE_CORRECT,
      difficulty: Difficulty.MEDIUM,
      translations: [
        {
          language: "ENGLISH",
          statement: "Which element has the highest electronegativity?",
          options: { A: "Oxygen", B: "Fluorine", C: "Nitrogen", D: "Chlorine" },
          correctOptionIds: ["B"],
          solution: "Fluorine (F) has the highest electronegativity on the Pauling scale (3.98).",
        },
        {
          language: "HINDI",
          statement: "किस तत्व की विद्युत ऋणात्मकता सबसे अधिक होती है?",
          options: { A: "ऑक्सीजन", B: "फ्लोरीन", C: "नाइट्रोजन", D: "क्लोरीन" },
          correctOptionIds: ["B"],
          solution: "पॉलिंग पैमाने पर फ्लोरीन (F) की विद्युत ऋणात्मकता सबसे अधिक (3.98) होती है।",
        },
      ],
    },
  ];

  for (const sq of seedQuestions) {
    try {
      const existing = await targetPrisma.question.findFirst({
        where: { OR: [{ id: sq.id }, { questionCode: sq.code }] },
      });
      if (!existing) {
        const created = await targetPrisma.question.create({
          data: {
            id: sq.id,
            questionCode: sq.code,
            subject: sq.subject,
            chapter: sq.topic,
            topic: sq.topic,
            type: sq.type,
            difficulty: sq.difficulty,
            category: "TEST_SERIES_IMPORTED",
            status: "DRAFT",
            tags: "TEST_SERIES, SEED_IMPORT",
            createdById: systemAdminId,
            translations: {
              create: sq.translations.map((t) => ({
                language: t.language as any,
                statement: t.statement,
                options: t.options,
                correctOptionIds: t.correctOptionIds,
                solution: t.solution,
              })),
            },
          },
        });
        questionIdMap.set(sq.id, created.id);
        console.log(`✓ Seed Question imported as DRAFT: ${sq.code} (${created.id})`);
      }
    } catch (sqErr) {
      console.warn(`! Warning importing seed question ${sq.code}:`, sqErr);
    }
  }

  // 5. Import Test Series & Tests
  console.log("\n--- Importing Test Series and Conducted Tests ---");
  for (const s of neonSeries) {
    try {
      if (s.code) {
        await targetPrisma.testSeries.upsert({
          where: { code: s.code },
          update: {
            name: s.name,
            targetBatch: s.targetBatch,
          },
          create: {
            id: s.id,
            name: s.name,
            code: s.code,
            targetBatch: s.targetBatch,
          },
        });
        console.log(`✓ TestSeries imported: ${s.name} (${s.code})`);
      }
    } catch (sErr) {
      console.warn(`! Warning importing test series ${s.id}:`, sErr);
    }
  }

  // Also ensure NEET27 series exists
  await targetPrisma.testSeries.upsert({
    where: { code: "NEET27" },
    update: {},
    create: {
      id: "series-neet-2027",
      name: "NEET 2027 Test Series",
      code: "NEET27",
      targetBatch: "Dropper 2027",
    },
  }).catch(() => {});

  for (const t of neonTests) {
    try {
      const existingTest = await targetPrisma.test.findFirst({
        where: { OR: [{ id: t.id }, t.code ? { code: t.code } : { id: t.id }] },
      });

      const testSeriesId = t.testSeriesId
        ? (await targetPrisma.testSeries.findUnique({ where: { id: t.testSeriesId } }))?.id || null
        : null;

      let targetTestId = "";
      if (!existingTest) {
        const createdTest = await targetPrisma.test.create({
          data: {
            id: t.id,
            name: t.name,
            code: t.code,
            testSeriesId,
            languageMode: t.languageMode,
            durationMin: t.durationMin,
            openTime: t.openTime,
            closeTime: t.closeTime,
            correctMarks: t.correctMarks,
            incorrectMarks: t.incorrectMarks,
            negativeMarkingEnabled: t.negativeMarkingEnabled,
            questionFormat: t.questionFormat,
            testType: t.testType,
            examType: t.examType,
            description: t.description,
            instructions: t.instructions,
            status: t.status,
            createdAt: t.createdAt,
          },
        });
        targetTestId = createdTest.id;
      } else {
        targetTestId = existingTest.id;
      }

      console.log(`✓ Test imported: ${t.name} [Status: ${t.status}] (${targetTestId})`);

      // Import Sections & SectionQuestion links
      for (const sec of t.sections) {
        let targetSection = await targetPrisma.section.findFirst({
          where: { testId: targetTestId, name: sec.name },
        });

        if (!targetSection) {
          targetSection = await targetPrisma.section.create({
            data: {
              id: sec.id,
              testId: targetTestId,
              name: sec.name,
              order: sec.order,
              subject: sec.subject,
              targetCount: sec.targetCount,
              marksPerQuestion: sec.marksPerQuestion,
              negativeMarks: sec.negativeMarks,
            },
          });
        }

        for (const sq of sec.questions) {
          const targetQId = questionIdMap.get(sq.questionId) || sq.questionId;
          const qExists = await targetPrisma.question.findUnique({ where: { id: targetQId } });
          if (qExists) {
            await targetPrisma.sectionQuestion.upsert({
              where: { id: sq.id },
              update: { order: sq.order },
              create: {
                id: sq.id,
                sectionId: targetSection.id,
                questionId: targetQId,
                order: sq.order,
                marksOverride: sq.marksOverride,
                negativeMarksOverride: sq.negativeMarksOverride,
              },
            }).catch(() => {});
          }
        }
      }

      // Import Attempts & Results
      for (const att of t.attempts) {
        const targetStudentId = studentIdMap.get(att.studentId) || (await targetPrisma.student.findFirst())?.id;
        if (!targetStudentId) continue;

        const targetAttempt = await targetPrisma.attempt.upsert({
          where: { id: att.id },
          update: {
            status: att.status,
            score: att.score,
            rank: att.rank,
            integrityScore: att.integrityScore,
          },
          create: {
            id: att.id,
            testId: targetTestId,
            studentId: targetStudentId,
            status: att.status,
            startedAt: att.startedAt,
            submittedAt: att.submittedAt,
            score: att.score,
            rank: att.rank,
            integrityScore: att.integrityScore,
          },
        });

        // Import Attempt Answers
        for (const ans of att.answers) {
          await targetPrisma.attemptAnswer.upsert({
            where: { id: ans.id },
            update: {
              selectedOptionId: ans.selectedOptionId,
              integerAnswer: ans.integerAnswer,
              isCorrect: ans.isCorrect,
              marksAwarded: ans.marksAwarded,
              timeSpentSeconds: ans.timeSpentSeconds,
            },
            create: {
              id: ans.id,
              attemptId: targetAttempt.id,
              sectionQuestionId: ans.sectionQuestionId,
              selectedOptionId: ans.selectedOptionId,
              integerAnswer: ans.integerAnswer,
              isCorrect: ans.isCorrect,
              marksAwarded: ans.marksAwarded,
              timeSpentSeconds: ans.timeSpentSeconds,
              answeredAt: ans.answeredAt,
            },
          }).catch(() => {});
        }

        // Import Violations
        for (const vio of att.violations) {
          await targetPrisma.attemptViolation.upsert({
            where: { id: vio.id },
            update: {},
            create: {
              id: vio.id,
              attemptId: targetAttempt.id,
              type: vio.type,
              timestamp: vio.timestamp,
              metadata: vio.metadata as any,
            },
          }).catch(() => {});
        }

        // Import Analysis
        if (att.analysis) {
          await targetPrisma.testAttemptAnalysis.upsert({
            where: { attemptId: targetAttempt.id },
            update: {
              subjectWiseScores: att.analysis.subjectWiseScores as any,
              accuracyPercentage: att.analysis.accuracyPercentage,
              speedKpi: att.analysis.speedKpi,
            },
            create: {
              attemptId: targetAttempt.id,
              subjectWiseScores: att.analysis.subjectWiseScores as any,
              accuracyPercentage: att.analysis.accuracyPercentage,
              speedKpi: att.analysis.speedKpi,
              timeDistribution: att.analysis.timeDistribution as any,
              predictedRank: att.analysis.predictedRank,
              collegeChances: att.analysis.collegeChances as any,
            },
          }).catch(() => {});
        }

        console.log(`✓ Test attempt imported for student ${att.studentId} on test ${t.name}: Score = ${att.score}`);
      }
    } catch (testErr) {
      console.warn(`! Warning importing test ${t.name}:`, testErr);
    }
  }

  // 6. Also import "NEET Grand Test 01" from seed if not present
  try {
    const seedTestExisting = await targetPrisma.test.findFirst({ where: { code: "10001" } });
    if (!seedTestExisting) {
      const series = await targetPrisma.testSeries.findFirst({ where: { code: "NEET27" } });
      const physicsTeacher = await targetPrisma.user.findFirst({ where: { email: "physics.teacher@atp.test" } });
      const now = new Date();
      const grandTest = await targetPrisma.test.create({
        data: {
          testSeriesId: series?.id,
          name: "NEET Grand Test 01",
          code: "10001",
          languageMode: "BOTH",
          durationMin: 180,
          openTime: new Date(now.getTime() - 60 * 60 * 1000),
          closeTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          correctMarks: 4,
          incorrectMarks: -1,
          status: "PUBLISHED",
          createdById: physicsTeacher?.id,
        },
      });

      const pSection = await targetPrisma.section.create({
        data: {
          testId: grandTest.id,
          name: "Physics",
          subject: "Physics",
          targetCount: 1,
          order: 0,
        },
      });
      const cSection = await targetPrisma.section.create({
        data: {
          testId: grandTest.id,
          name: "Chemistry",
          subject: "Chemistry",
          targetCount: 1,
          order: 1,
        },
      });

      const q1Id = questionIdMap.get("seed-q1-laws-of-motion");
      const q2Id = questionIdMap.get("seed-q2-periodic-table");

      if (q1Id) {
        await targetPrisma.sectionQuestion.create({
          data: { sectionId: pSection.id, questionId: q1Id, order: 0 },
        });
      }
      if (q2Id) {
        await targetPrisma.sectionQuestion.create({
          data: { sectionId: cSection.id, questionId: q2Id, order: 0 },
        });
      }

      console.log(`✓ Seed Test "NEET Grand Test 01" created with Physics & Chemistry sections.`);
    }
  } catch (gtErr) {
    console.warn("! Warning importing NEET Grand Test 01:", gtErr);
  }

  console.log("\n==================================================");
  console.log("MIGRATION COMPLETE!");
  console.log("==================================================");

  const finalQuestions = await targetPrisma.question.count();
  const draftQuestions = await targetPrisma.question.count({ where: { status: "DRAFT" } });
  const finalStudents = await targetPrisma.student.count();
  const finalTests = await targetPrisma.test.count();
  const finalAttempts = await targetPrisma.attempt.count();

  console.log({
    totalQuestions: finalQuestions,
    draftQuestions,
    totalStudents: finalStudents,
    totalTests: finalTests,
    totalAttempts: finalAttempts,
  });
}

main()
  .catch((e) => {
    console.error("FATAL IMPORT ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await targetPrisma.$disconnect();
    await sourcePrisma.$disconnect();
  });
