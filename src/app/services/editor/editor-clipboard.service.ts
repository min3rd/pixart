import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { EditorLayerService } from './editor-layer.service';
import { EditorCanvasStateService } from './editor-canvas-state.service';
import { EditorSelectionService } from './editor-selection.service';
import { LayerItem } from './editor.types';

interface ClipboardData {
  type: 'selection' | 'layer';
  width: number;
  height: number;
  pixels: string[];
  sourceX?: number;
  sourceY?: number;
}

@Injectable({ providedIn: 'root' })
export class EditorClipboardService {
  private readonly transloco = inject(TranslocoService);
  private readonly layerService = inject(EditorLayerService);
  private readonly canvasState = inject(EditorCanvasStateService);
  private readonly selectionService = inject(EditorSelectionService);
  private clipboard: ClipboardData | null = null;

  copy(): boolean {
    const sel = this.selectionService.selectionRect();
    if (!sel) return false;

    const shape = this.selectionService.selectionShape();
    const poly = this.selectionService.selectionPolygon();
    const sourceLayerId = this.layerService.selectedLayerId();
    const sourceBuf = this.canvasState.getLayerBuffer(sourceLayerId);
    if (!sourceBuf || sourceBuf.length === 0) return false;

    const canvasWidth = this.canvasState.canvasWidth();
    const canvasHeight = this.canvasState.canvasHeight();

    const clipWidth = sel.width;
    const clipHeight = sel.height;
    const clipPixels = new Array<string>(clipWidth * clipHeight).fill('');

    for (let y = 0; y < clipHeight; y++) {
      for (let x = 0; x < clipWidth; x++) {
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
          const dstIdx = y * clipWidth + x;
          clipPixels[dstIdx] = sourceBuf[srcIdx] || '';
        }
      }
    }

    this.clipboard = {
      type: 'selection',
      width: clipWidth,
      height: clipHeight,
      pixels: clipPixels,
      sourceX: sel.x,
      sourceY: sel.y,
    };

    return true;
  }

  copyMerged(): boolean {
    const sel = this.selectionService.selectionRect();
    if (!sel) return false;

    const shape = this.selectionService.selectionShape();
    const poly = this.selectionService.selectionPolygon();
    const canvasWidth = this.canvasState.canvasWidth();
    const canvasHeight = this.canvasState.canvasHeight();

    const clipWidth = sel.width;
    const clipHeight = sel.height;
    const clipPixels = new Array<string>(clipWidth * clipHeight).fill('');

    const layers = this.layerService.layers();
    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      if (!layer.visible) continue;

      const buf = this.canvasState.getLayerBuffer(layer.id);
      if (!buf || buf.length !== canvasWidth * canvasHeight) continue;

      for (let y = 0; y < clipHeight; y++) {
        for (let x = 0; x < clipWidth; x++) {
          const srcX = sel.x + x;
          const srcY = sel.y + y;
          if (
            srcX < 0 ||
            srcX >= canvasWidth ||
            srcY < 0 ||
            srcY >= canvasHeight
          )
            continue;

          if (
            !this.selectionService.isPixelWithinSelection(
              srcX,
              srcY,
              sel,
              shape,
              poly,
            )
          )
            continue;

          const srcIdx = srcY * canvasWidth + srcX;
          const dstIdx = y * clipWidth + x;
          const pixel = buf[srcIdx];
          if (pixel && pixel.length > 0) {
            clipPixels[dstIdx] = pixel;
          }
        }
      }
    }

    this.clipboard = {
      type: 'selection',
      width: clipWidth,
      height: clipHeight,
      pixels: clipPixels,
      sourceX: sel.x,
      sourceY: sel.y,
    };

    return true;
  }

  cut(): boolean {
    if (!this.copy()) return false;
    return this.clearPixelsInSelection();
  }

  private clearPixelsInSelection(): boolean {
    const sel = this.selectionService.selectionRect();
    if (!sel) return false;

    const shape = this.selectionService.selectionShape();
    const poly = this.selectionService.selectionPolygon();
    const layerId = this.layerService.selectedLayerId();
    const buf = this.canvasState.getLayerBuffer(layerId);
    if (!buf || buf.length === 0) return false;

    const canvasWidth = this.canvasState.canvasWidth();
    const canvasHeight = this.canvasState.canvasHeight();

    for (let y = sel.y; y < sel.y + sel.height; y++) {
      for (let x = sel.x; x < sel.x + sel.width; x++) {
        if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;

        if (
          this.selectionService.isPixelWithinSelection(x, y, sel, shape, poly)
        ) {
          const idx = y * canvasWidth + x;
          buf[idx] = '';
        }
      }
    }

    this.canvasState.incrementPixelsVersion();
    return true;
  }

  paste(): LayerItem | null {
    return this.createPastedLayer(
      0,
      0,
      this.transloco.translate('layers.pasted'),
      null,
    );
  }

  pasteInPlace(): LayerItem | null {
    if (
      !this.clipboard ||
      this.clipboard.sourceX === undefined ||
      this.clipboard.sourceY === undefined
    )
      return null;

    return this.createPastedLayer(
      this.clipboard.sourceX,
      this.clipboard.sourceY,
      this.transloco.translate('layers.pastedInPlace'),
      null,
    );
  }

  pasteInto(): LayerItem | null {
    if (!this.clipboard) return null;

    const sel = this.selectionService.selectionRect();
    if (!sel) return this.paste();

    const shape = this.selectionService.selectionShape();
    const poly = this.selectionService.selectionPolygon();

    return this.createPastedLayer(
      sel.x,
      sel.y,
      this.transloco.translate('layers.pastedInto'),
      { rect: sel, shape, poly },
    );
  }

  private createPastedLayer(
    startX: number,
    startY: number,
    layerName: string,
    maskSelection: {
      rect: { x: number; y: number; width: number; height: number };
      shape: 'rect' | 'ellipse' | 'lasso';
      poly: { x: number; y: number }[] | null;
    } | null,
  ): LayerItem | null {
    if (!this.clipboard) return null;

    const canvasWidth = this.canvasState.canvasWidth();
    const canvasHeight = this.canvasState.canvasHeight();
    const newLayerId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer: LayerItem = {
      id: newLayerId,
      name: layerName,
      visible: true,
      locked: false,
      type: 'layer',
    };

    const newBuf = new Array<string>(canvasWidth * canvasHeight).fill('');

    for (let y = 0; y < this.clipboard.height; y++) {
      for (let x = 0; x < this.clipboard.width; x++) {
        const destX = startX + x;
        const destY = startY + y;
        if (
          destX < 0 ||
          destX >= canvasWidth ||
          destY < 0 ||
          destY >= canvasHeight
        )
          continue;

        if (
          maskSelection &&
          !this.selectionService.isPixelWithinSelection(
            destX,
            destY,
            maskSelection.rect,
            maskSelection.shape,
            maskSelection.poly,
          )
        )
          continue;

        const srcIdx = y * this.clipboard.width + x;
        const pixel = this.clipboard.pixels[srcIdx];
        if (pixel && pixel.length > 0) {
          const destIdx = destY * canvasWidth + destX;
          newBuf[destIdx] = pixel;
        }
      }
    }

    this.layerService.layers.update((arr) => [newLayer, ...arr]);
    this.canvasState.setLayerBuffer(newLayerId, newBuf);
    this.layerService.selectedLayerId.set(newLayerId);
    this.layerService.selectedLayerIds.set(new Set([newLayerId]));
    this.canvasState.incrementPixelsVersion();

    const bounds = {
      x: startX,
      y: startY,
      width: Math.min(this.clipboard.width, canvasWidth - startX),
      height: Math.min(this.clipboard.height, canvasHeight - startY),
    };
    this.selectionService.selectionRect.set(bounds);
    this.selectionService.selectionShape.set('rect');
    this.selectionService.selectionPolygon.set(null);

    return newLayer;
  }

  clear(): boolean {
    return this.clearPixelsInSelection();
  }

  hasClipboard(): boolean {
    return this.clipboard !== null;
  }
}
