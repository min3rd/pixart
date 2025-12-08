import { Injectable, inject, signal, computed } from '@angular/core';
import { EditorDocumentService } from '../editor-document.service';
import { EditorToolsService } from '../editor-tools.service';
import { EditorCanvasStateService } from './editor-canvas-state.service';
import { EditorLayerService } from './editor-layer.service';
import { LayerItem } from './editor.types';

export interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextSessionState {
  bounds: TextBounds;
  text: string;
  isEditing: boolean;
}

@Injectable({ providedIn: 'root' })
export class EditorTextSessionService {
  private readonly document = inject(EditorDocumentService);
  private readonly tools = inject(EditorToolsService);
  private readonly canvasState = inject(EditorCanvasStateService);
  private readonly layerService = inject(EditorLayerService);

  readonly isActive = signal<boolean>(false);
  readonly textBounds = signal<TextBounds | null>(null);
  readonly currentText = signal<string>('');
  readonly isEditing = signal<boolean>(false);

  readonly sessionState = computed<TextSessionState | null>(() => {
    if (!this.isActive()) return null;
    const bounds = this.textBounds();
    if (!bounds) return null;
    return {
      bounds,
      text: this.currentText(),
      isEditing: this.isEditing(),
    };
  });

  startTextSession(x: number, y: number, width: number, height: number): void {
    const canvasWidth = this.canvasState.canvasWidth();
    const canvasHeight = this.canvasState.canvasHeight();

    let clampedX = Math.floor(x);
    let clampedY = Math.floor(y);

    if (clampedX < 0 || clampedX >= canvasWidth || clampedY < 0 || clampedY >= canvasHeight) {
      clampedX = 0;
      clampedY = 0;
    }

    const maxWidth = canvasWidth - clampedX;
    const maxHeight = canvasHeight - clampedY;

    const effectiveWidth = maxWidth < 10 ? canvasWidth : Math.max(10, Math.min(Math.floor(width), maxWidth));
    const effectiveHeight = maxHeight < 10 ? canvasHeight : Math.max(10, Math.min(Math.floor(height), maxHeight));

    if (maxWidth < 10 || maxHeight < 10) {
      clampedX = 0;
      clampedY = 0;
    }

    const bounds: TextBounds = {
      x: clampedX,
      y: clampedY,
      width: effectiveWidth,
      height: effectiveHeight,
    };
    this.textBounds.set(bounds);
    this.currentText.set('');
    this.isEditing.set(true);
    this.isActive.set(true);
  }

  startEditSession(x: number, y: number, existingText: string): void {
    const fontSize = this.tools.textFontSize();
    const estimatedWidth = Math.max(50, existingText.length * fontSize * 0.6);
    const estimatedHeight = fontSize * 1.5;

    const bounds: TextBounds = {
      x: Math.floor(x),
      y: Math.floor(y),
      width: Math.floor(estimatedWidth),
      height: Math.floor(estimatedHeight),
    };
    this.textBounds.set(bounds);
    this.currentText.set(existingText);
    this.isEditing.set(true);
    this.isActive.set(true);
  }

  updateTextContent(text: string): void {
    this.currentText.set(text);
  }

  updateBounds(bounds: TextBounds): void {
    this.textBounds.set(bounds);
  }

  async commitText(): Promise<LayerItem | null> {
    if (!this.isActive()) return null;

    const bounds = this.textBounds();
    const text = this.currentText();

    if (!bounds || !text || text.trim().length === 0) {
      this.cancelText();
      return null;
    }

    const fontFamily = this.tools.textFontFamily();
    const fontSize = this.tools.textFontSize();
    const color = this.tools.textColor();

    const newLayer = await this.createTextLayer(text, fontFamily, fontSize, color, bounds);

    this.resetSession();

    return newLayer;
  }

  cancelText(): void {
    this.resetSession();
  }

  private resetSession(): void {
    this.isActive.set(false);
    this.textBounds.set(null);
    this.currentText.set('');
    this.isEditing.set(false);
  }

  private async createTextLayer(
    text: string,
    fontFamily: string,
    fontSize: number,
    color: string,
    bounds: TextBounds,
  ): Promise<LayerItem | null> {
    const fontLoaded = await this.ensureFontLoaded(fontFamily);
    const effectiveFont = fontLoaded ? `"${fontFamily}"` : 'monospace';

    console.log('[TextTool] Creating text layer:', { text, fontFamily, fontSize, color, bounds, fontLoaded, effectiveFont });

    const lines = text.split('\n');
    const lineHeight = Math.ceil(fontSize * 1.2);

    const measureCanvas = document.createElement('canvas');
    measureCanvas.width = 1000;
    measureCanvas.height = 100;
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;

    measureCtx.font = `${fontSize}px ${effectiveFont}, sans-serif`;

    let maxWidth = 1;
    for (const line of lines) {
      const metrics = measureCtx.measureText(line);
      maxWidth = Math.max(maxWidth, Math.ceil(metrics.width) + 4);
    }
    const textHeight = Math.ceil(lineHeight * lines.length) + 4;

    const renderWidth = Math.max(maxWidth, 10);
    const renderHeight = Math.max(textHeight, fontSize + 4);

    console.log('[TextTool] Render dimensions:', { renderWidth, renderHeight, maxWidth, textHeight });

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = renderWidth;
    offscreenCanvas.height = renderHeight;

    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;

    ctx.font = `${fontSize}px ${effectiveFont}, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 2, 2 + i * lineHeight);
    }

    const imageData = ctx.getImageData(0, 0, renderWidth, renderHeight);

    let nonZeroPixels = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] > 0) {
        nonZeroPixels++;
      }
    }
    console.log('[TextTool] Image data:', { totalPixels: imageData.data.length / 4, nonZeroPixels, renderWidth, renderHeight });

    this.document.saveSnapshot('Add text');

    const layerId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer: LayerItem = {
      id: layerId,
      name: `Text: ${text.substring(0, 15)}${text.length > 15 ? '...' : ''}`,
      visible: true,
      locked: false,
      type: 'layer',
    };

    const canvasWidth = this.canvasState.canvasWidth();
    const canvasHeight = this.canvasState.canvasHeight();

    console.log('[TextTool] Canvas dimensions:', { canvasWidth, canvasHeight, boundsX: bounds.x, boundsY: bounds.y });

    this.canvasState.ensureLayerBuffer(layerId, canvasWidth, canvasHeight);
    const buffer = this.canvasState.getLayerBuffer(layerId);

    if (!buffer) return null;

    let pixelsCopied = 0;
    for (let py = 0; py < renderHeight; py++) {
      for (let px = 0; px < renderWidth; px++) {
        const destX = bounds.x + px;
        const destY = bounds.y + py;

        if (destX < 0 || destX >= canvasWidth || destY < 0 || destY >= canvasHeight) {
          continue;
        }

        const srcIdx = (py * renderWidth + px) * 4;
        const r = imageData.data[srcIdx];
        const g = imageData.data[srcIdx + 1];
        const b = imageData.data[srcIdx + 2];
        const a = imageData.data[srcIdx + 3];

        if (a > 0) {
          pixelsCopied++;
          const destIdx = destY * canvasWidth + destX;
          if (a >= 255) {
            buffer[destIdx] = `rgb(${r},${g},${b})`;
          } else {
            buffer[destIdx] = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
          }
        }
      }
    }

    console.log('[TextTool] Pixels copied to buffer:', pixelsCopied);

    this.layerService.layers.update((arr) => [newLayer, ...arr]);
    this.layerService.selectedLayerId.set(layerId);
    this.layerService.selectedLayerIds.set(new Set([layerId]));

    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);

    return newLayer;
  }

  private async ensureFontLoaded(fontFamily: string): Promise<boolean> {
    if (typeof document === 'undefined' || !document.fonts) {
      return false;
    }

    try {
      await document.fonts.load(`16px "${fontFamily}"`);
      await document.fonts.ready;
      const loaded = document.fonts.check(`16px "${fontFamily}"`);
      return loaded;
    } catch (error) {
      console.warn(`Failed to load font "${fontFamily}", using fallback:`, error);
      return false;
    }
  }
}
