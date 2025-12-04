import { Injectable, inject } from '@angular/core';
import { EditorDocumentService, isLayer } from '../../editor-document.service';
import {
  EditorFreeTransformService,
  FreeTransformState,
} from '../editor-free-transform.service';

export interface FreeTransformBufferState {
  originalBuffer: string[] | null;
  originalRect: { x: number; y: number; width: number; height: number } | null;
  layerId: string | null;
  previewIndices: number[] | null;
  previewBackup: Map<number, string> | null;
  duplicate: boolean;
  mirrorX: boolean;
  mirrorY: boolean;
}

@Injectable({ providedIn: 'root' })
export class CanvasFreeTransformHandler {
  private readonly document = inject(EditorDocumentService);
  private readonly freeTransform = inject(EditorFreeTransformService);

  private originalBuffer: string[] | null = null;
  private originalRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  private layerId: string | null = null;
  private previewIndices: number[] | null = null;
  private previewBackup: Map<number, string> | null = null;
  private duplicate = false;
  private mirrorX = false;
  private mirrorY = false;

  getState(): FreeTransformBufferState {
    return {
      originalBuffer: this.originalBuffer,
      originalRect: this.originalRect,
      layerId: this.layerId,
      previewIndices: this.previewIndices,
      previewBackup: this.previewBackup,
      duplicate: this.duplicate,
      mirrorX: this.mirrorX,
      mirrorY: this.mirrorY,
    };
  }

  getMirrorX(): boolean {
    return this.mirrorX;
  }

  getMirrorY(): boolean {
    return this.mirrorY;
  }

  toggleMirrorX(): boolean {
    this.mirrorX = !this.mirrorX;
    return this.mirrorX;
  }

  toggleMirrorY(): boolean {
    this.mirrorY = !this.mirrorY;
    return this.mirrorY;
  }

  hasOriginalBuffer(): boolean {
    return this.originalBuffer !== null;
  }

  activate(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      return;
    }

    this.duplicate = false;
    this.previewIndices = null;
    this.previewBackup = null;
    this.mirrorX = false;
    this.mirrorY = false;

    this.document.saveSnapshot('Free Transform');
    const layer = this.document.selectedLayer();
    if (!layer || !isLayer(layer)) return;
    const layerBuf = this.document.getLayerBuffer(layer.id);
    if (!layerBuf) return;

    const canvasW = this.document.canvasWidth();
    const canvasH = this.document.canvasHeight();
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
    this.freeTransform.startTransform(sel.x, sel.y, sel.width, sel.height);
    this.renderLivePreview();
  }

  commit(): void {
    const state = this.freeTransform.commitTransform();
    if (!state) return;

    const sel = this.document.selectionRect();
    if (!sel) return;

    const scaleX = state.width / sel.width;
    const scaleY = state.height / sel.height;
    const doScale =
      Math.abs(scaleX - 1) > 0.0001 || Math.abs(scaleY - 1) > 0.0001;
    const doRotate = Math.abs(state.rotation) > 0.0001;

    if (
      this.previewIndices &&
      this.previewIndices.length &&
      this.layerId &&
      this.previewBackup
    ) {
      const layerBuffer = this.document.getLayerBuffer(this.layerId);
      if (layerBuffer) {
        for (const idx of this.previewIndices) {
          if (idx >= 0 && idx < layerBuffer.length) {
            const backupValue = this.previewBackup.get(idx);
            layerBuffer[idx] = backupValue !== undefined ? backupValue : '';
          }
        }
      }
    }

    if (this.duplicate && this.originalBuffer && this.originalRect && this.layerId) {
      this.restoreOriginalPixels();
      this.applyTransformToSelection(
        state,
        scaleX,
        scaleY,
        this.originalBuffer,
        this.originalRect,
      );
    } else {
      if (doScale || doRotate) {
        if (this.originalBuffer && this.originalRect && this.layerId) {
          this.applyTransformToSelection(
            state,
            scaleX,
            scaleY,
            this.originalBuffer,
            this.originalRect,
          );
        }
      } else {
        this.restoreOriginalPixels();
      }
    }

    this.document.updateSelectionBounds(
      Math.floor(state.x),
      Math.floor(state.y),
      Math.floor(state.width),
      Math.floor(state.height),
    );
    this.document.setCanvasSaved(false);
    this.clearState();
  }

  cancel(): void {
    if (this.previewIndices && this.layerId && this.previewBackup) {
      const buf = this.document.getLayerBuffer(this.layerId);
      if (buf) {
        for (const idx of this.previewIndices) {
          if (idx >= 0 && idx < buf.length) {
            const backupValue = this.previewBackup.get(idx);
            buf[idx] = backupValue !== undefined ? backupValue : '';
          }
        }
        this.document.layerPixelsVersion.update((v) => v + 1);
      }
    }
    this.restoreOriginalPixels();
    this.freeTransform.cancelTransform();
    this.clearState();
  }

  renderLivePreview(): void {
    const state = this.freeTransform.transformState();
    if (!state || !this.originalBuffer || !this.originalRect || !this.layerId) {
      return;
    }

    const layerBuffer = this.document.getLayerBuffer(this.layerId);
    if (!layerBuffer) return;

    const canvasW = this.document.canvasWidth();
    const canvasH = this.document.canvasHeight();

    if (this.previewIndices && this.previewIndices.length && this.previewBackup) {
      for (const idx of this.previewIndices) {
        if (idx >= 0 && idx < layerBuffer.length) {
          const backupValue = this.previewBackup.get(idx);
          layerBuffer[idx] = backupValue !== undefined ? backupValue : '';
        }
      }
    }

    this.previewIndices = [];
    this.previewBackup = new Map<number, string>();

    const srcW = this.originalRect.width;
    const srcH = this.originalRect.height;
    const scaleX = state.width / srcW;
    const scaleY = state.height / srcH;
    const rad = (state.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cX = srcW / 2;
    const cY = srcH / 2;
    const tgtW = Math.max(1, Math.round(state.width));
    const tgtH = Math.max(1, Math.round(state.height));
    const baseX = Math.floor(state.x);
    const baseY = Math.floor(state.y);

    for (let y = 0; y < tgtH; y++) {
      for (let x = 0; x < tgtW; x++) {
        const srcX = x / scaleX;
        const srcY = y / scaleY;
        const dx = srcX - cX;
        const dy = srcY - cY;
        const rotX = cX + dx * cos + dy * sin;
        const rotY = cY - dx * sin + dy * cos;
        let sx = Math.floor(rotX);
        let sy = Math.floor(rotY);
        if (this.mirrorX) sx = srcW - 1 - sx;
        if (this.mirrorY) sy = srcH - 1 - sy;
        if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
          const srcIdx = sy * srcW + sx;
          const col = this.originalBuffer[srcIdx];
          if (col && col.length) {
            const destX = baseX + x;
            const destY = baseY + y;
            if (destX >= 0 && destX < canvasW && destY >= 0 && destY < canvasH) {
              const destIdx = destY * canvasW + destX;
              if (!this.previewBackup.has(destIdx)) {
                this.previewBackup.set(destIdx, layerBuffer[destIdx] || '');
              }
              layerBuffer[destIdx] = col;
              this.previewIndices.push(destIdx);
            }
          }
        }
      }
    }
    this.document.layerPixelsVersion.update((v) => v + 1);
  }

  private applyTransformToSelection(
    state: FreeTransformState,
    scaleX: number,
    scaleY: number,
    originalBuffer: string[],
    originalRect: { x: number; y: number; width: number; height: number },
  ): void {
    if (!this.layerId) return;
    const layerBuffer = this.document.getLayerBuffer(this.layerId);
    if (!layerBuffer) return;

    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();

    const cos = Math.cos((state.rotation * Math.PI) / 180);
    const sin = Math.sin((state.rotation * Math.PI) / 180);
    const centerX = originalRect.width / 2;
    const centerY = originalRect.height / 2;

    const targetW = Math.max(1, Math.round(state.width));
    const targetH = Math.max(1, Math.round(state.height));
    const targetX = Math.floor(state.x);
    const targetY = Math.floor(state.y);

    const transformedBuffer = new Array<string>(targetW * targetH).fill('');
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const srcX = x / scaleX;
        const srcY = y / scaleY;
        const dx = srcX - centerX;
        const dy = srcY - centerY;
        const rotX = centerX + dx * cos + dy * sin;
        const rotY = centerY - dx * sin + dy * cos;
        let sx = Math.floor(rotX);
        let sy = Math.floor(rotY);
        if (this.mirrorX) sx = originalRect.width - 1 - sx;
        if (this.mirrorY) sy = originalRect.height - 1 - sy;
        if (
          sx >= 0 &&
          sx < originalRect.width &&
          sy >= 0 &&
          sy < originalRect.height
        ) {
          const srcIdx = sy * originalRect.width + sx;
          const destIdx = y * targetW + x;
          transformedBuffer[destIdx] = originalBuffer[srcIdx] || '';
        }
      }
    }

    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const destX = targetX + x;
        const destY = targetY + y;
        if (
          destX >= 0 &&
          destX < canvasWidth &&
          destY >= 0 &&
          destY < canvasHeight
        ) {
          const srcIdx = y * targetW + x;
          const destIdx = destY * canvasWidth + destX;
          const col = transformedBuffer[srcIdx];
          if (col) layerBuffer[destIdx] = col;
        }
      }
    }
    this.document.layerPixelsVersion.update((v) => v + 1);
  }

  private restoreOriginalPixels(): void {
    if (!this.originalBuffer || !this.originalRect || !this.layerId) return;

    const layerBuffer = this.document.getLayerBuffer(this.layerId);
    if (!layerBuffer) return;

    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();
    const rect = this.originalRect;

    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const srcIdx = y * rect.width + x;
        const destX = rect.x + x;
        const destY = rect.y + y;
        if (
          destX >= 0 &&
          destX < canvasWidth &&
          destY >= 0 &&
          destY < canvasHeight
        ) {
          const destIdx = destY * canvasWidth + destX;
          const col = this.originalBuffer[srcIdx];
          if (col) layerBuffer[destIdx] = col;
        }
      }
    }
    this.document.layerPixelsVersion.update((v) => v + 1);
  }

  private clearState(): void {
    this.originalBuffer = null;
    this.originalRect = null;
    this.layerId = null;
    this.duplicate = false;
    this.previewIndices = null;
    this.previewBackup = null;
    this.mirrorX = false;
    this.mirrorY = false;
  }
}
