export type ModuleSubject = "CHEMISTRY" | "PHYSICS" | "BIOLOGY";

export interface SubjectTheme {
  id: ModuleSubject;
  name: string;
  hindiName: string;
  tagline: string;
  primaryColor: string;
  lightBg: string;
  softBg: string;
  darkText: string;
  accentColor: string;
  icon: string;
  heroVisualSvg: string;
  standardChapters: { en: string; hi: string }[];
}

export const SUBJECT_THEMES: Record<ModuleSubject, SubjectTheme> = {
  CHEMISTRY: {
    id: "CHEMISTRY",
    name: "CHEMISTRY",
    hindiName: "रसायन विज्ञान",
    tagline: "Chemical Sciences • Molecular Dynamics • Reaction Mechanics",
    primaryColor: "#0B7A43", // Official Chemistry Green
    lightBg: "#E8F5ED",      // Light Green for highlight boxes
    softBg: "#F5FBF8",       // Soft Green background
    darkText: "#1F2937",     // Dark Text
    accentColor: "#94D3B2",  // Accent Green
    icon: "science",
    heroVisualSvg: `
      <!-- Chemistry Lab Glassware & Molecules Visual -->
      <svg viewBox="0 0 400 480" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; object-fit: contain;">
        <defs>
          <linearGradient id="flaskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0B7A43" stop-opacity="0.85" />
            <stop offset="60%" stop-color="#10B981" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#047857" stop-opacity="0.95" />
          </linearGradient>
          <linearGradient id="liquidGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#34D399" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
          <filter id="chemGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Molecular Lattice Wireframe in Background -->
        <g stroke="#94D3B2" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.65">
          <circle cx="280" cy="90" r="16" fill="#E8F5ED" />
          <circle cx="360" cy="140" r="14" fill="#E8F5ED" />
          <circle cx="320" cy="220" r="18" fill="#E8F5ED" />
          <circle cx="240" cy="190" r="12" fill="#E8F5ED" />
          <line x1="280" y1="90" x2="360" y2="140" stroke="#0B7A43" stroke-width="2" />
          <line x1="360" y1="140" x2="320" y2="220" stroke="#0B7A43" stroke-width="2" />
          <line x1="320" y1="220" x2="240" y2="190" stroke="#0B7A43" stroke-width="2" />
          <line x1="240" y1="190" x2="280" y2="90" stroke="#0B7A43" stroke-width="2" />
          <!-- Hexagonal Organic Ring -->
          <polygon points="120,70 160,50 200,70 200,110 160,130 120,110" fill="none" stroke="#0B7A43" stroke-width="2.5" />
          <polygon points="130,76 160,60 190,76 190,104 160,120 130,104" fill="none" stroke="#94D3B2" stroke-width="1.5" />
        </g>

        <!-- Conical Lab Flask -->
        <path d="M185 170 L215 170 L215 220 L275 340 C285 360 270 385 245 385 L155 385 C130 385 115 360 125 340 L185 220 Z" 
              fill="url(#flaskGrad)" stroke="#ffffff" stroke-width="4" filter="url(#chemGlow)" />
        
        <!-- Flask Liquid Level & Bubbles -->
        <path d="M148 295 Q200 310 252 295 L268 335 C275 352 262 375 242 375 L158 375 C138 375 125 352 132 335 Z" fill="url(#liquidGlow)" />
        <circle cx="180" cy="340" r="6" fill="#ffffff" opacity="0.8" />
        <circle cx="215" cy="325" r="8" fill="#ffffff" opacity="0.9" />
        <circle cx="195" cy="305" r="4" fill="#ffffff" opacity="0.8" />
        <circle cx="230" cy="345" r="5" fill="#ffffff" opacity="0.7" />

        <!-- Highlights & Reflection on Glass -->
        <path d="M190 180 L190 220 L140 330" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6" />
      </svg>
    `,
    standardChapters: [
      { en: "IUPAC Nomenclature", hi: "IUPAC नामकरण" },
      { en: "General Organic Chemistry (GOC)", hi: "सामान्य कार्बनिक रसायन (GOC)" },
      { en: "Some Basic Concepts of Chemistry", hi: "रसायन विज्ञान की कुछ मूल अवधारणाएँ" },
      { en: "Structure of Atom", hi: "परमाणु की संरचना" },
      { en: "Classification of Elements & Periodicity", hi: "तत्वों का वर्गीकरण एवं आवर्तिता" },
      { en: "Chemical Bonding & Molecular Structure", hi: "रासायनिक आबंधन तथा आण्विक संरचना" },
      { en: "Thermodynamics", hi: "ऊष्मागतिकी" },
      { en: "Equilibrium", hi: "साम्यावस्था" },
      { en: "Redox Reactions", hi: "रेडॉक्स अभिक्रियाएँ" },
      { en: "Solutions", hi: "विलयन" },
      { en: "Electrochemistry", hi: "विद्युतरसायन" },
      { en: "Chemical Kinetics", hi: "रासायनिक बलगतिकी" },
      { en: "Coordination Compounds", hi: "उपसहसंयोजन यौगिक" },
      { en: "Haloalkanes and Haloarenes", hi: "हैलोऐल्केन तथा हैलोऐरीन" },
      { en: "Alcohols, Phenols and Ethers", hi: "ऐल्कोहॉल, फ़ीनॉल एवं ईथर" },
      { en: "Aldehydes, Ketones & Carboxylic Acids", hi: "ऐल्डिहाइड, कीटोन एवं अम्ल" },
      { en: "Amines & Nitrogen Compounds", hi: "ऐमीन" },
      { en: "Biomolecules", hi: "जैव-अणु" },
    ],
  },
  PHYSICS: {
    id: "PHYSICS",
    name: "PHYSICS",
    hindiName: "भौतिक विज्ञान",
    tagline: "Core Principles • Mathematical Derivations • Numerical Precision",
    primaryColor: "#1565C0", // Official Physics Blue
    lightBg: "#3BA9FF",      // Light Blue
    softBg: "#E6F2FF",       // Soft Blue background
    darkText: "#0F1F44",     // Dark Text
    accentColor: "#3BA9FF",  // Accent Blue
    icon: "bolt",
    heroVisualSvg: `
      <!-- Physics Newton Cradle & Mechanics Vector Art -->
      <svg viewBox="0 0 400 480" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; object-fit: contain;">
        <defs>
          <linearGradient id="sphereGrad" x1="20%" y1="20%" x2="90%" y2="90%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="35%" stop-color="#93C5FD" />
            <stop offset="70%" stop-color="#1D4ED8" />
            <stop offset="100%" stop-color="#0F172A" />
          </linearGradient>
          <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#60A5FA" />
            <stop offset="50%" stop-color="#1E40AF" />
            <stop offset="100%" stop-color="#60A5FA" />
          </linearGradient>
        </defs>

        <!-- Scientific Grid lines in Background -->
        <g stroke="#BFDBFE" stroke-width="1" opacity="0.5">
          <line x1="50" y1="60" x2="350" y2="60" />
          <line x1="50" y1="120" x2="350" y2="120" />
          <line x1="50" y1="180" x2="350" y2="180" />
          <line x1="50" y1="240" x2="350" y2="240" />
          <line x1="50" y1="300" x2="350" y2="300" />
          <circle cx="200" cy="200" r="120" stroke="#3B82F6" stroke-width="1.5" stroke-dasharray="4 4" />
        </g>

        <!-- Top Frame Bar -->
        <rect x="70" y="70" width="260" height="14" rx="7" fill="url(#barGrad)" />

        <!-- Suspension Cords & Pendulum Spheres -->
        <!-- Ball 1 (Swinging Out) -->
        <line x1="110" y1="84" x2="70" y2="260" stroke="#93C5FD" stroke-width="2.5" />
        <circle cx="70" cy="260" r="24" fill="url(#sphereGrad)" />

        <!-- Ball 2 -->
        <line x1="155" y1="84" x2="155" y2="290" stroke="#93C5FD" stroke-width="2.5" />
        <circle cx="155" cy="290" r="24" fill="url(#sphereGrad)" />

        <!-- Ball 3 -->
        <line x1="200" y1="84" x2="200" y2="290" stroke="#93C5FD" stroke-width="2.5" />
        <circle cx="200" cy="290" r="24" fill="url(#sphereGrad)" />

        <!-- Ball 4 -->
        <line x1="245" y1="84" x2="245" y2="290" stroke="#93C5FD" stroke-width="2.5" />
        <circle cx="245" cy="290" r="24" fill="url(#sphereGrad)" />

        <!-- Ball 5 (Swinging Out) -->
        <line x1="290" y1="84" x2="330" y2="260" stroke="#93C5FD" stroke-width="2.5" />
        <circle cx="330" cy="260" r="24" fill="url(#sphereGrad)" />
      </svg>
    `,
    standardChapters: [
      { en: "Units and Measurements", hi: "मात्रक और मापन" },
      { en: "Motion in a Straight Line", hi: "सरल रेखा में गति" },
      { en: "Motion in a Plane & Vectors", hi: "समतल में गति एवं सदिश" },
      { en: "Laws of Motion", hi: "गति के नियम" },
      { en: "Work, Energy and Power", hi: "कार्य, ऊर्जा और शक्ति" },
      { en: "System of Particles and Rotational Motion", hi: "कणों के निकाय तथा घूर्णी गति" },
      { en: "Gravitation", hi: "गुरुत्वाकर्षण" },
      { en: "Mechanical Properties of Solids & Fluids", hi: "ठोसों एवं तरलों के यांत्रिक गुण" },
      { en: "Thermal Properties & Thermodynamics", hi: "द्रव्य के तापीय गुण एवं ऊष्मागतिकी" },
      { en: "Oscillations & Waves", hi: "दोलन एवं तरंगें" },
      { en: "Electrostatics", hi: "स्थिरवैद्युतिकी" },
      { en: "Current Electricity", hi: "विद्युत धारा" },
      { en: "Moving Charges and Magnetism", hi: "गतिमान आवेश और चुंबकत्व" },
      { en: "Electromagnetic Induction & AC", hi: "विद्युतचुंबकीय प्रेरण एवं AC" },
      { en: "Ray Optics & Optical Instruments", hi: "किरण प्रकाशिकी" },
      { en: "Wave Optics", hi: "तरंग प्रकाशिकी" },
      { en: "Dual Nature of Radiation and Matter", hi: "विकिरण तथा द्रव्य की द्वैत प्रकृति" },
      { en: "Atoms & Nuclei", hi: "परमाणु एवं नाभिक" },
      { en: "Semiconductor Electronics", hi: "अर्धचालक इलेक्ट्रॉनिकी" },
    ],
  },
  BIOLOGY: {
    id: "BIOLOGY",
    name: "BIOLOGY",
    hindiName: "जीव विज्ञान",
    tagline: "NCERT Decoded • Diagrammatic Pathways • Clinical Concepts",
    primaryColor: "#7C3AED", // Official Biology Calm Purple
    lightBg: "#EDE9FE",      // Light Purple
    softBg: "#F8F5FF",       // Soft Background
    darkText: "#334155",     // Dark Text
    accentColor: "#ECFDF5",  // Accent Mint Green
    icon: "psychology_alt",
    heroVisualSvg: `
      <!-- Biology 3D DNA Double Helix & Plant Cell Visual -->
      <svg viewBox="0 0 400 480" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; object-fit: contain;">
        <defs>
          <linearGradient id="dnaStrand1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#A78BFA" />
            <stop offset="50%" stop-color="#7C3AED" />
            <stop offset="100%" stop-color="#4C1D95" />
          </linearGradient>
          <linearGradient id="dnaStrand2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34D399" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
          <linearGradient id="cellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#EDE9FE" />
            <stop offset="100%" stop-color="#DDD6FE" />
          </linearGradient>
        </defs>

        <!-- Plant Cell Organelle Base -->
        <rect x="210" y="270" width="150" height="150" rx="30" fill="url(#cellGrad)" stroke="#7C3AED" stroke-width="3" />
        <circle cx="285" cy="345" r="32" fill="#7C3AED" opacity="0.8" />
        <circle cx="285" cy="345" r="16" fill="#4C1D95" />
        <circle cx="250" cy="310" r="10" fill="#10B981" />
        <circle cx="320" cy="375" r="8" fill="#10B981" />

        <!-- DNA Double Helix Rungs -->
        <g stroke-width="4" stroke-linecap="round">
          <line x1="120" y1="80" x2="220" y2="120" stroke="#10B981" />
          <circle cx="120" cy="80" r="8" fill="#7C3AED" />
          <circle cx="220" cy="120" r="8" fill="#10B981" />

          <line x1="150" y1="130" x2="210" y2="160" stroke="#7C3AED" />
          <circle cx="150" cy="130" r="8" fill="#10B981" />
          <circle cx="210" cy="160" r="8" fill="#7C3AED" />

          <line x1="200" y1="180" x2="140" y2="210" stroke="#10B981" />
          <circle cx="200" cy="180" r="8" fill="#7C3AED" />
          <circle cx="140" cy="210" r="8" fill="#10B981" />

          <line x1="220" y1="230" x2="110" y2="270" stroke="#7C3AED" />
          <circle cx="220" cy="230" r="8" fill="#10B981" />
          <circle cx="110" cy="270" r="8" fill="#7C3AED" />

          <line x1="180" y1="290" x2="130" y2="330" stroke="#10B981" />
          <circle cx="180" cy="290" r="8" fill="#7C3AED" />
          <circle cx="130" cy="330" r="8" fill="#10B981" />

          <line x1="130" y1="350" x2="190" y2="390" stroke="#7C3AED" />
          <circle cx="130" cy="350" r="8" fill="#10B981" />
          <circle cx="190" cy="390" r="8" fill="#7C3AED" />
        </g>

        <!-- Curved Continuous DNA Ribbons -->
        <path d="M120 80 Q170 140 200 180 T110 270 T130 350" fill="none" stroke="url(#dnaStrand1)" stroke-width="6" />
        <path d="M220 120 Q170 170 140 210 T220 230 T190 390" fill="none" stroke="url(#dnaStrand2)" stroke-width="6" />
      </svg>
    `,
    standardChapters: [
      { en: "The Living World", hi: "जीव जगत" },
      { en: "Biological Classification", hi: "जीव जगत का वर्गीकरण" },
      { en: "Plant Kingdom", hi: "पादप जगत" },
      { en: "Animal Kingdom", hi: "प्राणी जगत" },
      { en: "Morphology of Flowering Plants", hi: "पुष्पी पादपों की आकारिकी" },
      { en: "Anatomy of Flowering Plants", hi: "पुष्पी पादपों का शारीर" },
      { en: "Cell: The Unit of Life", hi: "कोशिका : जीवन की इकाई" },
      { en: "Biomolecules", hi: "जैव-अणु" },
      { en: "Cell Cycle and Cell Division", hi: "कोशिका चक्र और कोशिका विभाजन" },
      { en: "Photosynthesis in Higher Plants", hi: "उच्च पादपों में प्रकाश-संश्लेषण" },
      { en: "Respiration in Plants", hi: "पादप में श्वसन" },
      { en: "Plant Growth and Development", hi: "पादप वृद्धि एवं परिवर्धन" },
      { en: "Breathing and Exchange of Gases", hi: "श्वसन और गैसों का विनिमय" },
      { en: "Body Fluids and Circulation", hi: "शरीर द्रव तथा परिसंचरण" },
      { en: "Excretory Products and Elimination", hi: "उत्सर्जी उत्पाद एवं निष्कासन" },
      { en: "Locomotion and Movement", hi: "गमन एवं संचलन" },
      { en: "Neural Control and Coordination", hi: "तंत्रिकीय नियंत्रण एवं समन्वय" },
      { en: "Chemical Coordination and Integration", hi: "रासायनिक समन्वय तथा एकीकरण" },
      { en: "Human Reproduction & Health", hi: "मानव जनन एवं जनन स्वास्थ्य" },
      { en: "Genetics & Molecular Basis", hi: "आनुवंशिकी तथा वंशागति का आधार" },
      { en: "Evolution", hi: "विकास" },
      { en: "Biotechnology", hi: "जैव प्रौद्योगिकी" },
      { en: "Ecology and Environment", hi: "पारिस्थितिकी एवं पर्यावरण" },
    ],
  },
};

export interface RenderHeaderFooterParams {
  subject: ModuleSubject;
  moduleNumber: string; // e.g. "Module 01" or "01"
  chapterName: string; // e.g. "IUPAC Nomenclature"
  facultyName?: string | null;
  targetExam?: string; // "CLASS 11 | NEET UG"
  pageNumberPlaceholder?: string;
  totalPagesPlaceholder?: string;
  isPrintMode?: boolean;
}

/**
 * Extracts a normalized 2-digit module number (e.g. "Module 01" -> "01")
 */
export function getNormalizedModuleCode(moduleNumberStr: string): string {
  const match = moduleNumberStr.match(/\d+/);
  return match ? String(match[0]).padStart(2, "0") : "01";
}

/**
 * EXACT MASTER FRONT COVER GENERATOR ACCORDING TO REFERENCE IMAGES
 */
export function generateModuleFrontCoverHtml(params: RenderHeaderFooterParams & { title?: string }): string {
  const theme = SUBJECT_THEMES[params.subject] || SUBJECT_THEMES.CHEMISTRY;
  const modCode = getNormalizedModuleCode(params.moduleNumber);
  const displayChapter = (params.title || params.chapterName || "CHAPTER TITLE").toUpperCase();
  const classTag = params.targetExam || "CLASS 11 | NEET UG";

  return `
    <div class="module-front-cover" style="
      width: 210mm;
      height: 297mm;
      min-height: 297mm;
      box-sizing: border-box;
      background: #ffffff;
      padding: 32px 36px 36px 36px;
      margin: 0;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      overflow: hidden;
      font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <!-- TOP BAR: Brand Logo & Tagline Left, NEET Mastery Stack Right -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; position: relative; z-index: 5;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <!-- Official Atomic Logo Block -->
          <div style="width: 52px; height: 52px; border-radius: 12px; background: #ffffff; border: 1.5px solid #e2e8f0; padding: 4px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <img src="/brand/logo.png" alt="Atomic Pathshala" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <div>
            <div style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; line-height: 1.1; color: #0f172a;">
              <span style="color: #ea580c;">ATOMIC</span> PATHSHALA
            </div>
            <div style="font-size: 9.5px; font-weight: 800; letter-spacing: 2px; color: #64748b; text-transform: uppercase; margin-top: 2px;">
              LEARN • EXPLORE • EXCEL
            </div>
          </div>
        </div>

        <!-- Top Right NEET Foundation / Practice / Mastery Stack -->
        <div style="text-align: right; font-size: 11px; font-weight: 800; line-height: 1.35; color: #1e293b; letter-spacing: 0.5px; text-transform: uppercase;">
          <div>NEET</div>
          <div>FOUNDATION</div>
          <div>PRACTICE</div>
          <div>MASTERY</div>
        </div>
      </div>

      <!-- MAIN MIDDLE BODY: Left Info + Right Geometric Visual -->
      <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; align-items: center; margin-top: 24px; position: relative; z-index: 4;">
        <!-- Left Column: Subject, Module, Chapter & Features -->
        <div>
          <!-- Big Subject Title -->
          <h1 style="
            font-size: 48px;
            font-weight: 900;
            color: ${theme.primaryColor};
            margin: 0;
            line-height: 1.05;
            letter-spacing: -1px;
            text-transform: uppercase;
          ">
            ${theme.name}
          </h1>

          <!-- Module Pill Line: MODULE - [ 01 ] -->
          <div style="display: flex; align-items: center; gap: 8px; margin: 16px 0 22px 0;">
            <span style="font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
              MODULE -
            </span>
            <span style="
              background: ${theme.primaryColor};
              color: #ffffff;
              padding: 2px 14px;
              border-radius: 8px;
              font-size: 22px;
              font-weight: 900;
              letter-spacing: 0.5px;
              box-shadow: 0 2px 6px ${theme.primaryColor}40;
            ">
              ${modCode}
            </span>
          </div>

          <!-- Chapter Label Divider -->
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="height: 1.5px; width: 32px; background: #94a3b8;"></div>
            <span style="font-size: 13px; font-weight: 800; color: #475569; letter-spacing: 3px; text-transform: uppercase;">
              CHAPTER
            </span>
            <div style="height: 1.5px; width: 32px; background: #94a3b8;"></div>
          </div>

          <!-- Dynamic Chapter Name -->
          <div style="
            font-size: 32px;
            font-weight: 900;
            color: ${theme.darkText};
            line-height: 1.15;
            letter-spacing: -0.5px;
            margin-bottom: 18px;
            text-transform: uppercase;
          ">
            ${displayChapter}
          </div>

          <!-- Class & Exam Badge Line -->
          <div style="
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 28px;
          ">
            ${classTag}
          </div>

          <!-- Feature Items with Rounded Icon Badges -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${[
              { icon: "menu_book", label: "Theory & Concepts" },
              { icon: "visibility", label: "Illustrations" },
              { icon: "track_changes", label: "Practice Questions" },
              { icon: "trending_up", label: "Levelwise Exercises" },
              { icon: "history_edu", label: "PYQs with Solutions" },
            ].map((f) => `
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="
                  width: 26px;
                  height: 26px;
                  border-radius: 6px;
                  border: 1.5px solid ${theme.primaryColor};
                  color: ${theme.primaryColor};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 13px;
                  font-weight: 900;
                  background: #ffffff;
                ">
                  <span class="material-symbols-outlined" style="font-size: 16px;">${f.icon}</span>
                </div>
                <span style="font-size: 13.5px; font-weight: 700; color: #1e293b;">
                  ${f.label}
                </span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Right Column: Subject-Specific Hero Visual with Geometric Slice -->
        <div style="position: relative; height: 380px; display: flex; align-items: center; justify-content: center;">
          <!-- Diagonal Background Geometric Ribbon -->
          <div style="
            position: absolute;
            top: 0;
            right: -20px;
            width: 320px;
            height: 380px;
            background: linear-gradient(135deg, ${theme.lightBg} 0%, ${theme.softBg} 100%);
            border-radius: 40px;
            transform: skewX(-6deg);
            z-index: 1;
            border: 2px solid ${theme.accentColor}55;
          "></div>

          <!-- Subject Specific Artwork Container -->
          <div style="position: relative; z-index: 2; width: 100%; height: 100%; padding: 10px;">
            ${theme.heroVisualSvg}
          </div>
        </div>
      </div>

      <!-- BOTTOM BAR: Clean, Minimalist Publisher & Faculty Footer -->
      <div style="
        border-top: 1.5px solid #e2e8f0;
        padding-top: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
        z-index: 5;
      ">
        <div style="font-size: 11px; font-weight: 700; color: #64748b;">
          ${params.facultyName ? `Academic Guidance: <b style="color: #0f172a;">${params.facultyName}</b>` : "Atomic Pathshala National Academic Council"}
        </div>
        <div style="font-size: 11px; font-weight: 800; color: ${theme.primaryColor}; text-transform: uppercase;">
          ★ 100% NCERT ALIGNED • PRINT READY
        </div>
      </div>
    </div>
  `;
}

/**
 * EXACT MASTER RUNNING HEADER FOR INSIDE PAGES
 */
export function generateModuleRunningHeaderHtml(params: RenderHeaderFooterParams): string {
  const theme = SUBJECT_THEMES[params.subject] || SUBJECT_THEMES.CHEMISTRY;
  const modCode = getNormalizedModuleCode(params.moduleNumber);

  return `
    <header class="module-running-header" style="
      width: 100%;
      box-sizing: border-box;
      padding: 10px 0 8px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1.5px solid ${theme.primaryColor};
      background: #ffffff;
      font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, sans-serif;
      margin-bottom: 20px;
    ">
      <!-- Left: Logo & Brand Name -->
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; border-radius: 4px; background: #ffffff; display: flex; align-items: center; justify-content: center;">
          <img src="/brand/logo.png" alt="A" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <div style="font-size: 12px; font-weight: 900; letter-spacing: -0.2px;">
          <span style="color: #ea580c;">ATOMIC</span> <span style="color: #0f172a;">PATHSHALA</span>
        </div>
      </div>

      <!-- Center: Subject & Module -->
      <div style="font-size: 11px; font-weight: 800; color: ${theme.primaryColor}; text-transform: uppercase; letter-spacing: 0.5px;">
        ${theme.name} | MODULE ${modCode}
      </div>

      <!-- Right: Current Chapter Name -->
      <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
        ${params.chapterName}
      </div>
    </header>
  `;
}

/**
 * EXACT MASTER RUNNING FOOTER FOR INSIDE PAGES
 */
export function generateModuleRunningFooterHtml(params: RenderHeaderFooterParams & { pageNumber?: number; totalPages?: number }): string {
  const theme = SUBJECT_THEMES[params.subject] || SUBJECT_THEMES.CHEMISTRY;
  const pageNum = params.pageNumber ?? 1;
  const pageNumStr = String(pageNum).padStart(2, "0");

  return `
    <footer class="module-running-footer" style="
      width: 100%;
      box-sizing: border-box;
      padding: 8px 0 10px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1.5px solid #e2e8f0;
      background: #ffffff;
      font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, sans-serif;
      margin-top: 24px;
    ">
      <!-- Left: Brand -->
      <div style="font-size: 11px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">
        ATOMIC PATHSHALA
      </div>

      <!-- Center: Tagline -->
      <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">
        LEARN • EXPLORE • EXCEL
      </div>

      <!-- Right: Class & Page Number Pill Badge -->
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 11px; font-weight: 700; color: #334155;">
          ${params.targetExam || "Class 11 | NEET UG"}
        </span>
        <span style="
          background: ${theme.primaryColor};
          color: #ffffff;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.5px;
        ">
          ${pageNumStr}
        </span>
      </div>
    </footer>
  `;
}

/**
 * DIGITAL PDF WATERMARK (3–5% Opacity, Monochrome Light Grey, Strictly Removed in Print Mode)
 */
export function generateModuleWatermarkHtml(isPrintMode: boolean = false): string {
  if (isPrintMode) {
    return ""; // Strictly NO WATERMARK for print version!
  }

  return `
    <div class="atomic-watermark-overlay" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 1;
      opacity: 0.04;
      user-select: none;
    ">
      <img src="/brand/logo.png" alt="Watermark" style="width: 420px; height: 420px; object-fit: contain; filter: grayscale(100%); transform: rotate(-25deg);" />
    </div>
  `;
}
