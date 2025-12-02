import { Injectable, signal, computed } from '@angular/core';

export type DistortHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';

export interface DistortCorner {
  x: number;
  y: number;
}

export interface DistortState {
  active: boolean;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  corners: {
    topLeft: DistortCorner;
    topRight: DistortCorner;
    bottomRight: DistortCorner;
    bottomLeft: DistortCorner;
  };
}

@Injectable({ providedIn: 'root' })
export class EditorDistortService {
  readonly distortState = signal<DistortState | null>(null);
  readonly isDraggingHandle = signal<DistortHandle | null>(null);
  readonly dragStartPos = signal<{ x: number; y: number } | null>(null);
  readonly dragStartCorners = signal<DistortState['corners'] | null>(null);

  readonly isActive = computed(() => this.distortState() !== null);

  startDistort(x: number, y: number, width: number, height: number): void {
    this.distortState.set({
      active: true,
      sourceX: x,
      sourceY: y,
      sourceWidth: width,
      sourceHeight: height,
      corners: {
        topLeft: { x, y },
        topRight: { x: x + width, y },
        bottomRight: { x: x + width, y: y + height },
        bottomLeft: { x, y: y + height },
      },
    });
  }

  updateCorner(handle: DistortHandle, x: number, y: number): void {
    const current = this.distortState();
    if (!current) return;

    const corners = { ...current.corners };
    switch (handle) {
      case 'top-left':
        corners.topLeft = { x, y };
        break;
      case 'top-right':
        corners.topRight = { x, y };
        break;
      case 'bottom-right':
        corners.bottomRight = { x, y };
        break;
      case 'bottom-left':
        corners.bottomLeft = { x, y };
        break;
    }

    this.distortState.set({ ...current, corners });
  }

  commitDistort(): DistortState | null {
    const state = this.distortState();
    this.distortState.set(null);
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartCorners.set(null);
    return state;
  }

  cancelDistort(): void {
    this.distortState.set(null);
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartCorners.set(null);
  }

  startHandleDrag(handle: DistortHandle, x: number, y: number): void {
    const state = this.distortState();
    if (!state) return;
    this.isDraggingHandle.set(handle);
    this.dragStartPos.set({ x, y });
    this.dragStartCorners.set({ ...state.corners });
  }

  updateHandleDrag(x: number, y: number): void {
    const handle = this.isDraggingHandle();
    if (!handle) return;
    this.updateCorner(handle, x, y);
  }

  endHandleDrag(): void {
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartCorners.set(null);
  }

  resetCorners(): void {
    const state = this.distortState();
    if (!state) return;

    const { sourceX, sourceY, sourceWidth, sourceHeight } = state;
    this.distortState.set({
      ...state,
      corners: {
        topLeft: { x: sourceX, y: sourceY },
        topRight: { x: sourceX + sourceWidth, y: sourceY },
        bottomRight: {
          x: sourceX + sourceWidth,
          y: sourceY + sourceHeight,
        },
        bottomLeft: { x: sourceX, y: sourceY + sourceHeight },
      },
    });
  }

  getHandlePosition(handle: DistortHandle): DistortCorner | null {
    const state = this.distortState();
    if (!state) return null;

    switch (handle) {
      case 'top-left':
        return state.corners.topLeft;
      case 'top-right':
        return state.corners.topRight;
      case 'bottom-right':
        return state.corners.bottomRight;
      case 'bottom-left':
        return state.corners.bottomLeft;
      default:
        return null;
    }
  }
}
