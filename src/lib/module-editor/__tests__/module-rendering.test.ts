import { describe, it, expect } from "vitest";
import {
  CoordinateEngine,
  ThemeEngine,
  LayerEngine,
  PreviewRenderer,
  NativePdfEngine,
  StateManager,
  SUBJECT_THEMES,
  VisualLayer,
  TextObject,
  ImageObject,
  ShapeObject,
  DEFAULT_PAGE_SIZE,
} from "../index";

describe("Module Editor — Rendering & Layering Engine", () => {
  // -------------------------------------------------------------
  // 1. REAL OBJECT DELETE
  // -------------------------------------------------------------
  describe("1. Real Object Delete", () => {
    it("should strictly omit deleted objects from active layer queues and rendering", () => {
      const manager = new StateManager();

      const obj1: TextObject = {
        id: "txt-1",
        type: "text",
        text: "Sample Title",
        fontSize: 14,
        fontFamily: "helvetica",
        color: "#000000",
        pageNumber: 1,
        zIndex: 0,
        layer: VisualLayer.EDIT_OBJECTS,
        transform: { x: 50, y: 50, width: 200, height: 30 },
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const obj2: ImageObject = {
        id: "img-1",
        type: "image",
        imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        pageNumber: 1,
        zIndex: 1,
        layer: VisualLayer.EDIT_OBJECTS,
        transform: { x: 50, y: 100, width: 100, height: 100 },
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      manager.addObject(obj1);
      manager.addObject(obj2);

      let active = LayerEngine.getActiveObjects(manager.getState().objects);
      expect(active).toHaveLength(2);

      // Perform Real Delete on obj1
      manager.deleteObject("txt-1");

      const stateAfterDelete = manager.getState();
      active = LayerEngine.getActiveObjects(stateAfterDelete.objects);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe("img-1");

      // Verify page render queue omits txt-1
      const renderQueue = LayerEngine.buildPageRenderQueue(
        1,
        stateAfterDelete.objects,
        stateAfterDelete.watermark,
        stateAfterDelete.headerFooter
      );

      const foundTxt = renderQueue.find((item) => item.id === "txt-1");
      expect(foundTxt).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // 2. LIVE WYSIWYG HEADER & FOOTER PREVIEW
  // -------------------------------------------------------------
  describe("2. Live Header & Footer Preview", () => {
    it("should compute exact WYSIWYG positions, bounds, and variable interpolations", () => {
      const manager = new StateManager();
      const state = manager.getState();
      const theme = SUBJECT_THEMES.CHEMISTRY;

      const vars = {
        page: 2,
        totalPages: 10,
        subject: "ORGANIC CHEMISTRY",
        chapter: "Hydrocarbons",
        teacher: "Firoz Sir",
        date: "08/10/2026",
        moduleNumber: "02",
        targetExam: "NEET 2027",
      };

      const model = PreviewRenderer.generateHeaderFooterModel(state.headerFooter, theme, vars);

      expect(model.header.visible).toBe(true);
      expect(model.header.bounds.height).toBe(36);
      expect(model.header.bounds.y).toBe(0);
      expect(model.header.leftText).toBe("ATOMIC PATHSHALA");
      expect(model.header.centerText).toBe("| ORGANIC CHEMISTRY - Hydrocarbons");
      expect(model.header.rightText).toBe("Firoz Sir");

      expect(model.footer.visible).toBe(true);
      expect(model.footer.bounds.height).toBe(28);
      expect(model.footer.bounds.y).toBe(DEFAULT_PAGE_SIZE.height - 28);
      expect(model.footer.rightText).toBe("Page 2 of 10");
    });

    it("should honor excludeFirstPage and custom page ranges", () => {
      const manager = new StateManager({
        headerFooter: {
          enabled: true,
          headerLeft: "LEFT",
          headerCenter: "CENTER",
          headerRight: "RIGHT",
          headerHeightPt: 36,
          headerTopOffsetPt: 0,
          footerLeft: "FOOTER",
          footerCenter: "",
          footerRight: "",
          footerHeightPt: 28,
          footerBottomOffsetPt: 0,
          removeOldHeader: false,
          removeOldFooter: false,
          oldHeaderHeightPt: 30,
          oldFooterHeightPt: 30,
          fontSize: 9,
          fontFamily: "helvetica",
          excludeFirstPage: true,
          pageRange: "ALL",
        },
      });

      const theme = SUBJECT_THEMES.PHYSICS;
      const modelP1 = PreviewRenderer.generateHeaderFooterModel(
        manager.getState().headerFooter,
        theme,
        { page: 1, totalPages: 5, subject: "PHYSICS", chapter: "Kinematics", teacher: "Faculty", date: "", moduleNumber: "01" }
      );
      expect(modelP1.header.visible).toBe(false);
      expect(modelP1.footer.visible).toBe(false);

      const modelP2 = PreviewRenderer.generateHeaderFooterModel(
        manager.getState().headerFooter,
        theme,
        { page: 2, totalPages: 5, subject: "PHYSICS", chapter: "Kinematics", teacher: "Faculty", date: "", moduleNumber: "01" }
      );
      expect(modelP2.header.visible).toBe(true);
      expect(modelP2.footer.visible).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 3. LAYER ORDERING & Z-INDEX MANIPULATION
  // -------------------------------------------------------------
  describe("3. Layer Ordering & Z-Index Controls", () => {
    it("should handle bringToFront, sendToBack, bringForward, and sendBackward", () => {
      const manager = new StateManager();

      const objA: ShapeObject = {
        id: "shape-a",
        type: "shape",
        shapeType: "rect",
        pageNumber: 1,
        zIndex: 0,
        layer: VisualLayer.EDIT_OBJECTS,
        transform: { x: 10, y: 10, width: 50, height: 50 },
        isDeleted: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const objB: ShapeObject = {
        id: "shape-b",
        type: "shape",
        shapeType: "circle",
        pageNumber: 1,
        zIndex: 1,
        layer: VisualLayer.EDIT_OBJECTS,
        transform: { x: 20, y: 20, width: 50, height: 50 },
        isDeleted: false,
        createdAt: "2026-01-01T00:00:01.000Z",
        updatedAt: "2026-01-01T00:00:01.000Z",
      };

      const objC: ShapeObject = {
        id: "shape-c",
        type: "shape",
        shapeType: "callout",
        pageNumber: 1,
        zIndex: 2,
        layer: VisualLayer.EDIT_OBJECTS,
        transform: { x: 30, y: 30, width: 50, height: 50 },
        isDeleted: false,
        createdAt: "2026-01-01T00:00:02.000Z",
        updatedAt: "2026-01-01T00:00:02.000Z",
      };

      manager.addObject(objA);
      manager.addObject(objB);
      manager.addObject(objC);

      // Bring objA to front (should become highest z-index)
      manager.reorderObject("shape-a", "BRING_TO_FRONT");
      let sorted = LayerEngine.getObjectsForPage(manager.getState().objects, 1);
      expect(sorted[sorted.length - 1].id).toBe("shape-a");

      // Send objA to back (should become lowest z-index)
      manager.reorderObject("shape-a", "SEND_TO_BACK");
      sorted = LayerEngine.getObjectsForPage(manager.getState().objects, 1);
      expect(sorted[0].id).toBe("shape-a");

      // Bring objA forward one step
      manager.reorderObject("shape-a", "BRING_FORWARD");
      sorted = LayerEngine.getObjectsForPage(manager.getState().objects, 1);
      expect(sorted[1].id).toBe("shape-a");
    });
  });

  // -------------------------------------------------------------
  // 4. STRUCTURAL THEME / COLOR CODING (NO DARK FULL PAGE FILL)
  // -------------------------------------------------------------
  describe("4. Structural Theming", () => {
    it("should provide subject-specific palettes while maintaining clean white/paper backgrounds", () => {
      const chemTheme = ThemeEngine.getThemeForSubject("CHEMISTRY");
      expect(chemTheme.type).toBe("CHEMISTRY");
      expect(chemTheme.colors.primary).toBe("#047857");
      expect(chemTheme.colors.paperBg).toBe("#ffffff"); // Guarantees no dark full-page fill

      const physTheme = ThemeEngine.getThemeForSubject("PHYSICS");
      expect(physTheme.type).toBe("PHYSICS");
      expect(physTheme.colors.primary).toBe("#1d4ed8");
      expect(physTheme.colors.paperBg).toBe("#ffffff");

      const bioTheme = ThemeEngine.getThemeForSubject("BIOLOGY");
      expect(bioTheme.type).toBe("BIOLOGY");
      expect(bioTheme.colors.primary).toBe("#6d28d9");
      expect(bioTheme.colors.paperBg).toBe("#ffffff");
    });
  });

  // -------------------------------------------------------------
  // 5. AUTOMATIC HEADING DETECTION & THEME STYLING
  // -------------------------------------------------------------
  describe("5. Automatic Heading Detection", () => {
    it("should detect chapter titles, section headers, and formulas without altering body text", () => {
      const textBlocks = [
        { id: "t1", pageNumber: 1, text: "CHAPTER 4: CHEMICAL BONDING", box: { x: 50, y: 60, width: 300, height: 25 }, fontSize: 18, isBold: true },
        { id: "t2", pageNumber: 1, text: "4.1 Ionic and Covalent Bonds", box: { x: 50, y: 100, width: 250, height: 18 }, fontSize: 14, isBold: true },
        { id: "t3", pageNumber: 1, text: "DEFINITION: Octet rule states that atoms combine to acquire 8 valence electrons.", box: { x: 50, y: 140, width: 400, height: 30 }, fontSize: 11 },
        { id: "t4", pageNumber: 1, text: "In general, elements in group 1 tend to lose electrons while elements in group 17 gain them.", box: { x: 50, y: 180, width: 400, height: 40 }, fontSize: 10 },
      ];

      const theme = SUBJECT_THEMES.CHEMISTRY;
      const detected = ThemeEngine.detectHeadingsInText(textBlocks, theme);

      expect(detected).toHaveLength(3);
      expect(detected[0].level).toBe(1); // Chapter 4
      expect(detected[0].ruleMatched).toBe("rule-h1-chapter");

      expect(detected[1].level).toBe(2); // 4.1 Section
      expect(detected[1].ruleMatched).toBe("rule-h2-section");

      expect(detected[2].level).toBe(3); // DEFINITION
      expect(detected[2].ruleMatched).toBe("rule-h3-concepts");

      // Verify body text t4 was NOT classified as heading
      const foundBody = detected.find((d) => d.text.includes("In general, elements"));
      expect(foundBody).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // 6. IMAGE WATERMARK LIVE PREVIEW & 0° ROTATION
  // -------------------------------------------------------------
  describe("6. Watermark Preview & Settings", () => {
    it("should properly configure image watermark with rotation=0 as standard orientation", () => {
      const manager = new StateManager({
        watermark: {
          enabled: true,
          type: "image",
          imageUrl: "https://atomicpathshala.com/logo.png",
          scale: 0.8,
          opacity: 0.12,
          rotation: 0, // Strictly unrotated normal orientation
          position: "CENTER",
          layer: "BEHIND_CONTENT",
          excludeFirstPage: false,
          pageRange: "ALL",
        },
      });

      const state = manager.getState();
      const theme = SUBJECT_THEMES.PHYSICS;
      const wmModel = PreviewRenderer.generateWatermarkModel(state.watermark, theme, 1);

      expect(wmModel.visible).toBe(true);
      expect(wmModel.type).toBe("image");
      expect(wmModel.rotation).toBe(0);
      expect(wmModel.opacity).toBe(0.12);
      expect(wmModel.layer).toBe("BEHIND_CONTENT");
    });
  });

  // -------------------------------------------------------------
  // 7. UNIFIED COORDINATE MODEL
  // -------------------------------------------------------------
  describe("7. Unified Coordinate Model", () => {
    it("should convert top-left UI coordinates to bottom-left PDF coordinates with precision", () => {
      const uiBox = { x: 50, y: 100, width: 200, height: 40 };
      const pageHeight = 841.89; // A4 height

      const pdfBox = CoordinateEngine.uiToPdfCoord(uiBox, pageHeight);
      expect(pdfBox.x).toBe(50);
      expect(pdfBox.y).toBe(Math.round((841.89 - 100 - 40) * 100) / 100);
      expect(pdfBox.width).toBe(200);
      expect(pdfBox.height).toBe(40);

      const roundTripUi = CoordinateEngine.pdfToUiCoord(pdfBox, pageHeight);
      expect(roundTripUi.x).toBe(uiBox.x);
      expect(roundTripUi.y).toBe(uiBox.y);
      expect(roundTripUi.width).toBe(uiBox.width);
      expect(roundTripUi.height).toBe(uiBox.height);
    });
  });

  // -------------------------------------------------------------
  // 8. SAVE / REOPEN STATE VALIDATION & PDF EXPORT
  // -------------------------------------------------------------
  describe("8. Save/Reopen State Serialization & PDF Export", () => {
    it("should serialize and deserialize state without data loss", () => {
      const manager = new StateManager({
        documentId: "module-test-101",
        pageCount: 3,
      });

      manager.setTheme("BIOLOGY");
      manager.addObject({
        id: "bio-text-1",
        type: "text",
        text: "Plant Physiology & Photosynthesis",
        fontSize: 16,
        fontFamily: "helvetica",
        color: "#6d28d9",
        pageNumber: 1,
        zIndex: 0,
        layer: VisualLayer.EDIT_OBJECTS,
        transform: { x: 50, y: 120, width: 350, height: 30 },
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const serialized = StateManager.serialize(manager.getState());
      expect(typeof serialized).toBe("string");

      const deserialized = StateManager.deserialize(serialized);
      expect(deserialized.documentId).toBe("module-test-101");
      expect(deserialized.theme.type).toBe("BIOLOGY");
      expect(deserialized.objects).toHaveLength(1);
      expect(deserialized.objects[0].id).toBe("bio-text-1");
    });

    it("should successfully generate and export valid PDF bytes with native-pdf-engine", async () => {
      const manager = new StateManager({
        pageCount: 2,
        coverPage: {
          enabled: true,
          action: "PREPEND",
          subject: "CHEMISTRY",
          chapter: "Thermodynamics",
          moduleNumber: "03",
          teacher: "Firoz Sir",
        },
        watermark: {
          enabled: true,
          type: "text",
          text: "ATOMIC PATHSHALA",
          opacity: 0.06,
          rotation: 35,
          position: "CENTER",
          layer: "BEHIND_CONTENT",
          excludeFirstPage: true,
          pageRange: "ALL",
        },
      });

      manager.addObject({
        id: "callout-box",
        type: "shape",
        shapeType: "callout",
        pageNumber: 1,
        zIndex: 0,
        layer: VisualLayer.EDIT_OBJECTS,
        transform: { x: 50, y: 100, width: 495, height: 60 },
        strokeColor: "#047857",
        fillColor: "#ecfdf5",
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await NativePdfEngine.exportPdf({
        state: manager.getState(),
      });

      expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(result.pdfBytes.length).toBeGreaterThan(1000);
      expect(result.pageCount).toBe(3); // 2 pages + 1 prepended cover page
      expect(result.fileSizeBytes).toBe(result.pdfBytes.length);
    });
  });
});
