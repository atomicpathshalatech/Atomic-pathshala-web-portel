import { PrismaClient, CRMLeadStatus, CRMLeadPriority, CRMLeadSource, CRMActivityType, CRMFollowUpType, CRMFollowUpStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Bootstrapping CRM Data...");

  // 1. Create or ensure Campaigns exist
  const defaultCampaigns = [
    {
      name: "Meta NEET 2026 Acquisition Campaign",
      campaignCode: "CAMP-META-NEET-26",
      platform: "META" as const,
      status: "ACTIVE" as const,
      budget: 50000,
      spend: 18450,
      utmSource: "facebook",
      utmCampaign: "neet_2026_pro",
      notes: "Main Meta Ads acquisition campaign targeting NEET 2026 aspirants",
    },
    {
      name: "Google Search — Physics Wallah & NEET Alternatives",
      campaignCode: "CAMP-GOOG-SEARCH-26",
      platform: "GOOGLE" as const,
      status: "ACTIVE" as const,
      budget: 40000,
      spend: 14200,
      utmSource: "google",
      utmCampaign: "high_intent_search",
      notes: "High conversion Google search ads on NEET physics & chemistry coaching",
    },
    {
      name: "YouTube Organic Lecture Series Leads",
      campaignCode: "CAMP-YT-ORGANIC",
      platform: "YOUTUBE" as const,
      status: "ACTIVE" as const,
      budget: 15000,
      spend: 3500,
      utmSource: "youtube",
      utmCampaign: "one_shot_lectures",
      notes: "Leads arriving from description links in YouTube one-shot lectures",
    },
    {
      name: "WhatsApp Direct Admissions Helpline",
      campaignCode: "CAMP-WA-HELPLINE",
      platform: "WHATSAPP" as const,
      status: "ACTIVE" as const,
      budget: 10000,
      spend: 1200,
      utmSource: "whatsapp",
      utmCampaign: "counselling_click_to_chat",
      notes: "Direct WhatsApp click-to-chat inquiries from landing pages",
    },
    {
      name: "Atomic Website Organic Admissions",
      campaignCode: "CAMP-WEB-ORGANIC",
      platform: "ORGANIC" as const,
      status: "ACTIVE" as const,
      budget: 0,
      spend: 0,
      utmSource: "organic",
      utmCampaign: "homepage_enquiry",
      notes: "Inbound organic web visitors and student sign-ups",
    },
  ];

  const campaignMap = new Map<string, string>();
  for (const c of defaultCampaigns) {
    const record = await prisma.cRMCampaign.upsert({
      where: { campaignCode: c.campaignCode },
      update: { budget: c.budget, spend: c.spend, status: c.status },
      create: c,
    });
    campaignMap.set(c.campaignCode, record.id);
  }
  console.log(`Ensured ${campaignMap.size} campaigns exist.`);

  // 2. Fetch admin user to assign leads
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN"] } } },
    select: { id: true, name: true },
  });

  const courses = await prisma.course.findMany({ select: { id: true, title: true } });
  const defaultCourse = courses[0];
  const batches = await prisma.batch.findMany({ select: { id: true, name: true } });
  const defaultBatch = batches[0];

  // 3. Migrate from WhatsAppContacts into crm_leads if not already present
  const existingCount = await prisma.cRMLead.count();
  if (existingCount === 0) {
    console.log("Importing initial leads from existing WhatsApp contacts & student activity...");
    const contacts = await prisma.whatsAppContact.findMany({
      include: {
        student: {
          include: {
            user: { select: { email: true, phone: true } },
          },
        },
      },
      take: 60,
    });

    const campaignCodes = Array.from(campaignMap.keys());
    let index = 1;

    for (const contact of contacts) {
      const code = `APL-2026-${String(index).padStart(4, "0")}`;
      const campaignCode = campaignCodes[index % campaignCodes.length];
      const campaignId = campaignMap.get(campaignCode);

      // Distribute statuses across pipeline for realistic CRM operations
      const statuses: CRMLeadStatus[] = [
        CRMLeadStatus.NEW_LEAD,
        CRMLeadStatus.FIRST_CALL_PENDING,
        CRMLeadStatus.CONTACTED,
        CRMLeadStatus.INTERESTED,
        CRMLeadStatus.COUNSELLING_SCHEDULED,
        CRMLeadStatus.HIGHLY_INTERESTED,
        CRMLeadStatus.PAYMENT_PENDING,
        CRMLeadStatus.ADMISSION_CONFIRMED,
        CRMLeadStatus.ENROLLED,
      ];
      const status = statuses[index % statuses.length];
      const priority = index % 3 === 0 ? CRMLeadPriority.HOT : index % 2 === 0 ? CRMLeadPriority.WARM : CRMLeadPriority.COLD;
      const score = priority === CRMLeadPriority.HOT ? 85 : priority === CRMLeadPriority.WARM ? 55 : 25;

      const createdLead = await prisma.cRMLead.create({
        data: {
          leadCode: code,
          name: contact.name || `Student ${index}`,
          phone: contact.phone,
          cleanPhone: contact.cleanPhone,
          alternatePhone: null,
          whatsappNumber: contact.phone,
          email: contact.email || (contact.student?.user?.email ?? `lead${index}@example.com`),
          fatherName: "Mr. Sharma",
          motherName: "Mrs. Sharma",
          studentClass: index % 3 === 0 ? "Dropper" : index % 2 === 0 ? "Class 12" : "Class 11",
          board: "CBSE",
          medium: index % 2 === 0 ? "HINDI" : "ENGLISH",
          targetExam: "NEET",
          targetYear: 2026,
          preferredSubject: "Physics & Chemistry",
          preferredCourse: defaultCourse?.title ?? "NEET UG 2026",
          targetCourseId: defaultCourse?.id,
          targetBatchId: defaultBatch?.id,
          state: "Uttar Pradesh",
          city: "Lucknow",
          school: "Kendriya Vidyalaya",
          expectedBudget: 25000,
          status,
          priority,
          score,
          source: index % 2 === 0 ? CRMLeadSource.WHATSAPP : CRMLeadSource.META_ADS,
          campaignId,
          campaignName: campaignCode,
          utmSource: index % 2 === 0 ? "whatsapp" : "facebook",
          utmMedium: index % 2 === 0 ? "chat" : "cpc",
          utmCampaign: "neet_2026_pro",
          assignedUserId: adminUser?.id,
          studentId: contact.studentId,
          isConverted: status === CRMLeadStatus.ENROLLED || status === CRMLeadStatus.ADMISSION_CONFIRMED,
          lastContactedAt: new Date(Date.now() - (index % 5) * 86400000),
          nextFollowUpAt: new Date(Date.now() + ((index % 3) - 1) * 86400000), // some overdue, some today, some future
        },
      });

      // Add initial lead activity
      await prisma.cRMLeadActivity.create({
        data: {
          leadId: createdLead.id,
          type: CRMActivityType.STATUS_CHANGE,
          title: `Lead imported and assigned to ${adminUser?.name ?? "Counsellor"}`,
          description: `Initial status set to ${status}. Acquisition source: ${createdLead.source}`,
          performedById: adminUser?.id,
        },
      });

      // Add a follow-up task
      await prisma.cRMLeadFollowUp.create({
        data: {
          leadId: createdLead.id,
          counsellorId: adminUser?.id,
          title: `NEET 2026 Counselling Follow-up for ${createdLead.name}`,
          description: "Discuss batch schedule, demo class registration, and fee structure.",
          type: CRMFollowUpType.PHONE_CALL,
          priority,
          status: index % 4 === 0 ? CRMFollowUpStatus.COMPLETED : CRMFollowUpStatus.PENDING,
          scheduledAt: createdLead.nextFollowUpAt ?? new Date(),
        },
      });

      // Add a call record for contacted leads
      if (status !== CRMLeadStatus.NEW_LEAD) {
        await prisma.cRMCallRecord.create({
          data: {
            leadId: createdLead.id,
            counsellorId: adminUser?.id,
            direction: "OUTBOUND",
            durationSeconds: 180 + (index * 15),
            outcome: status === CRMLeadStatus.INTERESTED || status === CRMLeadStatus.HIGHLY_INTERESTED ? "INTERESTED" : "CONNECTED",
            notes: "Parent enquired about faculty credentials, study materials, and mock test schedules.",
            provider: "MANUAL",
          },
        });
      }

      // Add counselling session for relevant stages
      if (status === CRMLeadStatus.COUNSELLING_SCHEDULED || status === CRMLeadStatus.COUNSELLING_COMPLETED || status === CRMLeadStatus.HIGHLY_INTERESTED) {
        await prisma.cRMCounsellingSession.create({
          data: {
            leadId: createdLead.id,
            counsellorId: adminUser?.id,
            scheduledAt: new Date(Date.now() - (index % 2) * 86400000),
            status: status === CRMLeadStatus.COUNSELLING_SCHEDULED ? "SCHEDULED" : "COMPLETED",
            mode: "PHONE",
            parentPresent: true,
            studentAspirations: "Targeting Government Medical College (MBBS 650+ marks).",
            recommendedCourseId: defaultCourse?.id,
            recommendedBatchId: defaultBatch?.id,
            counsellingNotes: "Student has good foundation in biology, needs rigorous problem-solving in physics.",
          },
        });
      }

      index++;
    }
    console.log(`Successfully bootstrapped ${index - 1} CRM leads with activities, calls, counselling, and follow-ups!`);
  } else {
    console.log(`CRM leads already present (${existingCount} records). Skipping import.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
