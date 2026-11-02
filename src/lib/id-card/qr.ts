import QRCode from "qrcode";

/**
 * The card's QR code as an SVG of FILLED module runs. qrcode's own SVG output
 * draws modules as strokes, which leave hairline gaps once the card is zoomed
 * to print size (seen in the PDF) — filled rectangles with crisp edges scan
 * reliably on screen and on paper.
 */
export function qrSvg(text: string, color = "#0a1f5c"): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  let d = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y * size + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Verification QR code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`;
}
