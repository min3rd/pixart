import { Injectable, signal, computed, inject } from '@angular/core';
import { EditorDocumentService } from '../editor-document.service';
import { EditorToolsService } from '../editor-tools.service';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type StrokePosition = 'inside' | 'outside' | 'center';

export interface StrokeOptions {
  color: string;
  width: number;
  style: StrokeStyle;
  position: StrokePosition;
}

@Injectable({ providedIn: 'root' })
export class EditorStrokeService {
  private readonly document = inject(EditorDocumentService);
  private readonly tools = inject(EditorToolsService);

  readonly isActive = signal(false);
  readonly strokeColor = signal('#000000');
  readonly strokeWidth = signal(1);
  readonly strokeStyle = signal<StrokeStyle>('solid');
  readonly strokePosition = signal<StrokePosition>('outside');
  readonly previewEnabled = signal(true);

  readonly options = computed<StrokeOptions>(() => ({
    color: this.strokeColor(),
    width: this.strokeWidth(),
    style: this.strokeStyle(),
    position: this.strokePosition(),
  }));

  activate(): void {
    const brushColor = this.tools.brushColor();
    if (brushColor) {
      this.strokeColor.set(brushColor);
    }
    this.isActive.set(true);
  }

  deactivate(): void {
    this.isActive.set(false);
  }

  setStrokeColor(color: string): void {
    this.strokeColor.set(color);
  }

  setStrokeWidth(width: number): void {
    this.strokeWidth.set(Math.max(1, Math.min(20, width)));
  }

  setStrokeStyle(style: StrokeStyle): void {
    this.strokeStyle.set(style);
  }

  setStrokePosition(position: StrokePosition): void {
    this.strokePosition.set(position);
  }

  setPreviewEnabled(enabled: boolean): void {
    this.previewEnabled.set(enabled);
  }

  getStrokePreview(): ImageData | null {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) return null;

    const currentLayer = this.document.selectedLayer();
    if (!currentLayer || currentLayer.type !== 'layer') return null;

    const { x, y, width, height } = sel;
    const strokeWidth = this.strokeWidth();
    const position = this.strokePosition();
    const style = this.strokeStyle();
    const color = this.strokeColor();

    let previewWidth = width;
    let previewHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (position === 'outside') {
      previewWidth = width + strokeWidth * 2;
      previewHeight = height + strokeWidth * 2;
      offsetX = strokeWidth;
      offsetY = strokeWidth;
    } else if (position === 'center') {
      previewWidth = width + strokeWidth;
      previewHeight = height + strokeWidth;
      offsetX = Math.floor(strokeWidth / 2);
      offsetY = Math.floor(strokeWidth / 2);
    }

    const imageData = new ImageData(previewWidth, previewHeight);
    const rgba = this.hexToRgba(color);

    this.drawStrokeBorder(
      imageData,
      previewWidth,
      previewHeight,
      offsetX,
      offsetY,
      width,
      height,
      strokeWidth,
      position,
      style,
      rgba,
    );

    return imageData;
  }

  applyStroke(): boolean {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) return false;

    const currentLayer = this.document.selectedLayer();
    if (!currentLayer || currentLayer.type !== 'layer') return false;

    const { x, y, width, height } = sel;
    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();
    const layerBuffer = this.document.getLayerBuffer(currentLayer.id);

    const strokeWidth = this.strokeWidth();
    const position = this.strokePosition();
    const style = this.strokeStyle();
    const color = this.strokeColor();
    const selectionShape = this.document.selectionShape();
    const selectionMask = this.document.selectionMask();
    const selectionPolygon = this.document.selectionPolygon();

    this.document.saveSnapshot('Stroke');

    const hiddenLayerName = `${currentLayer.name} (original)`;
    const hiddenLayer = this.document.addLayer(hiddenLayerName);
    const hiddenLayerTreeItem = this.document.findItemById(
      this.document.layers(),
      hiddenLayer.id,
    );
    if (hiddenLayerTreeItem) {
      hiddenLayerTreeItem.visible = false;
    }

    const hiddenBuffer = this.document.getLayerBuffer(hiddenLayer.id);
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const srcX = x + px;
        const srcY = y + py;
        if (
          srcX >= 0 &&
          srcX < canvasWidth &&
          srcY >= 0 &&
          srcY < canvasHeight
        ) {
          const layerIdx = srcY * canvasWidth + srcX;
          hiddenBuffer[layerIdx] = layerBuffer[layerIdx] || '';
        }
      }
    }

    const strokeLayerName = `${currentLayer.name} (stroke)`;
    const strokeLayer = this.document.addLayer(strokeLayerName);
    const strokeBuffer = this.document.getLayerBuffer(strokeLayer.id);

    const strokePixels = this.calculateStrokePixels(
      x,
      y,
      width,
      height,
      strokeWidth,
      position,
      style,
      selectionShape,
      selectionMask,
      selectionPolygon,
    );

    const rgba = this.hexToRgba(color);
    const hexColor = this.rgbaToHex(rgba[0], rgba[1], rgba[2], rgba[3]);

    for (const pixel of strokePixels) {
      const { px, py } = pixel;
      if (px >= 0 && px < canvasWidth && py >= 0 && py < canvasHeight) {
        const layerIdx = py * canvasWidth + px;
        strokeBuffer[layerIdx] = hexColor;
      }
    }

    return true;
  }

  private calculateStrokePixels(
    x: number,
    y: number,
    width: number,
    height: number,
    strokeWidth: number,
    position: StrokePosition,
    style: StrokeStyle,
    selectionShape: 'rect' | 'ellipse' | 'lasso',
    selectionMask: Set<string> | null,
    selectionPolygon: { x: number; y: number }[] | null,
  ): { px: number; py: number }[] {
    const pixels: { px: number; py: number }[] = [];

    if (selectionShape === 'rect' || !selectionMask) {
      return this.calculateRectStrokePixels(
        x,
        y,
        width,
        height,
        strokeWidth,
        position,
        style,
      );
    } else if (selectionShape === 'ellipse') {
      return this.calculateEllipseStrokePixels(
        x,
        y,
        width,
        height,
        strokeWidth,
        position,
        style,
      );
    } else if (selectionShape === 'lasso' && selectionPolygon) {
      return this.calculateLassoStrokePixels(
        x,
        y,
        width,
        height,
        strokeWidth,
        position,
        style,
        selectionMask,
        selectionPolygon,
      );
    }

    return pixels;
  }

  private calculateRectStrokePixels(
    x: number,
    y: number,
    width: number,
    height: number,
    strokeWidth: number,
    position: StrokePosition,
    style: StrokeStyle,
  ): { px: number; py: number }[] {
    const pixels: { px: number; py: number }[] = [];

    let startX = x;
    let startY = y;
    let endX = x + width - 1;
    let endY = y + height - 1;

    if (position === 'outside') {
      startX -= strokeWidth;
      startY -= strokeWidth;
      endX += strokeWidth;
      endY += strokeWidth;
    } else if (position === 'center') {
      const halfWidth = Math.floor(strokeWidth / 2);
      startX -= halfWidth;
      startY -= halfWidth;
      endX += halfWidth + (strokeWidth % 2 === 0 ? 0 : 1);
      endY += halfWidth + (strokeWidth % 2 === 0 ? 0 : 1);
    }

    for (let sw = 0; sw < strokeWidth; sw++) {
      let currentStartX = startX;
      let currentStartY = startY;
      let currentEndX = endX;
      let currentEndY = endY;

      if (position === 'inside') {
        currentStartX = x + sw;
        currentStartY = y + sw;
        currentEndX = x + width - 1 - sw;
        currentEndY = y + height - 1 - sw;
      } else if (position === 'outside') {
        currentStartX = startX + sw;
        currentStartY = startY + sw;
        currentEndX = endX - sw;
        currentEndY = endY - sw;
      } else {
        const halfWidth = Math.floor(strokeWidth / 2);
        currentStartX = x - halfWidth + sw;
        currentStartY = y - halfWidth + sw;
        currentEndX =
          x + width - 1 + halfWidth - sw + (strokeWidth % 2 === 0 ? 0 : 1);
        currentEndY =
          y + height - 1 + halfWidth - sw + (strokeWidth % 2 === 0 ? 0 : 1);
      }

      if (currentStartX > currentEndX || currentStartY > currentEndY) continue;

      for (let px = currentStartX; px <= currentEndX; px++) {
        if (this.shouldDrawPixel(px, currentStartY, style)) {
          pixels.push({ px, py: currentStartY });
        }
        if (this.shouldDrawPixel(px, currentEndY, style)) {
          pixels.push({ px, py: currentEndY });
        }
      }

      for (let py = currentStartY + 1; py < currentEndY; py++) {
        if (this.shouldDrawPixel(currentStartX, py, style)) {
          pixels.push({ px: currentStartX, py });
        }
        if (this.shouldDrawPixel(currentEndX, py, style)) {
          pixels.push({ px: currentEndX, py });
        }
      }
    }

    return pixels;
  }

  private calculateEllipseStrokePixels(
    x: number,
    y: number,
    width: number,
    height: number,
    strokeWidth: number,
    position: StrokePosition,
    style: StrokeStyle,
  ): { px: number; py: number }[] {
    const pixels: { px: number; py: number }[] = [];

    const cx = x + width / 2;
    const cy = y + height / 2;
    let outerRx = width / 2;
    let outerRy = height / 2;
    let innerRx = outerRx;
    let innerRy = outerRy;

    if (position === 'outside') {
      outerRx += strokeWidth;
      outerRy += strokeWidth;
    } else if (position === 'inside') {
      innerRx -= strokeWidth;
      innerRy -= strokeWidth;
    } else {
      const halfWidth = strokeWidth / 2;
      outerRx += halfWidth;
      outerRy += halfWidth;
      innerRx -= halfWidth;
      innerRy -= halfWidth;
    }

    const minX = Math.floor(cx - outerRx);
    const maxX = Math.ceil(cx + outerRx);
    const minY = Math.floor(cy - outerRy);
    const maxY = Math.ceil(cy + outerRy);

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const outerDist =
          (dx * dx) / (outerRx * outerRx) + (dy * dy) / (outerRy * outerRy);
        const innerDist =
          (dx * dx) / (innerRx * innerRx) + (dy * dy) / (innerRy * innerRy);

        if (outerDist <= 1 && innerDist > 1) {
          if (this.shouldDrawPixel(px, py, style)) {
            pixels.push({ px, py });
          }
        }
      }
    }

    return pixels;
  }

  private calculateLassoStrokePixels(
    x: number,
    y: number,
    width: number,
    height: number,
    strokeWidth: number,
    position: StrokePosition,
    style: StrokeStyle,
    selectionMask: Set<string>,
    selectionPolygon: { x: number; y: number }[],
  ): { px: number; py: number }[] {
    const pixels: { px: number; py: number }[] = [];

    const edgePixels = this.findEdgePixels(x, y, width, height, selectionMask);

    for (const edge of edgePixels) {
      for (let sw = 0; sw < strokeWidth; sw++) {
        let offset = sw;
        if (position === 'inside') {
          offset = -sw;
        } else if (position === 'center') {
          offset = sw - Math.floor(strokeWidth / 2);
        }

        for (let dx = -offset; dx <= offset; dx++) {
          for (let dy = -offset; dy <= offset; dy++) {
            const px = edge.px + dx;
            const py = edge.py + dy;
            if (this.shouldDrawPixel(px, py, style)) {
              pixels.push({ px, py });
            }
          }
        }
      }
    }

    return pixels;
  }

  private findEdgePixels(
    x: number,
    y: number,
    width: number,
    height: number,
    selectionMask: Set<string>,
  ): { px: number; py: number }[] {
    const edges: { px: number; py: number }[] = [];

    for (let py = y; py < y + height; py++) {
      for (let px = x; px < x + width; px++) {
        const key = `${px},${py}`;
        if (selectionMask.has(key)) {
          const neighbors = [
            `${px - 1},${py}`,
            `${px + 1},${py}`,
            `${px},${py - 1}`,
            `${px},${py + 1}`,
          ];
          const isEdge = neighbors.some((n) => !selectionMask.has(n));
          if (isEdge) {
            edges.push({ px, py });
          }
        }
      }
    }

    return edges;
  }

  private shouldDrawPixel(px: number, py: number, style: StrokeStyle): boolean {
    if (style === 'solid') return true;
    if (style === 'dashed') {
      const segment = Math.floor((px + py) / 4);
      return segment % 2 === 0;
    }
    if (style === 'dotted') {
      return (px + py) % 2 === 0;
    }
    return true;
  }

  private drawStrokeBorder(
    imageData: ImageData,
    previewWidth: number,
    previewHeight: number,
    offsetX: number,
    offsetY: number,
    selWidth: number,
    selHeight: number,
    strokeWidth: number,
    position: StrokePosition,
    style: StrokeStyle,
    rgba: [number, number, number, number],
  ): void {
    const data = imageData.data;

    const pixels = this.calculateRectStrokePixels(
      offsetX,
      offsetY,
      selWidth,
      selHeight,
      strokeWidth,
      position,
      style,
    );

    for (const pixel of pixels) {
      const { px, py } = pixel;
      if (px >= 0 && px < previewWidth && py >= 0 && py < previewHeight) {
        const idx = (py * previewWidth + px) * 4;
        data[idx] = rgba[0];
        data[idx + 1] = rgba[1];
        data[idx + 2] = rgba[2];
        data[idx + 3] = rgba[3];
      }
    }
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
}
