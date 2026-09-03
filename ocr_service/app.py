import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from pipeline import OCRPipeline

app = FastAPI(
    title="Atomic Pathshala OCR & Formula Recognition Microservice",
    description="Self-hosted OCR microservice with PaddleOCR, LaTeX formula recognition, and chemistry formatting.",
    version="1.0.0"
)

pipeline = OCRPipeline()

class OCRExtractRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/png"
    solution_image_base64: Optional[str] = None
    language: Optional[str] = "both"

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Atomic Pathshala Self-Hosted OCR Engine",
        "paddle_ocr_loaded": pipeline.paddle_ocr is not None,
    }

@app.post("/extract")
def extract_question(req: OCRExtractRequest):
    if not req.image_base64 or len(req.image_base64.strip()) < 20:
        raise HTTPException(status_code=400, detail="image_base64 must be a valid base64-encoded image string.")

    try:
        result = pipeline.process_image(req.image_base64, req.language or "both")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
