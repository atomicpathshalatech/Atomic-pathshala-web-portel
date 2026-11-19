import fs from 'fs';
import { withRenderedPdf, Box } from '../src/lib/pdf/page-renderer';

async function main() {
  const pdfPath = 'C:/Users/firoz/.gemini/antigravity/brain/c3fa2a19-2eb6-46ce-a982-daeec913b9d1/.user_uploaded/media_1795066526826_a42cf004.pdf';
  const buffer = fs.readFileSync(pdfPath);

  await withRenderedPdf(buffer, async (doc) => {
    console.log('Cropping Q81 from Page 24...');
    // Box coordinates: [top, left, bottom, right] in points (page is usually 595 x 842 points)
    const box81: Box = [320, 60, 520, 380];
    const crop81 = await doc.crop(24, box81, { grow: true });
    if (crop81) {
      fs.writeFileSync('public/uploads/animal_kingdom_q81.png', crop81);
      console.log('Saved Q81 crop, size:', crop81.length);
    }
  });
}

main().catch(console.error);
