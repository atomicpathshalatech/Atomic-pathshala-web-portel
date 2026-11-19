import fs from 'fs';
import { extractTextFromPdfBuffer } from '../src/lib/extraction/pdf-extractor';

async function main() {
  const pdfPath = 'C:/Users/firoz/.gemini/antigravity/brain/c3fa2a19-2eb6-46ce-a982-daeec913b9d1/.user_uploaded/media_1795066526826_a42cf004.pdf';
  const buffer = fs.readFileSync(pdfPath);
  console.log('PDF buffer size:', buffer.length);
  const result = await extractTextFromPdfBuffer(buffer);
  console.log('Total extracted pages:', result.pages.length);
  fs.writeFileSync('scripts/animal_kingdom_pages.json', JSON.stringify(result.pages, null, 2));
  console.log('Saved to scripts/animal_kingdom_pages.json');
}

main().catch(console.error);
