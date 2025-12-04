import { Injectable, inject } from '@angular/core';
import { EditorDocumentService, isLayer } from '../../editor-document.service';
import { EditorDistortService, DistortState } from '../editor-distort.service';
import { EditorTransformService } from '../editor-transform.service';

export interface DistortBufferState {
  originalBuffer: string[] | null;
  originalRect: { x: number; y: number; width: number; height: number } | null;
  layerId: string | null;
  fullLayerBackup: string[] | null;
}

@Injectable({ providedIn: 'root' })
export class CanvasDistortHandler {
  private readonly document = inject(EditorDocumentService);
  private readonly distort = inject(EditorDistortService);
  private readonly transformService = inject(EditorTransformService);

  private originalBuffer: string[] | null = null;
  private originalRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  private layerId: string | null = null;
  private fullLayerBackup: string[] | null = null;

  getState(): DistortBufferState {
    return {
      originalBuffer: this.originalBuffer,
      originalRect: this.originalRect,
      layerId: this.layerId,
      fullLayerBackup: this.fullLayerBackup,
    };
  }

  hasOriginalBuffer(): boolean {
    return this.originalBuffer !== null;
  }

  activate(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      return;
    }

    this.document.saveSnapshot('Distort');
    const layer = this.document.selectedLayer();
    if (!layer || !isLayer(layer)) return;
    const layerBuf = this.document.getLayerBuffer(layer.id);
    if (!layerBuf) return;

    const canvasW = this.document.canvasWidth();
    const canvasH = this.document.canvasHeight();

    this.fullLayerBackup = [...layerBuf];

    const original: string[] = new Array<string>(sel.width * sel.height).fill(
      '',
    );
    for (let y = 0; y < sel.height; y++) {
      for (let x = 0; x < sel.width; x++) {
        const srcX = sel.x + x;
        const srcY = sel.y + y;
        if (srcX >= 0 && srcX < canvasW && srcY >= 0 && srcY < canvasH) {
          const srcIdx = srcY * canvasW + srcX;
          const dstIdx = y * sel.width + x;
          original[dstIdx] = layerBuf[srcIdx] || '';
          layerBuf[srcIdx] = '';
        }
      }
    }

    this.document.layerPixelsVersion.update((v) => v + 1);
    this.originalBuffer = original;
    this.originalRect = {
      x: sel.x,
      y: sel.y,
      width: sel.width,
      height: sel.height,
    };
    this.layerId = layer.id;
    this.renderLivePreview();
  }

  commit(): void {
    const state = this.distort.commitDistort();
    if (!state) return;

    if (
      !this.originalBuffer ||
      !this.originalRect ||
      !this.layerId ||
      !this.fullLayerBackup
    ) {
      return;
    }

    const canvasW = this.document.canvasWidth();
    const canvasH = this.document.canvasHeight();

    const originalLayerBuffer = this.document.getLayerBuffer(this.layerId);
    if (!originalLayerBuffer) return;

    for (let i = 0; i < originalLayerBuffer.length; i++) {
      originalLayerBuffer[i] = this.fullLayerBackup[i];
    }

    for (let y = 0; y < this.originalRect.height; y++) {
      for (let x = 0; x < this.originalRect.width; x++) {
        const destX: number = this.originalRect.x + x;
        const destY: number = this.originalRect.y + y;
        if (destX >= 0 && destX < canvasW && destY >= 0 && destY < canvasH) {
          const destIdx = destY * canvasW + destX;
          originalLayerBuffer[destIdx] = '';
        }
      }
    }

    const originalSelectionLayer = this.document.addLayer('Original Selection');
    const origSelLayerBuf = this.document.getLayerBuffer(
      originalSelectionLayer.id,
    );

    if (origSelLayerBuf) {
      for (let y = 0; y < this.originalRect.height; y++) {
        for (let x = 0; x < this.originalRect.width; x++) {
          const srcIdx = y * this.originalRect.width + x;
          const destX: number = this.originalRect.x + x;
          const destY: number = this.originalRect.y + y;
          if (destX >= 0 && destX < canvasW && destY >= 0 && destY < canvasH) {
            const destIdx = destY * canvasW + destX;
            origSelLayerBuf[destIdx] = this.originalBuffer[srcIdx] || '';
          }
        }
      }
    }

    this.document.toggleLayerVisibility(originalSelectionLayer.id);

    const srcCorners = [
      { x: 0, y: 0 },
      { x: state.sourceWidth, y: 0 },
      { x: state.sourceWidth, y: state.sourceHeight },
      { x: 0, y: state.sourceHeight },
    ];

    const dstCorners = [
      state.corners.topLeft,
      state.corners.topRight,
      state.corners.bottomRight,
      state.corners.bottomLeft,
    ];

    const result = this.transformService.applyDistort(
      this.originalBuffer,
      this.originalRect.width,
      this.originalRect.height,
      srcCorners,
      dstCorners,
    );

    const distortedLayer = this.document.addLayer('Distorted Layer');
    const distortedLayerBuf = this.document.getLayerBuffer(distortedLayer.id);

    if (distortedLayerBuf) {
      for (let y = 0; y < result.height; y++) {
        for (let x = 0; x < result.width; x++) {
          const srcIdx = y * result.width + x;
          const color = result.buffer[srcIdx];
          if (color) {
            const destX = Math.floor(result.minX + x);
            const destY = Math.floor(result.minY + y);
            if (
              destX >= 0 &&
              destX < canvasW &&
              destY >= 0 &&
              destY < canvasH
            ) {
              const destIdx = destY * canvasW + destX;
              distortedLayerBuf[destIdx] = color;
            }
          }
        }
      }
    }

    this.document.selectLayer(distortedLayer.id);
    this.document.layerPixelsVersion.update((v) => v + 1);
    this.document.setCanvasSaved(false);
    this.clearState();
  }

  cancel(): void {
    if (this.fullLayerBackup && this.layerId) {
      const layerBuffer = this.document.getLayerBuffer(this.layerId);
      if (layerBuffer) {
        for (let i = 0; i < layerBuffer.length; i++) {
          layerBuffer[i] = this.fullLayerBackup[i];
        }
        this.document.layerPixelsVersion.update((v) => v + 1);
      }
    }

    this.distort.cancelDistort();
    this.clearState();
  }

  renderLivePreview(): void {
    const state = this.distort.distortState();
    if (
      !state ||
      !this.originalBuffer ||
      !this.originalRect ||
      !this.layerId ||
      !this.fullLayerBackup
    ) {
      return;
    }

    const layerBuffer = this.document.getLayerBuffer(this.layerId);
    if (!layerBuffer) return;

    const canvasW = this.document.canvasWidth();
    const canvasH = this.document.canvasHeight();

    for (let i = 0; i < layerBuffer.length; i++) {
      layerBuffer[i] = this.fullLayerBackup[i];
    }

    const srcCorners = [
      { x: 0, y: 0 },
      { x: state.sourceWidth, y: 0 },
      { x: state.sourceWidth, y: state.sourceHeight },
      { x: 0, y: state.sourceHeight },
    ];

    const dstCorners = [
      state.corners.topLeft,
      state.corners.topRight,
      state.corners.bottomRight,
      state.corners.bottomLeft,
    ];

    const result = this.transformService.applyDistort(
      this.originalBuffer,
      this.originalRect.width,
      this.originalRect.height,
      srcCorners,
      dstCorners,
    );

    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const srcIdx = y * result.width + x;
        const color = result.buffer[srcIdx];
        if (color) {
          const destX = Math.floor(result.minX + x);
          const destY = Math.floor(result.minY + y);
          if (destX >= 0 && destX < canvasW && destY >= 0 && destY < canvasH) {
            const destIdx = destY * canvasW + destX;
            layerBuffer[destIdx] = color;
          }
        }
      }
    }

    this.document.layerPixelsVersion.update((v) => v + 1);
  }

  private clearState(): void {
    this.originalBuffer = null;
    this.originalRect = null;
    this.layerId = null;
    this.fullLayerBackup = null;
  }
}
