import { Injectable, inject } from '@angular/core';
import { EditorDocumentService, isLayer } from '../../editor-document.service';
import { EditorWarpService, WarpState } from '../editor-warp.service';
import { EditorTransformService } from '../editor-transform.service';

export interface WarpBufferState {
  originalBuffer: string[] | null;
  originalRect: { x: number; y: number; width: number; height: number } | null;
  layerId: string | null;
  fullLayerBackup: string[] | null;
}

@Injectable({ providedIn: 'root' })
export class CanvasWarpHandler {
  private readonly document = inject(EditorDocumentService);
  private readonly warp = inject(EditorWarpService);
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

  getState(): WarpBufferState {
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

    this.document.saveSnapshot('Warp');
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
    const state = this.warp.commitWarp();
    if (!state) return;

    if (
      !this.originalBuffer ||
      !this.originalRect ||
      !this.layerId ||
      !this.fullLayerBackup
    ) {
      return;
    }

    const originalLayerBuffer = this.document.getLayerBuffer(this.layerId);
    if (!originalLayerBuffer) return;

    for (let i = 0; i < originalLayerBuffer.length; i++) {
      originalLayerBuffer[i] = this.fullLayerBackup[i];
    }

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

    this.warp.cancelWarp();
    this.clearState();
  }

  renderLivePreview(): void {
    const state = this.warp.warpState();
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

    for (let y = 0; y < this.originalRect.height; y++) {
      for (let x = 0; x < this.originalRect.width; x++) {
        const destX: number = this.originalRect.x + x;
        const destY: number = this.originalRect.y + y;
        if (destX >= 0 && destX < canvasW && destY >= 0 && destY < canvasH) {
          const destIdx = destY * canvasW + destX;
          layerBuffer[destIdx] = '';
        }
      }
    }

    const dims = this.warp.getGridDimensions();
    if (!dims) return;

    const result = this.transformService.applyWarp(
      this.originalBuffer,
      this.originalRect.width,
      this.originalRect.height,
      state.nodes,
      dims.rows,
      dims.cols,
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
