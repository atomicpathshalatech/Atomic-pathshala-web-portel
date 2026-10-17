// Text box model shared by the PDF editor (browser) and the PDF writer (server):
// the editor draws text boxes with this padding and line height, and the writer
// places each line's baseline the same way, so the PDF matches the preview.
export const TEXT_PAD = 2;
export const TEXT_LINE_HEIGHT = 1.25;
// Helvetica / Arial vertical metrics (em units): ascent and full content box.
export const FONT_ASCENT = 0.905;
export const FONT_BOX = 1.117;
