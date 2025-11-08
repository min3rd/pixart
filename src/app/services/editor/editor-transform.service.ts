import { Injectable, signal } from '@angular/core';

export type TransformMode =
  | 'none'
  | 'free'
  | 'scale'
  | 'rotate'
  | 'skew'
  | 'distort'
  | 'perspective'
  | 'warp'
  | 'puppet-warp';

export interface TransformState {
  mode: TransformMode;
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  anchorX: number;
  anchorY: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface PuppetWarpPin {
  id: string;
  x: number;
  y: number;
  selected: boolean;
}

export interface TransformMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

@Injectable({ providedIn: 'root' })
export class EditorTransformService {
  readonly transformState = signal<TransformState>({
    mode: 'none',
    active: false,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    flipHorizontal: false,
    flipVertical: false,
  });

  readonly puppetWarpPins = signal<PuppetWarpPin[]>([]);

  startTransform(
    mode: TransformMode,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.transformState.set({
      mode,
      active: true,
      x,
      y,
      width,
      height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      anchorX: 0.5,
      anchorY: 0.5,
      flipHorizontal: false,
      flipVertical: false,
    });
  }

  updateTransform(updates: Partial<TransformState>): void {
    this.transformState.update((state) => ({ ...state, ...updates }));
  }

  commitTransform(): TransformState {
    const state = this.transformState();
    this.transformState.update((s) => ({ ...s, active: false, mode: 'none' }));
    return state;
  }

  cancelTransform(): void {
    this.transformState.update((s) => ({ ...s, active: false, mode: 'none' }));
  }

  flipHorizontal(): void {
    this.transformState.update((state) => ({
      ...state,
      flipHorizontal: !state.flipHorizontal,
      scaleX: state.scaleX * -1,
    }));
  }

  flipVertical(): void {
    this.transformState.update((state) => ({
      ...state,
      flipVertical: !state.flipVertical,
      scaleY: state.scaleY * -1,
    }));
  }

  rotate90CW(): void {
    this.transformState.update((state) => ({
      ...state,
      rotation: (state.rotation + 90) % 360,
    }));
  }

  rotate90CCW(): void {
    this.transformState.update((state) => ({
      ...state,
      rotation: (state.rotation - 90 + 360) % 360,
    }));
  }

  rotate180(): void {
    this.transformState.update((state) => ({
      ...state,
      rotation: (state.rotation + 180) % 360,
    }));
  }

  addPuppetWarpPin(x: number, y: number): string {
    const id = `pin-${Date.now()}-${Math.random()}`;
    const pin: PuppetWarpPin = { id, x, y, selected: false };
    this.puppetWarpPins.update((pins) => [...pins, pin]);
    return id;
  }

  removePuppetWarpPin(id: string): void {
    this.puppetWarpPins.update((pins) => pins.filter((p) => p.id !== id));
  }

  movePuppetWarpPin(id: string, x: number, y: number): void {
    this.puppetWarpPins.update((pins) =>
      pins.map((p) => (p.id === id ? { ...p, x, y } : p)),
    );
  }

  selectPuppetWarpPin(id: string, exclusive = true): void {
    this.puppetWarpPins.update((pins) =>
      pins.map((p) =>
        p.id === id
          ? { ...p, selected: true }
          : exclusive
            ? { ...p, selected: false }
            : p,
      ),
    );
  }

  clearPuppetWarpPins(): void {
    this.puppetWarpPins.set([]);
  }

  getTransformMatrix(): TransformMatrix {
    const state = this.transformState();
    const cos = Math.cos((state.rotation * Math.PI) / 180);
    const sin = Math.sin((state.rotation * Math.PI) / 180);

    const anchorOffsetX = state.width * state.anchorX;
    const anchorOffsetY = state.height * state.anchorY;

    const a = cos * state.scaleX;
    const b = sin * state.scaleX;
    const c = -sin * state.scaleY + state.skewX;
    const d = cos * state.scaleY + state.skewY;

    const e =
      state.x +
      anchorOffsetX -
      (a * anchorOffsetX + c * anchorOffsetY);
    const f =
      state.y +
      anchorOffsetY -
      (b * anchorOffsetX + d * anchorOffsetY);

    return { a, b, c, d, e, f };
  }

  applyTransformToPoint(
    x: number,
    y: number,
    matrix: TransformMatrix,
  ): { x: number; y: number } {
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    };
  }

  calculateBoundingBox(
    width: number,
    height: number,
  ): { x: number; y: number }[] {
    const matrix = this.getTransformMatrix();
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
    return corners.map((corner) => this.applyTransformToPoint(corner.x, corner.y, matrix));
  }
}
