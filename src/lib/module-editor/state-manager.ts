import {
  ModuleEditorState,
  ModuleEditorStateSchema,
  ModuleEditorObject,
  SubjectThemeType,
  LayerOrderAction,
} from "./types";
import { DEFAULT_PAGE_SIZE } from "./coordinate-engine";
import { SUBJECT_THEMES, DEFAULT_HEADING_RULES } from "./theme-engine";
import { LayerEngine } from "./layer-engine";

export class StateManager {
  private currentState: ModuleEditorState;
  private undoStack: ModuleEditorState[] = [];
  private redoStack: ModuleEditorState[] = [];
  private readonly maxHistorySize: number = 50;

  constructor(initialState?: Partial<ModuleEditorState>) {
    this.currentState = this.createDefaultState(initialState);
  }

  /**
   * Factory function to create a validated default editor state
   */
  public createDefaultState(overrides?: Partial<ModuleEditorState>): ModuleEditorState {
    const defaultTheme = SUBJECT_THEMES.CHEMISTRY;
    const base: ModuleEditorState = {
      version: 2,
      documentId: `doc-${Date.now()}`,
      pageCount: 1,
      pageSize: {
        width: DEFAULT_PAGE_SIZE.width,
        height: DEFAULT_PAGE_SIZE.height,
      },
      theme: defaultTheme,
      headerFooter: {
        enabled: true,
        headerLeft: "ATOMIC PATHSHALA",
        headerCenter: "| {subject} - {chapter}",
        headerRight: "{teacher}",
        headerHeightPt: 36,
        headerTopOffsetPt: 0,
        footerLeft: "Atomic Pathshala | India's Leading NEET Accelerator",
        footerCenter: "",
        footerRight: "Page {page} of {totalPages}",
        footerHeightPt: 28,
        footerBottomOffsetPt: 0,
        removeOldHeader: true,
        removeOldFooter: true,
        oldHeaderHeightPt: 42,
        oldFooterHeightPt: 32,
        fontSize: 9,
        fontFamily: "helvetica",
        excludeFirstPage: false,
        pageRange: "ALL",
      },
      watermark: {
        enabled: false,
        type: "image",
        scale: 1.0,
        opacity: 0.08,
        rotation: 0, // 0 is strictly standard unrotated
        position: "CENTER",
        layer: "BEHIND_CONTENT",
        excludeFirstPage: false,
        pageRange: "ALL",
      },
      coverPage: {
        enabled: false,
        action: "NONE",
        subject: "CHEMISTRY",
        chapter: "Chemical Bonding",
        moduleNumber: "01",
        teacher: "Atomic Pathshala Faculty",
        targetExam: "NEET (UG)",
      },
      objects: [],
      pageRotations: {},
      deletedPages: [],
      pageOrder: [],
      headingDetectionEnabled: true,
      headingRules: DEFAULT_HEADING_RULES,
      savedAt: new Date().toISOString(),
    };

    const merged = { ...base, ...overrides };
    return ModuleEditorStateSchema.parse(merged) as ModuleEditorState;
  }

  /**
   * Get current state (immutable snapshot)
   */
  public getState(): ModuleEditorState {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  /**
   * Update state and push previous state to undo stack
   */
  public setState(updater: (prev: ModuleEditorState) => ModuleEditorState): ModuleEditorState {
    const prevState = this.getState();
    const nextState = updater(prevState);
    const validated = ModuleEditorStateSchema.parse({
      ...nextState,
      savedAt: new Date().toISOString(),
    }) as ModuleEditorState;

    this.undoStack.push(prevState);
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo on new action
    this.currentState = validated;
    return this.getState();
  }

  /**
   * Undo last operation
   */
  public undo(): ModuleEditorState | null {
    if (this.undoStack.length === 0) return null;
    const prev = this.undoStack.pop()!;
    this.redoStack.push(this.getState());
    this.currentState = prev;
    return this.getState();
  }

  /**
   * Redo last undone operation
   */
  public redo(): ModuleEditorState | null {
    if (this.redoStack.length === 0) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(this.getState());
    this.currentState = next;
    return this.getState();
  }

  /**
   * Add a new object to editor
   */
  public addObject(object: ModuleEditorObject): ModuleEditorState {
    return this.setState((prev) => {
      const highestZ = prev.objects
        .filter((o) => o.pageNumber === object.pageNumber && !o.isDeleted)
        .reduce((max, o) => Math.max(max, o.zIndex), -1);

      const newObj: ModuleEditorObject = {
        ...object,
        zIndex: object.zIndex !== undefined ? object.zIndex : highestZ + 1,
        createdAt: object.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return {
        ...prev,
        objects: [...prev.objects, newObj],
      };
    });
  }

  /**
   * Real Delete: marks object as deleted and removes it from visual layer calculations
   */
  public deleteObject(objectId: string): ModuleEditorState {
    return this.setState((prev) => ({
      ...prev,
      objects: LayerEngine.deleteObject(prev.objects, objectId),
    }));
  }

  /**
   * Change layer order of an object
   */
  public reorderObject(objectId: string, action: LayerOrderAction): ModuleEditorState {
    return this.setState((prev) => ({
      ...prev,
      objects: LayerEngine.adjustObjectZIndex(prev.objects, objectId, action),
    }));
  }

  /**
   * Set Theme (Chemistry, Physics, Biology, Classic)
   */
  public setTheme(themeType: SubjectThemeType): ModuleEditorState {
    const theme = SUBJECT_THEMES[themeType] || SUBJECT_THEMES.CLASSIC;
    return this.setState((prev) => ({
      ...prev,
      theme,
      coverPage: {
        ...prev.coverPage,
        subject: themeType,
      },
    }));
  }

  /**
   * Serialize editor state to JSON string
   */
  public static serialize(state: ModuleEditorState): string {
    const validated = ModuleEditorStateSchema.parse(state);
    return JSON.stringify(validated);
  }

  /**
   * Deserialize JSON string back to ModuleEditorState with full schema validation
   */
  public static deserialize(jsonString: string): ModuleEditorState {
    const parsed = JSON.parse(jsonString);
    return ModuleEditorStateSchema.parse(parsed) as ModuleEditorState;
  }
}
