import { Injectable, Signal, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { EditorToolsService } from './editor-tools.service';
import {
  EditorAnimationService,
  EditorAnimationCollectionService,
  EditorBoneHierarchyService,
  EditorCanvasStateService,
  EditorClipboardService,
  EditorColorService,
  EditorDrawingService,
  EditorFrameService,
  EditorHistoryService,
  EditorLayerService,
  EditorProjectService,
  EditorProjectStateService,
  EditorSelectionService,
  EditorBoneService,
  EditorExportService,
  EditorKeyframeService,
  EditorTransformService,
  FrameItem,
  GroupItem,
  LayerItem,
  LayerTreeItem,
  AnimationItem,
  BoneItem,
  isGroup,
  isLayer,
} from './editor/index';
import { EditorFreeTransformService } from './editor/editor-free-transform.service';
import { EditorContentAwareScaleService } from './editor/editor-content-aware-scale.service';
import { GradientType, ShapeFillMode, ToolMetaKey } from './tools/tool.types';
import { ProjectSnapshot } from './editor/history.types';

export type {
  FrameItem,
  GroupItem,
  LayerItem,
  LayerTreeItem,
  AnimationItem,
  BoneItem,
};
export { isGroup, isLayer };

interface ShapeDrawOptions {
  strokeThickness: number;
  strokeColor: string;
  fillMode: ShapeFillMode;
  fillColor: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientType: GradientType;
  gradientAngle: number;
}

@Injectable({ providedIn: 'root' })
export class EditorDocumentService {
  private readonly tools = inject(EditorToolsService);
  private readonly canvasState = inject(EditorCanvasStateService);
  private readonly layerService = inject(EditorLayerService);
  private readonly frameService = inject(EditorFrameService);
  private readonly animationService = inject(EditorAnimationService);
  private readonly animationCollectionService = inject(
    EditorAnimationCollectionService,
  );
  private readonly historyService = inject(EditorHistoryService);
  private readonly projectStateService = inject(EditorProjectStateService);
  private readonly selectionService = inject(EditorSelectionService);
  private readonly clipboardService = inject(EditorClipboardService);
  private readonly drawingService = inject(EditorDrawingService);
  private readonly colorService = inject(EditorColorService);
  private readonly projectService = inject(EditorProjectService);
  private readonly boneService = inject(EditorBoneService);
  private readonly boneHierarchyService = inject(EditorBoneHierarchyService);
  private readonly exportService = inject(EditorExportService);
  readonly keyframeService = inject(EditorKeyframeService);
  private readonly transformService = inject(EditorTransformService);
  private readonly freeTransformService = inject(EditorFreeTransformService);
  private readonly contentAwareScaleService = inject(
    EditorContentAwareScaleService,
  );

  readonly layers = this.layerService.layers;
  readonly selectedLayerId = this.layerService.selectedLayerId;
  readonly selectedLayerIds = this.layerService.selectedLayerIds;
  readonly selectedLayer: Signal<LayerTreeItem | null> =
    this.layerService.selectedLayer;

  readonly frames = this.frameService.frames;
  readonly currentFrameIndex = this.frameService.currentFrameIndex;

  readonly animations = this.animationCollectionService.animations;
  readonly currentAnimationIndex =
    this.animationCollectionService.currentAnimationIndex;

  readonly boneHierarchy = this.boneHierarchyService.bones;
  readonly selectedBoneHierarchyId = this.boneHierarchyService.selectedBoneId;

  readonly isAnimationPlaying = this.animationService.isPlaying;
  readonly animationFps = this.animationService.fps;

  readonly canvasWidth = this.canvasState.canvasWidth;
  readonly canvasHeight = this.canvasState.canvasHeight;
  readonly canvasSaved = this.canvasState.canvasSaved;
  readonly layerPixelsVersion = this.canvasState.layerPixelsVersion;

  readonly selectionRect = this.selectionService.selectionRect;
  readonly selectionShape = this.selectionService.selectionShape;
  readonly selectionPolygon = this.selectionService.selectionPolygon;
  readonly selectionMask = this.selectionService.selectionMask;

  readonly undoVersion = this.historyService.undoVersion;
  readonly redoVersion = this.historyService.redoVersion;

  constructor() {
    this.animationService.setLoadFrameCallback((index: number) => {
      this.loadFrameState(index);
    });

    setTimeout(() => this.initializeFirstFrame(), 0);
  }

  private initializeFirstFrame() {
    const firstFrame = this.frames()[0];
    if (firstFrame && !firstFrame.layers && !firstFrame.buffers) {
      this.saveFrameStateById(firstFrame.id);
    }
  }

  private captureProjectSnapshot() {
    const layers = this.layerService.layers().map((l) => ({ ...l }));
    const buffers: Record<string, string[]> = {};
    for (const [id, buf] of this.canvasState.getAllBuffers().entries()) {
      buffers[id] = buf.slice();
    }
    const toolSnapshot = this.tools.snapshot();
    const bonesSnapshot = this.boneService.snapshot();
    const bonesData: Record<string, any[]> = {};
    for (const [frameId, bones] of bonesSnapshot.entries()) {
      bonesData[frameId] = bones.map((b) => ({
        id: b.id,
        points: b.points.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          parentId: p.parentId,
          name: p.name,
          color: p.color,
        })),
        color: b.color,
        thickness: b.thickness,
      }));
    }
    const keyframeSnapshot = this.keyframeService.snapshot();
    const freeTransformState = this.freeTransformService.transformState();
    return {
      canvas: {
        width: this.canvasState.canvasWidth(),
        height: this.canvasState.canvasHeight(),
      },
      layers,
      layerBuffers: buffers,
      selectedLayerId: this.layerService.selectedLayerId(),
      selectedLayerIds: Array.from(this.layerService.selectedLayerIds()),
      selection: {
        rect: this.selectionService.selectionRect(),
        shape: this.selectionService.selectionShape(),
        polygon: this.selectionService.selectionPolygon(),
        mask: this.selectionService.selectionMask(),
      },
      frames: this.frameService.frames().map((f) => ({ ...f })),
      currentFrameIndex: this.frameService.currentFrameIndex(),
      animations: this.animationCollectionService
        .animations()
        .map((a) => ({ ...a })),
      currentAnimationIndex:
        this.animationCollectionService.currentAnimationIndex(),
      boneHierarchy: this.boneHierarchyService.bones().map((b) => ({ ...b })),
      selectedBoneId: this.boneHierarchyService.selectedBoneId(),
      bones: bonesData,
      keyframes: keyframeSnapshot.keyframes,
      pixelBindings: keyframeSnapshot.pixelBindings,
      animationCurrentTime: keyframeSnapshot.currentTime,
      animationDuration: keyframeSnapshot.animationDuration,
      timelineMode: keyframeSnapshot.timelineMode,
      toolSnapshot,
      freeTransformState: freeTransformState ? { ...freeTransformState } : null,
    };
  }

  private restoreSnapshot(snapshot: ProjectSnapshot) {
    if (!snapshot) return;

    this.canvasState.canvasWidth.set(snapshot.canvas.width);
    this.canvasState.canvasHeight.set(snapshot.canvas.height);

    this.layerService.layers.set(snapshot.layers.map((l: any) => ({ ...l })));

    const newBuffers = new Map<string, string[]>();
    for (const k of Object.keys(snapshot.layerBuffers)) {
      newBuffers.set(k, [...snapshot.layerBuffers[k]]);
    }
    this.canvasState.replaceAllBuffers(newBuffers);

    this.layerService.selectedLayerId.set(snapshot.selectedLayerId);
    this.layerService.selectedLayerIds.set(new Set(snapshot.selectedLayerIds));

    if (snapshot.selection) {
      this.selectionService.selectionRect.set(snapshot.selection.rect);
      this.selectionService.selectionShape.set(snapshot.selection.shape);
      this.selectionService.selectionPolygon.set(snapshot.selection.polygon);
      this.selectionService.selectionMask.set(snapshot.selection.mask);
    }

    this.frameService.frames.set(snapshot.frames.map((f: any) => ({ ...f })));
    this.frameService.currentFrameIndex.set(snapshot.currentFrameIndex);

    this.animationCollectionService.animations.set(
      snapshot.animations.map((a: any) => ({ ...a })),
    );
    this.animationCollectionService.currentAnimationIndex.set(
      snapshot.currentAnimationIndex,
    );

    this.boneHierarchyService.bones.set(
      snapshot.boneHierarchy.map((b: any) => ({ ...b })),
    );
    this.boneHierarchyService.selectedBoneId.set(snapshot.selectedBoneId);

    const bonesMap = new Map<string, any[]>();
    for (const frameId of Object.keys(snapshot.bones)) {
      bonesMap.set(
        frameId,
        snapshot.bones[frameId].map((b: any) => ({ ...b })),
      );
    }
    this.boneService.restore(bonesMap);

    this.keyframeService.restore({
      keyframes: snapshot.keyframes,
      pixelBindings: snapshot.pixelBindings,
      currentTime: snapshot.animationCurrentTime,
      animationDuration: snapshot.animationDuration,
      timelineMode: snapshot.timelineMode,
    });

    if (snapshot.toolSnapshot) {
      this.tools.applySnapshot(snapshot.toolSnapshot, {
        maxBrush: Math.max(snapshot.canvas.width, snapshot.canvas.height),
      });
    }

    if (snapshot.freeTransformState) {
      this.freeTransformService.transformState.set({
        ...snapshot.freeTransformState,
      });
    } else {
      this.freeTransformService.transformState.set(null);
    }

    this.canvasState.incrementPixelsVersion();
  }

  saveSnapshot(description?: string) {
    const snapshot = this.captureProjectSnapshot();
    this.projectStateService.setState(snapshot, description);
  }

  private saveSnapshotForUndo(description?: string) {
    this.saveSnapshot(description);
  }

  loadProjectFromLocalStorage(): Observable<boolean> {
    return this.projectService.loadProjectFromLocalStorage();
  }

  exportProjectSnapshot() {
    this.saveCurrentFrameState();
    return this.projectService.exportProjectSnapshot();
  }

  restoreProjectSnapshot(parsed: any): boolean {
    return this.projectService.restoreProjectSnapshot(parsed);
  }

  resetToNewProject(width = 64, height = 64) {
    this.canvasState.canvasWidth.set(Math.max(1, Math.floor(width)));
    this.canvasState.canvasHeight.set(Math.max(1, Math.floor(height)));
    this.layerService.resetLayers();
    const firstLayer = this.layerService.layers()[0];
    if (firstLayer) {
      this.canvasState.ensureLayerBuffer(
        firstLayer.id,
        this.canvasState.canvasWidth(),
        this.canvasState.canvasHeight(),
      );
    }
    this.selectionService.clearSelection();
    this.clearHistory();
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(true);
  }

  saveProjectToLocalStorage(): boolean {
    return this.projectService.saveProjectToLocalStorage();
  }

  selectLayer(id: string) {
    this.layerService.selectLayer(id);
  }

  toggleLayerSelection(id: string, multi = false) {
    this.layerService.toggleLayerSelection(id, multi);
  }

  selectLayerRange(fromId: string, toId: string) {
    this.layerService.selectLayerRange(fromId, toId);
  }

  setCurrentFrame(index: number) {
    this.frameService.setCurrentFrame(index);
  }

  setCanvasSize(width: number, height: number) {
    this.saveSnapshotForUndo('Resize canvas');
    this.canvasState.setCanvasSize(width, height);
    const layers = this.layerService.layers();
    for (const l of layers) {
      this.canvasState.ensureLayerBuffer(l.id, width, height);
    }
    this.canvasState.incrementPixelsVersion();
  }

  getLayerBuffer(layerId: string): string[] {
    return this.canvasState.getLayerBuffer(layerId);
  }

  getColorAt(x: number, y: number, layerId?: string): string | null {
    const id = layerId || this.selectedLayerId();
    if (!id) return null;

    const buffer = this.canvasState.getLayerBuffer(id);
    if (!buffer || buffer.length === 0) return null;

    const width = this.canvasWidth();
    const height = this.canvasHeight();

    if (x < 0 || x >= width || y < 0 || y >= height) return null;

    const idx = y * width + x;
    const color = buffer[idx];
    return color && color.length > 0 ? color : null;
  }

  setLayerBuffer(layerId: string, buffer: string[]): void {
    this.canvasState.setLayerBuffer(layerId, buffer);
  }

  ensureLayerBuffer(layerId: string, width: number, height: number) {
    this.canvasState.ensureLayerBuffer(layerId, width, height);
  }

  isPixelWithinSelection(
    x: number,
    y: number,
    rect: { x: number; y: number; width: number; height: number } | null,
    shape: 'rect' | 'ellipse' | 'lasso',
    poly: { x: number; y: number }[] | null,
  ): boolean {
    return this.selectionService.isPixelWithinSelection(
      x,
      y,
      rect,
      shape,
      poly,
    );
  }

  getFlattenedLayers(): LayerItem[] {
    return this.layerService.getFlattenedLayers();
  }

  findItemById(items: LayerTreeItem[], id: string): LayerTreeItem | null {
    return this.layerService.findItemById(items, id);
  }

  renameLayer(id: string, newName: string) {
    this.saveSnapshotForUndo('Rename layer');
    this.layerService.renameLayer(id, newName);
    this.canvasState.incrementPixelsVersion();
  }

  toggleGroupExpanded(id: string) {
    this.layerService.toggleGroupExpanded(id);
  }

  toggleLayerVisibility(id: string) {
    this.saveSnapshotForUndo('Toggle layer visibility');
    this.layerService.toggleLayerVisibility(id);
    this.canvasState.incrementPixelsVersion();
  }

  toggleLayerLock(id: string) {
    this.saveSnapshotForUndo('Toggle layer lock');
    this.layerService.toggleLayerLock(id);
  }

  removeLayer(id: string): boolean {
    this.saveSnapshotForUndo('Remove layer');
    const item = this.layerService.findItemById(this.layerService.layers(), id);
    const success = this.layerService.removeLayer(id);
    if (!success) return false;
    if (item && isLayer(item)) {
      this.canvasState.deleteLayerBuffer(id);
    } else if (item && isGroup(item)) {
      const groupLayerIds = this.layerService.getAllLayerIds([item]);
      for (const lid of groupLayerIds) {
        if (lid !== id) {
          this.canvasState.deleteLayerBuffer(lid);
        }
      }
    }
    this.canvasState.incrementPixelsVersion();
    return true;
  }

  addLayer(name?: string) {
    this.saveSnapshotForUndo('Add layer');
    const item = this.layerService.addLayer(name);
    this.canvasState.ensureLayerBuffer(
      item.id,
      this.canvasState.canvasWidth(),
      this.canvasState.canvasHeight(),
    );
    return item;
  }

  reorderLayers(fromIndex: number, toIndex: number) {
    this.saveSnapshotForUndo('Reorder layers');
    const success = this.layerService.reorderLayers(fromIndex, toIndex);
    if (!success) return false;
    return true;
  }

  duplicateLayer(layerId?: string): LayerItem | null {
    const id = layerId || this.layerService.selectedLayerId();
    const item = this.layerService.findItemById(this.layerService.layers(), id);
    if (!item || !isLayer(item)) return null;
    this.saveSnapshotForUndo('Duplicate layer');
    const newLayerId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer: LayerItem = {
      id: newLayerId,
      name: `${item.name} copy`,
      visible: item.visible,
      locked: item.locked,
      type: 'layer',
    };
    const sourceBuf = this.canvasState.getLayerBuffer(id);
    if (sourceBuf && sourceBuf.length > 0) {
      this.canvasState.setLayerBuffer(newLayerId, sourceBuf.slice());
    } else {
      this.canvasState.ensureLayerBuffer(
        newLayerId,
        this.canvasState.canvasWidth(),
        this.canvasState.canvasHeight(),
      );
    }
    this.layerService.layers.update((arr) => [newLayer, ...arr]);
    this.layerService.selectedLayerId.set(newLayerId);
    this.layerService.selectedLayerIds.set(new Set([newLayerId]));
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return newLayer;
  }

  selectPixelForLayer(layerId?: string) {
    const id = layerId || this.layerService.selectedLayerId();
    const buf = this.canvasState.getLayerBuffer(id);
    if (!buf || buf.length === 0) return;
    const w = this.canvasState.canvasWidth();
    const h = this.canvasState.canvasHeight();
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const pixel = buf[idx];
        if (pixel && pixel.length > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (minX > maxX || minY > maxY) {
      return;
    }
    this.saveSnapshotForUndo('Select pixels');
    this.selectionService.selectionRect.set({
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
    this.selectionService.selectionShape.set('rect');
    this.selectionService.selectionPolygon.set(null);
    this.selectionService.selectionMask.set(null);
  }

  mergeLayers(layerIds: string[]): LayerItem | null {
    if (layerIds.length < 2) return null;
    this.saveSnapshotForUndo('Merge layers');
    const w = this.canvasState.canvasWidth();
    const h = this.canvasState.canvasHeight();
    const mergedBuf = new Array<string>(w * h).fill('');
    const flatLayers = this.layerService.getFlattenedLayers();
    const layerSet = new Set(layerIds);
    const selectedLayers = flatLayers.filter((l) => layerSet.has(l.id));
    for (let li = selectedLayers.length - 1; li >= 0; li--) {
      const layer = selectedLayers[li];
      const buf = this.canvasState.getLayerBuffer(layer.id);
      if (!buf || buf.length !== w * h) continue;
      for (let idx = 0; idx < w * h; idx++) {
        const pixel = buf[idx];
        if (pixel && pixel.length > 0) {
          mergedBuf[idx] = pixel;
        }
      }
    }
    const newLayerId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer: LayerItem = {
      id: newLayerId,
      name: 'Merged layer',
      visible: true,
      locked: false,
      type: 'layer',
    };
    let updatedLayers = this.layerService.layers();
    for (const lid of layerIds) {
      updatedLayers = this.layerService.removeItemById(updatedLayers, lid);
      this.canvasState.deleteLayerBuffer(lid);
    }
    updatedLayers = [newLayer, ...updatedLayers];
    this.layerService.layers.set(updatedLayers);
    this.canvasState.setLayerBuffer(newLayerId, mergedBuf);
    this.layerService.selectedLayerId.set(newLayerId);
    this.layerService.selectedLayerIds.set(new Set([newLayerId]));
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return newLayer;
  }

  groupLayers(layerIds: string[]): GroupItem | null {
    this.saveSnapshotForUndo('Group layers');
    const group = this.layerService.groupLayers(layerIds);
    if (!group) return null;
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return group;
  }

  ungroupLayers(groupId: string): boolean {
    this.saveSnapshotForUndo('Ungroup layers');
    const success = this.layerService.ungroupLayers(groupId);
    if (!success) return false;
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  insertImageAsLayer(
    imageFile: File,
    targetWidth?: number,
    targetHeight?: number,
  ): Observable<{
    layerId: string;
    bounds: { x: number; y: number; width: number; height: number };
  } | null> {
    return this.loadImage(imageFile).pipe(
      map((img) => {
        const finalWidth =
          targetWidth && targetWidth > 0 ? targetWidth : img.width;
        const finalHeight =
          targetHeight && targetHeight > 0 ? targetHeight : img.height;
        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
        const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
        const layerName =
          imageFile.name.replace(/\.[^.]+$/, '') ||
          `Inserted Image ${this.layerService.layers().length + 1}`;
        const newLayer = this.addLayer(layerName);
        const canvasWidth = this.canvasState.canvasWidth();
        const canvasHeight = this.canvasState.canvasHeight();
        const startX = 0;
        const startY = 0;
        const buf = this.canvasState.getLayerBuffer(newLayer.id);
        if (!buf || buf.length === 0) return null;
        for (let y = 0; y < finalHeight; y++) {
          for (let x = 0; x < finalWidth; x++) {
            const px = startX + x;
            const py = startY + y;
            if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight)
              continue;
            const srcIdx = (y * finalWidth + x) * 4;
            const r = imageData.data[srcIdx];
            const g = imageData.data[srcIdx + 1];
            const b = imageData.data[srcIdx + 2];
            const a = imageData.data[srcIdx + 3] / 255;
            if (a <= 0) continue;
            const color =
              a >= 1
                ? `rgb(${r},${g},${b})`
                : `rgba(${r},${g},${b},${a.toFixed(3)})`;
            const idx = py * canvasWidth + px;
            buf[idx] = color;
          }
        }
        this.canvasState.incrementPixelsVersion();
        this.canvasState.setCanvasSaved(false);
        const bounds = {
          x: startX,
          y: startY,
          width: Math.min(finalWidth, canvasWidth - startX),
          height: Math.min(finalHeight, canvasHeight - startY),
        };
        this.selectionService.selectionRect.set(bounds);
        this.selectionService.selectionShape.set('rect');
        this.selectionService.selectionPolygon.set(null);
        return { layerId: newLayer.id, bounds };
      }),
      catchError((error) => {
        console.error('Failed to insert image as layer:', error);
        return of(null);
      }),
    );
  }

  private loadImage(file: File): Observable<HTMLImageElement> {
    return new Observable<HTMLImageElement>((observer) => {
      const img = new Image();
      img.onload = () => {
        observer.next(img);
        observer.complete();
      };
      img.onerror = (err) => observer.error(err);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.onerror = (err) => observer.error(err);
      reader.readAsDataURL(file);
    });
  }

  applyBrushToLayer(
    layerId: string,
    x: number,
    y: number,
    brushSize: number,
    color: string | null,
    options?: { eraserStrength?: number },
  ) {
    return this.drawingService.applyBrushToLayer(
      layerId,
      x,
      y,
      brushSize,
      color,
      options,
    );
  }

  applyFillToLayer(
    layerId: string,
    x: number,
    y: number,
    color: string | null,
  ) {
    return this.drawingService.applyFillToLayer(layerId, x, y, color);
  }

  applyGradientFillToLayer(
    layerId: string,
    x: number,
    y: number,
    gradientStartColor: string,
    gradientEndColor: string,
    gradientType: GradientType,
    gradientAngle: number,
  ) {
    return this.drawingService.applyGradientFillToLayer(
      layerId,
      x,
      y,
      gradientStartColor,
      gradientEndColor,
      gradientType,
      gradientAngle,
    );
  }

  applyLineToLayer(
    layerId: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    thickness: number,
  ) {
    return this.drawingService.applyLineToLayer(
      layerId,
      x0,
      y0,
      x1,
      y1,
      color,
      thickness,
    );
  }

  applySquareToLayer(
    layerId: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    options: ShapeDrawOptions,
    constrainToSquare = true,
  ) {
    return this.drawingService.applySquareToLayer(
      layerId,
      x0,
      y0,
      x1,
      y1,
      options,
      constrainToSquare,
    );
  }

  applyCircleToLayer(
    layerId: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    options: ShapeDrawOptions,
    constrainToCircle = true,
  ) {
    return this.drawingService.applyCircleToLayer(
      layerId,
      x0,
      y0,
      x1,
      y1,
      options,
      constrainToCircle,
    );
  }

  beginSelection(
    x: number,
    y: number,
    shape: 'rect' | 'ellipse' | 'lasso' = 'rect',
  ) {
    this.saveSnapshotForUndo('Create selection');
    this.selectionService.beginSelection(x, y, shape);
  }

  addLassoPoint(x: number, y: number) {
    this.selectionService.addLassoPoint(x, y);
  }

  updateSelection(x: number, y: number) {
    this.selectionService.updateSelection(x, y);
  }

  endSelection() {}

  clearSelection() {
    const prev = this.selectionService.getSelectionSnapshot();
    if (!prev.rect) return;
    this.saveSnapshotForUndo('Clear selection');
    this.selectionService.clearSelection();
  }

  moveSelection(dx: number, dy: number) {
    this.selectionService.moveSelection(
      dx,
      dy,
      this.canvasState.canvasWidth(),
      this.canvasState.canvasHeight(),
    );
  }

  updateSelectionBounds(x: number, y: number, width: number, height: number) {
    const sel = this.selectionService.selectionRect();
    if (!sel) return;
    this.selectionService.selectionRect.set({
      x: Math.max(0, Math.floor(x)),
      y: Math.max(0, Math.floor(y)),
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
    });
  }

  beginMoveSelection(description?: string) {
    this.saveSnapshotForUndo(description || 'Move selection');
  }

  endMoveSelection(_description?: string) {}

  invertSelection() {
    this.saveSnapshotForUndo('Invert selection');
    this.selectionService.invertSelection(
      this.canvasState.canvasWidth(),
      this.canvasState.canvasHeight(),
    );
  }

  growSelection(pixels: number) {
    this.saveSnapshotForUndo('Grow selection');
    this.selectionService.growSelection(
      pixels,
      this.canvasState.canvasWidth(),
      this.canvasState.canvasHeight(),
    );
  }

  makeCopyLayer() {
    const sel = this.selectionService.selectionRect();
    if (!sel) return null;
    const shape = this.selectionService.selectionShape();
    const poly = this.selectionService.selectionPolygon();
    const sourceLayerId = this.layerService.selectedLayerId();
    const sourceBuf = this.canvasState.getLayerBuffer(sourceLayerId);
    if (!sourceBuf || sourceBuf.length === 0) return null;
    const w = this.canvasState.canvasWidth();
    const h = this.canvasState.canvasHeight();
    this.saveSnapshotForUndo('Copy selection to layer');
    const sourceItem = this.layerService.findItemById(
      this.layerService.layers(),
      sourceLayerId,
    );
    const newName = sourceItem ? `${sourceItem.name}-copy` : 'Layer copy';
    const newLayerId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer: LayerItem = {
      id: newLayerId,
      name: newName,
      visible: true,
      locked: false,
      type: 'layer',
    };
    const newBuf = new Array<string>(w * h).fill('');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (
          this.selectionService.isPixelWithinSelection(x, y, sel, shape, poly)
        ) {
          const idx = y * w + x;
          newBuf[idx] = sourceBuf[idx] || '';
        }
      }
    }
    const currentLayers = this.layerService.layers();
    const sourceIndex = currentLayers.findIndex((l) => l.id === sourceLayerId);
    if (sourceIndex >= 0) {
      this.layerService.layers.update((arr) => [
        ...arr.slice(0, sourceIndex),
        newLayer,
        ...arr.slice(sourceIndex),
      ]);
    } else {
      this.layerService.layers.update((arr) => [newLayer, ...arr]);
    }
    this.canvasState.setLayerBuffer(newLayerId, newBuf);
    this.layerService.selectedLayerId.set(newLayerId);
    this.canvasState.incrementPixelsVersion();
    return newLayer;
  }

  mergeVisibleToNewLayer() {
    const sel = this.selectionService.selectionRect();
    if (!sel) return null;
    const shape = this.selectionService.selectionShape();
    const poly = this.selectionService.selectionPolygon();
    const w = this.canvasState.canvasWidth();
    const h = this.canvasState.canvasHeight();
    this.saveSnapshotForUndo('Merge visible layers');
    const mergedBuf = new Array<string>(w * h).fill('');
    const layers = this.layerService.layers();
    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      if (!layer.visible) continue;
      const buf = this.canvasState.getLayerBuffer(layer.id);
      if (!buf || buf.length !== w * h) continue;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (
            !this.selectionService.isPixelWithinSelection(
              x,
              y,
              sel,
              shape,
              poly,
            )
          )
            continue;
          const idx = y * w + x;
          const pixel = buf[idx];
          if (pixel && pixel.length > 0) {
            const existing = mergedBuf[idx];
            if (!existing || existing.length === 0) {
              mergedBuf[idx] = pixel;
            } else {
              mergedBuf[idx] = pixel;
            }
          }
        }
      }
    }
    const newLayerId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer: LayerItem = {
      id: newLayerId,
      name: 'Merged layer',
      visible: true,
      locked: false,
      type: 'layer',
    };
    this.layerService.layers.update((arr) => [newLayer, ...arr]);
    this.canvasState.setLayerBuffer(newLayerId, mergedBuf);
    this.layerService.selectedLayerId.set(newLayerId);
    this.canvasState.incrementPixelsVersion();
    return newLayer;
  }

  canUndo(): boolean {
    return this.historyService.canUndo();
  }

  canRedo(): boolean {
    return this.historyService.canRedo();
  }

  undo() {
    if (!this.canUndo()) return false;
    const currentState = this.captureProjectSnapshot();
    const entry = this.historyService.popUndo();
    if (!entry) return false;
    this.historyService.pushToRedoStack(currentState);
    this.restoreSnapshot(entry.snapshot);
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const currentState = this.captureProjectSnapshot();
    const entry = this.historyService.popRedo();
    if (!entry) return false;
    this.historyService.pushToUndoStack(currentState);
    this.restoreSnapshot(entry.snapshot);
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  clearHistory() {
    this.historyService.clearHistory();
  }

  addFrame(): FrameItem {
    const layers = this.layerService.layers();
    const buffers: Record<string, string[]> = {};
    for (const [id, buf] of this.canvasState.getAllBuffers().entries()) {
      buffers[id] = buf.slice();
    }
    return this.frameService.addFrame(undefined, layers, buffers);
  }

  removeFrame(id: string): boolean {
    return this.frameService.removeFrame(id);
  }

  duplicateFrame(id: string): FrameItem | null {
    return this.frameService.duplicateFrame(id);
  }

  updateFrameDuration(id: string, duration: number): boolean {
    return this.frameService.updateFrameDuration(id, duration);
  }

  saveCurrentFrameState() {
    const currentFrame = this.frames()[this.currentFrameIndex()];
    if (!currentFrame) return;
    this.saveFrameStateById(currentFrame.id);
  }

  private saveFrameStateById(frameId: string) {
    const layers = this.layerService.layers();
    const buffers: Record<string, string[]> = {};
    for (const [id, buf] of this.canvasState.getAllBuffers().entries()) {
      buffers[id] = buf.slice();
    }

    this.frameService.saveFrameState(frameId, layers, buffers);
  }

  loadFrameState(frameIndex: number) {
    const frame = this.frames()[frameIndex];
    if (!frame) return;

    if (frame.layers && frame.buffers) {
      this.layerService.layers.set(structuredClone(frame.layers));

      const newBuffers = new Map<string, string[]>();
      for (const [key, value] of Object.entries(frame.buffers)) {
        newBuffers.set(key, [...value]);
      }
      this.canvasState.replaceAllBuffers(newBuffers);
      this.layerService.ensureValidSelection();
      this.canvasState.incrementPixelsVersion();
    }

    this.frameService.setCurrentFrame(frameIndex);
  }

  playAnimation() {
    this.animationService.play();
  }

  stopAnimation() {
    this.animationService.stop();
  }

  setAnimationFps(fps: number) {
    this.animationService.setFps(fps);
  }

  setCanvasSaved(saved: boolean) {
    this.canvasState.setCanvasSaved(saved);
  }

  getCurrentAnimation(): AnimationItem | null {
    return this.animationCollectionService.getCurrentAnimation();
  }

  setCurrentAnimation(index: number) {
    this.animationCollectionService.setCurrentAnimation(index);
  }

  addAnimation(name?: string): AnimationItem {
    this.saveSnapshotForUndo('Add animation');
    return this.animationCollectionService.addAnimation(name);
  }

  removeAnimation(id: string): boolean {
    this.saveSnapshotForUndo('Remove animation');
    return this.animationCollectionService.removeAnimation(id);
  }

  renameAnimation(id: string, newName: string): boolean {
    this.saveSnapshotForUndo('Rename animation');
    return this.animationCollectionService.renameAnimation(id, newName);
  }

  reorderAnimations(fromIndex: number, toIndex: number): boolean {
    this.saveSnapshotForUndo('Reorder animations');
    return this.animationCollectionService.reorderAnimations(
      fromIndex,
      toIndex,
    );
  }

  attachBoneToAnimation(animationId: string, boneId: string): boolean {
    this.saveSnapshotForUndo('Attach bone to animation');
    return this.animationCollectionService.attachBone(animationId, boneId);
  }

  detachBoneFromAnimation(animationId: string, boneId: string): boolean {
    this.saveSnapshotForUndo('Detach bone from animation');
    return this.animationCollectionService.detachBone(animationId, boneId);
  }

  addFrameToAnimation(animationId: string, name?: string): FrameItem | null {
    this.saveSnapshotForUndo('Add frame to animation');
    return this.animationCollectionService.addFrameToAnimation(
      animationId,
      name,
    );
  }

  removeFrameFromAnimation(animationId: string, frameId: string): boolean {
    this.saveSnapshotForUndo('Remove frame from animation');
    return this.animationCollectionService.removeFrameFromAnimation(
      animationId,
      frameId,
    );
  }

  validateAnimationName(name: string): boolean {
    return this.animationCollectionService.validateAnimationName(name);
  }

  addBone(
    name?: string,
    parentId: string | null = null,
    x = 0,
    y = 0,
  ): BoneItem {
    this.saveSnapshotForUndo('Add bone');
    return this.boneHierarchyService.addBone(name, parentId, x, y);
  }

  removeBone(id: string): boolean {
    this.saveSnapshotForUndo('Remove bone');
    return this.boneHierarchyService.removeBone(id);
  }

  renameBone(id: string, newName: string): boolean {
    this.saveSnapshotForUndo('Rename bone');
    return this.boneHierarchyService.renameBone(id, newName);
  }

  updateBone(id: string, updates: Partial<Omit<BoneItem, 'id'>>): boolean {
    this.saveSnapshotForUndo('Update bone');
    return this.boneHierarchyService.updateBone(id, updates);
  }

  selectBone(id: string) {
    this.boneHierarchyService.selectBone(id);
  }

  getBone(id: string): BoneItem | null {
    return this.boneHierarchyService.getBone(id);
  }

  getChildBones(parentId: string): BoneItem[] {
    return this.boneHierarchyService.getChildBones(parentId);
  }

  exportAnimationAsSpriteSheet(
    animation: AnimationItem,
    options?: { padding: number; columns: number; backgroundColor?: string },
  ): Observable<Blob | null> {
    return this.exportService.exportAnimationAsSpriteSheet(animation, options);
  }

  exportAnimationAsPackage(
    animation: AnimationItem,
  ): Observable<{ files: Map<string, Blob>; metadata: string } | null> {
    return this.exportService.exportAnimationAsPackage(animation);
  }

  copySelection(): boolean {
    return this.clipboardService.copy();
  }

  copyMerged(): boolean {
    return this.clipboardService.copyMerged();
  }

  cutSelection(): boolean {
    this.saveSnapshotForUndo('Cut');
    return this.clipboardService.cut();
  }

  pasteClipboard(): LayerItem | null {
    this.saveSnapshotForUndo('Paste');
    const result = this.clipboardService.paste();
    if (result) {
      this.canvasState.setCanvasSaved(false);
    }
    return result;
  }

  pasteInPlace(): LayerItem | null {
    this.saveSnapshotForUndo('Paste in place');
    const result = this.clipboardService.pasteInPlace();
    if (result) {
      this.canvasState.setCanvasSaved(false);
    }
    return result;
  }

  pasteInto(): LayerItem | null {
    this.saveSnapshotForUndo('Paste into');
    const result = this.clipboardService.pasteInto();
    if (result) {
      this.canvasState.setCanvasSaved(false);
    }
    return result;
  }

  clearSelectionContent(): boolean {
    this.saveSnapshotForUndo('Clear');
    const result = this.clipboardService.clear();
    if (result) {
      this.canvasState.setCanvasSaved(false);
    }
    return result;
  }

  hasClipboard(): boolean {
    return this.clipboardService.hasClipboard();
  }

  private getSelectionBuffer(): {
    buffer: string[];
    width: number;
    height: number;
    x: number;
    y: number;
  } | null {
    const sel = this.selectionService.selectionRect();
    if (!sel) return null;

    const shape = this.selectionService.selectionShape();
    const poly = this.selectionService.selectionPolygon();
    const layerId = this.selectedLayerId();
    const sourceBuf = this.canvasState.getLayerBuffer(layerId);
    if (!sourceBuf || sourceBuf.length === 0) return null;

    const canvasWidth = this.canvasWidth();
    const canvasHeight = this.canvasHeight();
    const buffer = new Array<string>(sel.width * sel.height).fill('');

    for (let y = 0; y < sel.height; y++) {
      for (let x = 0; x < sel.width; x++) {
        const srcX = sel.x + x;
        const srcY = sel.y + y;
        if (srcX < 0 || srcX >= canvasWidth || srcY < 0 || srcY >= canvasHeight)
          continue;

        if (
          this.selectionService.isPixelWithinSelection(
            srcX,
            srcY,
            sel,
            shape,
            poly,
          )
        ) {
          const srcIdx = srcY * canvasWidth + srcX;
          const dstIdx = y * sel.width + x;
          buffer[dstIdx] = sourceBuf[srcIdx] || '';
        }
      }
    }

    return {
      buffer,
      width: sel.width,
      height: sel.height,
      x: sel.x,
      y: sel.y,
    };
  }

  private applySelectionBuffer(
    buffer: string[],
    width: number,
    height: number,
    x: number,
    y: number,
    clearOriginal = true,
  ): boolean {
    const sel = this.selectionService.selectionRect();
    if (!sel && !clearOriginal) return false;

    const layerId = this.selectedLayerId();
    const targetBuf = this.canvasState.getLayerBuffer(layerId);
    if (!targetBuf || targetBuf.length === 0) return false;

    const canvasWidth = this.canvasWidth();
    const canvasHeight = this.canvasHeight();

    if (clearOriginal && sel) {
      const shape = this.selectionService.selectionShape();
      const poly = this.selectionService.selectionPolygon();

      for (let cy = 0; cy < sel.height; cy++) {
        for (let cx = 0; cx < sel.width; cx++) {
          const px = sel.x + cx;
          const py = sel.y + cy;
          if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight)
            continue;

          if (
            this.selectionService.isPixelWithinSelection(
              px,
              py,
              sel,
              shape,
              poly,
            )
          ) {
            const idx = py * canvasWidth + px;
            targetBuf[idx] = '';
          }
        }
      }
    }

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const destX = x + dx;
        const destY = y + dy;
        if (
          destX < 0 ||
          destX >= canvasWidth ||
          destY < 0 ||
          destY >= canvasHeight
        )
          continue;

        const srcIdx = dy * width + dx;
        const destIdx = destY * canvasWidth + destX;
        const pixel = buffer[srcIdx];
        if (pixel) {
          targetBuf[destIdx] = pixel;
        }
      }
    }

    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  flipLayerHorizontal(layerId?: string): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Flip horizontal (selection)');

      const flipped = this.transformService.applySimpleFlipHorizontal(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
      );

      return this.applySelectionBuffer(
        flipped,
        selBuf.width,
        selBuf.height,
        selBuf.x,
        selBuf.y,
        true,
      );
    }

    const targetId = layerId || this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Flip horizontal');

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const flipped = this.transformService.applySimpleFlipHorizontal(
      buffer,
      width,
      height,
    );

    this.canvasState.setLayerBuffer(targetId, flipped);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  flipLayerVertical(layerId?: string): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Flip vertical (selection)');

      const flipped = this.transformService.applySimpleFlipVertical(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
      );

      return this.applySelectionBuffer(
        flipped,
        selBuf.width,
        selBuf.height,
        selBuf.x,
        selBuf.y,
        true,
      );
    }

    const targetId = layerId || this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Flip vertical');

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const flipped = this.transformService.applySimpleFlipVertical(
      buffer,
      width,
      height,
    );

    this.canvasState.setLayerBuffer(targetId, flipped);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  rotateLayer90CW(layerId?: string): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Rotate 90° CW (selection)');

      const result = this.transformService.applyRotate90CW(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
      );

      const newX = Math.max(
        0,
        Math.min(this.canvasWidth() - result.width, selBuf.x),
      );
      const newY = Math.max(
        0,
        Math.min(this.canvasHeight() - result.height, selBuf.y),
      );

      this.applySelectionBuffer(
        result.buffer,
        result.width,
        result.height,
        newX,
        newY,
        true,
      );

      this.selectionService.selectionRect.set({
        x: newX,
        y: newY,
        width: result.width,
        height: result.height,
      });

      return true;
    }

    const targetId = layerId || this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Rotate 90° CW');

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const result = this.transformService.applyRotate90CW(buffer, width, height);

    this.canvasState.setCanvasSize(result.width, result.height);
    this.canvasState.setLayerBuffer(targetId, result.buffer);

    for (const layer of this.layerService.getFlattenedLayers()) {
      if (layer.id !== targetId) {
        this.canvasState.ensureLayerBuffer(
          layer.id,
          result.width,
          result.height,
        );
      }
    }

    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  rotateLayer90CCW(layerId?: string): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Rotate 90° CCW (selection)');

      const result = this.transformService.applyRotate90CCW(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
      );

      const newX = Math.max(
        0,
        Math.min(this.canvasWidth() - result.width, selBuf.x),
      );
      const newY = Math.max(
        0,
        Math.min(this.canvasHeight() - result.height, selBuf.y),
      );

      this.applySelectionBuffer(
        result.buffer,
        result.width,
        result.height,
        newX,
        newY,
        true,
      );

      this.selectionService.selectionRect.set({
        x: newX,
        y: newY,
        width: result.width,
        height: result.height,
      });

      return true;
    }

    const targetId = layerId || this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Rotate 90° CCW');

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const result = this.transformService.applyRotate90CCW(
      buffer,
      width,
      height,
    );

    this.canvasState.setCanvasSize(result.width, result.height);
    this.canvasState.setLayerBuffer(targetId, result.buffer);

    for (const layer of this.layerService.getFlattenedLayers()) {
      if (layer.id !== targetId) {
        this.canvasState.ensureLayerBuffer(
          layer.id,
          result.width,
          result.height,
        );
      }
    }

    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  rotateLayer180(layerId?: string): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Rotate 180° (selection)');

      const rotated = this.transformService.applyRotate180(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
      );

      return this.applySelectionBuffer(
        rotated,
        selBuf.width,
        selBuf.height,
        selBuf.x,
        selBuf.y,
        true,
      );
    }

    const targetId = layerId || this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Rotate 180°');

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const rotated = this.transformService.applyRotate180(buffer, width, height);

    this.canvasState.setLayerBuffer(targetId, rotated);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  scaleSelectionOrLayer(scaleX: number, scaleY: number): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Scale (selection)');

      const result = this.transformService.applyScale(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
        scaleX,
        scaleY,
      );

      const centerX = selBuf.x + selBuf.width / 2;
      const centerY = selBuf.y + selBuf.height / 2;

      const newX = Math.max(
        0,
        Math.min(
          this.canvasWidth() - result.width,
          Math.round(centerX - result.width / 2),
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          this.canvasHeight() - result.height,
          Math.round(centerY - result.height / 2),
        ),
      );

      this.applySelectionBuffer(
        result.buffer,
        result.width,
        result.height,
        newX,
        newY,
        true,
      );

      this.selectionService.selectionRect.set({
        x: newX,
        y: newY,
        width: result.width,
        height: result.height,
      });

      return true;
    }

    const targetId = this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Scale');

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const result = this.transformService.applyScale(
      buffer,
      width,
      height,
      scaleX,
      scaleY,
    );

    if (result.width !== width || result.height !== height) {
      this.canvasState.setCanvasSize(result.width, result.height);

      for (const layer of this.layerService.getFlattenedLayers()) {
        if (layer.id !== targetId) {
          this.canvasState.ensureLayerBuffer(
            layer.id,
            result.width,
            result.height,
          );
        }
      }
    }

    this.canvasState.setLayerBuffer(targetId, result.buffer);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  rotateSelectionOrLayer(angleDegrees: number): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Rotate (selection)');

      const result = this.transformService.applyRotateByAngle(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
        angleDegrees,
      );

      const centerX = selBuf.x + selBuf.width / 2;
      const centerY = selBuf.y + selBuf.height / 2;

      const newX = Math.max(
        0,
        Math.min(
          this.canvasWidth() - result.width,
          Math.round(centerX - result.width / 2),
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          this.canvasHeight() - result.height,
          Math.round(centerY - result.height / 2),
        ),
      );

      this.applySelectionBuffer(
        result.buffer,
        result.width,
        result.height,
        newX,
        newY,
        true,
      );

      this.selectionService.selectionRect.set({
        x: newX,
        y: newY,
        width: result.width,
        height: result.height,
      });

      return true;
    }

    const targetId = this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Rotate');

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const result = this.transformService.applyRotateByAngle(
      buffer,
      width,
      height,
      angleDegrees,
    );

    if (result.width !== width || result.height !== height) {
      this.canvasState.setCanvasSize(result.width, result.height);

      for (const layer of this.layerService.getFlattenedLayers()) {
        if (layer.id !== targetId) {
          this.canvasState.ensureLayerBuffer(
            layer.id,
            result.width,
            result.height,
          );
        }
      }
    }

    this.canvasState.setLayerBuffer(targetId, result.buffer);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  skewSelectionOrLayer(skewXDegrees: number, skewYDegrees: number): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Skew (selection)');

      const result = this.transformService.applySkew(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
        skewXDegrees,
        skewYDegrees,
      );

      const newLayer = this.layerService.addLayer('Skewed Layer');

      const canvasW = this.canvasWidth();
      const canvasH = this.canvasHeight();

      this.canvasState.ensureLayerBuffer(newLayer.id, canvasW, canvasH);

      const centerX = selBuf.x + selBuf.width / 2;
      const centerY = selBuf.y + selBuf.height / 2;

      const newX = Math.max(
        0,
        Math.min(
          canvasW - result.width,
          Math.round(centerX - result.width / 2),
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          canvasH - result.height,
          Math.round(centerY - result.height / 2),
        ),
      );

      const layerBuf = this.canvasState.getLayerBuffer(newLayer.id);
      if (layerBuf) {
        for (let y = 0; y < result.height; y++) {
          for (let x = 0; x < result.width; x++) {
            const srcIdx = y * result.width + x;
            const color = result.buffer[srcIdx];
            if (color) {
              const destX = newX + x;
              const destY = newY + y;
              if (
                destX >= 0 &&
                destX < canvasW &&
                destY >= 0 &&
                destY < canvasH
              ) {
                const destIdx = destY * canvasW + destX;
                layerBuf[destIdx] = color;
              }
            }
          }
        }
      }

      this.canvasState.setLayerBuffer(newLayer.id, layerBuf || []);
      this.canvasState.incrementPixelsVersion();
      this.canvasState.setCanvasSaved(false);
      return true;
    }

    const targetId = this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Skew');

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const result = this.transformService.applySkew(
      buffer,
      width,
      height,
      skewXDegrees,
      skewYDegrees,
    );

    const newLayer = this.layerService.addLayer('Skewed Layer');

    if (result.width !== width || result.height !== height) {
      this.canvasState.setCanvasSize(result.width, result.height);

      for (const layer of this.layerService.getFlattenedLayers()) {
        if (layer.id !== newLayer.id) {
          this.canvasState.ensureLayerBuffer(
            layer.id,
            result.width,
            result.height,
          );
        }
      }
    }

    this.canvasState.ensureLayerBuffer(
      newLayer.id,
      result.width,
      result.height,
    );
    this.canvasState.setLayerBuffer(newLayer.id, result.buffer);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  applyContentAwareScale(
    targetWidth: number,
    targetHeight: number,
    protectImportantAreas: boolean,
  ): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Content-Aware Scale (selection)');

      const originalLayerId = this.selectedLayerId();
      const canvasWidth = this.canvasWidth();
      const canvasHeight = this.canvasHeight();

      const hiddenLayer = this.layerService.addLayer('Original Selection');
      this.layerService.toggleLayerVisibility(hiddenLayer.id);

      this.canvasState.ensureLayerBuffer(
        hiddenLayer.id,
        canvasWidth,
        canvasHeight,
      );
      const hiddenLayerBuf = this.canvasState.getLayerBuffer(hiddenLayer.id);
      if (hiddenLayerBuf) {
        for (let y = 0; y < selBuf.height; y++) {
          for (let x = 0; x < selBuf.width; x++) {
            const srcIdx = y * selBuf.width + x;
            const color = selBuf.buffer[srcIdx];
            if (color) {
              const destX = selBuf.x + x;
              const destY = selBuf.y + y;
              if (
                destX >= 0 &&
                destX < canvasWidth &&
                destY >= 0 &&
                destY < canvasHeight
              ) {
                const destIdx = destY * canvasWidth + destX;
                hiddenLayerBuf[destIdx] = color;
              }
            }
          }
        }
        this.canvasState.setLayerBuffer(hiddenLayer.id, hiddenLayerBuf);
      }

      const canvas = document.createElement('canvas');
      canvas.width = selBuf.width;
      canvas.height = selBuf.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const imgData = ctx.createImageData(selBuf.width, selBuf.height);
      for (let i = 0; i < selBuf.buffer.length; i++) {
        const colorStr = selBuf.buffer[i];
        if (colorStr) {
          const r = parseInt(colorStr.slice(1, 3), 16);
          const g = parseInt(colorStr.slice(3, 5), 16);
          const b = parseInt(colorStr.slice(5, 7), 16);
          const a = parseInt(colorStr.slice(7, 9), 16);
          imgData.data[i * 4] = r;
          imgData.data[i * 4 + 1] = g;
          imgData.data[i * 4 + 2] = b;
          imgData.data[i * 4 + 3] = a;
        }
      }

      const importanceMap = protectImportantAreas
        ? this.detectImportantAreas(imgData)
        : undefined;

      const scaled = this.contentAwareScaleService.contentAwareScale(
        imgData,
        targetWidth,
        targetHeight,
        importanceMap,
      );

      const resultBuffer: string[] = new Array(targetWidth * targetHeight).fill(
        '',
      );
      for (let i = 0; i < resultBuffer.length; i++) {
        const r = scaled.data[i * 4];
        const g = scaled.data[i * 4 + 1];
        const b = scaled.data[i * 4 + 2];
        const a = scaled.data[i * 4 + 3];
        if (a > 0) {
          resultBuffer[i] =
            `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
        }
      }

      const transformedLayer = this.layerService.addLayer(
        'Content-Aware Scaled',
      );
      this.canvasState.ensureLayerBuffer(
        transformedLayer.id,
        canvasWidth,
        canvasHeight,
      );

      const centerX = selBuf.x + selBuf.width / 2;
      const centerY = selBuf.y + selBuf.height / 2;

      const newX = Math.max(
        0,
        Math.min(
          canvasWidth - targetWidth,
          Math.round(centerX - targetWidth / 2),
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          canvasHeight - targetHeight,
          Math.round(centerY - targetHeight / 2),
        ),
      );

      const transformedLayerBuf = this.canvasState.getLayerBuffer(
        transformedLayer.id,
      );
      if (transformedLayerBuf) {
        for (let y = 0; y < targetHeight; y++) {
          for (let x = 0; x < targetWidth; x++) {
            const srcIdx = y * targetWidth + x;
            const color = resultBuffer[srcIdx];
            if (color) {
              const destX = newX + x;
              const destY = newY + y;
              if (
                destX >= 0 &&
                destX < canvasWidth &&
                destY >= 0 &&
                destY < canvasHeight
              ) {
                const destIdx = destY * canvasWidth + destX;
                transformedLayerBuf[destIdx] = color;
              }
            }
          }
        }
        this.canvasState.setLayerBuffer(
          transformedLayer.id,
          transformedLayerBuf,
        );
      }

      if (originalLayerId) {
        this.layerService.selectLayer(originalLayerId);
        const originalBuf = this.canvasState.getLayerBuffer(originalLayerId);
        if (originalBuf) {
          const shape = this.selectionService.selectionShape();
          const poly = this.selectionService.selectionPolygon();

          for (let cy = 0; cy < sel.height; cy++) {
            for (let cx = 0; cx < sel.width; cx++) {
              const px = sel.x + cx;
              const py = sel.y + cy;
              if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight)
                continue;

              if (
                this.selectionService.isPixelWithinSelection(
                  px,
                  py,
                  sel,
                  shape,
                  poly,
                )
              ) {
                const idx = py * canvasWidth + px;
                originalBuf[idx] = '';
              }
            }
          }
          this.canvasState.setLayerBuffer(originalLayerId, originalBuf);
        }
      }

      this.selectionService.selectionRect.set({
        x: newX,
        y: newY,
        width: targetWidth,
        height: targetHeight,
      });

      this.canvasState.incrementPixelsVersion();
      this.canvasState.setCanvasSaved(false);
      return true;
    }

    const targetId = this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Content-Aware Scale');

    const width = this.canvasWidth();
    const height = this.canvasHeight();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const imgData = ctx.createImageData(width, height);
    for (let i = 0; i < buffer.length; i++) {
      const colorStr = buffer[i];
      if (colorStr) {
        const r = parseInt(colorStr.slice(1, 3), 16);
        const g = parseInt(colorStr.slice(3, 5), 16);
        const b = parseInt(colorStr.slice(5, 7), 16);
        const a = parseInt(colorStr.slice(7, 9), 16);
        imgData.data[i * 4] = r;
        imgData.data[i * 4 + 1] = g;
        imgData.data[i * 4 + 2] = b;
        imgData.data[i * 4 + 3] = a;
      }
    }

    const importanceMap = protectImportantAreas
      ? this.detectImportantAreas(imgData)
      : undefined;

    const scaled = this.contentAwareScaleService.contentAwareScale(
      imgData,
      targetWidth,
      targetHeight,
      importanceMap,
    );

    const resultBuffer: string[] = new Array(targetWidth * targetHeight).fill(
      '',
    );
    for (let i = 0; i < resultBuffer.length; i++) {
      const r = scaled.data[i * 4];
      const g = scaled.data[i * 4 + 1];
      const b = scaled.data[i * 4 + 2];
      const a = scaled.data[i * 4 + 3];
      if (a > 0) {
        resultBuffer[i] =
          `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
      }
    }

    if (targetWidth !== width || targetHeight !== height) {
      this.canvasState.setCanvasSize(targetWidth, targetHeight);

      for (const layer of this.layerService.getFlattenedLayers()) {
        if (layer.id !== targetId) {
          this.canvasState.ensureLayerBuffer(
            layer.id,
            targetWidth,
            targetHeight,
          );
        }
      }
    }

    this.canvasState.setLayerBuffer(targetId, resultBuffer);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  private detectImportantAreas(imageData: ImageData): Set<string> {
    const importantAreas = new Set<string>();
    const { width, height, data } = imageData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];

        if (alpha > 128) {
          let edgeStrength = 0;

          if (x > 0 && x < width - 1) {
            const leftIdx = (y * width + (x - 1)) * 4;
            const rightIdx = (y * width + (x + 1)) * 4;
            edgeStrength += Math.abs(data[rightIdx] - data[leftIdx]);
            edgeStrength += Math.abs(data[rightIdx + 1] - data[leftIdx + 1]);
            edgeStrength += Math.abs(data[rightIdx + 2] - data[leftIdx + 2]);
          }

          if (y > 0 && y < height - 1) {
            const topIdx = ((y - 1) * width + x) * 4;
            const bottomIdx = ((y + 1) * width + x) * 4;
            edgeStrength += Math.abs(data[bottomIdx] - data[topIdx]);
            edgeStrength += Math.abs(data[bottomIdx + 1] - data[topIdx + 1]);
            edgeStrength += Math.abs(data[bottomIdx + 2] - data[topIdx + 2]);
          }

          if (edgeStrength > 100) {
            importantAreas.add(`${x},${y}`);
          }
        }
      }
    }

    return importantAreas;
  }

  distortSelectionOrLayer(
    corners: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
    },
    sourceWidth: number,
    sourceHeight: number,
  ): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Distort (selection)');

      const srcCorners = [
        { x: 0, y: 0 },
        { x: sourceWidth, y: 0 },
        { x: sourceWidth, y: sourceHeight },
        { x: 0, y: sourceHeight },
      ];

      const dstCorners = [
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ];

      const result = this.transformService.applyDistort(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
        srcCorners,
        dstCorners,
      );

      const newLayer = this.layerService.addLayer('Distorted Layer');

      const canvasW = this.canvasWidth();
      const canvasH = this.canvasHeight();

      this.canvasState.ensureLayerBuffer(newLayer.id, canvasW, canvasH);

      const centerX = selBuf.x + selBuf.width / 2;
      const centerY = selBuf.y + selBuf.height / 2;

      const newX = Math.max(
        0,
        Math.min(
          canvasW - result.width,
          Math.round(centerX - result.width / 2),
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          canvasH - result.height,
          Math.round(centerY - result.height / 2),
        ),
      );

      const layerBuf = this.canvasState.getLayerBuffer(newLayer.id);
      if (layerBuf) {
        for (let y = 0; y < result.height; y++) {
          for (let x = 0; x < result.width; x++) {
            const srcIdx = y * result.width + x;
            const color = result.buffer[srcIdx];
            if (color) {
              const destX = newX + x;
              const destY = newY + y;
              if (
                destX >= 0 &&
                destX < canvasW &&
                destY >= 0 &&
                destY < canvasH
              ) {
                const destIdx = destY * canvasW + destX;
                layerBuf[destIdx] = color;
              }
            }
          }
        }
      }

      this.canvasState.setLayerBuffer(newLayer.id, layerBuf || []);
      this.canvasState.incrementPixelsVersion();
      this.canvasState.setCanvasSaved(false);
      return true;
    }

    const targetId = this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Distort');

    const width = this.canvasWidth();
    const height = this.canvasHeight();

    const srcCorners = [
      { x: 0, y: 0 },
      { x: sourceWidth, y: 0 },
      { x: sourceWidth, y: sourceHeight },
      { x: 0, y: sourceHeight },
    ];

    const dstCorners = [
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ];

    const result = this.transformService.applyDistort(
      buffer,
      width,
      height,
      srcCorners,
      dstCorners,
    );

    const newLayer = this.layerService.addLayer('Distorted Layer');

    if (result.width !== width || result.height !== height) {
      this.canvasState.setCanvasSize(result.width, result.height);

      for (const layer of this.layerService.getFlattenedLayers()) {
        if (layer.id !== newLayer.id) {
          this.canvasState.ensureLayerBuffer(
            layer.id,
            result.width,
            result.height,
          );
        }
      }
    }

    this.canvasState.ensureLayerBuffer(
      newLayer.id,
      result.width,
      result.height,
    );
    this.canvasState.setLayerBuffer(newLayer.id, result.buffer);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }

  applyPerspectiveTransform(corners: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  }): boolean {
    const sel = this.selectionService.selectionRect();

    if (sel) {
      const selBuf = this.getSelectionBuffer();
      if (!selBuf) return false;

      this.saveSnapshotForUndo('Perspective (selection)');

      const srcCorners = [
        { x: 0, y: 0 },
        { x: selBuf.width, y: 0 },
        { x: selBuf.width, y: selBuf.height },
        { x: 0, y: selBuf.height },
      ];

      const dstCorners = [
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ];

      const result = this.transformService.applyDistort(
        selBuf.buffer,
        selBuf.width,
        selBuf.height,
        srcCorners,
        dstCorners,
      );

      const newLayer = this.layerService.addLayer('Perspective Layer');

      const canvasW = this.canvasWidth();
      const canvasH = this.canvasHeight();

      this.canvasState.ensureLayerBuffer(newLayer.id, canvasW, canvasH);

      const centerX = selBuf.x + selBuf.width / 2;
      const centerY = selBuf.y + selBuf.height / 2;

      const newX = Math.max(
        0,
        Math.min(
          canvasW - result.width,
          Math.round(centerX - result.width / 2),
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          canvasH - result.height,
          Math.round(centerY - result.height / 2),
        ),
      );

      const layerBuf = this.canvasState.getLayerBuffer(newLayer.id);
      if (layerBuf) {
        for (let y = 0; y < result.height; y++) {
          for (let x = 0; x < result.width; x++) {
            const srcIdx = y * result.width + x;
            const color = result.buffer[srcIdx];
            if (color) {
              const destX = newX + x;
              const destY = newY + y;
              if (
                destX >= 0 &&
                destX < canvasW &&
                destY >= 0 &&
                destY < canvasH
              ) {
                const destIdx = destY * canvasW + destX;
                layerBuf[destIdx] = color;
              }
            }
          }
        }
      }

      this.canvasState.setLayerBuffer(newLayer.id, layerBuf || []);
      this.canvasState.incrementPixelsVersion();
      this.canvasState.setCanvasSaved(false);
      return true;
    }

    const targetId = this.selectedLayerId();
    if (!targetId) return false;

    const buffer = this.canvasState.getLayerBuffer(targetId);
    if (!buffer || buffer.length === 0) return false;

    this.saveSnapshotForUndo('Perspective');

    const width = this.canvasWidth();
    const height = this.canvasHeight();

    const srcCorners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];

    const dstCorners = [
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ];

    const result = this.transformService.applyDistort(
      buffer,
      width,
      height,
      srcCorners,
      dstCorners,
    );

    const newLayer = this.layerService.addLayer('Perspective Layer');

    if (result.width !== width || result.height !== height) {
      this.canvasState.setCanvasSize(result.width, result.height);

      for (const layer of this.layerService.getFlattenedLayers()) {
        if (layer.id !== newLayer.id) {
          this.canvasState.ensureLayerBuffer(
            layer.id,
            result.width,
            result.height,
          );
        }
      }
    }

    this.canvasState.ensureLayerBuffer(
      newLayer.id,
      result.width,
      result.height,
    );
    this.canvasState.setLayerBuffer(newLayer.id, result.buffer);
    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);
    return true;
  }
}
