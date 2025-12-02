import { Injectable, inject, signal, computed } from '@angular/core';
import {
  ShapeLibraryService,
  CustomShape,
  ShapeType,
} from '../shape-library.service';
import { EditorCanvasStateService } from './editor-canvas-state.service';
import { EditorSelectionService } from './editor-selection.service';
import { EditorLayerService } from './editor-layer.service';

export interface DefineShapeState {
  active: boolean;
  name: string;
  shapeType: ShapeType;
  cornerRadius: number;
  pathSmoothing: number;
  livePreview: boolean;
  imageDataBase64: string | null;
  pixelData: number[] | null;
  vectorPath: string | null;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class DefineShapeService {
  private readonly shapeLibrary = inject(ShapeLibraryService);
  private readonly canvasState = inject(EditorCanvasStateService);
  private readonly selectionService = inject(EditorSelectionService);
  private readonly layerService = inject(EditorLayerService);

  private readonly state = signal<DefineShapeState>({
    active: false,
    name: '',
    shapeType: 'filled',
    cornerRadius: 0,
    pathSmoothing: 0.5,
    livePreview: false,
    imageDataBase64: null,
    pixelData: null,
    vectorPath: null,
    width: 0,
    height: 0,
  });

  readonly isActive = computed(() => this.state().active);
  readonly shapeName = computed(() => this.state().name);
  readonly shapeType = computed(() => this.state().shapeType);
  readonly cornerRadius = computed(() => this.state().cornerRadius);
  readonly pathSmoothing = computed(() => this.state().pathSmoothing);
  readonly livePreviewEnabled = computed(() => this.state().livePreview);
  readonly imageDataBase64 = computed(() => this.state().imageDataBase64);
  readonly vectorPath = computed(() => this.state().vectorPath);
  readonly shapeWidth = computed(() => this.state().width);
  readonly shapeHeight = computed(() => this.state().height);

  readonly hasSelection = computed(() => {
    const sel = this.selectionService.selectionRect();
    return sel !== null && sel.width > 0 && sel.height > 0;
  });

  readonly customShapes = this.shapeLibrary.customShapes;

  activate(): boolean {
    const sel = this.selectionService.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      return false;
    }

    const imageData = this.extractSelectionImageData();
    if (!imageData) {
      return false;
    }

    const base64 = this.imageDataToBase64(
      imageData.data,
      imageData.width,
      imageData.height,
    );
    const pixelData = Array.from(imageData.data.data);
    const vectorPath = this.generateVectorPath(
      pixelData,
      imageData.width,
      imageData.height,
      0,
      0.5,
    );

    this.state.set({
      active: true,
      name: `Shape ${Date.now() % 10000}`,
      shapeType: 'filled',
      cornerRadius: 0,
      pathSmoothing: 0.5,
      livePreview: false,
      imageDataBase64: base64,
      pixelData: pixelData,
      vectorPath: vectorPath,
      width: imageData.width,
      height: imageData.height,
    });

    return true;
  }

  deactivate(): void {
    this.state.set({
      active: false,
      name: '',
      shapeType: 'filled',
      cornerRadius: 0,
      pathSmoothing: 0.5,
      livePreview: false,
      imageDataBase64: null,
      pixelData: null,
      vectorPath: null,
      width: 0,
      height: 0,
    });
  }

  setName(name: string): void {
    this.state.update((s) => ({ ...s, name }));
  }

  setShapeType(shapeType: ShapeType): void {
    this.state.update((s) => ({ ...s, shapeType }));
  }

  setCornerRadius(cornerRadius: number): void {
    const clamped = Math.max(0, Math.min(50, cornerRadius));
    const s = this.state();
    const newPath = this.generateVectorPath(
      s.pixelData || [],
      s.width,
      s.height,
      clamped,
      s.pathSmoothing,
    );
    this.state.update((st) => ({
      ...st,
      cornerRadius: clamped,
      vectorPath: newPath,
    }));
  }

  setPathSmoothing(pathSmoothing: number): void {
    const clamped = Math.max(0, Math.min(1, pathSmoothing));
    const s = this.state();
    const newPath = this.generateVectorPath(
      s.pixelData || [],
      s.width,
      s.height,
      s.cornerRadius,
      clamped,
    );
    this.state.update((st) => ({
      ...st,
      pathSmoothing: clamped,
      vectorPath: newPath,
    }));
  }

  setLivePreview(enabled: boolean): void {
    this.state.update((s) => ({ ...s, livePreview: enabled }));
  }

  saveShape(): CustomShape | null {
    const s = this.state();
    if (!s.active || !s.imageDataBase64) {
      return null;
    }

    const shape = this.shapeLibrary.addCustomShape({
      name: s.name || 'Untitled Shape',
      pathData: s.vectorPath || '',
      shapeType: s.shapeType,
      cornerRadius: s.cornerRadius,
      pathSmoothing: s.pathSmoothing,
      width: s.width,
      height: s.height,
      imageDataBase64: s.imageDataBase64,
    });

    this.deactivate();
    return shape;
  }

  deleteShape(id: string): boolean {
    return this.shapeLibrary.removeCustomShape(id);
  }

  private extractSelectionImageData(): {
    data: ImageData;
    width: number;
    height: number;
  } | null {
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
        if (
          srcX < 0 ||
          srcX >= canvasWidth ||
          srcY < 0 ||
          srcY >= canvasHeight
        ) {
          continue;
        }

        if (
          !this.selectionService.isPixelWithinSelection(
            srcX,
            srcY,
            sel,
            shape,
            poly,
          )
        ) {
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

  private parseColor(colorStr: string): {
    r: number;
    g: number;
    b: number;
    a: number;
  } {
    if (colorStr.startsWith('rgba(')) {
      const match = colorStr.match(
        /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
      );
      if (match) {
        return {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10),
          a: Math.round(parseFloat(match[4]) * 255),
        };
      }
    } else if (colorStr.startsWith('rgb(')) {
      const match = colorStr.match(
        /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/,
      );
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

  private imageDataToBase64(
    imageData: ImageData,
    width: number,
    height: number,
  ): string {
    if (typeof document === 'undefined') return '';

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  private generateVectorPath(
    pixelData: number[],
    width: number,
    height: number,
    cornerRadius: number,
    smoothing: number,
  ): string {
    if (!pixelData || pixelData.length === 0 || width <= 0 || height <= 0) {
      return '';
    }

    const binaryGrid = this.createBinaryGrid(pixelData, width, height);
    const contour = this.extractContour(binaryGrid, width, height);

    if (contour.length < 3) {
      return '';
    }

    const smoothedContour = this.smoothContour(contour, smoothing);
    const pathData = this.contourToPath(smoothedContour, cornerRadius);

    return pathData;
  }

  private createBinaryGrid(
    pixelData: number[],
    width: number,
    height: number,
  ): boolean[][] {
    const grid: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = pixelData[idx + 3] || 0;
        grid[y][x] = alpha > 0;
      }
    }
    return grid;
  }

  private extractContour(
    grid: boolean[][],
    width: number,
    height: number,
  ): { x: number; y: number }[] {
    const contour: { x: number; y: number }[] = [];

    let startX = -1;
    let startY = -1;
    outer: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x]) {
          startX = x;
          startY = y;
          break outer;
        }
      }
    }

    if (startX === -1) return contour;

    const directions = [
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
    ];

    let x = startX;
    let y = startY;
    let dir = 0;
    const visited = new Set<string>();
    const maxIterations = width * height * 4;
    let iterations = 0;

    do {
      const key = `${x},${y}`;
      if (!visited.has(key)) {
        contour.push({ x, y });
        visited.add(key);
      }

      let found = false;
      const startDir = (dir + 5) % 8;

      for (let i = 0; i < 8; i++) {
        const checkDir = (startDir + i) % 8;
        const nx = x + directions[checkDir].dx;
        const ny = y + directions[checkDir].dy;

        if (
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height &&
          grid[ny][nx]
        ) {
          x = nx;
          y = ny;
          dir = checkDir;
          found = true;
          break;
        }
      }

      if (!found) break;
      iterations++;
    } while ((x !== startX || y !== startY) && iterations < maxIterations);

    return contour;
  }

  private smoothContour(
    contour: { x: number; y: number }[],
    smoothing: number,
  ): { x: number; y: number }[] {
    if (contour.length < 3 || smoothing <= 0) {
      return contour;
    }

    const windowSize = Math.max(1, Math.floor(smoothing * 5));
    const smoothed: { x: number; y: number }[] = [];

    for (let i = 0; i < contour.length; i++) {
      let sumX = 0;
      let sumY = 0;
      let count = 0;

      for (let j = -windowSize; j <= windowSize; j++) {
        const idx = (i + j + contour.length) % contour.length;
        sumX += contour[idx].x;
        sumY += contour[idx].y;
        count++;
      }

      smoothed.push({
        x: sumX / count,
        y: sumY / count,
      });
    }

    return smoothed;
  }

  private contourToPath(
    contour: { x: number; y: number }[],
    cornerRadius: number,
  ): string {
    if (contour.length < 3) return '';

    const simplified = this.simplifyContour(contour, 1.0);
    if (simplified.length < 3) return '';

    let path = `M ${simplified[0].x.toFixed(2)} ${simplified[0].y.toFixed(2)}`;

    if (cornerRadius > 0) {
      for (let i = 1; i < simplified.length; i++) {
        const prev = simplified[i - 1];
        const curr = simplified[i];
        const next = simplified[(i + 1) % simplified.length];

        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;

        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        if (len1 > 0 && len2 > 0) {
          const radius = Math.min(cornerRadius, len1 / 2, len2 / 2);
          const startX = curr.x - (dx1 / len1) * radius;
          const startY = curr.y - (dy1 / len1) * radius;
          const endX = curr.x + (dx2 / len2) * radius;
          const endY = curr.y + (dy2 / len2) * radius;

          path += ` L ${startX.toFixed(2)} ${startY.toFixed(2)}`;
          path += ` Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`;
        } else {
          path += ` L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
        }
      }
    } else {
      for (let i = 1; i < simplified.length; i++) {
        path += ` L ${simplified[i].x.toFixed(2)} ${simplified[i].y.toFixed(2)}`;
      }
    }

    path += ' Z';
    return path;
  }

  private simplifyContour(
    contour: { x: number; y: number }[],
    tolerance: number,
  ): { x: number; y: number }[] {
    if (contour.length <= 2) return contour;

    let maxDist = 0;
    let maxIdx = 0;

    const first = contour[0];
    const last = contour[contour.length - 1];

    for (let i = 1; i < contour.length - 1; i++) {
      const dist = this.perpendicularDistance(contour[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > tolerance) {
      const left = this.simplifyContour(contour.slice(0, maxIdx + 1), tolerance);
      const right = this.simplifyContour(contour.slice(maxIdx), tolerance);
      return [...left.slice(0, -1), ...right];
    }

    return [first, last];
  }

  private perpendicularDistance(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLenSq = dx * dx + dy * dy;

    if (lineLenSq === 0) {
      const ddx = point.x - lineStart.x;
      const ddy = point.y - lineStart.y;
      return Math.sqrt(ddx * ddx + ddy * ddy);
    }

    const num = Math.abs(
      dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
    );
    return num / Math.sqrt(lineLenSq);
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
        imageData.data.set(new Uint8ClampedArray(s.pixelData));
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

  generateVectorPreview(previewSize: number = 128): string | null {
    const s = this.state();
    if (typeof document === 'undefined') return null;
    if (!s.vectorPath) return null;

    const canvas = document.createElement('canvas');
    canvas.width = previewSize;
    canvas.height = previewSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, previewSize, previewSize);

    const scaleX = (previewSize - 20) / s.width;
    const scaleY = (previewSize - 20) / s.height;
    const scale = Math.min(scaleX, scaleY, 1);

    const offsetX = (previewSize - s.width * scale) / 2;
    const offsetY = (previewSize - s.height * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const path = new Path2D(s.vectorPath);

    if (s.shapeType === 'filled' || s.shapeType === 'both') {
      ctx.fillStyle = '#3b82f6';
      ctx.fill(path);
    }

    if (s.shapeType === 'outlined' || s.shapeType === 'both') {
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 2 / scale;
      ctx.stroke(path);
    }

    ctx.restore();

    return canvas.toDataURL('image/png');
  }
}
