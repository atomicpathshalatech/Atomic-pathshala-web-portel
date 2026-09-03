import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedDemoCbtTest() {
  console.log("--- Starting Idempotent Demo CBT Test Seeding ---");

  // 1. Upsert Public Test Series
  const testSeries = await prisma.testSeries.upsert({
    where: { id: "atomic-demo-cbt-series" },
    create: {
      id: "atomic-demo-cbt-series",
      name: "Atomic Pathshala Official CBT Series",
      code: "OFFICIAL-CBT-SERIES",
      description: "Official CBT Simulation & Practice Test Series for NEET/JEE aspirants.",
      course: "NEET UG",
      visibility: "PUBLIC",
      status: "PUBLISHED",
    },
    update: {
      name: "Atomic Pathshala Official CBT Series",
      visibility: "PUBLIC",
      status: "PUBLISHED",
    },
  });

  console.log(`✓ TestSeries: ${testSeries.id}`);

  // 2. Upsert Demo Test
  const demoTest = await prisma.test.upsert({
    where: { id: "atomic-pathshala-demo-cbt-test" },
    create: {
      id: "atomic-pathshala-demo-cbt-test",
      name: "Atomic Pathshala Demo CBT Test",
      code: "DEMO-CBT-10",
      description:
        "10 प्रश्नों वाला Demo Test — Student Test Interface, Question Palette, Review, Language और Result Flow को test करने के लिए।",
      instructions:
        "Total 10 questions (Biology 4, Chemistry 3, Physics 3). Duration 20 minutes. Correct +4, Incorrect -1.",
      testSeriesId: testSeries.id,
      durationMin: 20,
      correctMarks: 4,
      incorrectMarks: -1,
      negativeMarkingEnabled: true,
      status: "PUBLISHED",
      languageMode: "BOTH",
      examType: "NEET UG",
      testType: "PRACTICE",
    },
    update: {
      name: "Atomic Pathshala Demo CBT Test",
      description:
        "10 प्रश्नों वाला Demo Test — Student Test Interface, Question Palette, Review, Language और Result Flow को test करने के लिए।",
      durationMin: 20,
      correctMarks: 4,
      incorrectMarks: -1,
      status: "PUBLISHED",
      testSeriesId: testSeries.id,
    },
  });

  console.log(`✓ Demo Test: ${demoTest.id}`);

  // 3. Upsert Sections (Biology, Chemistry, Physics)
  const bioSection = await prisma.section.upsert({
    where: { id: "demo-sec-biology" },
    create: {
      id: "demo-sec-biology",
      testId: demoTest.id,
      name: "Biology Section",
      subject: "Biology",
      order: 1,
      targetCount: 4,
      marksPerQuestion: 4,
      negativeMarks: -1,
    },
    update: {
      name: "Biology Section",
      subject: "Biology",
      order: 1,
      targetCount: 4,
    },
  });

  const chemSection = await prisma.section.upsert({
    where: { id: "demo-sec-chemistry" },
    create: {
      id: "demo-sec-chemistry",
      testId: demoTest.id,
      name: "Chemistry Section",
      subject: "Chemistry",
      order: 2,
      targetCount: 3,
      marksPerQuestion: 4,
      negativeMarks: -1,
    },
    update: {
      name: "Chemistry Section",
      subject: "Chemistry",
      order: 2,
      targetCount: 3,
    },
  });

  const physSection = await prisma.section.upsert({
    where: { id: "demo-sec-physics" },
    create: {
      id: "demo-sec-physics",
      testId: demoTest.id,
      name: "Physics Section",
      subject: "Physics",
      order: 3,
      targetCount: 3,
      marksPerQuestion: 4,
      negativeMarks: -1,
    },
    update: {
      name: "Physics Section",
      subject: "Physics",
      order: 3,
      targetCount: 3,
    },
  });

  // 4. 10 NEET-Level Bilingual Questions
  const questionsData = [
    // BIOLOGY (Q1 - Q4)
    {
      id: "demo-q1-cell-cycle",
      sectionId: bioSection.id,
      order: 1,
      subject: "Biology",
      chapter: "Cell Cycle and Cell Division",
      difficulty: "EASY",
      statementEn: "During which phase of the cell cycle does DNA replication take place?",
      optionsEn: { A: "G1 phase", B: "S phase", C: "G2 phase", D: "M phase" },
      statementHi: "कोशिका चक्र की किस प्रावस्था के दौरान DNA का प्रतिकृतियन (Replication) होता है?",
      optionsHi: { A: "G1 प्रावस्था", B: "S प्रावस्था", C: "G2 प्रावस्था", D: "M प्रावस्था" },
      correctOption: "B",
      solutionEn: "DNA replication and synthesis take place during the S (Synthesis) phase of the cell cycle. During this phase, the amount of DNA per cell doubles.",
      solutionHi: "कोशिका चक्र के S (संश्लेषण) प्रावस्था के दौरान DNA प्रतिकृतियन और संश्लेषण होता है। इस प्रावस्था में प्रति कोशिका DNA की मात्रा दोगुनी हो जाती है।",
    },
    {
      id: "demo-q2-heart-chamber",
      sectionId: bioSection.id,
      order: 2,
      subject: "Biology",
      chapter: "Body Fluids and Circulation",
      difficulty: "EASY",
      statementEn: "Which chamber of the human heart receives oxygenated blood from the lungs via pulmonary veins?",
      optionsEn: { A: "Right atrium", B: "Right ventricle", C: "Left atrium", D: "Left ventricle" },
      statementHi: "मानव हृदय का कौन-सा कोष्ठ फुफ्फुसीय शिराओं (Pulmonary veins) के माध्यम से फेफड़ों से ऑक्सीजन युक्त रक्त प्राप्त करता है?",
      optionsHi: { A: "दायाँ आलिंद", B: "दायाँ निलय", C: "बायाँ आलिंद", D: "बायाँ निलय" },
      correctOption: "C",
      solutionEn: "Oxygenated blood from the lungs is carried by four pulmonary veins into the left atrium of the human heart.",
      solutionHi: "फेफड़ों से ऑक्सीजनित रक्त चार फुफ्फुसीय शिराओं द्वारा मानव हृदय के बाएँ आलिंद (Left atrium) में लाया जाता है।",
    },
    {
      id: "demo-q3-mendel-cross",
      sectionId: bioSection.id,
      order: 3,
      subject: "Biology",
      chapter: "Principles of Inheritance and Variation",
      difficulty: "MEDIUM",
      statementEn: "What is the phenotypic ratio obtained in the F2 generation of a Mendelian monohybrid cross?",
      optionsEn: { A: "9:3:3:1", B: "3:1", C: "1:2:1", D: "1:1:1:1" },
      statementHi: "मेंडेलियन एकसंकर संकरण (Monohybrid cross) की F2 पीढ़ी में प्राप्त दृश्यप्ररूपी (Phenotypic) अनुपात क्या होता है?",
      optionsHi: { A: "9:3:3:1", B: "3:1", C: "1:2:1", D: "1:1:1:1" },
      correctOption: "B",
      solutionEn: "In a typical Mendelian monohybrid cross between homozygous dominant and recessive parents, the F2 generation phenotypic ratio is 3:1 (Dominant : Recessive), while the genotypic ratio is 1:2:1.",
      solutionHi: "एक प्रारूपिक मेंडेलियन एकसंकर संकरण में F2 पीढ़ी का लक्षणप्ररूपी (दृश्यप्ररूपी) अनुपात 3:1 (प्रभावी : अप्रभावी) होता है, जबकि जीनप्ररूपी अनुपात 1:2:1 होता है।",
    },
    {
      id: "demo-q4-c3-plant-rubp",
      sectionId: bioSection.id,
      order: 4,
      subject: "Biology",
      chapter: "Photosynthesis in Higher Plants",
      difficulty: "MEDIUM",
      statementEn: "Which primary carbon dioxide acceptor is involved in C3 plants during the dark reaction?",
      optionsEn: {
        A: "Phosphoenolpyruvate (PEP)",
        B: "Ribulose-1,5-bisphosphate (RuBP)",
        C: "Oxaloacetic acid (OAA)",
        D: "3-Phosphoglyceric acid (PGA)",
      },
      statementHi: "C3 पादपों में अप्रकाशीय अभिक्रिया (Dark reaction) के दौरान प्राथमिक कार्बन डाइऑक्साइड ग्राही कौन-सा होता है?",
      optionsHi: {
        A: "फॉस्फोइनोलपाइरूवेट (PEP)",
        B: "रिबुलोज-1,5-बिसफॉस्फेट (RuBP)",
        C: "ऑक्सालोएसिटिक अम्ल (OAA)",
        D: "3-फॉस्फोग्लिसरिक अम्ल (PGA)",
      },
      correctOption: "B",
      solutionEn: "In C3 plants, the primary CO2 acceptor is a 5-carbon ketose sugar called Ribulose-1,5-bisphosphate (RuBP), catalyzed by the enzyme RuBisCO.",
      solutionHi: "C3 पादपों में प्राथमिक CO2 ग्राही 5-कार्बन वाला कीटोज़ शर्करा रिबुलोज़-1,5-बिसफॉस्फेट (RuBP) होता है, जिसे RuBisCO एंजाइम द्वारा उत्प्रेरित किया जाता है।",
    },

    // CHEMISTRY (Q5 - Q7)
    {
      id: "demo-q5-pauli-orbital",
      sectionId: chemSection.id,
      order: 5,
      subject: "Chemistry",
      chapter: "Structure of Atom",
      difficulty: "EASY",
      statementEn: "What is the maximum number of electrons that can be accommodated in a single $3d$ orbital ($n = 3, l = 2$)?",
      optionsEn: { A: "2", B: "6", C: "10", D: "14" },
      statementHi: "क्वांटम संख्या $n = 3$ और $l = 2$ वाले एक कक्षक (Single $3d$ orbital) में अधिकतम कितने इलेक्ट्रॉन समाहित हो सकते हैं?",
      optionsHi: { A: "2", B: "6", C: "10", D: "14" },
      correctOption: "A",
      solutionEn: "According to Pauli's Exclusion Principle, any single orbital can hold a maximum of 2 electrons with opposite spins, regardless of principal quantum number $n$ and azimuthal quantum number $l$.",
      solutionHi: "पॉली के अपवर्जन नियम के अनुसार, किसी भी एक कक्षक (Single orbital) में विपरीत चक्रण वाले अधिकतम 2 इलेक्ट्रॉन ही रह सकते हैं।",
    },
    {
      id: "demo-q6-co2-geometry",
      sectionId: chemSection.id,
      order: 6,
      subject: "Chemistry",
      chapter: "Chemical Bonding and Molecular Structure",
      difficulty: "MEDIUM",
      statementEn: "Which of the following molecules has a linear molecular geometry and zero dipole moment ($\\mu = 0$)?",
      optionsEn: { A: "$\\text{H}_2\\text{O}$", B: "$\\text{SO}_2$", C: "$\\text{CO}_2$", D: "$\\text{NH}_3$" },
      statementHi: "निम्नलिखित में से किस अणु की ज्यामिति रैखिक (Linear) है तथा उसका द्विध्रुव आघूर्ण शून्य ($\\mu = 0$) है?",
      optionsHi: { A: "$\\text{H}_2\\text{O}$", B: "$\\text{SO}_2$", C: "$\\text{CO}_2$", D: "$\\text{NH}_3$" },
      correctOption: "C",
      solutionEn: "$\\text{CO}_2$ has $sp$ hybridization with a linear structure ($\\text{O}=\\text{C}=\\text{O}$, bond angle $180^\\circ$). The two equal and opposite $\\text{C}=\\text{O}$ dipole vectors cancel out, resulting in $\\mu = 0$.",
      solutionHi: "$\\text{CO}_2$ में $sp$ संकरण के कारण इसकी संरचना रैखिक ($\\text{O}=\\text{C}=\\text{O}$, बंध कोण $180^\\circ$) होती है। दोनों विपरीत $\\text{C}=\\text{O}$ बंध आघूर्ण एक-दूसरे को निरस्त कर देते हैं, जिससे कुल $\\mu = 0$ होता है।",
    },
    {
      id: "demo-q7-iupac-methylbutane",
      sectionId: chemSection.id,
      order: 7,
      subject: "Chemistry",
      chapter: "Organic Chemistry - Some Basic Principles",
      difficulty: "EASY",
      statementEn: "What is the correct IUPAC name of the compound $\\text{CH}_3-\\text{CH}(\\text{CH}_3)-\\text{CH}_2-\\text{CH}_3$?",
      optionsEn: { A: "2-Methylbutane", B: "3-Methylbutane", C: "Isopentane", D: "2-Ethylpropane" },
      statementHi: "यौगिक $\\text{CH}_3-\\text{CH}(\\text{CH}_3)-\\text{CH}_2-\\text{CH}_3$ का सही IUPAC नाम क्या है?",
      optionsHi: { A: "2-मेथिलब्यूटेन", B: "3-मेथिलब्यूटेन", C: "आइसोपेंटेन", D: "2-एथिलप्रोपेन" },
      correctOption: "A",
      solutionEn: "The longest carbon chain contains 4 carbons (butane) with a methyl substituent at carbon-2 when numbered from the nearest end (left). Thus, the IUPAC name is 2-Methylbutane.",
      solutionHi: "सबसे लंबी कार्बन श्रृंखला 4 कार्बनों (ब्यूटेन) की है जिसमें बाएँ से अंकन करने पर कार्बन-2 पर एक मेथिल समूह जुड़ा है। अतः सही IUPAC नाम 2-मेथिलब्यूटेन है।",
    },

    // PHYSICS (Q8 - Q10)
    {
      id: "demo-q8-gravitational-constant",
      sectionId: physSection.id,
      order: 8,
      subject: "Physics",
      chapter: "Units and Measurements",
      difficulty: "MEDIUM",
      statementEn: "What is the dimensional formula for the Universal Gravitational Constant ($G$)?",
      optionsEn: {
        A: "$[\\text{M}^{-1}\\text{L}^3\\text{T}^{-2}]$",
        B: "$[\\text{M}^1\\text{L}^2\\text{T}^{-2}]$",
        C: "$[\\text{M}^{-1}\\text{L}^2\\text{T}^{-1}]$",
        D: "$[\\text{M}^0\\text{L}^3\\text{T}^{-2}]$",
      },
      statementHi: "सार्वत्रिक गुरुत्वाकर्षण नियतांक ($G$) का विमीय सूत्र क्या है?",
      optionsHi: {
        A: "$[\\text{M}^{-1}\\text{L}^3\\text{T}^{-2}]$",
        B: "$[\\text{M}^1\\text{L}^2\\text{T}^{-2}]$",
        C: "$[\\text{M}^{-1}\\text{L}^2\\text{T}^{-1}]$",
        D: "$[\\text{M}^0\\text{L}^3\\text{T}^{-2}]$",
      },
      correctOption: "A",
      solutionEn: "From Newton's law of gravitation: $F = \\frac{G m_1 m_2}{r^2} \\implies G = \\frac{F r^2}{m^2} = \\frac{[\\text{M}\\text{L}\\text{T}^{-2}][\\text{L}^2]}{[\\text{M}^2]} = [\\text{M}^{-1}\\text{L}^3\\text{T}^{-2}]$.",
      solutionHi: "न्यूटन के गुरुत्वाकर्षण नियम से: $F = \\frac{G m_1 m_2}{r^2} \\implies G = \\frac{F r^2}{m^2} = \\frac{[\\text{M}\\text{L}\\text{T}^{-2}][\\text{L}^2]}{[\\text{M}^2]} = [\\text{M}^{-1}\\text{L}^3\\text{T}^{-2}]$।",
    },
    {
      id: "demo-q9-kinematics-distance",
      sectionId: physSection.id,
      order: 9,
      subject: "Physics",
      chapter: "Motion in a Straight Line",
      difficulty: "EASY",
      statementEn: "A car starts from rest and accelerates uniformly at $2\\text{ m/s}^2$ for $5\\text{ seconds}$. What is the distance covered by the car?",
      optionsEn: { A: "$10\\text{ m}$", B: "$25\\text{ m}$", C: "$50\\text{ m}$", D: "$100\\text{ m}$" },
      statementHi: "एक कार विरामावस्था से चलना प्रारंभ करती है तथा $2\\text{ m/s}^2$ के एकसमान त्वरण से $5\\text{ सेकंड}$ तक त्वरित होती है। कार द्वारा तय की गई दूरी क्या होगी?",
      optionsHi: { A: "$10\\text{ m}$", B: "$25\\text{ m}$", C: "$50\\text{ m}$", D: "$100\\text{ m}$" },
      correctOption: "B",
      solutionEn: "Using the second equation of motion: $s = ut + \\frac{1}{2}at^2$. Since $u = 0$, $a = 2\\text{ m/s}^2$, and $t = 5\\text{ s}$, we obtain $s = 0 + \\frac{1}{2}(2)(5)^2 = 25\\text{ m}$.",
      solutionHi: "गति के दूसरे समीकरण $s = ut + \\frac{1}{2}at^2$ का उपयोग करने पर: चूँकि $u = 0$, $a = 2\\text{ m/s}^2$ तथा $t = 5\\text{ s}$, अतः $s = 0 + \\frac{1}{2}(2)(5)^2 = 25\\text{ m}$।",
    },
    {
      id: "demo-q10-parallel-resistors",
      sectionId: physSection.id,
      order: 10,
      subject: "Physics",
      chapter: "Current Electricity",
      difficulty: "EASY",
      statementEn: "Three resistors of resistances $2\\,\\Omega$, $3\\,\\Omega$, and $6\\,\\Omega$ are connected in parallel. What is their equivalent resistance?",
      optionsEn: { A: "$1\\,\\Omega$", B: "$11\\,\\Omega$", C: "$0.5\\,\\Omega$", D: "$3\\,\\Omega$" },
      statementHi: "$2\\,\\Omega$, $3\\,\\Omega$ तथा $6\\,\\Omega$ के तीन प्रतिरोध समांतर क्रम (Parallel) में जुड़े हैं। उनका तुल्य प्रतिरोध क्या होगा?",
      optionsHi: { A: "$1\\,\\Omega$", B: "$11\\,\\Omega$", C: "$0.5\\,\\Omega$", D: "$3\\,\\Omega$" },
      correctOption: "A",
      solutionEn: "For a parallel combination: $\\frac{1}{R_{eq}} = \\frac{1}{2} + \\frac{1}{3} + \\frac{1}{6} = \\frac{3 + 2 + 1}{6} = \\frac{6}{6} = 1 \\implies R_{eq} = 1\\,\\Omega$.",
      solutionHi: "समांतर क्रम संयोजन के लिए: $\\frac{1}{R_{eq}} = \\frac{1}{2} + \\frac{1}{3} + \\frac{1}{6} = \\frac{3 + 2 + 1}{6} = \\frac{6}{6} = 1 \\implies R_{eq} = 1\\,\\Omega$।",
    },
  ];

  for (const q of questionsData) {
    // 1. Upsert Question record
    await prisma.question.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        questionCode: `CBT-${q.order.toString().padStart(3, "0")}`,
        subject: q.subject,
        chapter: q.chapter,
        difficulty: q.difficulty as any,
        type: "SINGLE_CORRECT",
        status: "PUBLISHED",
        isPublished: true,
      },
      update: {
        subject: q.subject,
        chapter: q.chapter,
        difficulty: q.difficulty as any,
        isPublished: true,
        status: "PUBLISHED",
      },
    });

    // 2. Upsert English Translation
    await prisma.questionTranslation.upsert({
      where: {
        questionId_language: {
          questionId: q.id,
          language: "ENGLISH",
        },
      },
      create: {
        questionId: q.id,
        language: "ENGLISH",
        statement: q.statementEn,
        options: q.optionsEn,
        solution: q.solutionEn,
        correctOptionIds: [q.correctOption],
      },
      update: {
        statement: q.statementEn,
        options: q.optionsEn,
        solution: q.solutionEn,
        correctOptionIds: [q.correctOption],
      },
    });

    // 3. Upsert Hindi Translation
    await prisma.questionTranslation.upsert({
      where: {
        questionId_language: {
          questionId: q.id,
          language: "HINDI",
        },
      },
      create: {
        questionId: q.id,
        language: "HINDI",
        statement: q.statementHi,
        options: q.optionsHi,
        solution: q.solutionHi,
        correctOptionIds: [q.correctOption],
      },
      update: {
        statement: q.statementHi,
        options: q.optionsHi,
        solution: q.solutionHi,
        correctOptionIds: [q.correctOption],
      },
    });

    // 4. Link Question to Section
    await prisma.sectionQuestion.upsert({
      where: {
        sectionId_questionId: {
          sectionId: q.sectionId,
          questionId: q.id,
        },
      },
      create: {
        sectionId: q.sectionId,
        questionId: q.id,
        order: q.order,
        marksOverride: 4,
        negativeMarksOverride: -1,
      },
      update: {
        order: q.order,
        marksOverride: 4,
        negativeMarksOverride: -1,
      },
    });

    console.log(`  ✓ Seeded Q${q.order} (${q.subject}): ${q.id}`);
  }

  console.log("--- Successfully seeded Atomic Pathshala Demo CBT Test (10 Questions)! ---");
}

if (require.main === module) {
  seedDemoCbtTest()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
