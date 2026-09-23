import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function sendNotificationEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  recipientName: string;
  recipientUserId: string;
  idempotencyKey: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Atomic Pathshala <noreply@atomicpathshala.in>";

  // Log in EmailLog
  try {
    const log = await prisma.emailLog.create({
      data: {
        idempotencyKey: opts.idempotencyKey,
        recipientUser: { connect: { id: opts.recipientUserId } },
        recipientName: opts.recipientName,
        recipientEmail: opts.to,
        recipientType: "STUDENT",
        emailType: "ANNOUNCEMENT",
        subject: opts.subject,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    if (key) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }),
      });
      if (res.ok) {
        console.log(`[EMAIL DELIVERED] Email sent to ${opts.to} via Resend!`);
      } else {
        const body = await res.text();
        console.warn(`[EMAIL RESEND WARNING] Resend HTTP response: ${body}`);
      }
    } else {
      console.log(`[EMAIL LOGGED] RESEND_API_KEY not present in environment, email successfully logged to EmailLog table (ID: ${log.id}) for delivery.`);
    }
  } catch (err: any) {
    console.error(`[EMAIL LOG ERROR]`, err.message);
  }
}

async function main() {
  const targetEnrollments = ["AP-2026-408905", "AP-2026-042812"];
  const TARGET_STREAK = 35;
  const today = new Date();

  console.log(`=== RESTORING STREAKS TO ${TARGET_STREAK} DAYS FOR STUDENTS ===`);

  for (const enrollNum of targetEnrollments) {
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { enrollmentNumber: enrollNum },
          { studentIdCode: enrollNum },
          { id: enrollNum },
        ],
      },
      include: { user: true },
    });

    if (!student) {
      console.error(`[ERROR] Student with ID/Enrollment "${enrollNum}" not found in database!`);
      continue;
    }

    console.log(`\nFound Student: ${student.user.name} (${student.user.email}) | ID: ${student.id} | Enroll: ${student.enrollmentNumber}`);

    // Update Streak in DB
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: {
        currentStreakDays: TARGET_STREAK,
        longestStreakDays: Math.max(student.longestStreakDays, TARGET_STREAK),
        lastActivityDate: today,
      },
    });

    console.log(`[UPDATED] Current Streak: ${updated.currentStreakDays} days | Longest: ${updated.longestStreakDays} days`);

    // Dispatch Notification Email
    const studentName = student.user.name || "Student";
    const emailSubject = `🔥 Great News ${studentName}! Your 35-Day Learning Streak is Restored | Atomic Pathshala`;
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #002f6c 0%, #1e40af 50%, #3b82f6 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Atomic Pathshala</h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #bfdbfe;">NEET Preparation &amp; Conceptual Excellence</p>
        </div>
        
        <div style="padding: 32px 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #eff6ff; border: 2px solid #93c5fd; border-radius: 50%; padding: 16px; margin-bottom: 12px;">
              <span style="font-size: 40px; line-height: 1;">🔥</span>
            </div>
            <h2 style="margin: 0; font-size: 22px; color: #0f172a; font-weight: 800;">Your Study Streak is Back!</h2>
            <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-weight: 800; font-size: 16px; padding: 6px 18px; border-radius: 9999px; margin-top: 10px;">
              🔥 35 DAYS ACTIVE STREAK
            </div>
          </div>

          <p style="font-size: 15px; line-height: 1.6; color: #334155;">
            Dear <strong>${studentName}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            We noticed an unintended technical interruption in your daily study streak on our platform. We deeply value your daily dedication and hard work towards NEET.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Our academic and technical team has <strong>manually restored your learning streak to full 35 Days</strong> in the database.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; padding-bottom: 6px;">Student Name:</td>
                <td style="font-weight: 700; color: #0f172a; text-align: right;">${studentName}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding-bottom: 6px;">Enrollment Number:</td>
                <td style="font-weight: 700; color: #0f172a; font-family: monospace; text-align: right;">${student.enrollmentNumber || student.studentIdCode}</td>
              </tr>
              <tr>
                <td style="color: #64748b;">Current Active Streak:</td>
                <td style="font-weight: 800; color: #0284c7; text-align: right;">35 Days 🔥</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="https://atomicpathshala.com/dashboard" style="display: inline-block; background-color: #002f6c; color: #ffffff; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(0, 47, 108, 0.2);">
              Continue Practice on Dashboard →
            </a>
          </div>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            Keep practicing daily tests, DPPs, and NCERT chapters to build on your streak!
          </p>
        </div>

        <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Atomic Pathshala · India's Premium Accelerator for NEET &amp; JEE
        </div>
      </div>
    `;

    await sendNotificationEmail({
      idempotencyKey: `streak_restore_35d:${student.id}:${today.toISOString().split("T")[0]}`,
      to: student.user.email,
      recipientName: studentName,
      recipientUserId: student.userId,
      subject: emailSubject,
      html: emailHtml,
      text: `Dear ${studentName}, your 35-day study streak has been successfully restored on Atomic Pathshala! Log in to keep learning: https://atomicpathshala.com/dashboard`,
    });
  }

  console.log("\n=== FINISHED RESTORING STREAKS ===");
}

main()
  .catch((e) => {
    console.error("Execution failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
