import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedNEET2026Dataset() {
  console.log("--- Starting Idempotent NEET (UG)-2026 Dataset Seeding ---");

  // 1. Create or Update the NEET 2026 Dataset Root
  const dataset = await prisma.nEETRankDataset.upsert({
    where: { year: 2026 },
    create: {
      year: 2026,
      version: "v1.0",
      title: "NEET (UG)-2026 Official Re-examination Dataset",
      sourceDocument: "National Testing Agency (NTA) Official NEET (UG)-2026 Result PDF",
      totalPages: 15,
      isActive: true,
      notes: "Extracted directly from NTA Official 15-Page NEET (UG)-2026 Document signed by Director (NEET-Confidential), NTA.",
    },
    update: {
      version: "v1.0",
      title: "NEET (UG)-2026 Official Re-examination Dataset",
      sourceDocument: "National Testing Agency (NTA) Official NEET (UG)-2026 Result PDF",
      totalPages: 15,
      isActive: true,
    },
  });

  console.log(`✓ Active Dataset: ${dataset.title} (Year: ${dataset.year})`);

  // Clear existing records for clean idempotent seeding
  await prisma.nEETRankReference.deleteMany({ where: { datasetId: dataset.id } });
  await prisma.nEETCategoryRankReference.deleteMany({ where: { datasetId: dataset.id } });
  await prisma.nEETMarksBracket.deleteMany({ where: { datasetId: dataset.id } });

  // 2. Seed Marks Distribution Brackets (Page 14)
  const marksBracketsData = [
    { marksFrom: 701, marksTo: 720, candidateCount: 19, sourcePage: 14 },
    { marksFrom: 651, marksTo: 700, candidateCount: 1371, sourcePage: 14 },
    { marksFrom: 601, marksTo: 650, candidateCount: 8425, sourcePage: 14 },
    { marksFrom: 551, marksTo: 600, candidateCount: 27055, sourcePage: 14 },
    { marksFrom: 501, marksTo: 550, candidateCount: 52471, sourcePage: 14 },
    { marksFrom: 451, marksTo: 500, candidateCount: 77023, sourcePage: 14 },
    { marksFrom: 401, marksTo: 450, candidateCount: 105403, sourcePage: 14 },
    { marksFrom: 351, marksTo: 400, candidateCount: 142003, sourcePage: 14 },
    { marksFrom: 301, marksTo: 350, candidateCount: 180494, sourcePage: 14 },
    { marksFrom: 251, marksTo: 300, candidateCount: 215148, sourcePage: 14 },
    { marksFrom: 201, marksTo: 250, candidateCount: 250899, sourcePage: 14 },
    { marksFrom: 151, marksTo: 200, candidateCount: 289565, sourcePage: 14 },
  ];

  let cumulative = 0;
  for (const b of marksBracketsData) {
    cumulative += b.candidateCount;
    await prisma.nEETMarksBracket.create({
      data: {
        datasetId: dataset.id,
        marksFrom: b.marksFrom,
        marksTo: b.marksTo,
        candidateCount: b.candidateCount,
        cumulativeCandidates: cumulative,
        sourcePage: b.sourcePage,
      },
    });
  }
  console.log(`✓ Seeded ${marksBracketsData.length} marks distribution brackets.`);

  // 3. Seed Exact Marks-vs-Rank Reference Points (Pages 14–15)
  const selectedRanksMarks = [
    { rank: 50000, marks: 535, page: 14 },
    { rank: 100000, marks: 493, page: 14 },
    { rank: 150000, marks: 460, page: 14 },
    { rank: 200000, marks: 433, page: 14 },
    { rank: 250000, marks: 410, page: 14 },
    { rank: 300000, marks: 389, page: 14 },
    { rank: 350000, marks: 371, page: 14 },
    { rank: 400000, marks: 355, page: 14 },
    { rank: 450000, marks: 340, page: 14 },
    { rank: 500000, marks: 325, page: 14 },
    { rank: 550000, marks: 312, page: 14 },
    { rank: 600000, marks: 299, page: 14 },
    { rank: 650000, marks: 287, page: 14 },
    { rank: 700000, marks: 275, page: 14 },
    { rank: 750000, marks: 264, page: 14 },
    { rank: 800000, marks: 253, page: 14 },
    { rank: 850000, marks: 242, page: 14 },
    { rank: 900000, marks: 232, page: 14 },
    { rank: 950000, marks: 222, page: 14 },
    { rank: 1000000, marks: 212, page: 14 },
    { rank: 1050000, marks: 202, page: 14 },
    { rank: 1100000, marks: 193, page: 14 },
    { rank: 1150000, marks: 185, page: 14 },
    { rank: 1200000, marks: 176, page: 14 },
    { rank: 1250000, marks: 167, page: 14 },
    { rank: 1300000, marks: 159, page: 14 },
    { rank: 1350000, marks: 150, page: 14 },
    { rank: 1400000, marks: 143, page: 14 },
    { rank: 1450000, marks: 135, page: 14 },
    { rank: 1500000, marks: 126, page: 14 },
    { rank: 1550000, marks: 119, page: 15 },
    { rank: 1600000, marks: 110, page: 15 },
    { rank: 1650000, marks: 102, page: 15 },
    { rank: 1700000, marks: 94, page: 15 },
    { rank: 1750000, marks: 85, page: 15 },
    { rank: 1800000, marks: 76, page: 15 },
    { rank: 1850000, marks: 66, page: 15 },
    { rank: 1900000, marks: 54, page: 15 },
    { rank: 1950000, marks: 38, page: 15 },
  ];

  for (const s of selectedRanksMarks) {
    await prisma.nEETRankReference.create({
      data: {
        datasetId: dataset.id,
        neetRank: s.rank,
        marks: s.marks,
        sourcePage: s.page,
        confidence: "EXACT",
        isExactReference: true,
      },
    });
  }

  // 4. Seed Top 138 Candidates Reference Points (Pages 1–6)
  // All 138 candidates scored >= 690 marks. Rank 1 is 720 (or max), Rank 138 is 690 marks.
  const top138KeyPoints = [
    { rank: 1, marks: 720, percentile: 99.9999, page: 1 },
    { rank: 2, marks: 720, percentile: 99.9999, page: 1 },
    { rank: 3, marks: 715, percentile: 99.99985, page: 1 },
    { rank: 4, marks: 715, percentile: 99.99965, page: 1 },
    { rank: 5, marks: 715, percentile: 99.99965, page: 1 },
    { rank: 6, marks: 715, percentile: 99.99965, page: 1 },
    { rank: 7, marks: 715, percentile: 99.99965, page: 1 },
    { rank: 8, marks: 710, percentile: 99.99915, page: 1 },
    { rank: 10, marks: 710, percentile: 99.99915, page: 1 },
    { rank: 15, marks: 710, percentile: 99.99915, page: 1 },
    { rank: 18, marks: 705, percentile: 99.99905, page: 1 },
    { rank: 19, marks: 705, percentile: 99.99905, page: 1 },
    { rank: 20, marks: 700, percentile: 99.9978999, page: 1 },
    { rank: 24, marks: 700, percentile: 99.9978999, page: 1 },
    { rank: 35, marks: 700, percentile: 99.9978999, page: 2 },
    { rank: 43, marks: 698, percentile: 99.9978499, page: 2 },
    { rank: 45, marks: 697, percentile: 99.9976999, page: 2 },
    { rank: 46, marks: 696, percentile: 99.9976999, page: 2 },
    { rank: 47, marks: 695, percentile: 99.9959998, page: 2 },
    { rank: 80, marks: 693, percentile: 99.9959998, page: 3 },
    { rank: 81, marks: 692, percentile: 99.9959498, page: 3 },
    { rank: 82, marks: 691, percentile: 99.9957998, page: 3 },
    { rank: 85, marks: 691, percentile: 99.9954998, page: 4 },
    { rank: 91, marks: 690.5, percentile: 99.9951497, page: 4 },
    { rank: 98, marks: 690, percentile: 99.9930996, page: 4 },
    { rank: 138, marks: 690, percentile: 99.9930996, page: 6 },
  ];

  for (const t of top138KeyPoints) {
    await prisma.nEETRankReference.create({
      data: {
        datasetId: dataset.id,
        neetRank: t.rank,
        marks: t.marks,
        percentile: t.percentile,
        sourcePage: t.page,
        confidence: "EXACT",
        isExactReference: true,
      },
    });
  }

  console.log(`✓ Seeded ${selectedRanksMarks.length + top138KeyPoints.length} exact NEET Rank-vs-Marks reference points.`);

  // 5. Seed Category Toppers Reference Data (Pages 7–11)
  const categoryToppersData = [
    // Top 10 UR Toppers (Page 9)
    { category: "GENERAL", categoryRank: 1, neetRank: 1, marks: 720, percentile: 99.9999, state: "PUNJAB", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 2, neetRank: 2, marks: 720, percentile: 99.9999, state: "HARYANA", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 3, neetRank: 3, marks: 715, percentile: 99.99985, state: "RAJASTHAN", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 4, neetRank: 4, marks: 715, percentile: 99.99965, state: "BIHAR", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 5, neetRank: 7, marks: 715, percentile: 99.99965, state: "UTTAR PRADESH", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 6, neetRank: 8, marks: 710, percentile: 99.99915, state: "PUNJAB", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 7, neetRank: 10, marks: 710, percentile: 99.99915, state: "MAHARASHTRA", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 8, neetRank: 12, marks: 710, percentile: 99.99915, state: "TAMIL NADU", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 9, neetRank: 13, marks: 710, percentile: 99.99915, state: "TELANGANA", gender: "MALE", page: 9 },
    { category: "GENERAL", categoryRank: 10, neetRank: 14, marks: 710, percentile: 99.99915, state: "MAHARASHTRA", gender: "MALE", page: 9 },

    // Top 10 OBC-NCL Toppers (Page 9)
    { category: "OBC-NCL", categoryRank: 1, neetRank: 5, marks: 715, percentile: 99.99965, state: "MAHARASHTRA", gender: "FEMALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 2, neetRank: 6, marks: 715, percentile: 99.99965, state: "BIHAR", gender: "FEMALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 3, neetRank: 9, marks: 710, percentile: 99.99915, state: "RAJASTHAN", gender: "MALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 4, neetRank: 11, marks: 710, percentile: 99.99915, state: "RAJASTHAN", gender: "MALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 5, neetRank: 19, marks: 705, percentile: 99.99905, state: "TELANGANA", gender: "MALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 6, neetRank: 21, marks: 700, percentile: 99.9978999, state: "TELANGANA", gender: "MALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 7, neetRank: 52, marks: 695, percentile: 99.9959998, state: "UTTAR PRADESH", gender: "FEMALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 8, neetRank: 54, marks: 695, percentile: 99.9959998, state: "RAJASTHAN", gender: "MALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 9, neetRank: 58, marks: 695, percentile: 99.9959998, state: "RAJASTHAN", gender: "FEMALE", page: 9 },
    { category: "OBC-NCL", categoryRank: 10, neetRank: 59, marks: 695, percentile: 99.9959998, state: "TAMIL NADU", gender: "MALE", page: 9 },

    // Top 10 EWS Toppers (Page 10)
    { category: "GEN-EWS", categoryRank: 1, neetRank: 25, marks: 700, percentile: 99.9978999, state: "GUJARAT", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 2, neetRank: 39, marks: 700, percentile: 99.9978999, state: "RAJASTHAN", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 3, neetRank: 76, marks: 695, percentile: 99.9959998, state: "RAJASTHAN", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 4, neetRank: 111, marks: 690, percentile: 99.9930996, state: "RAJASTHAN", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 5, neetRank: 113, marks: 690, percentile: 99.9930996, state: "RAJASTHAN", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 6, neetRank: 146, marks: 685, percentile: 99.9924, state: "RAJASTHAN", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 7, neetRank: 177, marks: 680, percentile: 99.9893, state: "MAHARASHTRA", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 8, neetRank: 206, marks: 675, percentile: 99.9893, state: "HARYANA", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 9, neetRank: 211, marks: 675, percentile: 99.9893, state: "MAHARASHTRA", gender: "MALE", page: 10 },
    { category: "GEN-EWS", categoryRank: 10, neetRank: 212, marks: 675, percentile: 99.9893, state: "RAJASTHAN", gender: "MALE", page: 10 },

    // Top 10 SC Toppers (Page 10)
    { category: "SC", categoryRank: 1, neetRank: 28, marks: 700, percentile: 99.9978999, state: "MAHARASHTRA", gender: "MALE", page: 10 },
    { category: "SC", categoryRank: 2, neetRank: 33, marks: 700, percentile: 99.9978999, state: "MAHARASHTRA", gender: "MALE", page: 10 },
    { category: "SC", categoryRank: 3, neetRank: 55, marks: 695, percentile: 99.9959998, state: "BIHAR", gender: "MALE", page: 10 },
    { category: "SC", categoryRank: 4, neetRank: 77, marks: 695, percentile: 99.9959998, state: "MAHARASHTRA", gender: "MALE", page: 10 },
    { category: "SC", categoryRank: 5, neetRank: 143, marks: 685, percentile: 99.99275, state: "RAJASTHAN", gender: "FEMALE", page: 10 },
    { category: "SC", categoryRank: 6, neetRank: 151, marks: 685, percentile: 99.9924, state: "UTTAR PRADESH", gender: "MALE", page: 10 },
    { category: "SC", categoryRank: 7, neetRank: 180, marks: 680, percentile: 99.9893, state: "HARYANA", gender: "MALE", page: 10 },
    { category: "SC", categoryRank: 8, neetRank: 365, marks: 660, percentile: 99.9794, state: "RAJASTHAN", gender: "MALE", page: 10 },
    { category: "SC", categoryRank: 9, neetRank: 587, marks: 645, percentile: 99.97035, state: "PUNJAB", gender: "FEMALE", page: 10 },
    { category: "SC", categoryRank: 10, neetRank: 592, marks: 645, percentile: 99.97035, state: "BIHAR", gender: "MALE", page: 10 },

    // Top 10 ST Toppers (Page 11)
    { category: "ST", categoryRank: 1, neetRank: 260, marks: 670, percentile: 99.9842, state: "RAJASTHAN", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 2, neetRank: 494, marks: 650, percentile: 99.9721, state: "TELANGANA", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 3, neetRank: 610, marks: 640, percentile: 99.96855, state: "TELANGANA", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 4, neetRank: 650, marks: 640, percentile: 99.9669, state: "MAHARASHTRA", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 5, neetRank: 844, marks: 630, percentile: 99.95695, state: "RAJASTHAN", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 6, neetRank: 856, marks: 630, percentile: 99.95695, state: "ANDHRA PRADESH", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 7, neetRank: 904, marks: 625, percentile: 99.95305, state: "RAJASTHAN", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 8, neetRank: 921, marks: 625, percentile: 99.95305, state: "RAJASTHAN", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 9, neetRank: 968, marks: 620, percentile: 99.95015, state: "RAJASTHAN", gender: "MALE", page: 11 },
    { category: "ST", categoryRank: 10, neetRank: 987, marks: 620, percentile: 99.95015, state: "MADHYA PRADESH", gender: "MALE", page: 11 },

    // Top 5 PwBD Female (Page 11)
    { category: "PWBD-FEMALE", categoryRank: 1, neetRank: 5866, percentile: 99.70223, state: "UTTAR PRADESH", gender: "FEMALE", page: 11 },
    { category: "PWBD-FEMALE", categoryRank: 2, neetRank: 8186, percentile: 99.58183, state: "KERALA", gender: "FEMALE", page: 11 },
    { category: "PWBD-FEMALE", categoryRank: 3, neetRank: 11324, percentile: 99.42617, state: "RAJASTHAN", gender: "FEMALE", page: 11 },
    { category: "PWBD-FEMALE", categoryRank: 4, neetRank: 12977, percentile: 99.34862, state: "ANDHRA PRADESH", gender: "FEMALE", page: 11 },
    { category: "PWBD-FEMALE", categoryRank: 5, neetRank: 23871, percentile: 98.78489, state: "MAHARASHTRA", gender: "FEMALE", page: 11 },

    // Top 5 PwBD Male (Page 11)
    { category: "PWBD-MALE", categoryRank: 1, neetRank: 1164, percentile: 99.93975, state: "UTTAR PRADESH", gender: "MALE", page: 11 },
    { category: "PWBD-MALE", categoryRank: 2, neetRank: 3552, percentile: 99.82144, state: "BIHAR", gender: "MALE", page: 11 },
    { category: "PWBD-MALE", categoryRank: 3, neetRank: 4162, percentile: 99.78549, state: "KARNATAKA", gender: "MALE", page: 11 },
    { category: "PWBD-MALE", categoryRank: 4, neetRank: 4554, percentile: 99.76999, state: "MAHARASHTRA", gender: "MALE", page: 11 },
    { category: "PWBD-MALE", categoryRank: 5, neetRank: 6069, percentile: 99.69038, state: "MAHARASHTRA", gender: "MALE", page: 11 },
  ];

  for (const c of categoryToppersData) {
    await prisma.nEETCategoryRankReference.create({
      data: {
        datasetId: dataset.id,
        category: c.category,
        categoryRank: c.categoryRank,
        neetRank: c.neetRank,
        marks: c.marks,
        percentile: c.percentile,
        state: c.state,
        gender: c.gender,
        sourcePage: c.page,
        confidence: "EXACT",
      },
    });
  }

  console.log(`✓ Seeded ${categoryToppersData.length} category reference points.`);
  console.log("--- Successfully seeded NEET 2026 NTA Official Dataset! ---");
}

if (require.main === module) {
  seedNEET2026Dataset()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
