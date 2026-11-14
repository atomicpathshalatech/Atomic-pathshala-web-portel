import { PrismaClient } from "@prisma/client";
import QRCode from "qrcode";

const prisma = new PrismaClient();

const MAPPING_CONFIG = [
  {
    nameMatch: "ilmas ameer",
    newEmployeeId: "AP10001",
    oldEmployeeId: "AP-EMP-2026-0006",
    teacherEmployeeCode: "EMP-86738655",
    designation: "Senior Chemistry Faculty",
    department: "Chemistry",
  },
  {
    nameMatch: "Firoz Ali",
    newEmployeeId: "AP10002",
    oldEmployeeId: "AP-EMP-2026-0002",
    teacherEmployeeCode: "EMP-29583637",
    designation: "Founder and Director",
    department: "Chemistry",
  },
  {
    nameMatch: "MUKUL KASHYAP",
    newEmployeeId: "AP10003",
    oldEmployeeId: "AP-EMP-2026-0001",
    teacherEmployeeCode: "EMP-26154696",
    designation: "Senior Physics Faculty",
    department: "NEET",
  },
  {
    nameMatch: "Md Moaz Ahmed",
    newEmployeeId: "AP10004",
    oldEmployeeId: "AP-EMP-2026-0003",
    teacherEmployeeCode: "EMP-73517797",
    designation: "Senior Biology Faculty",
    department: "Biology",
  },
  {
    nameMatch: "SOFIYA BI",
    newEmployeeId: "AP10005",
    oldEmployeeId: "AP-EMP-2026-0004",
    teacherEmployeeCode: "EMP-74259137",
    designation: "Faculty Educator",
    department: "Academic",
  },
  {
    nameMatch: "Rehan ali",
    newEmployeeId: "AP10006",
    oldEmployeeId: "AP-EMP-2026-0005",
    teacherEmployeeCode: "EMP-77648475",
    designation: "Biology Faculty",
    department: "Biology",
  },
  {
    nameMatch: "Umaima Nadeem",
    newEmployeeId: "AP10007",
    oldEmployeeId: "AP-EMP-2026-0007",
    teacherEmployeeCode: "EMP-88800864",
    designation: "Chemistry Faculty",
    department: "Chemistry",
  },
  {
    nameMatch: "Yaman",
    newEmployeeId: "AP10008",
    oldEmployeeId: "AP-EMP-2026-0008",
    teacherEmployeeCode: "EMP-89476081",
    designation: "Biology Faculty",
    department: "Biology",
  },
  {
    nameMatch: "Nigar Rao",
    newEmployeeId: "AP10009",
    oldEmployeeId: "AP-EMP-2026-0009",
    teacherEmployeeCode: "EMP-40082736",
    designation: "Faculty Educator",
    department: "Academic",
  },
  {
    nameMatch: "Sashan Yadav",
    newEmployeeId: "AP10010",
    oldEmployeeId: "AP-EMP-2026-0010",
    teacherEmployeeCode: "EMP-28043644",
    designation: "Physics Faculty",
    department: "Physics",
  },
];

async function generateQr(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: {
      dark: "#0a1f5c",
      light: "#ffffff",
    },
  });
}

async function runMigration() {
  console.log("=== STARTING ATOMIC PATHSHALA EMPLOYEE ID MIGRATION ===\n");

  const baseDomain = "https://ap.atomicpathshala.in";

  for (const item of MAPPING_CONFIG) {
    console.log(`Processing: ${item.nameMatch} -> Target: ${item.newEmployeeId}`);

    // Find Employee row
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { employeeId: item.oldEmployeeId },
          { employeeId: item.newEmployeeId },
          { name: { equals: item.nameMatch, mode: "insensitive" } },
        ],
      },
    });

    if (!employee) {
      console.warn(`[WARN] Employee not found for ${item.nameMatch}`);
      continue;
    }

    const previousId = employee.employeeId;
    const verificationUrl = `${baseDomain}/verify/${item.newEmployeeId}`;
    const newQr = await generateQr(verificationUrl);

    // 1. Update Employee record
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        employeeId: item.newEmployeeId,
        designation: item.designation || employee.designation,
        department: item.department || employee.department,
        qrCodeDataUrl: newQr,
      },
    });
    console.log(`  ✓ Updated Employee ${employee.id}: ${previousId} -> ${item.newEmployeeId}`);

    // 2. Record Legacy ID mapping for old employeeId
    const existingLegacy = await prisma.employeeLegacyIdMapping.findFirst({
      where: { newEmployeeId: item.newEmployeeId },
    });
    if (existingLegacy) {
      await prisma.employeeLegacyIdMapping.update({
        where: { id: existingLegacy.id },
        data: {
          previousId: previousId,
          status: "MIGRATED",
          notes: `Migrated from ${previousId} to permanent universal ID ${item.newEmployeeId}`,
        },
      });
    } else {
      await prisma.employeeLegacyIdMapping.create({
        data: {
          employeeId: employee.id,
          previousId: previousId,
          newEmployeeId: item.newEmployeeId,
          status: "MIGRATED",
          notes: `Migrated from ${previousId} to permanent universal ID ${item.newEmployeeId}`,
        },
      });
    }

    // 3. If teacher had an old code like EMP-86738655, add legacy mapping for that too
    if (item.teacherEmployeeCode && item.teacherEmployeeCode !== item.newEmployeeId) {
      const existingTeacherLegacy = await prisma.employeeLegacyIdMapping.findFirst({
        where: { previousId: item.teacherEmployeeCode },
      });
      if (!existingTeacherLegacy) {
        await prisma.employeeLegacyIdMapping.create({
          data: {
            employeeId: employee.id,
            previousId: item.teacherEmployeeCode,
            newEmployeeId: `${item.newEmployeeId}_TEACHER`,
            status: "MIGRATED",
            notes: `Legacy teacher employeeCode ${item.teacherEmployeeCode} mapped to ${item.newEmployeeId}`,
          },
        });
      }
    }

    // 4. Update Teacher record if linked
    if (employee.teacherId) {
      await prisma.teacher.update({
        where: { id: employee.teacherId },
        data: {
          employeeCode: item.newEmployeeId,
          department: item.department,
        },
      });
      console.log(`  ✓ Updated Teacher ${employee.teacherId}: employeeCode -> ${item.newEmployeeId}`);
    } else {
      // Find teacher by user or name
      const teacher = await prisma.teacher.findFirst({
        where: {
          OR: [
            { employeeCode: item.teacherEmployeeCode },
            { displayName: { equals: item.nameMatch, mode: "insensitive" } },
            { user: { name: { equals: item.nameMatch, mode: "insensitive" } } },
          ],
        },
      });
      if (teacher) {
        await prisma.teacher.update({
          where: { id: teacher.id },
          data: {
            employeeCode: item.newEmployeeId,
            department: item.department,
          },
        });
        // also link to employee
        await prisma.employee.update({
          where: { id: employee.id },
          data: { teacherId: teacher.id, userId: teacher.userId },
        });
        console.log(`  ✓ Linked & Updated Teacher ${teacher.id}: employeeCode -> ${item.newEmployeeId}`);
      }
    }

    // 5. Update IdCard if exists for this user / employee (only for TEAM kind)
    if (employee.userId) {
      // First clear any non-TEAM cards that might have had employeeCode
      await prisma.idCard.updateMany({
        where: { userId: employee.userId, kind: { not: "TEAM" } },
        data: { employeeCode: null },
      });

      const teamCard = await prisma.idCard.findFirst({
        where: { userId: employee.userId, kind: "TEAM" },
      });
      if (teamCard) {
        await prisma.idCard.update({
          where: { id: teamCard.id },
          data: {
            employeeCode: item.newEmployeeId,
          },
        });
        console.log(`  ✓ Updated Team IdCard ${teamCard.id}: employeeCode -> ${item.newEmployeeId}`);
      }
    }
  }

  console.log("\n=== MIGRATION COMPLETED SUCCESSFULLY ===");
}

runMigration()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
