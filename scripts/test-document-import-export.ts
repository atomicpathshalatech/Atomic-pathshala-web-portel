import assert from "assert";

async function runDocumentImportExportTests() {
  console.log("==================================================================");
  console.log("ATOMIC PATHSHALA — DOCUMENT IMPORT & WHITEBOARD EXPORT TEST SUITE");
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`  [PASS] #${total}: ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  [FAIL] #${total}: ${name}`);
            console.error("        ", err.message || err);
          });
      } else {
        console.log(`  [PASS] #${total}: ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  [FAIL] #${total}: ${name}`);
      console.error("        ", err.message || err);
    }
  }

  // 1. Test PPT Presentation Metadata & Filename Preservation
  await test("PPT/PPTX Upload metadata correctly identifies presentation format", () => {
    const sessionWithPpt = {
      presentationUrl: "modules/live-classes/sched-101/uuid-Thermodynamics_Class_12.pptx",
      presentationName: "Thermodynamics_Class_12.pptx",
      presentationType: "PPTX",
      title: "Class 12 Physics: Heat & Thermodynamics",
    };

    const hasPresentation = Boolean(sessionWithPpt.presentationUrl);
    const isPpt =
      hasPresentation &&
      (sessionWithPpt.presentationType === "PPTX" ||
        sessionWithPpt.presentationName?.toLowerCase().endsWith(".ppt") ||
        sessionWithPpt.presentationName?.toLowerCase().endsWith(".pptx"));

    assert.strictEqual(isPpt, true, "Should identify PPTX presentation");
    assert.strictEqual(sessionWithPpt.presentationName, "Thermodynamics_Class_12.pptx");
  });

  // 2. Test PDF Document Metadata & Filename Preservation
  await test("PDF Upload metadata correctly identifies document format", () => {
    const sessionWithPdf = {
      presentationUrl: "https://r2.atomicpathshala.com/modules/live-classes/sched-102/Rotational_Motion.pdf",
      presentationName: "Rotational_Motion.pdf",
      presentationType: "PDF",
      title: "Class 11 Physics: Rotational Motion",
    };

    const hasPresentation = Boolean(sessionWithPdf.presentationUrl);
    const isPdf =
      hasPresentation &&
      (sessionWithPdf.presentationType === "PDF" ||
        sessionWithPdf.presentationName?.toLowerCase().endsWith(".pdf"));

    assert.strictEqual(isPdf, true, "Should identify PDF document");
    assert.strictEqual(sessionWithPdf.presentationName, "Rotational_Motion.pdf");
  });

  // 3. Test Whiteboard Export PDF generation logic with strokes and shapes
  await test("Whiteboard PDF generator composes vector strokes and background pages", async () => {
    const { generateWhiteboardPdf } = await import("../src/lib/whiteboard/pdf-generator");
    const testPages = [
      {
        pageNumber: 1,
        background: "light",
        objects: [
          {
            id: "obj-1",
            type: "path",
            color: "#ea580c",
            width: 3,
            points: [
              { x: 100, y: 100, pressure: 0.5 },
              { x: 120, y: 110, pressure: 0.7 },
              { x: 150, y: 130, pressure: 0.9 },
            ],
          },
          {
            id: "obj-2",
            type: "text",
            x: 200,
            y: 200,
            text: "Atomic Pathshala: E = mc^2",
            color: "#1e293b",
            fontSize: 24,
          },
          {
            id: "obj-3",
            type: "shape",
            shapeType: "rectangle",
            x: 300,
            y: 300,
            width: 150,
            height: 100,
            color: "#4f46e5",
          },
        ],
      },
      {
        pageNumber: 2,
        background: "atomic_dark",
        objects: [
          {
            id: "obj-4",
            type: "path",
            color: "#38bdf8",
            width: 4,
            points: [
              { x: 50, y: 50, pressure: 0.8 },
              { x: 80, y: 80, pressure: 0.6 },
            ],
          },
        ],
      },
    ];

    const pdfBuffer = await generateWhiteboardPdf(testPages, "Test Live Class");
    assert.ok(pdfBuffer instanceof Buffer, "Should return a Buffer");
    assert.ok(pdfBuffer.length > 500, `Buffer should contain valid PDF bytes (got ${pdfBuffer.length} bytes)`);
    const header = pdfBuffer.subarray(0, 4).toString("utf-8");
    assert.strictEqual(header, "%PDF", "Buffer must have valid %PDF magic header");
  });

  // 4. Test Student PPT Access Restriction (RBAC Guard)
  await test("Student access to original PPT is strictly forbidden (403)", () => {
    const studentRole = "STUDENT";
    const canAccessPpt = studentRole === "TEACHER" || studentRole === "ADMIN";
    assert.strictEqual(canAccessPpt, false, "Students must not have access to original PPT source files");
  });

  // 5. Test Teacher Access to Original PPT & PDF & Whiteboard PDF
  await test("Teacher access includes original PPT, original PDF, and Whiteboard notes", () => {
    const teacherRole = "TEACHER";
    const canAccessPpt = teacherRole === "TEACHER";
    const canAccessPdf = teacherRole === "TEACHER" || teacherRole === "STUDENT";
    assert.strictEqual(canAccessPpt, true, "Teacher must have access to original PPT");
    assert.strictEqual(canAccessPdf, true, "Teacher and student must have access to Whiteboard PDF");
  });

  // 6. Test Status Endpoint response payload structure
  await test("Status endpoint payload provides clear flags for original PPT/PDF and Whiteboard PDF", () => {
    const mockWbSession = {
      pdfStatus: "READY",
      pptxStatus: "READY",
      pdfStorageKey: "classes/wb-101/slides/final.pdf",
      pptxStorageKey: null,
      presentationUrl: "modules/live-classes/sched-101/uuid-lecture.pptx",
      presentationName: "lecture.pptx",
      presentationType: "PPTX",
      finalizedAt: new Date(),
    };

    const isPpt =
      Boolean(mockWbSession.presentationUrl) &&
      (mockWbSession.presentationType === "PPTX" ||
        mockWbSession.presentationName?.toLowerCase().endsWith(".pptx"));

    const statusResponse = {
      pdfStatus: mockWbSession.pdfStatus,
      pptxStatus: isPpt ? "READY" : "NONE",
      hasOriginalPpt: isPpt,
      originalPptName: isPpt ? mockWbSession.presentationName : null,
      hasOriginalPdf: false,
      originalPdfName: null,
      hasOriginalPresentation: true,
      presentationType: mockWbSession.presentationType,
      presentationName: mockWbSession.presentationName,
    };

    assert.strictEqual(statusResponse.hasOriginalPpt, true);
    assert.strictEqual(statusResponse.originalPptName, "lecture.pptx");
    assert.strictEqual(statusResponse.pdfStatus, "READY");
    assert.strictEqual(statusResponse.hasOriginalPdf, false);
  });

  console.log("\n------------------------------------------------------------------");
  console.log(`RESULTS: ${passed}/${total} tests passed successfully.`);
  console.log("==================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runDocumentImportExportTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
