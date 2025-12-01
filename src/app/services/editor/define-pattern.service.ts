import { Injectable, inject, signal, computed } from '@angular/core';
import { PatternLibraryService, CustomPattern } from '../pattern-library.service';
import { EditorCanvasStateService } from './editor-canvas-state.service';
import { EditorSelectionService } from './editor-selection.service';
import { EditorLayerService } from './editor-layer.service';

export interface DefinePatternState {
  active: boolean;
  name: string;
  scale: number;
  opacity: number;
  livePreview: boolean;
  imageDataBase64: string | null;
  pixelData: number[] | null;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class DefinePatternService {
  private readonly patternLibrary = inject(PatternLibraryService);
  private readonly canvasState = inject(EditorCanvasStateService);
  private readonly selectionService = inject(EditorSelectionService);
  private readonly layerService = inject(EditorLayerService);

  private readonly state = signal<DefinePatternState>({
    active: false,
    name: '',
    scale: 1,
    opacity: 1,
    livePreview: false,
    imageDataBase64: null,
    pixelData: null,
    width: 0,
    height: 0,
  });

  readonly isActive = computed(() => this.state().active);
  readonly patternName = computed(() => this.state().name);
  readonly patternScale = computed(() => this.state().scale);
  readonly patternOpacity = computed(() => this.state().opacity);
  readonly livePreviewEnabled = computed(() => this.state().livePreview);
  readonly imageDataBase64 = computed(() => this.state().imageDataBase64);
  readonly patternWidth = computed(() => this.state().width);
  readonly patternHeight = computed(() => this.state().height);

  readonly hasSelection = computed(() => {
    const sel = this.selectionService.selectionRect();
    return sel !== null && sel.width > 0 && sel.height > 0;
  });

  activate(): boolean {
    const sel = this.selectionService.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      return false;
    }

    const imageData = this.extractSelectionImageData();
    if (!imageData) {
      return false;
    }

    const base64 = this.imageDataToBase64(imageData.data, imageData.width, imageData.height);
    const pixelData = Array.from(imageData.data.data);

    this.state.set({
      active: true,
      name: `Pattern ${Date.now() % 10000}`,
      scale: 1,
      opacity: 1,
      livePreview: false,
      imageDataBase64: base64,
      pixelData: pixelData,
      width: imageData.width,
      height: imageData.height,
    });

    return true;
  }

  deactivate(): void {
    this.state.set({
      active: false,
      name: '',
      scale: 1,
      opacity: 1,
      livePreview: false,
      imageDataBase64: null,
      pixelData: null,
      width: 0,
      height: 0,
    });
  }

  setName(name: string): void {
    this.state.update(s => ({ ...s, name }));
  }

  setScale(scale: number): void {
    const clampedScale = Math.max(0.1, Math.min(4, scale));
    this.state.update(s => ({ ...s, scale: clampedScale }));
  }

  setOpacity(opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.state.update(s => ({ ...s, opacity: clampedOpacity }));
  }

  setLivePreview(enabled: boolean): void {
    this.state.update(s => ({ ...s, livePreview: enabled }));
  }

  savePattern(): CustomPattern | null {
    const s = this.state();
    if (!s.active || !s.imageDataBase64) {
      return null;
    }

    const pattern = this.patternLibrary.addCustomPattern({
      name: s.name || 'Untitled Pattern',
      imageDataBase64: s.imageDataBase64,
      pixelData: s.pixelData || undefined,
      width: s.width,
      height: s.height,
      scale: s.scale,
      opacity: s.opacity,
    });

    this.deactivate();
    return pattern;
  }

  private extractSelectionImageData(): { data: ImageData; width: number; height: number } | null {
    const sel = this.selectionService.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      return null;
    }

    const shape = this.selectionService.selectionShape();
    const poly = this.selectionService.selectionPolygon();
    const layerId = this.layerService.selectedLayerId();
    const buffer = this.canvasState.getLayerBuffer(layerId);
    if (!buffer || buffer.length === 0) {
      return null;
    }

    const canvasWidth = this.canvasState.canvasWidth();
    const canvasHeight = this.canvasState.canvasHeight();
    const imageData = new ImageData(sel.width, sel.height);

    for (let y = 0; y < sel.height; y++) {
      for (let x = 0; x < sel.width; x++) {
        const srcX = sel.x + x;
        const srcY = sel.y + y;
        if (srcX < 0 || srcX >= canvasWidth || srcY < 0 || srcY >= canvasHeight) {
          continue;
        }

        if (!this.selectionService.isPixelWithinSelection(srcX, srcY, sel, shape, poly)) {
          continue;
        }

        const srcIdx = srcY * canvasWidth + srcX;
        const colorStr = buffer[srcIdx];
        if (!colorStr) continue;

        const destIdx = (y * sel.width + x) * 4;
        const rgba = this.parseColor(colorStr);
        imageData.data[destIdx] = rgba.r;
        imageData.data[destIdx + 1] = rgba.g;
        imageData.data[destIdx + 2] = rgba.b;
        imageData.data[destIdx + 3] = rgba.a;
      }
    }

    return { data: imageData, width: sel.width, height: sel.height };
  }

  private parseColor(colorStr: string): { r: number; g: number; b: number; a: number } {
    if (colorStr.startsWith('rgba(')) {
      const match = colorStr.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
      if (match) {
        return {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10),
          a: Math.round(parseFloat(match[4]) * 255),
        };
      }
    } else if (colorStr.startsWith('rgb(')) {
      const match = colorStr.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (match) {
        return {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10),
          a: 255,
        };
      }
    } else if (colorStr.startsWith('#')) {
      let hex = colorStr.slice(1);
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 255,
        };
      } else if (hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: parseInt(hex.slice(6, 8), 16),
        };
      }
    }
    return { r: 0, g: 0, b: 0, a: 255 };
  }

  private imageDataToBase64(imageData: ImageData, width: number, height: number): string {
    if (typeof document === 'undefined') return '';

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  generateThumbnail(maxSize: number = 64): string | null {
    const s = this.state();
    if (!s.pixelData && !s.imageDataBase64) return null;
    if (typeof document === 'undefined') return null;

    const srcW = s.width;
    const srcH = s.height;
    if (srcW <= 0 || srcH <= 0) return null;

    const scale = Math.min(maxSize / srcW, maxSize / srcH, 1);
    const destW = Math.max(1, Math.floor(srcW * scale));
    const destH = Math.max(1, Math.floor(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (s.pixelData && s.pixelData.length === srcW * srcH * 4) {
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = srcW;
      srcCanvas.height = srcH;
      const srcCtx = srcCanvas.getContext('2d');
      if (srcCtx) {
        const imageData = srcCtx.createImageData(srcW, srcH);
        for (let i = 0; i < s.pixelData.length; i++) {
          imageData.data[i] = s.pixelData[i];
        }
        srcCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(srcCanvas, 0, 0, destW, destH);
      }
    } else if (s.imageDataBase64) {
      const img = new Image();
      img.src = s.imageDataBase64;
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, destW, destH);
      }
    }

    return canvas.toDataURL('image/png');
  }

  generateTilePreview(tileSize: number = 128, repeatCount: number = 3): string | null {
    const s = this.state();
    if (typeof document === 'undefined') return null;
    if (!s.imageDataBase64 && !s.pixelData) return null;

    const canvas = document.createElement('canvas');
    const totalSize = tileSize * repeatCount;
    canvas.width = totalSize;
    canvas.height = totalSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaledW = Math.max(1, Math.floor(s.width * s.scale));
    const scaledH = Math.max(1, Math.floor(s.height * s.scale));

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalSize, totalSize);
    ctx.globalAlpha = s.opacity;

    if (s.pixelData && s.pixelData.length === s.width * s.height * 4) {
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = s.width;
      patternCanvas.height = s.height;
      const patternCtx = patternCanvas.getContext('2d');
      if (patternCtx) {
        const imageData = patternCtx.createImageData(s.width, s.height);
        for (let i = 0; i < s.pixelData.length; i++) {
          imageData.data[i] = s.pixelData[i];
        }
        patternCtx.putImageData(imageData, 0, 0);

        for (let y = 0; y < totalSize; y += scaledH) {
          for (let x = 0; x < totalSize; x += scaledW) {
            ctx.drawImage(patternCanvas, x, y, scaledW, scaledH);
          }
        }
      }
    } else if (s.imageDataBase64) {
      const img = new Image();
      img.src = s.imageDataBase64;

      if (img.complete && img.naturalWidth > 0) {
        for (let y = 0; y < totalSize; y += scaledH) {
          for (let x = 0; x < totalSize; x += scaledW) {
            ctx.drawImage(img, x, y, scaledW, scaledH);
          }
        }
      }
    }

    return canvas.toDataURL('image/png');
  }
}
