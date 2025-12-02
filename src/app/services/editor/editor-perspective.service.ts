import { Injectable, signal, computed } from '@angular/core';

export type PerspectiveHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';

export interface PerspectiveCorner {
  x: number;
  y: number;
}

export interface PerspectiveConstraints {
  preserveAspectRatio: boolean;
  keepParallelEdges: boolean;
}

export interface PerspectiveState {
  active: boolean;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  corners: {
    topLeft: PerspectiveCorner;
    topRight: PerspectiveCorner;
    bottomRight: PerspectiveCorner;
    bottomLeft: PerspectiveCorner;
  };
  constraints: PerspectiveConstraints;
}

@Injectable({ providedIn: 'root' })
export class EditorPerspectiveService {
  readonly perspectiveState = signal<PerspectiveState | null>(null);
  readonly isDraggingHandle = signal<PerspectiveHandle | null>(null);
  readonly dragStartPos = signal<{ x: number; y: number } | null>(null);
  readonly dragStartCorners = signal<PerspectiveState['corners'] | null>(null);

  readonly isActive = computed(() => this.perspectiveState() !== null);

  startPerspective(x: number, y: number, width: number, height: number): void {
    this.perspectiveState.set({
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
      constraints: {
        preserveAspectRatio: false,
        keepParallelEdges: false,
      },
    });
  }

  updateCorner(handle: PerspectiveHandle, x: number, y: number): void {
    const current = this.perspectiveState();
    if (!current) return;

    const corners = { ...current.corners };
    const constraints = current.constraints;

    if (constraints.preserveAspectRatio) {
      const aspectRatio = current.sourceWidth / current.sourceHeight;
      this.updateCornerWithAspectRatio(
        handle,
        x,
        y,
        corners,
        aspectRatio,
        current,
      );
    } else if (constraints.keepParallelEdges) {
      this.updateCornerWithParallelEdges(handle, x, y, corners);
    } else {
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
    }

    this.perspectiveState.set({ ...current, corners });
  }

  private updateCornerWithAspectRatio(
    handle: PerspectiveHandle,
    x: number,
    y: number,
    corners: PerspectiveState['corners'],
    aspectRatio: number,
    current: PerspectiveState,
  ): void {
    const centerX = current.sourceX + current.sourceWidth / 2;
    const centerY = current.sourceY + current.sourceHeight / 2;

    const dx = x - centerX;
    const dy = y - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const width = Math.abs(distance * Math.cos(angle) * 2);
    const height = width / aspectRatio;

    switch (handle) {
      case 'top-left':
        corners.topLeft = { x: centerX - width / 2, y: centerY - height / 2 };
        corners.topRight = { x: centerX + width / 2, y: centerY - height / 2 };
        corners.bottomLeft = {
          x: centerX - width / 2,
          y: centerY + height / 2,
        };
        corners.bottomRight = {
          x: centerX + width / 2,
          y: centerY + height / 2,
        };
        break;
      case 'top-right':
        corners.topLeft = { x: centerX - width / 2, y: centerY - height / 2 };
        corners.topRight = { x: centerX + width / 2, y: centerY - height / 2 };
        corners.bottomLeft = {
          x: centerX - width / 2,
          y: centerY + height / 2,
        };
        corners.bottomRight = {
          x: centerX + width / 2,
          y: centerY + height / 2,
        };
        break;
      case 'bottom-right':
        corners.topLeft = { x: centerX - width / 2, y: centerY - height / 2 };
        corners.topRight = { x: centerX + width / 2, y: centerY - height / 2 };
        corners.bottomLeft = {
          x: centerX - width / 2,
          y: centerY + height / 2,
        };
        corners.bottomRight = {
          x: centerX + width / 2,
          y: centerY + height / 2,
        };
        break;
      case 'bottom-left':
        corners.topLeft = { x: centerX - width / 2, y: centerY - height / 2 };
        corners.topRight = { x: centerX + width / 2, y: centerY - height / 2 };
        corners.bottomLeft = {
          x: centerX - width / 2,
          y: centerY + height / 2,
        };
        corners.bottomRight = {
          x: centerX + width / 2,
          y: centerY + height / 2,
        };
        break;
    }
  }

  private updateCornerWithParallelEdges(
    handle: PerspectiveHandle,
    x: number,
    y: number,
    corners: PerspectiveState['corners'],
  ): void {
    switch (handle) {
      case 'top-left':
        corners.topLeft = { x, y };
        corners.bottomLeft.x = x;
        corners.topRight.y = y;
        break;
      case 'top-right':
        corners.topRight = { x, y };
        corners.bottomRight.x = x;
        corners.topLeft.y = y;
        break;
      case 'bottom-right':
        corners.bottomRight = { x, y };
        corners.topRight.x = x;
        corners.bottomLeft.y = y;
        break;
      case 'bottom-left':
        corners.bottomLeft = { x, y };
        corners.topLeft.x = x;
        corners.bottomRight.y = y;
        break;
    }
  }

  setConstraints(constraints: Partial<PerspectiveConstraints>): void {
    const state = this.perspectiveState();
    if (!state) return;

    this.perspectiveState.set({
      ...state,
      constraints: { ...state.constraints, ...constraints },
    });
  }

  commitPerspective(): PerspectiveState | null {
    const state = this.perspectiveState();
    this.perspectiveState.set(null);
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartCorners.set(null);
    return state;
  }

  cancelPerspective(): void {
    this.perspectiveState.set(null);
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartCorners.set(null);
  }

  startHandleDrag(handle: PerspectiveHandle, x: number, y: number): void {
    const state = this.perspectiveState();
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
    const state = this.perspectiveState();
    if (!state) return;

    const { sourceX, sourceY, sourceWidth, sourceHeight } = state;
    this.perspectiveState.set({
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

  getHandlePosition(handle: PerspectiveHandle): PerspectiveCorner | null {
    const state = this.perspectiveState();
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
