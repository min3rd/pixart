import { Injectable, inject } from '@angular/core';
import { EditorDocumentService } from '../editor-document.service';
import { PatternLibraryService } from '../pattern-library.service';
import { ContentAwareFillService } from '../content-aware-fill.service';
import { FillToolMode } from '../tools/tool.types';

export interface FillSelectionOptions {
  mode: FillToolMode;
  color?: string;
  patternId?: string;
  contentAwareThreshold?: number;
}

@Injectable({ providedIn: 'root' })
export class FillSelectionService {
  private readonly document = inject(EditorDocumentService);
  private readonly patternLibrary = inject(PatternLibraryService);
  private readonly contentAwareFill = inject(ContentAwareFillService);

  fillSelection(options: FillSelectionOptions): boolean {
    const selectionRect = this.document.selectionRect();
    if (!selectionRect || selectionRect.width <= 0 || selectionRect.height <= 0) return false;

    const currentLayer = this.document.selectedLayer();
    if (!currentLayer || currentLayer.type !== 'layer') return false;

    const { x, y, width, height } = selectionRect;
    const selectionMask = this.document.selectionMask();
    const selectionShape = this.document.selectionShape();
    const selectionPolygon = this.document.selectionPolygon();

    const maskData = this.buildMaskData(
      x,
      y,
      width,
      height,
      selectionShape,
      selectionMask,
      selectionPolygon
    );

    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = this.document.canvasWidth();
    layerCanvas.height = this.document.canvasHeight();
    const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true });
    if (!layerCtx) return false;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return false;

    const currentBuffer = this.document.getLayerBuffer(currentLayer.id);
    this.renderBufferToCanvas(currentBuffer, this.document.canvasWidth(), layerCanvas);
    const fullImageData = layerCtx.getImageData(x, y, width, height);

    const originalPixels = new Uint8ClampedArray(fullImageData.data);

    let fillImageData: ImageData;

    if (options.mode === 'color' && options.color) {
      fillImageData = this.fillWithColor(
        width,
        height,
        maskData,
        options.color
      );
    } else if (options.mode === 'pattern' && options.patternId) {
      fillImageData = this.fillWithPattern(
        width,
        height,
        maskData,
        options.patternId
      );
    } else if (options.mode === 'content-aware') {
      fillImageData = this.fillWithContentAware(
        fullImageData,
        maskData,
        width,
        height,
        options.contentAwareThreshold || 32
      );
    } else if (options.mode === 'erase') {
      fillImageData = this.fillWithErase(width, height, maskData);
    } else {
      return false;
    }

    const hiddenLayerName = `${currentLayer.name} (backup)`;
    const hiddenLayer = this.document.addLayer(hiddenLayerName);
    hiddenLayer.visible = false;

    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = width;
    hiddenCanvas.height = height;
    const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
    if (hiddenCtx) {
      hiddenCtx.putImageData(
        new ImageData(originalPixels, width, height),
        0,
        0
      );
      const hiddenData = hiddenCtx.getImageData(0, 0, width, height);
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const idx = py * width + px;
          if (maskData[idx] > 0) {
            const dataIdx = idx * 4;
            const layerIndex = (y + py) * this.document.canvasWidth() + (x + px);
            const hiddenBuffer = this.document.getLayerBuffer(hiddenLayer.id);
            hiddenBuffer[layerIndex] =
              this.rgbaToHex(
                hiddenData.data[dataIdx],
                hiddenData.data[dataIdx + 1],
                hiddenData.data[dataIdx + 2],
                hiddenData.data[dataIdx + 3]
              );
          }
        }
      }
    }

    const newLayerName = `${currentLayer.name} (filled)`;
    const newLayer = this.document.addLayer(newLayerName);

    tempCtx.putImageData(fillImageData, 0, 0);
    const filledData = tempCtx.getImageData(0, 0, width, height);
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px;
        if (maskData[idx] > 0) {
          const dataIdx = idx * 4;
          const layerIndex = (y + py) * this.document.canvasWidth() + (x + px);
          const newBuffer = this.document.getLayerBuffer(newLayer.id);
          newBuffer[layerIndex] =
            this.rgbaToHex(
              filledData.data[dataIdx],
              filledData.data[dataIdx + 1],
              filledData.data[dataIdx + 2],
              filledData.data[dataIdx + 3]
            );
        }
      }
    }

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px;
        if (maskData[idx] > 0) {
          const layerIndex = (y + py) * this.document.canvasWidth() + (x + px);
          const currentBuffer = this.document.getLayerBuffer(currentLayer.id);
          currentBuffer[layerIndex] = '';
        }
      }
    }

    return true;
  }

  private fillWithColor(
    width: number,
    height: number,
    maskData: Uint8Array,
    color: string
  ): ImageData {
    const imageData = new ImageData(width, height);
    const data = imageData.data;
    const rgba = this.hexToRgba(color);

    for (let i = 0; i < width * height; i++) {
      if (maskData[i] > 0) {
        const idx = i * 4;
        data[idx] = rgba[0];
        data[idx + 1] = rgba[1];
        data[idx + 2] = rgba[2];
        data[idx + 3] = rgba[3];
      }
    }
    return imageData;
  }

  private fillWithPattern(
    width: number,
    height: number,
    maskData: Uint8Array,
    patternId: string
  ): ImageData {
    const pattern = this.patternLibrary.getPattern(patternId);
    if (!pattern) {
      return new ImageData(width, height);
    }

    const patternSize = 64;
    const patternData = pattern.generate(patternSize);

    const imageData = new ImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (maskData[idx] > 0) {
          const px = x % patternSize;
          const py = y % patternSize;
          const pidx = (py * patternSize + px) * 4;
          const dataIdx = idx * 4;
          data[dataIdx] = patternData.data[pidx];
          data[dataIdx + 1] = patternData.data[pidx + 1];
          data[dataIdx + 2] = patternData.data[pidx + 2];
          data[dataIdx + 3] = patternData.data[pidx + 3];
        }
      }
    }
    return imageData;
  }

  private fillWithContentAware(
    sourceData: ImageData,
    maskData: Uint8Array,
    width: number,
    height: number,
    threshold: number
  ): ImageData {
    return this.contentAwareFill.fillSelection(sourceData, maskData, width, height, {
      threshold,
      sampleRadius: 5,
    });
  }

  private fillWithErase(
    width: number,
    height: number,
    maskData: Uint8Array
  ): ImageData {
    const imageData = new ImageData(width, height);
    return imageData;
  }

  private hexToRgba(hex: string): [number, number, number, number] {
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      return [
        parseInt(clean.substring(0, 2), 16),
        parseInt(clean.substring(2, 4), 16),
        parseInt(clean.substring(4, 6), 16),
        255,
      ];
    } else if (clean.length === 8) {
      return [
        parseInt(clean.substring(0, 2), 16),
        parseInt(clean.substring(2, 4), 16),
        parseInt(clean.substring(4, 6), 16),
        parseInt(clean.substring(6, 8), 16),
      ];
    }
    return [0, 0, 0, 255];
  }

  private rgbaToHex(r: number, g: number, b: number, a: number): string {
    if (a === 0) return '';
    const rh = r.toString(16).padStart(2, '0');
    const gh = g.toString(16).padStart(2, '0');
    const bh = b.toString(16).padStart(2, '0');
    const ah = a.toString(16).padStart(2, '0');
    return `#${rh}${gh}${bh}${ah}`;
  }

  private buildMaskData(
    x: number,
    y: number,
    width: number,
    height: number,
    shape: 'rect' | 'ellipse' | 'lasso',
    mask: Set<string> | null,
    polygon: { x: number; y: number }[] | null
  ): Uint8Array {
    const maskData = new Uint8Array(width * height);

    if (mask) {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const key = `${x + px},${y + py}`;
          maskData[py * width + px] = mask.has(key) ? 255 : 0;
        }
      }
    } else if (shape === 'rect') {
      maskData.fill(255);
    } else if (shape === 'ellipse') {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width / 2;
      const ry = height / 2;
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const dx = (px - cx) / rx;
          const dy = (py - cy) / ry;
          maskData[py * width + px] = dx * dx + dy * dy <= 1 ? 255 : 0;
        }
      }
    } else if (shape === 'lasso' && polygon) {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const gx = x + px;
          const gy = y + py;
          if (this.pointInPolygon(gx, gy, polygon)) {
            maskData[py * width + px] = 255;
          }
        }
      }
    }
    return maskData;
  }

  private pointInPolygon(
    x: number,
    y: number,
    polygon: { x: number; y: number }[]
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private renderBufferToCanvas(
    buffer: string[],
    canvasWidth: number,
    canvas: HTMLCanvasElement
  ): void {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < buffer.length; i++) {
      const hex = buffer[i];
      if (hex) {
        const rgba = this.hexToRgba(hex);
        const idx = i * 4;
        data[idx] = rgba[0];
        data[idx + 1] = rgba[1];
        data[idx + 2] = rgba[2];
        data[idx + 3] = rgba[3];
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
}
