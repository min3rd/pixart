import { Injectable, signal } from '@angular/core';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class CanvasSelectionMoveService {
  private selectionContentMoving = false;
  private selectionContentMoveStart: { x: number; y: number } | null = null;
  private movingContentBuffer: string[] | null = null;
  private movingContentOriginalRect: SelectionRect | null = null;
  private originalLayerId: string | null = null;

  isMoving(): boolean {
    return this.selectionContentMoving;
  }

  getMoveStart(): { x: number; y: number } | null {
    return this.selectionContentMoveStart;
  }

  getMovingBuffer(): string[] | null {
    return this.movingContentBuffer;
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
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
    isPointInSelection: (px: number, py: number) => boolean,
  ): void {
    this.selectionContentMoving = true;
    this.selectionContentMoveStart = { x, y };
    this.originalLayerId = layerId;
    this.movingContentOriginalRect = { ...selectionRect };
    this.movingContentBuffer = [];

    const w = canvasWidth;
    const h = canvasHeight;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const idx = py * w + px;
        if (isPointInSelection(px, py)) {
          this.movingContentBuffer[idx] = layerBuffer[idx] || '';
          layerBuffer[idx] = '';
        } else {
          this.movingContentBuffer[idx] = '';
        }
      }
    }
  }

  updateMoveStart(x: number, y: number): void {
    this.selectionContentMoveStart = { x, y };
  }

  endMove(
    layerBuffer: string[],
    currentSelectionRect: SelectionRect,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (
      !this.movingContentBuffer ||
      !this.movingContentOriginalRect
    )
      return;

    const w = canvasWidth;
    const h = canvasHeight;
    const dx = currentSelectionRect.x - this.movingContentOriginalRect.x;
    const dy = currentSelectionRect.y - this.movingContentOriginalRect.y;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (this.movingContentBuffer[idx]) {
          const newX = x + dx;
          const newY = y + dy;
          if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
            const newIdx = newY * w + newX;
            layerBuffer[newIdx] = this.movingContentBuffer[idx];
          }
        }
      }
    }

    this.clearState();
  }

  cancelMove(): void {
    this.clearState();
  }

  private clearState(): void {
    this.selectionContentMoving = false;
    this.selectionContentMoveStart = null;
    this.movingContentBuffer = null;
    this.movingContentOriginalRect = null;
    this.originalLayerId = null;
  }
}
