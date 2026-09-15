import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Student } from "@prisma/client";

export async function getAuthenticatedStudent(): Promise<{ student: Student; userId: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  let student = await prisma.student.findUnique({
    where: { userId: session.user.id },
  });

  // If user is a student role but doesn't have student record, auto-create
  if (!student) {
    try {
      student = await prisma.student.create({
        data: {
          userId: session.user.id,
          enrollmentNumber: `AP-STU-${Date.now().toString().slice(-6)}`,
          studentIdCode: `S${Date.now().toString().slice(-6)}`,
          fatherName: "Parent",
          motherName: "Parent",
          dob: new Date(2007, 0, 1),
          gender: "MALE",
          class: "12",
          targetExam: "NEET",
          school: "Atomic Pathshala",
          city: "New Delhi",
          state: "Delhi",
        },
      });
    } catch {
      return null;
    }
  }

  return { student, userId: session.user.id };
}
