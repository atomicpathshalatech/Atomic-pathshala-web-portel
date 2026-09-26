import { prisma } from "../src/lib/db";

async function main() {
  const students = await prisma.student.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  console.log("Total students in DB:", students.length);
  for (const s of students) {
    console.log(`Student ID: ${s.id} | Code: ${s.studentIdCode} | Name: ${s.user?.name} | Email: ${s.user?.email} | Phone: ${s.user?.phone}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
