import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function audit() {
  console.log("=== ATOMIC PATHSHALA EMPLOYEE ID SYSTEM AUDIT ===\n");

  // 1. Employees table
  const employees = await prisma.employee.findMany({
    include: {
      certificates: true,
      verificationLogs: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`1. Total Employee records: ${employees.length}`);
  for (const emp of employees) {
    console.log({
      id: emp.id,
      employeeId: emp.employeeId,
      name: emp.name,
      designation: emp.designation,
      department: emp.department,
      employmentType: emp.employmentType,
      status: emp.status,
      userId: emp.userId,
      teacherId: emp.teacherId,
      certificatesCount: emp.certificates.length,
      createdAt: emp.createdAt,
    });
  }

  // 2. Teachers table
  const teachers = await prisma.teacher.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, department: true, position: true },
      },
      agreements: {
        select: { id: true, agreementNumber: true, documentType: true, status: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\n2. Total Teacher records: ${teachers.length}`);
  for (const t of teachers) {
    console.log({
      id: t.id,
      userId: t.userId,
      employeeCode: t.employeeCode,
      displayName: t.displayName || t.user.name,
      department: t.department,
      agreementsCount: t.agreements.length,
      agreements: t.agreements.map((a) => `${a.agreementNumber} (${a.documentType}: ${a.status})`),
      createdAt: t.createdAt,
    });
  }

  // 3. User table staff (users with staff positions / roles)
  const usersWithPosition = await prisma.user.findMany({
    where: {
      OR: [
        { department: { not: null } },
        { position: { not: null } },
        { contractType: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      position: true,
      contractType: true,
      teacher: { select: { id: true, employeeCode: true } },
    },
  });
  console.log(`\n3. Users with department/position/contract: ${usersWithPosition.length}`);
  for (const u of usersWithPosition) {
    console.log({
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department,
      position: u.position,
      contractType: u.contractType,
      teacherEmployeeCode: u.teacher?.employeeCode,
    });
  }

  // 4. EmployeeCertificates table
  const certificates = await prisma.employeeCertificate.findMany({
    include: {
      employee: { select: { id: true, employeeId: true, name: true } },
    },
  });
  console.log(`\n4. Total EmployeeCertificate records: ${certificates.length}`);
  for (const c of certificates) {
    console.log({
      id: c.id,
      number: c.certificateNumber,
      type: c.certificateType,
      employeeIdField: c.employeeId,
      employeeCode: c.employee?.employeeId,
      employeeName: c.employee?.name,
      status: c.status,
    });
  }

  // 5. Agreements table
  const agreements = await prisma.agreement.findMany({
    include: {
      educator: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  console.log(`\n5. Total Agreement records: ${agreements.length}`);
  for (const a of agreements) {
    console.log({
      id: a.id,
      agreementNumber: a.agreementNumber,
      documentType: a.documentType,
      educatorId: a.educatorId,
      educatorEmployeeCode: a.educator.employeeCode,
      educatorName: a.educator.user.name,
      status: a.status,
    });
  }

  // 6. IdCards table
  const idCards = await prisma.idCard.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  console.log(`\n6. Total IdCard records: ${idCards.length}`);
  for (const card of idCards) {
    console.log({
      id: card.id,
      kind: card.kind,
      employeeCode: card.employeeCode,
      userName: card.user.name,
      status: card.status,
    });
  }
}

audit()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
