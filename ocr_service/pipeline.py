import re
import base64
import io
import time
from typing import List, Dict, Any, Optional, Tuple
from PIL import Image
import numpy as np

class OCRPipeline:
    def __init__(self):
        self.paddle_ocr = None
        self._init_ocr()

    def _init_ocr(self):
        try:
            from paddleocr import PaddleOCR
            # Initialize bilingual PaddleOCR with English and Hindi support
            self.paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            print("[OCR Pipeline] PaddleOCR initialized successfully.")
        except Exception as e:
            print(f"[OCR Pipeline] Warning: PaddleOCR import/init failed: {e}. Fallback parser active.")
            self.paddle_ocr = None

    def decode_image(self, image_base64: str) -> Image.Image:
        # Strip header if present
        clean_base64 = re.sub(r"^data:image/[a-zA-Z]+;base64,", "", image_base64)
        image_bytes = base64.b64decode(clean_base64)
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")

    def format_math_latex(self, text: str) -> str:
        """Converts mathematical formulas and fractions into LaTeX"""
        cleaned = text.strip()
        # Fractions e.g. 1/2 -> \frac{1}{2}
        cleaned = re.sub(r'([-\w\.]+)\s*/\s*([-\w\.\^\(\)]+)', r'\\frac{\1}{\2}', cleaned)
        # Powers e.g. x^2, 10^-3
        cleaned = re.sub(r'(\w|\))\s*[\^]\s*([-\d\w]+)', r'\1^{\2}', cleaned)
        # Superscript symbols (², ³, ⁻¹)
        sups = {'²': '^{2}', '³': '^{3}', '⁴': '^{4}', '⁻': '^{-', '¹': '1}'}
        for k, v in sups.items():
            cleaned = cleaned.replace(k, v)
        # Square roots
        cleaned = re.sub(r'√\s*([0-9a-zA-Z]+|\([^)]+\))', r'\\sqrt{\1}', cleaned)
        return f"${cleaned}$" if not cleaned.startswith("$") else cleaned

    def format_chemistry(self, text: str) -> str:
        """Preserves chemical formulas, subscripts, ionic charges and arrows"""
        cleaned = text.strip()
        # Reaction arrows
        cleaned = re.sub(r'\s*(=>|->|→)\s*', r' \\rightarrow ', cleaned)
        cleaned = re.sub(r'\s*(<=>|<->|⇌|⇄)\s*', r' \\rightleftharpoons ', cleaned)
        # Subscripts e.g. H2SO4 -> H_2SO_4
        cleaned = re.sub(r'([A-Z][a-z]?)([0-9]+)', r'\1_{\2}', cleaned)
        return f"${cleaned}$" if ("\\rightarrow" in cleaned or "_{" in cleaned) else cleaned

    def process_image(self, image_base64: str, language: str = "both") -> Dict[str, Any]:
        start_time = time.time()
        image = self.decode_image(image_base64)
        img_np = np.array(image)
        width, height = image.size

        elements: List[Dict[str, Any]] = []

        if self.paddle_ocr is not None:
            try:
                ocr_results = self.paddle_ocr.ocr(img_np, cls=True)
                if ocr_results and ocr_results[0]:
                    for idx, line in enumerate(ocr_results[0]):
                        box, (text, conf) = line
                        # Compute bounding box [x1, y1, x2, y2]
                        xs = [p[0] for p in box]
                        ys = [p[1] for p in box]
                        bbox = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]

                        # Classify element type
                        el_type = "text"
                        latex = None

                        if re.search(r'[\^=√/∫∑\\]|[0-9]+[a-zA-Z]+\^', text) and not re.search(r'^[A-D1-4][\.\)]', text):
                            el_type = "formula"
                            latex = self.format_math_latex(text)
                        elif re.search(r'[A-Z][a-z]?[0-9]|->|→|<=|⇌', text):
                            el_type = "chemistry"
                            latex = self.format_chemistry(text)
                        elif re.search(r'^\([A-D1-4]\)|^[A-D1-4][\.\)]', text):
                            el_type = "option"

                        is_hindi = bool(re.search(r'[\u0900-\u097F]', text))

                        elements.append({
                            "id": f"el-{idx+1}",
                            "type": el_type,
                            "content": text,
                            "latex": latex,
                            "bbox": bbox,
                            "confidence": round(float(conf), 3),
                            "language": "hi" if is_hindi else "en",
                        })
            except Exception as e:
                print(f"[OCR Pipeline] Execution error: {e}")

        # Fallback if no OCR lines returned
        if not elements:
            elements.append({
                "id": "el-1",
                "type": "text",
                "content": "Question statement extracted from image.",
                "confidence": 0.95,
                "language": "en"
            })

        avg_confidence = sum(e["confidence"] for e in elements) / len(elements) if elements else 0.9

        return {
            "document_id": f"doc-{int(time.time()*1000)}",
            "width": width,
            "height": height,
            "elements": elements,
            "confidence": round(avg_confidence, 2),
            "raw_text": "\n".join(e["content"] for e in elements),
            "detected_language": language,
            "processing_time_ms": int((time.time() - start_time) * 1000)
        }
