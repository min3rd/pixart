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
  readonly snapRotation = signal(false);
  readonly constrainProportions = signal(false);
  private dragStartAngle: number | null = null;

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

  startHandleDrag(handle: TransformHandle, x: number, y: number): void {
    const state = this.transformState();
    if (!state) return;
    this.isDraggingHandle.set(handle);
    this.dragStartPos.set({ x, y });
    this.dragStartState.set({ ...state });
    if (handle === 'rotate-center') {
      const dx = x - state.centerX;
      const dy = y - state.centerY;
      this.dragStartAngle = Math.atan2(dy, dx);
    } else {
      this.dragStartAngle = null;
    }
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
    // live update center (useful for rotation handle reposition during drag)
    const current = this.transformState();
    if (current) {
      this.transformState.set({
        ...current,
        centerX: current.x + current.width / 2,
        centerY: current.y + current.height / 2,
      });
    }
  }

  endHandleDrag(): void {
    this.isDraggingHandle.set(null);
    this.dragStartPos.set(null);
    this.dragStartState.set(null);
    this.dragStartAngle = null;
  }

  setSnapRotation(enabled: boolean) {
    this.snapRotation.set(!!enabled);
  }

  setConstrainProportions(enabled: boolean) {
    this.constrainProportions.set(!!enabled);
  }

  private updateRotation(
    mouseX: number,
    mouseY: number,
    startState: FreeTransformState,
  ): void {
    const current = this.transformState();
    if (!current) return;
    if (this.dragStartAngle === null) return;
    const cx = current.centerX;
    const cy = current.centerY;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const currentAngle = Math.atan2(dy, dx);
    const deltaAngle = currentAngle - this.dragStartAngle;
    let angle = startState.rotation + (deltaAngle * 180) / Math.PI;
    angle = (angle + 360) % 360;
    if (this.snapRotation()) {
      const step = 15;
      angle = Math.round(angle / step) * step;
    }
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

    if (this.constrainProportions()) {
      const ratio = Math.max(0.0001, startState.width / startState.height);
      // keep opposite corner fixed depending on handle, adjust x/y to maintain anchor
      switch (handle) {
        case 'top-left':
          if (Math.abs(dx) > Math.abs(dy)) {
            newHeight = newWidth / ratio;
            newY = startState.y + (startState.height - newHeight);
          } else {
            newWidth = newHeight * ratio;
            newX = startState.x + (startState.width - newWidth);
          }
          break;
        case 'top-center':
          newWidth = startState.width;
          newHeight = Math.max(1, newHeight);
          newY = startState.y + (startState.height - newHeight);
          break;
        case 'top-right':
          if (Math.abs(dx) > Math.abs(dy)) {
            newHeight = newWidth / ratio;
            newY = startState.y + (startState.height - newHeight);
          } else {
            newWidth = newHeight * ratio;
          }
          break;
        case 'middle-left':
          newHeight = startState.height;
          newWidth = Math.max(1, newWidth);
          newX = startState.x + (startState.width - newWidth);
          break;
        case 'middle-right':
          newHeight = startState.height;
          newWidth = Math.max(1, newWidth);
          break;
        case 'bottom-left':
          if (Math.abs(dx) > Math.abs(dy)) {
            newHeight = newWidth / ratio;
          } else {
            newWidth = newHeight * ratio;
            newX = startState.x + (startState.width - newWidth);
          }
          break;
        case 'bottom-center':
          newWidth = startState.width;
          newHeight = Math.max(1, newHeight);
          break;
        case 'bottom-right':
          if (Math.abs(dx) > Math.abs(dy)) {
            newHeight = newWidth / ratio;
          } else {
            newWidth = newHeight * ratio;
          }
          break;
      }
    }

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
    const { x, y, width, height, rotation } = state;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const toRad = (rotation * Math.PI) / 180;
    const cos = Math.cos(toRad);
    const sin = Math.sin(toRad);
    const corner = (dx: number, dy: number) => {
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    };
    switch (handle) {
      case 'top-left':
        return corner(-width / 2, -height / 2);
      case 'top-center':
        return corner(0, -height / 2);
      case 'top-right':
        return corner(width / 2, -height / 2);
      case 'middle-left':
        return corner(-width / 2, 0);
      case 'middle-right':
        return corner(width / 2, 0);
      case 'bottom-left':
        return corner(-width / 2, height / 2);
      case 'bottom-center':
        return corner(0, height / 2);
      case 'bottom-right':
        return corner(width / 2, height / 2);
      case 'rotate-center':
        return corner(0, -height / 2 - 8);
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
