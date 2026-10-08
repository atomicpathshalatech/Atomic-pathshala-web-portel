import {
  ModuleEditorObject,
  VisualLayer,
  LayerOrderAction,
  WatermarkConfig,
  HeaderFooterConfig,
} from "./types";

export interface RenderableLayerItem {
  id: string;
  sourceType: "OBJECT" | "WATERMARK" | "HEADER_FOOTER" | "BACKGROUND" | "BASE_PDF";
  layer: VisualLayer;
  zIndex: number;
  data: any;
}

export class LayerEngine {
  /**
   * Filter out deleted objects (Real Object Delete guarantee)
   */
  public static getActiveObjects(objects: ModuleEditorObject[]): ModuleEditorObject[] {
    return objects.filter((obj) => !obj.isDeleted);
  }

  /**
   * Sort objects deterministically by Layer and Z-Index
   */
  public static sortObjectsByLayer(objects: ModuleEditorObject[]): ModuleEditorObject[] {
    const active = this.getActiveObjects(objects);
    return [...active].sort((a, b) => {
      if (a.layer !== b.layer) {
        return a.layer - b.layer;
      }
      if (a.zIndex !== b.zIndex) {
        return a.zIndex - b.zIndex;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  /**
   * Filter objects applicable to a specific page
   */
  public static getObjectsForPage(objects: ModuleEditorObject[], pageNumber: number): ModuleEditorObject[] {
    const sorted = this.sortObjectsByLayer(objects);
    return sorted.filter((obj) => {
      if (obj.pageNumber === pageNumber) return true;
      if (obj.pageNumber === 0 || obj.pageRange === "ALL") return true;
      if (obj.pageRange === "ODD") return pageNumber % 2 !== 0;
      if (obj.pageRange === "EVEN") return pageNumber % 2 === 0;
      if (obj.pageRange === "CUSTOM" && obj.customPages) {
        return obj.customPages.includes(pageNumber);
      }
      return false;
    });
  }

  /**
   * Re-orders an object within its page/layer
   */
  public static adjustObjectZIndex(
    objects: ModuleEditorObject[],
    targetId: string,
    action: LayerOrderAction,
    pageNumber?: number
  ): ModuleEditorObject[] {
    const targetObj = objects.find((o) => o.id === targetId);
    if (!targetObj || targetObj.isDeleted) return objects;

    // Filter relevant objects on the same page and same layer
    const relevantPage = pageNumber ?? targetObj.pageNumber;
    const samePageLayerObjs = objects
      .filter((o) => !o.isDeleted && o.pageNumber === relevantPage && o.layer === targetObj.layer)
      .sort((a, b) => a.zIndex - b.zIndex);

    if (samePageLayerObjs.length <= 1) return objects;

    const currentIndex = samePageLayerObjs.findIndex((o) => o.id === targetId);
    if (currentIndex === -1) return objects;

    const updated = [...objects];
    const targetInUpdated = updated.find((o) => o.id === targetId)!;

    switch (action) {
      case "BRING_TO_FRONT": {
        const maxZ = Math.max(...samePageLayerObjs.map((o) => o.zIndex));
        targetInUpdated.zIndex = maxZ + 1;
        break;
      }
      case "SEND_TO_BACK": {
        const minZ = Math.min(...samePageLayerObjs.map((o) => o.zIndex));
        targetInUpdated.zIndex = Math.max(0, minZ - 1);
        break;
      }
      case "BRING_FORWARD": {
        if (currentIndex < samePageLayerObjs.length - 1) {
          const nextObj = samePageLayerObjs[currentIndex + 1];
          if (nextObj) {
            const nextInUpdated = updated.find((o) => o.id === nextObj.id);
            if (nextInUpdated) {
              const tempZ = targetInUpdated.zIndex;
              targetInUpdated.zIndex = nextInUpdated.zIndex;
              nextInUpdated.zIndex = tempZ;
              if (targetInUpdated.zIndex === nextInUpdated.zIndex) {
                targetInUpdated.zIndex += 1;
              }
            }
          }
        }
        break;
      }
      case "SEND_BACKWARD": {
        if (currentIndex > 0) {
          const prevObj = samePageLayerObjs[currentIndex - 1];
          if (prevObj) {
            const prevInUpdated = updated.find((o) => o.id === prevObj.id);
            if (prevInUpdated) {
              const tempZ = targetInUpdated.zIndex;
              targetInUpdated.zIndex = prevInUpdated.zIndex;
              prevInUpdated.zIndex = tempZ;
              if (targetInUpdated.zIndex === prevInUpdated.zIndex) {
                prevInUpdated.zIndex += 1;
              }
            }
          }
        }
        break;
      }
    }

    targetInUpdated.updatedAt = new Date().toISOString();
    return this.normalizeZIndices(updated, relevantPage);
  }

  /**
   * Normalizes Z-Indices to continuous 0..N integers
   */
  public static normalizeZIndices(objects: ModuleEditorObject[], pageNumber?: number): ModuleEditorObject[] {
    const updated = [...objects];
    const pages = pageNumber ? [pageNumber] : Array.from(new Set(objects.map((o) => o.pageNumber)));

    for (const p of pages) {
      const pageObjs = updated
        .filter((o) => !o.isDeleted && o.pageNumber === p)
        .sort((a, b) => a.zIndex - b.zIndex);

      pageObjs.forEach((obj, idx) => {
        const found = updated.find((o) => o.id === obj.id);
        if (found) {
          found.zIndex = idx;
        }
      });
    }

    return updated;
  }

  /**
   * Builds the complete unified rendering queue for a page in strict z-order
   */
  public static buildPageRenderQueue(
    pageNumber: number,
    objects: ModuleEditorObject[],
    watermark?: WatermarkConfig,
    headerFooter?: HeaderFooterConfig
  ): RenderableLayerItem[] {
    const queue: RenderableLayerItem[] = [];

    // 1. Background Layer (Layer 0)
    queue.push({
      id: `bg-page-${pageNumber}`,
      sourceType: "BACKGROUND",
      layer: VisualLayer.BACKGROUND,
      zIndex: 0,
      data: { pageNumber },
    });

    // 2. Base PDF Document Content (Layer 10)
    queue.push({
      id: `base-pdf-${pageNumber}`,
      sourceType: "BASE_PDF",
      layer: VisualLayer.BASE_PDF,
      zIndex: 0,
      data: { pageNumber },
    });

    // 3. Watermark behind content if configured
    if (watermark?.enabled && watermark.layer === "BEHIND_CONTENT") {
      queue.push({
        id: `wm-behind-${pageNumber}`,
        sourceType: "WATERMARK",
        layer: VisualLayer.BEHIND_WATERMARK,
        zIndex: 0,
        data: watermark,
      });
    }

    // 4. Header & Footer (Layer 50)
    if (headerFooter?.enabled) {
      queue.push({
        id: `hf-${pageNumber}`,
        sourceType: "HEADER_FOOTER",
        layer: VisualLayer.HEADER_FOOTER,
        zIndex: 0,
        data: headerFooter,
      });
    }

    // 5. Active User Editable Objects (Layers 30, 40, 60)
    const pageObjects = this.getObjectsForPage(objects, pageNumber);
    for (const obj of pageObjects) {
      queue.push({
        id: obj.id,
        sourceType: "OBJECT",
        layer: obj.layer,
        zIndex: obj.zIndex,
        data: obj,
      });
    }

    // 6. Watermark above content if configured
    if (watermark?.enabled && watermark.layer === "ABOVE_CONTENT") {
      queue.push({
        id: `wm-above-${pageNumber}`,
        sourceType: "WATERMARK",
        layer: VisualLayer.ABOVE_WATERMARK,
        zIndex: 999,
        data: watermark,
      });
    }

    // Sort complete queue deterministically
    return queue.sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a.zIndex - b.zIndex;
    });
  }

  /**
   * Real Delete: marks object as deleted and removes it from active rendering
   */
  public static deleteObject(objects: ModuleEditorObject[], objectId: string): ModuleEditorObject[] {
    return objects.map((obj) => {
      if (obj.id === objectId) {
        return {
          ...obj,
          isDeleted: true,
          updatedAt: new Date().toISOString(),
        };
      }
      return obj;
    });
  }

  /**
   * Purge all deleted objects permanently (Garbage Collection)
   */
  public static purgeDeletedObjects(objects: ModuleEditorObject[]): ModuleEditorObject[] {
    return objects.filter((obj) => !obj.isDeleted);
  }
}
