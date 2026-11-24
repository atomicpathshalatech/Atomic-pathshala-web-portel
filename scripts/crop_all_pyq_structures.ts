import fs from "fs";
import { withRenderedPdf } from "../src/lib/pdf/page-renderer";

const PDF_PATH = "C:/Users/firoz/Downloads/NEET Some Basic Concepts of Organic Chemistry Previous Year Questions with Answer Key.pdf";

// Complete bounding boxes for all questions with chemical structures / diagrams:
// Format: [ymin, xmin, ymax, xmax] in 0-1000 scale on that page
const FIGURE_DEFINITIONS: Array<{
  qNum: number;
  page: number;
  filename: string;
  box: [number, number, number, number];
  description: string;
}> = [
  { qNum: 1, page: 2, filename: "q001_carbocation.png", box: [170, 60, 390, 560], description: "Q1 Carbocation with benzene ring" },
  { qNum: 2, page: 2, filename: "q002_alkane.png", box: [500, 60, 580, 560], description: "Q2 3-ethyl-5-methylheptane structure" },
  { qNum: 4, page: 3, filename: "q004_reactions.png", box: [130, 50, 250, 300], description: "Q4 Lassaigne test reactions" },
  { qNum: 5, page: 3, filename: "q005_isopentane.png", box: [330, 60, 460, 560], description: "Q5 2-methylbutane structure" },
  { qNum: 7, page: 3, filename: "q007_structures.png", box: [670, 60, 830, 560], description: "Q7 Compounds I-III with C-H*" },
  { qNum: 11, page: 5, filename: "q011_nitrobenzene.png", box: [140, 60, 350, 420], description: "Q11 4-ethyl-1-fluoro-2-nitrobenzene" },
  { qNum: 15, page: 6, filename: "q015_carbocations.png", box: [240, 50, 770, 550], description: "Q15 Carbocation options A, B, C, D" },
  { qNum: 19, page: 8, filename: "q019_guanidines.png", box: [130, 50, 660, 450], description: "Q19 Urea/guanidine options A, B, C, D" },
  { qNum: 24, page: 10, filename: "q024_huckel_rings.png", box: [130, 50, 345, 350], description: "Q24 Cyclic species i-vii" },
  { qNum: 27, page: 11, filename: "q027_carbocations.png", box: [130, 50, 660, 350], description: "Q27 Cyclohexenyl carbocations A, B, C, D" },
  { qNum: 28, page: 12, filename: "q028_aromatic_rings.png", box: [130, 50, 660, 300], description: "Q28 Ring options A, B, C, D" },
  { qNum: 30, page: 13, filename: "q030_nitrogen_compounds.png", box: [150, 50, 680, 550], description: "Q30 Nitrogen compounds A, B, C, D" },
  { qNum: 31, page: 14, filename: "q031_hexanol.png", box: [130, 60, 310, 560], description: "Q31 1-bromo-5-chloro-4-methylhexan-3-ol" },
  { qNum: 33, page: 15, filename: "q033_decenes.png", box: [130, 50, 660, 370], description: "Q33 Decene options A, B, C, D" },
  { qNum: 39, page: 17, filename: "q039_oxo_compounds.png", box: [140, 50, 630, 630], description: "Q39 Compounds A, B, C, D to protonate" },
  { qNum: 40, page: 18, filename: "q040_nitro_areniums.png", box: [130, 50, 660, 280], description: "Q40 Nitro carbocations A, B, C, D" },
  { qNum: 44, page: 19, filename: "q044_enal.png", box: [480, 60, 630, 550], description: "Q44 3-keto-2-methylhex-4-enal structure" },
  { qNum: 46, page: 20, filename: "q046_bicyclic_ketones.png", box: [140, 50, 260, 550], description: "Q46 Bicyclic ketones I, II, III" },
  { qNum: 47, page: 21, filename: "q047_biphenyls.png", box: [140, 50, 660, 350], description: "Q47 Biphenyl options A, B, C, D" },
  { qNum: 51, page: 22, filename: "q051_polyene.png", box: [650, 50, 805, 550], description: "Q51 Polyene pi bonds structure" },
  { qNum: 52, page: 23, filename: "q052_cyclohexenones.png", box: [140, 50, 310, 550], description: "Q52 Cyclohexenones I, II, III" },
  { qNum: 53, page: 24, filename: "q053_arrow_mechanisms.png", box: [160, 50, 660, 670], description: "Q53 Electron displacement mechanisms A, B, C, D" },
  { qNum: 55, page: 25, filename: "q055_radicals.png", box: [140, 50, 245, 550], description: "Q55 Radicals I, II, III" },
  { qNum: 56, page: 25, filename: "q056_ethyl_acetoacetate.png", box: [380, 50, 465, 560], description: "Q56 Enolic form of ethyl acetoacetate" },
  { qNum: 57, page: 26, filename: "q057_chloroalkanes.png", box: [160, 50, 670, 550], description: "Q57 Chloro compounds A, B, C, D" },
  { qNum: 59, page: 27, filename: "q059_carbocations.png", box: [140, 50, 330, 500], description: "Q59 Five carbocations 1-5" },
  { qNum: 60, page: 27, filename: "q060_benzyl_cation.png", box: [470, 50, 620, 460], description: "Q60 Benzyl carbonium ion" },
  { qNum: 62, page: 29, filename: "q062_systems.png", box: [130, 50, 660, 440], description: "Q62 Systems A, B, C, D" },
  { qNum: 63, page: 30, filename: "q063_sawhorse.png", box: [140, 50, 260, 550], description: "Q63 Sawhorse projections I and II" },
  { qNum: 64, page: 30, filename: "q064_benzyl_radical.png", box: [440, 50, 580, 460], description: "Q64 Benzyl radical" },
  { qNum: 65, page: 31, filename: "q065_isobutyl_groups.png", box: [150, 50, 580, 650], description: "Q65 Isobutyl group options A, B, C, D" },
  { qNum: 66, page: 32, filename: "q066_carboxylic_acids.png", box: [140, 50, 660, 460], description: "Q66 Carboxylic acid options A, B, C, D" },
  { qNum: 68, page: 33, filename: "q068_iupac_options.png", box: [160, 50, 660, 590], description: "Q68 IUPAC options A, B, C, D" },
  { qNum: 70, page: 34, filename: "q070_haloalkene.png", box: [160, 60, 320, 530], description: "Q70 2-chloro-3-iodo-2-pentene" },
  { qNum: 72, page: 35, filename: "q072_aromatics.png", box: [140, 50, 660, 380], description: "Q72 Aromatic options A, B, C, D" },
  { qNum: 73, page: 36, filename: "q073_branched_alkene.png", box: [150, 50, 360, 500], description: "Q73 4-ethyl-3-propylhex-1-ene skeletal" },
  { qNum: 77, page: 37, filename: "q077_ethylene_glycol.png", box: [130, 50, 660, 300], description: "Q77 Ethylene glycol Newman conformers A, B, C, D" },
  { qNum: 78, page: 38, filename: "q078_aromatics.png", box: [140, 50, 660, 380], description: "Q78 Aromatic options A, B, C, D" },
  { qNum: 79, page: 39, filename: "q079_butane_newman.png", box: [130, 50, 660, 290], description: "Q79 n-Butane Newman conformers A, B, C, D" },
  { qNum: 81, page: 40, filename: "q081_carbanions.png", box: [150, 50, 240, 550], description: "Q81 Carbanions i, ii, iii" },
  { qNum: 82, page: 41, filename: "q082_aromatics.png", box: [140, 50, 660, 400], description: "Q82 Aromatic options A, B, C, D" },
  { qNum: 83, page: 42, filename: "q083_carbanions.png", box: [150, 50, 260, 540], description: "Q83 Carbanions i, ii, iii, iv" },
  { qNum: 88, page: 43, filename: "q088_acyl_chloride.png", box: [140, 60, 320, 530], description: "Q88 2,3-dimethylpentanoyl chloride" },
  { qNum: 89, page: 44, filename: "q089_iupac_compounds.png", box: [140, 50, 650, 610], description: "Q89 Compound options A, B, C, D" },
  { qNum: 90, page: 45, filename: "q090_chiral_center.png", box: [150, 60, 320, 390], description: "Q90 Wedge-dash chiral carbon" },
  { qNum: 91, page: 45, filename: "q091_carbocations.png", box: [510, 50, 750, 300], description: "Q91 Carbocation options C, D" },
  { qNum: 94, page: 46, filename: "q094_diphenylmethane.png", box: [400, 60, 485, 540], description: "Q94 Diphenylmethane structure" },
  { qNum: 95, page: 47, filename: "q095_methyloctane.png", box: [140, 60, 335, 500], description: "Q95 4-ethyl-3-methyloctane structure" },
  { qNum: 97, page: 48, filename: "q097_fischer_pairs.png", box: [140, 50, 660, 590], description: "Q97 Fischer projection pairs A, B, C, D" },
  { qNum: 100, page: 49, filename: "q100_iupac_compounds.png", box: [260, 50, 770, 580], description: "Q100 IUPAC options A, B, C, D" },
  { qNum: 102, page: 50, filename: "q102_phenols.png", box: [300, 50, 465, 560], description: "Q102 Phenol derivatives I, II, III" },
  { qNum: 107, page: 51, filename: "q107_haloalkene.png", box: [240, 60, 360, 560], description: "Q107 Haloalkene structure" },
  { qNum: 117, page: 52, filename: "q117_butenes.png", box: [720, 50, 820, 670], description: "Q117 2-Methyl-2-butene representations A, B, C, D" }
];

async function cropAllFigures() {
  console.log(`Starting extraction of ${FIGURE_DEFINITIONS.length} high-resolution chemical structures...`);
  const pdfBuf = fs.readFileSync(PDF_PATH);

  await withRenderedPdf(pdfBuf, async (doc) => {
    let completed = 0;
    // Group by page so we render each page only once
    const pagesMap = new Map<number, typeof FIGURE_DEFINITIONS>();
    for (const fig of FIGURE_DEFINITIONS) {
      if (!pagesMap.has(fig.page)) pagesMap.set(fig.page, []);
      pagesMap.get(fig.page)!.push(fig);
    }

    for (const [pageNum, figs] of pagesMap.entries()) {
      await doc.render(pageNum);
      for (const fig of figs) {
        const cropBuf = await doc.crop(pageNum, fig.box, { grow: true });
        if (cropBuf) {
          const outPath = `public/uploads/organic_pyq/${fig.filename}`;
          fs.writeFileSync(outPath, cropBuf);
          completed++;
          console.log(`[${completed}/${FIGURE_DEFINITIONS.length}] Saved ${fig.filename} (${cropBuf.length} bytes) - ${fig.description}`);
        } else {
          console.warn(`[WARNING] Crop returned null for ${fig.filename} on page ${pageNum}`);
        }
      }
      await doc.release(pageNum);
    }
  });

  console.log("All chemical structure crops completed successfully!");
}

cropAllFigures().catch(console.error);
