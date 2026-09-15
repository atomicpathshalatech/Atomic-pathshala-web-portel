import { prisma } from "@/lib/db";
import { NCERTLanguage, NCERTDocumentStatus } from "@prisma/client";

export async function seedSampleNcertContent() {
  console.log("[NCERT Seeder] Starting sample NCERT seeding...");

  const adminUser = await prisma.user.findFirst({
    select: { id: true },
  });

  if (!adminUser) {
    console.error("[NCERT Seeder] No user found in DB to attach upload to");
    return;
  }

  // 1. Find Class 11
  const class11 = await prisma.academicClass.findFirst({
    where: { numericValue: 11 },
  });
  if (!class11) {
    console.error("[NCERT Seeder] Class 11 not found in DB");
    return;
  }

  // 2. Find Biology & Physics subjects
  const bioSubject = await prisma.academicSubject.findFirst({
    where: { classId: class11.id, name: "Biology" },
  });
  const physSubject = await prisma.academicSubject.findFirst({
    where: { classId: class11.id, name: "Physics" },
  });

  if (!bioSubject) {
    console.error("[NCERT Seeder] Biology subject not found for Class 11");
    return;
  }

  // 3. Find Chapter 1: The Living World
  const livingWorldChapter = await prisma.academicChapter.findFirst({
    where: { subjectId: bioSubject.id, chapterNumber: 1 },
  });

  if (!livingWorldChapter) {
    console.error("[NCERT Seeder] The Living World chapter not found");
    return;
  }

  // --- SEED ENGLISH NCERT DOCUMENT FOR THE LIVING WORLD ---
  const enDoc = await prisma.ncertDocument.upsert({
    where: {
      academicChapterId_language_version: {
        academicChapterId: livingWorldChapter.id,
        language: NCERTLanguage.ENGLISH,
        version: 1,
      },
    },
    update: {
      status: NCERTDocumentStatus.READY,
      totalPages: 4,
    },
    create: {
      academicClassId: class11.id,
      academicSubjectId: bioSubject.id,
      academicChapterId: livingWorldChapter.id,
      language: NCERTLanguage.ENGLISH,
      fileName: "Biology_Class11_Chapter01_The_Living_World_EN.pdf",
      fileUrl: "https://assets.atomicpathshala.in/ncert/class11/biology/ch01_the_living_world_en.pdf",
      fileSize: 1258400,
      version: 1,
      status: NCERTDocumentStatus.READY,
      totalPages: 4,
      uploadedById: adminUser.id,
    },
  });

  // Pages for English Document
  const enPages = [
    {
      pageNumber: 1,
      text: `CHAPTER 1
THE LIVING WORLD

1.1 WHAT IS ‘LIVING’?
How wonderful is the living world! The wide range of living types is amazing. The extraordinary habitats in which we find living organisms, be it cold mountains, deciduous forests, oceans, fresh water lakes, deserts or hot springs, leave us speechless. The beauty of a galloping horse, of the migrating birds, the valley of flowers or the attacking shark evokes awe and a deep sense of wonder. The ecological conflict and cooperation among members of a population and among populations of a community or even the molecular traffic inside a cell make us deeply reflect on — what indeed is life?

This question has two implicit questions within it. The first is a technical one and seeks answer to what living is as opposed to the non-living, and the second is a philosophical one, and seeks answer to what the purpose of life is. As scientists, we shall not attempt answering the second question. We will try to reflect on - what is living?

When we try to define ‘living’, we conventionally look for distinctive characteristics exhibited by living organisms. Growth, reproduction, ability to sense environment and mount a suitable response come to our mind immediately as unique features of living organisms. One can add a few more features like metabolism, ability to self-replicate, self-organise, interact and emergence to this list. Let us try to understand each of these.`,
      elements: [
        { type: "heading", content: "CHAPTER 1: THE LIVING WORLD" },
        { type: "heading", content: "1.1 WHAT IS 'LIVING'?" },
        { type: "paragraph", content: "Growth, reproduction, ability to sense environment and mount a suitable response come to our mind immediately as unique features of living organisms. One can add a few more features like metabolism, ability to self-replicate, self-organise, interact and emergence to this list." }
      ]
    },
    {
      pageNumber: 2,
      text: `All living organisms grow. Increase in mass and increase in number of individuals are twin characteristics of growth. A multicellular organism grows by cell division. In plants, this growth by cell division occurs continuously throughout their life span. In animals, this growth is seen only up to a certain age. However, cell division occurs in certain tissues to replace lost cells. Unicellular organisms grow by cell division. One can easily observe this in in vitro cultures by simply counting the number of cells under the microscope. In majority of higher animals and plants, growth and reproduction are mutually exclusive events.

One must remember that increase in body mass is considered as growth. Non-living objects also grow if we take increase in body mass as a criterion for growth. Mountains, boulders and sand mounds do grow. However, this kind of growth exhibited by non-living objects is by accumulation of material on the surface. In living organisms, growth is from inside. Growth, therefore, cannot be taken as a defining property of living organisms. Conditions under which it can be observed in all living organisms have to be explained and then we understand that it is a characteristic of living systems. A dead organism does not grow.

Reproduction, likewise, is a characteristic of living organisms. In multicellular organisms, reproduction refers to the production of progeny possessing features more or less similar to those of parents. Invariably and implicitly we refer to sexual reproduction. Organisms reproduce by asexual means also. Fungi multiply and spread easily due to the millions of asexual spores they produce. In lower organisms like yeast and hydra, we observe budding. In Planaria (flat worms), we observe true regeneration, i.e., a fragmented organism regenerates the lost part of its body and becomes, a new organism. The fungi, the filamentous algae, the protonema of mosses, all easily multiply by fragmentation.`,
      elements: [
        { type: "heading", content: "GROWTH AND REPRODUCTION" },
        { type: "paragraph", content: "Increase in mass and increase in number of individuals are twin characteristics of growth." },
        { type: "paragraph", content: "Non-living objects also grow by accumulation of material on the surface. In living organisms, growth is from inside. Growth, therefore, cannot be taken as a defining property of living organisms." },
        { type: "paragraph", content: "In Planaria (flat worms), we observe true regeneration. The fungi, the filamentous algae, the protonema of mosses, all easily multiply by fragmentation." }
      ]
    },
    {
      pageNumber: 3,
      text: `When it comes to unicellular organisms like bacteria, unicellular algae or Amoeba, reproduction is synonymous with growth, i.e., increase in number of cells. Indeed, we have already defined growth as equivalent to increase in cell number or mass. Hence, we notice that in single-celled organisms, we are not very clear about the usage of these two terms – growth and reproduction.

Further, there are many organisms which do not reproduce (mules, sterile worker bees, infertile human couples, etc). Hence, reproduction also cannot be an all-inclusive defining property of living organisms. Of course, no non-living object is capable of reproducing or replicating by itself.

Another characteristic of life is metabolism. All living organisms are made of chemicals. These chemicals, small and big, belonging to various classes, sizes, functions, etc., are constantly being made and changed into some other biomolecules. These conversions are chemical reactions or metabolic reactions. There are thousands of metabolic reactions occurring simultaneously inside all living organisms, be they unicellular or multicellular. All plants, animals, fungi and microbes exhibit metabolism. The sum total of all the chemical reactions occurring in our body is metabolism. No non-living object exhibits metabolism. Metabolic reactions can be demonstrated outside the body in cell-free systems. An isolated metabolic reaction(s) outside the body of an organism, performed in a test tube is neither living nor non-living. Hence, while metabolism is a defining feature of all living organisms without exception, isolated metabolic reactions in vitro are not living things but surely living reactions. Hence, cellular organisation of the body is the defining feature of life forms.`,
      elements: [
        { type: "heading", content: "METABOLISM AND CELLULAR ORGANISATION" },
        { type: "paragraph", content: "Mules, sterile worker bees, and infertile human couples do not reproduce, so reproduction cannot be an all-inclusive defining property." },
        { type: "paragraph", content: "The sum total of all the chemical reactions occurring in our body is metabolism. No non-living object exhibits metabolism." },
        { type: "paragraph", content: "Metabolism is a defining feature of all living organisms without exception. Cellular organisation of the body is the defining feature of life forms." }
      ]
    },
    {
      pageNumber: 4,
      text: `Perhaps, the most obvious and technically complicated feature of all living organisms is this ability to sense their surroundings or environment and respond to these environmental stimuli which could be physical, chemical or biological. We sense our environment through our sense organs. Plants respond to external factors like light, water, temperature, other organisms, pollutants, etc. All organisms, from the prokaryotes to the most complex eukaryotes can sense and respond to environmental cues. Photoperiod affects reproduction in seasonal breeders, both plants and animals. All organisms handle chemicals entering their bodies. All organisms therefore, are ‘aware’ of their surroundings. Human being is the only organism who is aware of himself, i.e., has self-consciousness. Consciousness therefore, becomes the defining property of living organisms.

When we consider the human being, it is all the more difficult to define the living state. We observe patients lying in coma in hospitals virtually supported by machines which replace heart and lungs. The patient is otherwise brain-dead. The patient has no self-consciousness. Are such patients who never come back to normal life, living or non-living?

In higher classes, you will come to know that all living phenomena are due to underlying interactions. Properties of tissues are not present in the constituent cells but arise as a result of interactions among the constituent cells. Similarly, properties of cellular organelles are not present in the molecular constituents of the organelle but arise as a result of interactions among the molecular components comprising the organelle. These interactions result in emergent properties at a higher level of organisation. This phenomenon of emergence is true in the hierarchy of organisational complexity at all levels. Therefore, we can say that living organisms are self-replicating, evolving and self-regulating interactive systems capable of responding to external stimuli.`,
      elements: [
        { type: "heading", content: "CONSCIOUSNESS AND EMERGENT PROPERTIES" },
        { type: "paragraph", content: "Photoperiod affects reproduction in seasonal breeders, both plants and animals. Human being is the only organism who has self-consciousness." },
        { type: "paragraph", content: "Consciousness therefore, becomes the defining property of living organisms." },
        { type: "paragraph", content: "Living organisms are self-replicating, evolving and self-regulating interactive systems capable of responding to external stimuli." }
      ]
    }
  ];

  for (const p of enPages) {
    await prisma.ncertPage.upsert({
      where: {
        documentId_pageNumber: {
          documentId: enDoc.id,
          pageNumber: p.pageNumber,
        },
      },
      update: {
        extractedText: p.text,
        extractedElements: p.elements as any,
        processingStatus: "READY",
      },
      create: {
        documentId: enDoc.id,
        pageNumber: p.pageNumber,
        extractedText: p.text,
        extractedElements: p.elements as any,
        processingStatus: "READY",
      },
    });
  }

  // --- SEED HINDI NCERT DOCUMENT FOR THE LIVING WORLD (जीव जगत) ---
  const hiDoc = await prisma.ncertDocument.upsert({
    where: {
      academicChapterId_language_version: {
        academicChapterId: livingWorldChapter.id,
        language: NCERTLanguage.HINDI,
        version: 1,
      },
    },
    update: {
      status: NCERTDocumentStatus.READY,
      totalPages: 4,
    },
    create: {
      academicClassId: class11.id,
      academicSubjectId: bioSubject.id,
      academicChapterId: livingWorldChapter.id,
      language: NCERTLanguage.HINDI,
      fileName: "Biology_Class11_Chapter01_Jeev_Jagat_HI.pdf",
      fileUrl: "https://assets.atomicpathshala.in/ncert/class11/biology/ch01_jeev_jagat_hi.pdf",
      fileSize: 1320400,
      version: 1,
      status: NCERTDocumentStatus.READY,
      totalPages: 4,
      uploadedById: adminUser.id,
    },
  });

  const hiPages = [
    {
      pageNumber: 1,
      text: `अध्याय 1
जीव जगत

1.1 जीव क्या है?
जीव जगत कितना निराला है! जीवों के विस्तृत प्रकारों की श्रृंखला विस्मयकारी है। असाधारण वास स्थान चाहे वे ठंडे पर्वत, पर्णपाती वन, महासागर, अलवणीय मीठे जल की झीलें, मरुस्थल अथवा गर्म झरने हों, जहाँ जीव रहते हैं, वे हमें आश्चर्यचकित कर देते हैं। सरपट दौड़ते घोड़े, प्रवासी पक्षियों, घाटियों में खिलते फूलों अथवा हमलावर शार्क की सुंदरता विस्मय तथा श्रद्धा की गहरी भावना उत्पन्न करती है। किसी समष्टि के सदस्यों के बीच तथा समुदाय की समष्टियों के बीच पारिस्थितिक संघर्ष तथा सहयोग अथवा कोशिका के भीतर आण्विक गतिशीलता से हमें यह गहराई से सोचने को बाध्य होना पड़ता है कि वास्तव में जीवन क्या है?

इस प्रश्न में दो अन्तर्निहित प्रश्न हैं। पहला तकनीकी है जो जीव और निर्जीव के अंतर का उत्तर खोजने का प्रयास करता है तथा दूसरा दार्शनिक है जो यह जानने का प्रयास करता है कि जीवन का उद्देश्य क्या है? वैज्ञानिकों के रूप में हम दूसरे प्रश्न का उत्तर देने का प्रयास नहीं करेंगे। हम पहले प्रश्न पर विचार करेंगे कि जीव क्या है?

जब हम 'जीव' को परिभाषित करने का प्रयास करते हैं, तब हम पारंपरिक रूप से जीवों के सुस्पष्ट अभिलक्षणों को देखते हैं। वृद्धि, जनन, पर्यावरण के प्रति संवेदना की अनुभूति तथा उसके अनुकूल क्रिया करना — ये सब जीवों के अद्वितीय लक्षण के रूप में तुरंत हमारे ध्यान में आते हैं। इस सूची में उपापचय, स्वयं की प्रतिलिपि बनाना, स्वयं को संगठित करना, परस्पर क्रिया तथा उद्गमन जैसे कुछ और लक्षणों को भी जोड़ा जा सकता है। आइए हम इनमें से प्रत्येक को समझने का प्रयास करें।`,
      elements: [
        { type: "heading", content: "अध्याय 1: जीव जगत" },
        { type: "heading", content: "1.1 जीव क्या है?" },
        { type: "paragraph", content: "वृद्धि, जनन, पर्यावरण के प्रति संवेदना की अनुभूति तथा उसके अनुकूल क्रिया करना — ये सब जीवों के अद्वितीय लक्षण हैं।" }
      ]
    },
    {
      pageNumber: 2,
      text: `सभी जीव वृद्धि करते हैं। भार तथा संख्या में वृद्धि होना — ये दोनों वृद्धि के द्वियुग्मी अभिलक्षण हैं। बहुकोशिकीय जीव कोशिका विभाजन द्वारा वृद्धि करते हैं। पौधों में यह वृद्धि कोशिका विभाजन द्वारा जीवन पर्यन्त होती रहती है। प्राणियों में यह वृद्धि केवल एक निश्चित आयु तक होती है। लेकिन नष्ट हुई कोशिकाओं के स्थान पर कुछ ऊतकों में कोशिका विभाजन होता रहता है। एककोशिकीय जीव भी कोशिका विभाजन द्वारा वृद्धि करते हैं। इन विट्रो संवर्धन में सूक्ष्मदर्शी के नीचे कोशिकाओं की संख्या गिनकर इसे आसानी से देखा जा सकता है। अधिकांश उच्च कोटि के प्राणियों तथा पादपों में वृद्धि तथा जनन पारस्परिक रूप से विशिष्ट घटनाएँ हैं।

हमें याद रखना चाहिए कि शरीर के भार में वृद्धि होने को वृद्धि समझा जाता है। यदि हम शरीर के भार में वृद्धि को वृद्धि का लक्षण मानें तो निर्जीवों के भार में भी वृद्धि होती है। पर्वत, गोलाश्म तथा रेत के टीले भी बढ़ते हैं। लेकिन निर्जीवों में इस प्रकार की वृद्धि उनकी सतह पर पदार्थों के एकत्र होने से होती है। जीवों में यह वृद्धि अंदर की ओर से होती है। इसलिए वृद्धि को जीवों का विशिष्ट अथवा परिभाषित लक्षण नहीं माना जा सकता। जीवों में यह किन परिस्थितियों में परिलक्षित होता है, इसे समझकर ही यह समझा जा सकता है कि यह जीव तंत्र का अभिलक्षण है। एक मृत जीव वृद्धि नहीं करता।

जनन भी जीवों का एक अभिलक्षण है। बहुकोशिकीय जीवों में जनन का अर्थ अपनी संतति उत्पन्न करना है जिसके अभिलक्षण लगभग अपने माता-पिता से मिलते-जुलते होते हैं। स्वाभाविक रूप से हम लैंगिक जनन की बात करते हैं। जीव अलैंगिक जनन भी करते हैं। कवकों में लाखों अलैंगिक बीजाणुओं द्वारा गुणन होता है और वे आसानी से फैल जाते हैं। यीस्ट तथा हाइड्रा जैसे निम्न कोटि के जीवों में हम मुकुलन देखते हैं। प्लैनेरिया (चपटे कृमि) में हम वास्तविक पुनर्जनन देखते हैं, अर्थात् एक खंडित जीव अपने शरीर के लुप्त भाग को पुनः प्राप्त कर लेता है और इस प्रकार एक नया जीव बन जाता है। कवक, तंतुमयी शैवाल, मॉस का प्रथम तंतु (प्रोटोनेमा) सभी विखंडन विधि द्वारा सरलता से गुणन करते हैं।`,
      elements: [
        { type: "heading", content: "वृद्धि और जनन" },
        { type: "paragraph", content: "भार तथा संख्या में वृद्धि होना — ये दोनों वृद्धि के द्वियुग्मी अभिलक्षण हैं।" },
        { type: "paragraph", content: "निर्जीवों में वृद्धि सतह पर पदार्थों के संचय द्वारा होती है, जबकि जीवों में वृद्धि अंदर से होती है। अतः वृद्धि जीवों का परिभाषित लक्षण नहीं है।" },
        { type: "paragraph", content: "प्लैनेरिया (चपटे कृमि) में वास्तविक पुनर्जनन देखा जाता है।" }
      ]
    },
    {
      pageNumber: 3,
      text: `जब हम एककोशिकीय जीवों जैसे जीवाणु, एककोशिकीय शैवाल अथवा अमीबा के विषय में बात करते हैं, तो जनन की वृद्धि के साथ पर्यायवाची होती है, अर्थात् कोशिकाओं की संख्या में वृद्धि होना। हम पहले ही वृद्धि की परिभाषा संख्या अथवा भार में वृद्धि के रूप में कर चुके हैं। इसलिए हम देखते हैं कि एककोशिकीय जीवों में 'वृद्धि' तथा 'जनन' इन दोनों शब्दों के उपयोग के विषय में हम पूर्णतः स्पष्ट नहीं हैं।

इसके अतिरिक्त बहुत से ऐसे जीव हैं जो जनन नहीं करते (खच्चर, बंध्य कर्मी मधुमक्खी, अनुर्वर मानव युगल आदि)। इस प्रकार जनन भी जीवों का समग्र परिभाषित लक्षण नहीं हो सकता। यद्यपि कोई भी निर्जीव वस्तु स्वयं जनन अथवा अपनी प्रतिलिपि बनाने में सक्षम नहीं है।

जीवों का दूसरा लक्षण उपापचय (Metabolism) है। सभी जीव रसायनों से बने होते हैं। ये रसायन, छोटे-बड़े, विभिन्न वर्गों, आकारों, कार्यों आदि वाले, लगातार बनते रहते हैं और अन्य जैव अणुओं में परिवर्तित होते रहते हैं। ये परिवर्तन रासायनिक अथवा उपापचयी क्रियाएँ हैं। सभी जीवों में, चाहे वे एककोशिकीय हों अथवा बहुकोशिकीय, हजारों उपापचयी क्रियाएं साथ-साथ चलती रहती हैं। सभी पौधे, प्राणी, कवक तथा सूक्ष्मजीव उपापचय प्रदर्शित करते हैं। हमारे शरीर में होने वाली सभी रासायनिक क्रियाओं का योग उपापचय है। किसी भी निर्जीव में उपापचय क्रियाएं नहीं होती हैं। शरीर के बाहर कोशिका-मुक्त तंत्र में उपापचयी क्रियाएं प्रदर्शित की जा सकती हैं। शरीर के बाहर परखनली में की गई एकाकी उपापचयी क्रिया न तो जैव है और न ही अजैव। अतः उपापचय बिना किसी अपवाद के सभी जीवों का एक परिभाषित लक्षण है, जबकि पात्रे (in vitro) में एकाकी उपापचयी क्रियाएँ जैविक क्रियाएँ हैं। अतः शरीर का कोशिकीय संगठन जीवन स्वरूप का स्पष्ट परिभाषित लक्षण है।`,
      elements: [
        { type: "heading", content: "उपापचय एवं कोशिकीय संगठन" },
        { type: "paragraph", content: "खच्चर, बंध्य कर्मी मधुमक्खी तथा अनुर्वर मानव युगल जनन नहीं करते, अतः जनन भी समग्र परिभाषित लक्षण नहीं है।" },
        { type: "paragraph", content: "हमारे शरीर में होने वाली सभी रासायनिक क्रियाओं का योग उपापचय है। किसी भी निर्जीव में उपापचय नहीं होता।" },
        { type: "paragraph", content: "उपापचय बिना किसी अपवाद के सभी जीवों का परिभाषित लक्षण है। कोशिकीय संगठन जीवन का परिभाषित लक्षण है।" }
      ]
    },
    {
      pageNumber: 4,
      text: `शायद सभी जीवों का सबसे स्पष्ट परंतु तकनीकी रूप से जटिल अभिलक्षण अपने आसपास अथवा पर्यावरण के भौतिक, रासायनिक अथवा जैविक उद्दीपनों के प्रति संवेदनशीलता तथा अनुक्रिया करना है। हम अपने संवेदी अंगों द्वारा अपने पर्यावरण को महसूस करते हैं। पौधे प्रकाश, जल, ताप, अन्य जीवों, प्रदूषकों आदि जैसे बाह्य कारकों के प्रति अनुक्रिया करते हैं। प्रोकैरियोट से लेकर जटिलतम यूकैरियोट तक सभी जीव पर्यावरण के संकेतों के प्रति संवेदना एवं अनुक्रिया प्रदर्शित कर सकते हैं। दीप्तिकाल (Photoperiod) मौसमी प्रजनकों, पादपों तथा प्राणियों दोनों में जनन को प्रभावित करता है। सभी जीव अपने शरीर में प्रवेश करने वाले रसायनों का नियमन करते हैं। इसलिए सभी जीव अपने पर्यावरण से अवगत होते हैं। मानव ही केवल ऐसा जीव है जो स्वयं से अवगत होता है, अर्थात् उसके पास स्व-चेतना (Self-consciousness) होती है। अतः चेतना (Consciousness) जीवों का स्पष्ट परिभाषित लक्षण बन जाती है।

जब हम मानव के विषय में विचार करते हैं, तब जीवित अवस्था को परिभाषित करना और भी कठिन हो जाता है। हम अस्पतालों में कोमा में पड़े रोगियों को देखते हैं जो हृदय तथा फेफड़ों को प्रतिस्थापित करने वाली मशीनों के सहारे जीवित रहते हैं। रोगी अन्यथा ब्रेन-डेड (मस्तिष्क मृत) होता है। रोगी में कोई स्व-चेतना नहीं होती। ऐसे रोगी जो कभी सामान्य जीवन में वापस नहीं आ पाते, वे जीवित हैं अथवा निर्जीव?

उच्च कक्षाओं में आप जानेंगे कि सभी जैविक परिघटनाएं अंतर्निहित अंतरक्रियाओं के कारण होती हैं। ऊतकों के गुणधर्म उनके घटक कोशिकाओं में उपस्थित नहीं होते, बल्कि घटक कोशिकाओं के बीच अंतरक्रिया के परिणामस्वरूप उत्पन्न होते हैं। इसी प्रकार कोशिकीय अंगकों के गुणधर्म उनके आण्विक घटकों में नहीं होते, बल्कि अंगक के आण्विक घटकों के बीच अंतरक्रिया के कारण होते हैं। ये अंतरक्रियाएं उच्च स्तर के संगठन में उद्गामी गुणधर्मों (Emergent properties) को जन्म देती हैं। संगठनात्मक जटिलता के पदानुक्रम में यह परिघटना सभी स्तरों पर सत्य है। अतः हम कह सकते हैं कि जीव स्व-प्रतिकृति बनाने वाले, विकासशील तथा स्व-नियमनकारी परस्पर संवादात्मक तंत्र हैं जो बाह्य उद्दीपनों के प्रति अनुक्रिया करने में सक्षम हैं।`,
      elements: [
        { type: "heading", content: "चेतना और उद्गामी गुणधर्म" },
        { type: "paragraph", content: "दीप्तिकाल (Photoperiod) मौसमी प्रजनकों के जनन को प्रभावित करता है। केवल मानव में स्व-चेतना होती है।" },
        { type: "paragraph", content: "चेतना (Consciousness) जीवों का स्पष्ट परिभाषित लक्षण है।" },
        { type: "paragraph", content: "जीव स्व-प्रतिकृति बनाने वाले, विकासशील तथा स्व-नियमनकारी तंत्र हैं।" }
      ]
    }
  ];

  for (const p of hiPages) {
    await prisma.ncertPage.upsert({
      where: {
        documentId_pageNumber: {
          documentId: hiDoc.id,
          pageNumber: p.pageNumber,
        },
      },
      update: {
        extractedText: p.text,
        extractedElements: p.elements as any,
        processingStatus: "READY",
      },
      create: {
        documentId: hiDoc.id,
        pageNumber: p.pageNumber,
        extractedText: p.text,
        extractedElements: p.elements as any,
        processingStatus: "READY",
      },
    });
  }

  console.log("[NCERT Seeder] Successfully seeded English & Hindi NCERT content for Class 11 Biology: The Living World!");
}
