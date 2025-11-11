import { Injectable, signal, computed } from '@angular/core';

export type TransformHandle =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'rotate-center';

export interface FreeTransformState {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  centerX: number;
  centerY: number;
}

@Injectable({ providedIn: 'root' })
export class EditorFreeTransformService {
  readonly transformState = signal<FreeTransformState | null>(null);
  readonly isDraggingHandle = signal<TransformHandle | null>(null);
  readonly dragStartPos = signal<{ x: number; y: number } | null>(null);
  readonly dragStartState = signal<FreeTransformState | null>(null);

  readonly isActive = computed(() => this.transformState() !== null);

  startTransform(x: number, y: number, width: number, height: number): void {
    this.transformState.set({
      active: true,
      x,
      y,
      width,
      height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      centerX: x + width / 2,
      centerY: y + height / 2,
    });
  }

  updateTransform(updates: Partial<FreeTransformState>): void {
    const current = this.transformState();
    if (!current) return;
    this.transformState.set({ ...current, ...updates });
  }

  commitTransform(): FreeTransformState | null {
    const state = this.transformState();
    this.transformState.set(null);
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartState.set(null);
    return state;
  }

  cancelTransform(): void {
    this.transformState.set(null);
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartState.set(null);
  }

  startHandleDrag(
    handle: TransformHandle,
    x: number,
    y: number,
  ): void {
    const state = this.transformState();
    if (!state) return;
    this.isDraggingHandle.set(handle);
    this.dragStartPos.set({ x, y });
    this.dragStartState.set({ ...state });
  }

  updateHandleDrag(x: number, y: number): void {
    const handle = this.isDraggingHandle();
    const startPos = this.dragStartPos();
    const startState = this.dragStartState();
    if (!handle || !startPos || !startState) return;

    if (handle === 'rotate-center') {
      this.updateRotation(x, y, startState);
    } else {
      this.updateScale(handle, x, y, startPos, startState);
    }
  }

  endHandleDrag(): void {
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartState.set(null);
  }

  private updateRotation(
    mouseX: number,
    mouseY: number,
    startState: FreeTransformState,
  ): void {
    const dx = mouseX - startState.centerX;
    const dy = mouseY - startState.centerY;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    this.updateTransform({ rotation: angle });
  }

  private updateScale(
    handle: TransformHandle,
    mouseX: number,
    mouseY: number,
    startPos: { x: number; y: number },
    startState: FreeTransformState,
  ): void {
    const dx = mouseX - startPos.x;
    const dy = mouseY - startPos.y;

    let newX = startState.x;
    let newY = startState.y;
    let newWidth = startState.width;
    let newHeight = startState.height;

    switch (handle) {
      case 'top-left':
        newX = startState.x + dx;
        newY = startState.y + dy;
        newWidth = startState.width - dx;
        newHeight = startState.height - dy;
        break;
      case 'top-center':
        newY = startState.y + dy;
        newHeight = startState.height - dy;
        break;
      case 'top-right':
        newY = startState.y + dy;
        newWidth = startState.width + dx;
        newHeight = startState.height - dy;
        break;
      case 'middle-left':
        newX = startState.x + dx;
        newWidth = startState.width - dx;
        break;
      case 'middle-right':
        newWidth = startState.width + dx;
        break;
      case 'bottom-left':
        newX = startState.x + dx;
        newWidth = startState.width - dx;
        newHeight = startState.height + dy;
        break;
      case 'bottom-center':
        newHeight = startState.height + dy;
        break;
      case 'bottom-right':
        newWidth = startState.width + dx;
        newHeight = startState.height + dy;
        break;
    }

    newWidth = Math.max(1, newWidth);
    newHeight = Math.max(1, newHeight);

    const scaleX = newWidth / startState.width;
    const scaleY = newHeight / startState.height;

    this.updateTransform({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      scaleX,
      scaleY,
      centerX: newX + newWidth / 2,
      centerY: newY + newHeight / 2,
    });
  }

  getHandlePosition(
    handle: TransformHandle,
    state: FreeTransformState,
  ): { x: number; y: number } {
    const { x, y, width, height } = state;
    switch (handle) {
      case 'top-left':
        return { x, y };
      case 'top-center':
        return { x: x + width / 2, y };
      case 'top-right':
        return { x: x + width, y };
      case 'middle-left':
        return { x, y: y + height / 2 };
      case 'middle-right':
        return { x: x + width, y: y + height / 2 };
      case 'bottom-left':
        return { x, y: y + height };
      case 'bottom-center':
        return { x: x + width / 2, y: y + height };
      case 'bottom-right':
        return { x: x + width, y: y + height };
      case 'rotate-center':
        return { x: x + width / 2, y: y + height / 2 };
    }
  }

  isPointNearHandle(
    px: number,
    py: number,
    handle: TransformHandle,
    state: FreeTransformState,
    threshold: number = 8,
  ): boolean {
    const handlePos = this.getHandlePosition(handle, state);
    const dx = px - handlePos.x;
    const dy = py - handlePos.y;
    return Math.sqrt(dx * dx + dy * dy) <= threshold;
  }
}
