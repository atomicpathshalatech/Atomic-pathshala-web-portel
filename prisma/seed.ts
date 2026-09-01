import { PrismaClient, GlobalRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS } from "../src/lib/rbac/permissions";
import { DEFAULT_PLAN_PRICING } from "../src/lib/subscription/plan-pricing-defaults";

const prisma = new PrismaClient();

const ROLE_LABELS: Record<GlobalRole, string> = {
  GUEST: "Guest",
  STUDENT: "Student",
  PARENT: "Parent",
  TEACHER: "Teacher",
  ACADEMIC_HEAD: "Academic Head",
  QUESTION_TEAM: "Question Team",
  CONTENT_TEAM: "Content Team",
  SALES: "Sales",
  SUPPORT: "Support",
  FINANCE: "Finance",
  HR: "HR",
  MARKETING: "Marketing",
  DEPARTMENT_HEAD: "Department Head",
  SUB_ADMIN: "Sub Admin",
  SUPER_ADMIN: "Super Admin",
  FOUNDER: "Founder",
};

async function main() {
  console.log("=== ATOMIC PATHSHALA SEED ===");

  // ------------------------------------------------------------
  // ROLES
  // ------------------------------------------------------------

  console.log("Seeding roles...");

  const roles: Record<string, { id: string }> = {};

  for (const [name, label] of Object.entries(ROLE_LABELS)) {
    const role = await prisma.role.upsert({
      where: {
        name: name as GlobalRole,
      },
      update: {
        label,
      },
      create: {
        name: name as GlobalRole,
        label,
        isSystem: true,
      },
    });

    roles[name] = role;
  }

  // ------------------------------------------------------------
  // PERMISSIONS
  // ------------------------------------------------------------

  console.log("Seeding permissions...");

  for (const code of Object.values(PERMISSIONS)) {
    const [module] = code.split(".");

    if (!module) {
      throw new Error(`Invalid permission code: ${code}`);
    }

    await prisma.permission.upsert({
      where: {
        code,
      },
      update: {},
      create: {
        code,
        module,
      },
    });
  }

  // ------------------------------------------------------------
  // ROLE PERMISSIONS
  // ------------------------------------------------------------

  console.log("Attaching role permissions...");

  for (const [roleName, permissionCodes] of Object.entries(
    ROLE_PERMISSION_DEFAULTS
  )) {
    const role = roles[roleName];

    if (!role) continue;

    for (const code of permissionCodes) {
      const permission = await prisma.permission.findUnique({
        where: {
          code,
        },
      });

      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // ------------------------------------------------------------
  // PLAN PRICING
  // ------------------------------------------------------------

  console.log("Seeding plan pricing...");

  for (const [plan, cycles] of Object.entries(DEFAULT_PLAN_PRICING)) {
    for (const [billingCycle, amount] of Object.entries(cycles)) {
      await prisma.planPricing.upsert({
        where: {
          plan_billingCycle: {
            plan: plan as keyof typeof DEFAULT_PLAN_PRICING,
            billingCycle: billingCycle as keyof typeof cycles,
          },
        },
        update: {},
        create: {
          plan: plan as keyof typeof DEFAULT_PLAN_PRICING,
          billingCycle: billingCycle as keyof typeof cycles,
          amount,
        },
      });
    }
  }

  // ------------------------------------------------------------
  // TEST PASSWORD
  // ------------------------------------------------------------

  const passwordHash = await bcrypt.hash("Test@12345", 12);

  const superAdminRole = roles["SUPER_ADMIN"];
  const teacherRole = roles["TEACHER"];
  const studentRole = roles["STUDENT"];

  if (!superAdminRole || !teacherRole || !studentRole) {
    throw new Error("Required roles are missing.");
  }

  // ============================================================
  // TEST SUPER ADMIN
  // ============================================================

  console.log("Creating test Super Admin...");

  const admin = await prisma.user.upsert({
    where: {
      email: "admin.test@atomicpathshala.local",
    },
    update: {
      name: "Atomic Test Admin",
      passwordHash,
      status: "ACTIVE",
      roleId: superAdminRole.id,
    },
    create: {
      email: "admin.test@atomicpathshala.local",
      passwordHash,
      name: "Atomic Test Admin",
      status: "ACTIVE",
      roleId: superAdminRole.id,
    },
  });

  // ============================================================
  // TEST TEACHER
  // ============================================================

  console.log("Creating test Teacher...");

  const teacherUser = await prisma.user.upsert({
    where: {
      email: "teacher.test@atomicpathshala.local",
    },
    update: {
      name: "Atomic Test Teacher",
      passwordHash,
      status: "ACTIVE",
      roleId: teacherRole.id,
    },
    create: {
      email: "teacher.test@atomicpathshala.local",
      passwordHash,
      name: "Atomic Test Teacher",
      status: "ACTIVE",
      roleId: teacherRole.id,
    },
  });

  const teacher = await prisma.teacher.upsert({
    where: {
      userId: teacherUser.id,
    },
    update: {
      employeeCode: "TEST-TEACHER-001",
      department: "Chemistry",
      subjects: [
        "Chemistry",
        "Physical Chemistry",
        "Organic Chemistry",
        "Inorganic Chemistry",
      ],
      bio: "Atomic Pathshala test teacher account.",
      onboardingStatus: "PENDING_DOCUMENTS",
    },
    create: {
      userId: teacherUser.id,
      employeeCode: "TEST-TEACHER-001",
      department: "Chemistry",
      subjects: [
        "Chemistry",
        "Physical Chemistry",
        "Organic Chemistry",
        "Inorganic Chemistry",
      ],
      bio: "Atomic Pathshala test teacher account.",
      onboardingStatus: "PENDING_DOCUMENTS",
    },
  });

  // ============================================================
  // TEST STUDENT
  // ============================================================

  console.log("Creating test Student...");

  const studentUser = await prisma.user.upsert({
    where: {
      email: "student.test@atomicpathshala.local",
    },
    update: {
      name: "Atomic Test Student",
      passwordHash,
      status: "ACTIVE",
      roleId: studentRole.id,
    },
    create: {
      email: "student.test@atomicpathshala.local",
      passwordHash,
      name: "Atomic Test Student",
      status: "ACTIVE",
      roleId: studentRole.id,
    },
  });

  const student = await prisma.student.upsert({
    where: {
      userId: studentUser.id,
    },
    update: {
      enrollmentNumber: "TEST-ENR-001",
      studentIdCode: "ATP-TEST-001",
      fatherName: "Test Father",
      motherName: "Test Mother",
      dob: new Date("2008-01-15"),
      gender: "MALE",
      class: "12",
      targetExam: "NEET",
      school: "Atomic Pathshala Test School",
      city: "Muzaffarnagar",
      state: "Uttar Pradesh",
      address: "Test Address",
      status: "ACTIVE",
    },
    create: {
      userId: studentUser.id,
      enrollmentNumber: "TEST-ENR-001",
      studentIdCode: "ATP-TEST-001",
      fatherName: "Test Father",
      motherName: "Test Mother",
      dob: new Date("2008-01-15"),
      gender: "MALE",
      class: "12",
      targetExam: "NEET",
      school: "Atomic Pathshala Test School",
      city: "Muzaffarnagar",
      state: "Uttar Pradesh",
      address: "Test Address",
      status: "ACTIVE",
    },
  });

  // ============================================================
  // ACADEMIC COURSES & SUBJECTS
  // ============================================================

  console.log("Seeding academic courses and subjects...");

  const SEED_COURSES = [
    {
      title: "NEET UG 2026 (Medical Target Program)",
      slug: "neet-ug-2026",
      description: "Comprehensive NEET coaching for Physics, Chemistry, Botany and Zoology.",
      subjects: [
        "Physics",
        "Chemistry",
        "Botany",
        "Zoology",
        "Physical Chemistry",
        "Organic Chemistry",
        "Inorganic Chemistry",
      ],
    },
    {
      title: "IIT-JEE (Main + Advanced) 2026",
      slug: "jee-main-advanced-2026",
      description: "IIT-JEE exam preparation with advanced problem solving and mock tests.",
      subjects: ["Physics", "Chemistry", "Mathematics"],
    },
    {
      title: "Class 11th Science (NEET / JEE / CBSE)",
      slug: "class-11th-science",
      description: "Foundational and advanced concepts for Class 11th Science students.",
      subjects: ["Physics", "Chemistry", "Biology", "Mathematics"],
    },
    {
      title: "Class 12th Science (Board + Competitive Mastery)",
      slug: "class-12th-science",
      description: "Board exams and competitive exam preparation for Class 12th.",
      subjects: ["Physics", "Chemistry", "Biology", "Mathematics"],
    },
    {
      title: "Foundation (Class 9th & 10th Olympiad / NTSE)",
      slug: "foundation-9th-10th",
      description: "Early foundation for Science and Maths Olympiads and NTSE.",
      subjects: ["Science", "Mathematics", "Mental Ability"],
    },
  ];

  for (const c of SEED_COURSES) {
    const course = await prisma.course.upsert({
      where: { slug: c.slug },
      update: {
        title: c.title,
        description: c.description,
        isPublished: true,
      },
      create: {
        title: c.title,
        slug: c.slug,
        description: c.description,
        isPublished: true,
      },
    });

    for (const subTitle of c.subjects) {
      const existing = await prisma.subject.findFirst({
        where: { courseId: course.id, title: subTitle },
      });
      if (!existing) {
        await prisma.subject.create({
          data: {
            title: subTitle,
            courseId: course.id,
          },
        });
      }
    }
  }

  // ============================================================
  // OUTPUT
  // ============================================================

  console.log("");
  console.log("==========================================");
  console.log("TEST ACCOUNTS READY");
  console.log("==========================================");

  console.log(`SUPER ADMIN : ${admin.email}`);
  console.log(`TEACHER     : ${teacherUser.email}`);
  console.log(`TEACHER ID  : ${teacher.id}`);
  console.log(`STUDENT     : ${studentUser.email}`);
  console.log(`STUDENT ID  : ${student.id}`);

  console.log("");
  console.log("PASSWORD FOR ALL TEST ACCOUNTS:");
  console.log("Test@12345");

  console.log("==========================================");
  console.log("SEED COMPLETE");
  console.log("==========================================");
}

main()
  .catch((error) => {
    console.error("SEED FAILED:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
