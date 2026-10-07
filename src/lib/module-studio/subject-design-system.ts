import "server-only";

export type ModuleSubject = "CHEMISTRY" | "PHYSICS" | "BIOLOGY";

export interface SubjectTheme {
  id: ModuleSubject;
  name: string;
  hindiName: string;
  tagline: string;
  primaryColor: string;
  primaryDark: string;
  secondaryColor: string;
  accentColor: string;
  bgLight: string;
  bgGradient: string;
  borderLight: string;
  cardRadius: string;
  icon: string;
  standardChapters: { en: string; hi: string }[];
}

export const SUBJECT_THEMES: Record<ModuleSubject, SubjectTheme> = {
  CHEMISTRY: {
    id: "CHEMISTRY",
    name: "Chemistry",
    hindiName: "रसायन विज्ञान",
    tagline: "Chemical Sciences • Molecular Dynamics • Reaction Mechanics",
    primaryColor: "#0f766e", // Deep Teal
    primaryDark: "#115e59",
    secondaryColor: "#0d9488",
    accentColor: "#14b8a6",
    bgLight: "#f0fdfa",
    bgGradient: "linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #0d9488 100%)",
    borderLight: "#ccfbf1",
    cardRadius: "12px",
    icon: "science",
    standardChapters: [
      { en: "Some Basic Concepts of Chemistry", hi: "रसायन विज्ञान की कुछ मूल अवधारणाएँ" },
      { en: "Structure of Atom", hi: "परमाणु की संरचना" },
      { en: "Classification of Elements & Periodicity", hi: "तत्वों का वर्गीकरण एवं गुणधर्मों में आवर्तिता" },
      { en: "Chemical Bonding & Molecular Structure", hi: "रासायनिक आबंधन तथा आण्विक संरचना" },
      { en: "Thermodynamics", hi: "ऊष्मागतिकी" },
      { en: "Equilibrium (Physical & Chemical)", hi: "साम्यावस्था" },
      { en: "Redox Reactions", hi: "अपचयोपचय (रेडॉक्स) अभिक्रियाएँ" },
      { en: "Solutions", hi: "विलयन" },
      { en: "Electrochemistry", hi: "विद्युतरसायन" },
      { en: "Chemical Kinetics", hi: "रासायनिक बलगतिकी" },
      { en: "Surface Chemistry", hi: "पृष्ठ रसायन" },
      { en: "Coordination Compounds", hi: "उपसहसंयोजन यौगिक" },
      { en: "Haloalkanes and Haloarenes", hi: "हैलोऐल्केन तथा हैलोऐरीन" },
      { en: "Alcohols, Phenols and Ethers", hi: "ऐल्कोहॉल, फ़ीनॉल एवं ईथर" },
      { en: "Aldehydes, Ketones & Carboxylic Acids", hi: "ऐल्डिहाइड, कीटोन एवं कार्बोक्सिलिक अम्ल" },
      { en: "Amines & Nitrogen Compounds", hi: "ऐमीन एवं नाइट्रोजन युक्त कार्बनिक यौगिक" },
      { en: "Biomolecules", hi: "जैव-अणु" },
      { en: "General Organic Chemistry (GOC) & IUPAC", hi: "सामान्य कार्बनिक रसायन (GOC) एवं IUPAC नामकरण" },
    ],
  },
  PHYSICS: {
    id: "PHYSICS",
    name: "Physics",
    hindiName: "भौतिक विज्ञान",
    tagline: "Core Principles • Mathematical Derivations • Numerical Precision",
    primaryColor: "#1e40af", // Royal Blue
    primaryDark: "#1e3a8a",
    secondaryColor: "#2563eb",
    accentColor: "#3b82f6",
    bgLight: "#eff6ff",
    bgGradient: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)",
    borderLight: "#dbeafe",
    cardRadius: "12px",
    icon: "bolt",
    standardChapters: [
      { en: "Units and Measurements", hi: "मात्रक और मापन" },
      { en: "Motion in a Straight Line", hi: "सरल रेखा में गति" },
      { en: "Motion in a Plane & Vectors", hi: "समतल में गति एवं सदिश" },
      { en: "Laws of Motion", hi: "गति के नियम" },
      { en: "Work, Energy and Power", hi: "कार्य, ऊर्जा और शक्ति" },
      { en: "System of Particles and Rotational Motion", hi: "कणों के निकाय तथा घूर्णी गति" },
      { en: "Gravitation", hi: "गुरुत्वाकर्षण" },
      { en: "Mechanical Properties of Solids & Fluids", hi: "ठोसों एवं तरलों के यांत्रिक गुण" },
      { en: "Thermal Properties of Matter & Thermodynamics", hi: "द्रव्य के तापीय गुण एवं ऊष्मागतिकी" },
      { en: "Oscillations & Waves", hi: "दोलन एवं तरंगें" },
      { en: "Electrostatics (Fields & Potential)", hi: "स्थिरवैद्युतिकी (क्षेत्र एवं विभव)" },
      { en: "Current Electricity", hi: "विद्युत धारा" },
      { en: "Moving Charges and Magnetism", hi: "गतिमान आवेश और चुंबकत्व" },
      { en: "Electromagnetic Induction & AC", hi: "विद्युतचुंबकीय प्रेरण एवं प्रत्यावर्ती धारा" },
      { en: "Ray Optics & Optical Instruments", hi: "किरण प्रकाशिकी एवं प्रकाशिक यंत्र" },
      { en: "Wave Optics", hi: "तरंग प्रकाशिकी" },
      { en: "Dual Nature of Radiation and Matter", hi: "विकिरण तथा द्रव्य की द्वैत प्रकृति" },
      { en: "Atoms & Nuclei", hi: "परमाणु एवं नाभिक" },
      { en: "Semiconductor Electronics", hi: "अर्धचालक इलेक्ट्रॉनिकी" },
    ],
  },
  BIOLOGY: {
    id: "BIOLOGY",
    name: "Biology",
    hindiName: "जीव विज्ञान",
    tagline: "NCERT Decoded • Diagrammatic Pathways • Clinical Concepts",
    primaryColor: "#15803d", // Botanical Green
    primaryDark: "#14532d",
    secondaryColor: "#16a34a",
    accentColor: "#22c55e",
    bgLight: "#f0fdf4",
    bgGradient: "linear-gradient(135deg, #14532d 0%, #15803d 50%, #16a34a 100%)",
    borderLight: "#dcfce7",
    cardRadius: "12px",
    icon: "psychology_alt",
    standardChapters: [
      { en: "The Living World", hi: "जीव जगत" },
      { en: "Biological Classification", hi: "जीव जगत का वर्गीकरण" },
      { en: "Plant Kingdom", hi: "पादप जगत" },
      { en: "Animal Kingdom", hi: "प्राणी जगत" },
      { en: "Morphology of Flowering Plants", hi: "पुष्पी पादपों की आकारिकी" },
      { en: "Anatomy of Flowering Plants", hi: "पुष्पी पादपों का शारीर" },
      { en: "Structural Organisation in Animals", hi: "प्राणियों में संरचनात्मक संगठन" },
      { en: "Cell: The Unit of Life", hi: "कोशिका : जीवन की इकाई" },
      { en: "Biomolecules", hi: "जैव-अणु" },
      { en: "Cell Cycle and Cell Division", hi: "कोशिका चक्र और कोशिका विभाजन" },
      { en: "Photosynthesis in Higher Plants", hi: "उच्च पादपों में प्रकाश-संश्लेषण" },
      { en: "Respiration in Plants", hi: "पादप में श्वसन" },
      { en: "Plant Growth and Development", hi: "पादप वृद्धि एवं परिवर्धन" },
      { en: "Breathing and Exchange of Gases", hi: "श्वसन और गैसों का विनिमय" },
      { en: "Body Fluids and Circulation", hi: "शरीर द्रव तथा परिसंचरण" },
      { en: "Excretory Products and their Elimination", hi: "उत्सर्जी उत्पाद एवं उनका निष्कासन" },
      { en: "Locomotion and Movement", hi: "गमन एवं संचलन" },
      { en: "Neural Control and Coordination", hi: "तंत्रिकीय नियंत्रण एवं समन्वय" },
      { en: "Chemical Coordination and Integration", hi: "रासायनिक समन्वय तथा एकीकरण" },
      { en: "Human Reproduction & Reproductive Health", hi: "मानव जनन एवं जनन स्वास्थ्य" },
      { en: "Genetics & Molecular Basis of Inheritance", hi: "आनुवंशिकी तथा वंशागति का आण्विक आधार" },
      { en: "Evolution", hi: "विकास" },
      { en: "Biotechnology: Principles and Processes", hi: "जैव प्रौद्योगिकी : सिद्धांत व प्रक्रम" },
      { en: "Ecology and Environment", hi: "पारिस्थितिकी एवं पर्यावरण" },
    ],
  },
};

export interface RenderHeaderFooterParams {
  subject: ModuleSubject;
  moduleNumber: string; // e.g. "Module 01"
  chapterName: string; // e.g. "IUPAC Nomenclature"
  facultyName?: string | null;
  targetExam?: string; // "NEET (UG)" | "JEE (Main+Adv)" | "Class 11/12 Boards"
  pageNumberPlaceholder?: string; // "PAGE_NUM"
  totalPagesPlaceholder?: string; // "TOTAL_PAGES"
  isPrintMode?: boolean; // If true, watermark is strictly omitted
}

/**
 * Renders the High-Impact Academic Front Cover HTML for the Module
 */
export function generateModuleFrontCoverHtml(params: RenderHeaderFooterParams & { title?: string }): string {
  const theme = SUBJECT_THEMES[params.subject] || SUBJECT_THEMES.CHEMISTRY;
  const targetExam = params.targetExam || "NEET (UG) / JEE";
  const displayTitle = params.title || params.chapterName;

  return `
    <div class="module-front-cover" style="
      width: 100%;
      min-height: 1050px;
      height: 100%;
      box-sizing: border-box;
      background: #ffffff;
      padding: 0;
      margin: 0;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      overflow: hidden;
      font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <!-- Top Decorative Subject Banner -->
      <div style="
        background: ${theme.bgGradient};
        color: #ffffff;
        padding: 48px 48px 60px 48px;
        position: relative;
        border-bottom-left-radius: 36px;
        border-bottom-right-radius: 36px;
        box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.2);
      ">
        <!-- Floating Vector Circles -->
        <div style="position: absolute; top: -60px; right: -40px; width: 220px; height: 220px; border-radius: 50%; background: rgba(255,255,255,0.08); pointer-events: none;"></div>
        <div style="position: absolute; bottom: -30px; right: 80px; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.06); pointer-events: none;"></div>
        <div style="position: absolute; top: 30px; left: 35%; width: 90px; height: 90px; border-radius: 50%; background: rgba(255,255,255,0.04); pointer-events: none;"></div>

        <!-- Brand Top Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 2;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 14px; background: #ffffff; padding: 4px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <img src="/icon.png" alt="Atomic Pathshala" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;" />
            </div>
            <div>
              <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px; line-height: 1.1; color: #ffffff;">
                ATOMIC PATHSHALA
              </div>
              <div style="font-size: 10px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.85); text-transform: uppercase;">
                LEARN • EXPLORE • EXCEL
              </div>
            </div>
          </div>

          <!-- Subject Pill -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); padding: 6px 18px; border-radius: 9999px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff; text-transform: uppercase;">
              ${theme.name} • ${theme.hindiName}
            </span>
          </div>
        </div>

        <!-- Main Module Badge & Title -->
        <div style="margin-top: 54px; position: relative; z-index: 2;">
          <div style="display: inline-flex; align-items: center; gap: 8px; background: #ffffff; color: ${theme.primaryColor}; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; box-shadow: 0 4px 14px rgba(0,0,0,0.12); margin-bottom: 20px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${theme.primaryColor};"></span>
            ${params.moduleNumber.toUpperCase()}
          </div>

          <h1 style="font-size: 42px; font-weight: 900; line-height: 1.15; letter-spacing: -0.8px; margin: 0 0 16px 0; color: #ffffff; text-shadow: 0 3px 6px rgba(0,0,0,0.25);">
            ${displayTitle}
          </h1>

          <p style="font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.92); margin: 0; max-width: 600px; line-height: 1.5;">
            ${theme.tagline}
          </p>
        </div>
      </div>

      <!-- Center Body Highlights -->
      <div style="padding: 44px 48px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 24px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div style="background: ${theme.bgLight}; border: 1.5px solid ${theme.borderLight}; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
            <div style="font-size: 11px; font-weight: 800; color: ${theme.primaryColor}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
              TARGET EXAM
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">
              ${targetExam}
            </div>
          </div>

          <div style="background: ${theme.bgLight}; border: 1.5px solid ${theme.borderLight}; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
            <div style="font-size: 11px; font-weight: 800; color: ${theme.primaryColor}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
              CURRICULUM
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">
              100% NCERT Decoded
            </div>
          </div>

          <div style="background: ${theme.bgLight}; border: 1.5px solid ${theme.borderLight}; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
            <div style="font-size: 11px; font-weight: 800; color: ${theme.primaryColor}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
              EDITION
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">
              2026-2027 Comprehensive
            </div>
          </div>
        </div>

        <!-- Features Box -->
        <div style="background: #ffffff; border: 1.5px dashed ${theme.primaryColor}55; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 13px; font-weight: 800; color: ${theme.primaryColor}; text-transform: uppercase; letter-spacing: 1px;">
            Module Core Contents &amp; Highlights:
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #334155; font-weight: 600;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: ${theme.primaryColor}; font-weight: 900;">✓</span> Complete Theory &amp; Step-by-Step Derivations
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: ${theme.primaryColor}; font-weight: 900;">✓</span> Integrated NCERT Concept Enrichments
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: ${theme.primaryColor}; font-weight: 900;">✓</span> Graded Practice Problems &amp; Detailed Solutions
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: ${theme.primaryColor}; font-weight: 900;">✓</span> High-Res Vector Diagrams &amp; Graphs
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Faculty Footer -->
      <div style="
        padding: 28px 48px;
        background: #f8fafc;
        border-top: 1.5px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
            ACADEMIC DIRECTION &amp; VERIFICATION
          </div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">
            ${params.facultyName ? `Prepared under the guidance of <b>${params.facultyName}</b>` : "Atomic Pathshala National Academic Council"}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 700; color: ${theme.primaryColor};">
          <span style="background: ${theme.bgLight}; border: 1px solid ${theme.borderLight}; padding: 6px 14px; border-radius: 9999px;">
            ★ Certified Atomic Material
          </span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates the Subject Header HTML for all internal pages
 */
export function generateModuleRunningHeaderHtml(params: RenderHeaderFooterParams): string {
  const theme = SUBJECT_THEMES[params.subject] || SUBJECT_THEMES.CHEMISTRY;

  return `
    <header class="module-running-header" style="
      width: 100%;
      box-sizing: border-box;
      padding: 12px 28px 10px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid ${theme.primaryColor};
      background: #ffffff;
      font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, sans-serif;
      margin-bottom: 24px;
    ">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 24px; height: 24px; border-radius: 6px; background: ${theme.primaryColor}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900;">
          A
        </div>
        <div style="font-size: 13px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px;">
          ATOMIC PATHSHALA
        </div>
        <span style="color: #cbd5e1; font-weight: 300;">|</span>
        <span style="font-size: 12px; font-weight: 800; color: ${theme.primaryColor}; text-transform: uppercase;">
          ${theme.name}
        </span>
      </div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: ${theme.bgLight}; border: 1px solid ${theme.borderLight}; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: ${theme.primaryColor};">
          ${params.moduleNumber.toUpperCase()}
        </span>
        <span style="font-size: 12px; font-weight: 700; color: #334155;">
          ${params.chapterName}
        </span>
      </div>
    </header>
  `;
}

/**
 * Generates the Subject Footer HTML for all internal pages
 */
export function generateModuleRunningFooterHtml(params: RenderHeaderFooterParams & { pageNumber?: number; totalPages?: number }): string {
  const theme = SUBJECT_THEMES[params.subject] || SUBJECT_THEMES.CHEMISTRY;
  const pageNum = params.pageNumber ?? 1;
  const totalPages = params.totalPages ?? 1;

  return `
    <footer class="module-running-footer" style="
      width: 100%;
      box-sizing: border-box;
      padding: 10px 28px 12px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1.5px solid #e2e8f0;
      background: #ffffff;
      font-family: 'Poppins', 'Noto Sans Devanagari', -apple-system, sans-serif;
      margin-top: 28px;
    ">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: #64748b;">
        <span>ATOMIC PATHSHALA</span>
        <span>•</span>
        <span style="color: ${theme.primaryColor};">LEARN • EXPLORE • EXCEL</span>
        <span>•</span>
        <span>${params.targetExam || "NEET / JEE Preparation"}</span>
      </div>

      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="background: ${theme.bgLight}; border: 1px solid ${theme.borderLight}; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; color: ${theme.primaryColor};">
          Page ${pageNum} of ${totalPages}
        </span>
      </div>
    </footer>
  `;
}

/**
 * Renders the Background Watermark (Omitted completely when isPrintMode = true)
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
      z-index: 999;
      opacity: 0.055;
      font-family: 'Poppins', sans-serif;
      font-size: 70px;
      font-weight: 900;
      transform: rotate(-35deg);
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 6px;
      user-select: none;
    ">
      ATOMIC PATHSHALA
    </div>
  `;
}
