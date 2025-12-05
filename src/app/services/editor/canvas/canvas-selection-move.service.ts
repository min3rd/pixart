import { Injectable, inject } from '@angular/core';
import { EditorCanvasStateService } from '../editor-canvas-state.service';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class CanvasSelectionMoveService {
  private readonly canvasState = inject(EditorCanvasStateService);
  private selectionContentMoving = false;
  private selectionContentMoveStart: { x: number; y: number } | null = null;
  private movingContentPixelMap: Map<string, string> | null = null;
  private movingContentOriginalRect: SelectionRect | null = null;
  private originalLayerId: string | null = null;

  isMoving(): boolean {
    return this.selectionContentMoving;
  }

  getMoveStart(): { x: number; y: number } | null {
    return this.selectionContentMoveStart;
  }

  getMovingBuffer(): string[] | null {
    if (!this.movingContentPixelMap) return null;
    const w = this.canvasState.canvasWidth();
    const h = this.canvasState.canvasHeight();
    const buf = new Array<string>(w * h).fill('');
    for (const [key, color] of this.movingContentPixelMap.entries()) {
      const coords = this.canvasState.parseCoordinateKey(key);
      if (!coords) continue;
      const { x, y } = coords;
      if (x >= 0 && x < w && y >= 0 && y < h) {
        buf[y * w + x] = color;
      }
    }
    return buf;
  }

  getMovingPixelMap(): Map<string, string> | null {
    return this.movingContentPixelMap;
  }

  getOriginalRect(): SelectionRect | null {
    return this.movingContentOriginalRect;
  }

  getOriginalLayerId(): string | null {
    return this.originalLayerId;
  }

  startMove(
    x: number,
    y: number,
    selectionRect: SelectionRect,
    layerId: string,
    _layerBuffer: string[],
    _canvasWidth: number,
    _canvasHeight: number,
    isPointInSelection: (px: number, py: number) => boolean,
  ): void {
    this.selectionContentMoving = true;
    this.selectionContentMoveStart = { x, y };
    this.originalLayerId = layerId;
    this.movingContentOriginalRect = { ...selectionRect };
    this.movingContentPixelMap = new Map<string, string>();

    const pixelMap = this.canvasState.getLayerPixelMap(layerId);
    for (const [key, color] of pixelMap.entries()) {
      const coords = this.canvasState.parseCoordinateKey(key);
      if (!coords) continue;
      const { x: px, y: py } = coords;
      if (isPointInSelection(px, py)) {
        this.movingContentPixelMap.set(key, color);
        this.canvasState.deletePixel(layerId, px, py);
      }
    }
  }

  updateMoveStart(x: number, y: number): void {
    this.selectionContentMoveStart = { x, y };
  }

  endMove(
    _layerBuffer: string[],
    currentSelectionRect: SelectionRect,
    _canvasWidth: number,
    _canvasHeight: number,
  ): void {
    if (
      !this.movingContentPixelMap ||
      !this.movingContentOriginalRect ||
      !this.originalLayerId
    )
      return;

    const dx = currentSelectionRect.x - this.movingContentOriginalRect.x;
    const dy = currentSelectionRect.y - this.movingContentOriginalRect.y;

    for (const [key, color] of this.movingContentPixelMap.entries()) {
      const coords = this.canvasState.parseCoordinateKey(key);
      if (!coords) continue;
      const newX = coords.x + dx;
      const newY = coords.y + dy;
      this.canvasState.setPixel(this.originalLayerId, newX, newY, color);
    }

    this.clearState();
  }

  cancelMove(): void {
    this.clearState();
  }

  private clearState(): void {
    this.selectionContentMoving = false;
    this.selectionContentMoveStart = null;
    this.movingContentPixelMap = null;
    this.movingContentOriginalRect = null;
    this.originalLayerId = null;
  }
}
