import { Injectable, inject, signal, computed } from '@angular/core';
import { EditorDocumentService } from '../editor-document.service';
import { EditorToolsService } from '../editor-tools.service';
import { EditorCanvasStateService } from './editor-canvas-state.service';
import { EditorLayerService } from './editor-layer.service';
import { LayerItem, isLayer } from './editor.types';
import { TextToPixelConverterService } from './text-to-pixel-converter.service';

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
  private readonly textConverter = inject(TextToPixelConverterService);

  readonly isActive = signal<boolean>(false);
  readonly textBounds = signal<TextBounds | null>(null);
  readonly currentText = signal<string>('');
  readonly isEditing = signal<boolean>(false);
  readonly editingLayerId = signal<string | null>(null);

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

  startEditSession(layerId: string, bounds: TextBounds, existingText: string): void {
    this.textBounds.set(bounds);
    this.currentText.set(existingText);
    this.isEditing.set(true);
    this.isActive.set(true);
    this.editingLayerId.set(layerId);
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
    const editingLayerId = this.editingLayerId();

    let resultLayer: LayerItem | null;
    if (editingLayerId) {
      resultLayer = await this.updateTextLayer(editingLayerId, text, fontFamily, fontSize, color, bounds);
    } else {
      resultLayer = await this.createTextLayer(text, fontFamily, fontSize, color, bounds);
    }

    this.resetSession();

    return resultLayer;
  }

  cancelText(): void {
    this.resetSession();
  }

  private resetSession(): void {
    this.isActive.set(false);
    this.textBounds.set(null);
    this.currentText.set('');
    this.isEditing.set(false);
    this.editingLayerId.set(null);
  }

  private async updateTextLayer(
    layerId: string,
    text: string,
    fontFamily: string,
    fontSize: number,
    color: string,
    bounds: TextBounds,
  ): Promise<LayerItem | null> {
    const result = await this.textConverter.renderTextToPixels({
      text,
      fontFamily,
      fontSize,
      color,
    });

    if (!result) return null;

    const { width: renderWidth, height: renderHeight, imageData } = result;

    this.document.saveSnapshot('Edit text');

    const canvasWidth = this.canvasState.canvasWidth();
    const canvasHeight = this.canvasState.canvasHeight();

    const buffer = this.canvasState.getLayerBuffer(layerId);
    if (!buffer) return null;

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = '';
    }

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
          const destIdx = destY * canvasWidth + destX;
          if (a >= 255) {
            buffer[destIdx] = `rgb(${r},${g},${b})`;
          } else {
            buffer[destIdx] = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
          }
        }
      }
    }

    this.canvasState.setLayerBuffer(layerId, buffer);

    const layers = this.layerService.layers();
    const existingLayerItem = layers.find(l => l.id === layerId);
    if (existingLayerItem && isLayer(existingLayerItem)) {
      const updatedLayer: LayerItem = {
        ...existingLayerItem,
        name: `Text: ${text.substring(0, 15)}${text.length > 15 ? '...' : ''}`,
      };
      this.layerService.layers.update(arr => arr.map(l => l.id === layerId ? updatedLayer : l));
      
      this.canvasState.incrementPixelsVersion();
      this.canvasState.setCanvasSaved(false);
      
      return updatedLayer;
    }

    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);

    return null;
  }

  private async createTextLayer(
    text: string,
    fontFamily: string,
    fontSize: number,
    color: string,
    bounds: TextBounds,
  ): Promise<LayerItem | null> {
    const result = await this.textConverter.renderTextToPixels({
      text,
      fontFamily,
      fontSize,
      color,
    });

    if (!result) return null;

    const { width: renderWidth, height: renderHeight, imageData } = result;

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

    this.canvasState.ensureLayerBuffer(layerId, canvasWidth, canvasHeight);
    const buffer = this.canvasState.getLayerBuffer(layerId);

    if (!buffer) return null;

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
          const destIdx = destY * canvasWidth + destX;
          if (a >= 255) {
            buffer[destIdx] = `rgb(${r},${g},${b})`;
          } else {
            buffer[destIdx] = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
          }
        }
      }
    }

    this.canvasState.setLayerBuffer(layerId, buffer);

    this.layerService.layers.update((arr) => [newLayer, ...arr]);
    this.layerService.selectedLayerId.set(layerId);
    this.layerService.selectedLayerIds.set(new Set([layerId]));

    this.canvasState.incrementPixelsVersion();
    this.canvasState.setCanvasSaved(false);

    return newLayer;
  }

}
