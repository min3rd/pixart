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

  applyTransformToBuffer(
    sourceBuffer: string[],
    sourceWidth: number,
    sourceHeight: number,
    transform: TransformState,
  ): { buffer: string[]; width: number; height: number } {
    const matrix = this.getTransformMatrix();
    
    const corners = this.calculateBoundingBox(sourceWidth, sourceHeight);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
    
    const newWidth = Math.ceil(maxX - minX);
    const newHeight = Math.ceil(maxY - minY);
    const newBuffer = new Array<string>(newWidth * newHeight).fill('');
    
    const inverseMatrix = this.invertMatrix(matrix);
    if (!inverseMatrix) return { buffer: sourceBuffer, width: sourceWidth, height: sourceHeight };
    
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcPoint = this.applyTransformToPoint(
          x + minX,
          y + minY,
          inverseMatrix,
        );
        
        const sx = Math.floor(srcPoint.x);
        const sy = Math.floor(srcPoint.y);
        
        if (sx >= 0 && sx < sourceWidth && sy >= 0 && sy < sourceHeight) {
          const srcIdx = sy * sourceWidth + sx;
          const destIdx = y * newWidth + x;
          newBuffer[destIdx] = sourceBuffer[srcIdx] || '';
        }
      }
    }
    
    return { buffer: newBuffer, width: newWidth, height: newHeight };
  }

  private invertMatrix(m: TransformMatrix): TransformMatrix | null {
    const det = m.a * m.d - m.b * m.c;
    if (Math.abs(det) < 0.0001) return null;
    
    const invDet = 1 / det;
    return {
      a: m.d * invDet,
      b: -m.b * invDet,
      c: -m.c * invDet,
      d: m.a * invDet,
      e: (m.c * m.f - m.d * m.e) * invDet,
      f: (m.b * m.e - m.a * m.f) * invDet,
    };
  }

  applySimpleFlipHorizontal(
    buffer: string[],
    width: number,
    height: number,
  ): string[] {
    const result = new Array<string>(buffer.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = y * width + x;
        const destIdx = y * width + (width - 1 - x);
        result[destIdx] = buffer[srcIdx] || '';
      }
    }
    return result;
  }

  applySimpleFlipVertical(
    buffer: string[],
    width: number,
    height: number,
  ): string[] {
    const result = new Array<string>(buffer.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = y * width + x;
        const destIdx = (height - 1 - y) * width + x;
        result[destIdx] = buffer[srcIdx] || '';
      }
    }
    return result;
  }

  applyRotate90CW(
    buffer: string[],
    width: number,
    height: number,
  ): { buffer: string[]; width: number; height: number } {
    const newWidth = height;
    const newHeight = width;
    const result = new Array<string>(newWidth * newHeight).fill('');
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = y * width + x;
        const newX = height - 1 - y;
        const newY = x;
        const destIdx = newY * newWidth + newX;
        result[destIdx] = buffer[srcIdx] || '';
      }
    }
    
    return { buffer: result, width: newWidth, height: newHeight };
  }

  applyRotate90CCW(
    buffer: string[],
    width: number,
    height: number,
  ): { buffer: string[]; width: number; height: number } {
    const newWidth = height;
    const newHeight = width;
    const result = new Array<string>(newWidth * newHeight).fill('');
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = y * width + x;
        const newX = y;
        const newY = width - 1 - x;
        const destIdx = newY * newWidth + newX;
        result[destIdx] = buffer[srcIdx] || '';
      }
    }
    
    return { buffer: result, width: newWidth, height: newHeight };
  }

  applyRotate180(
    buffer: string[],
    width: number,
    height: number,
  ): string[] {
    const result = new Array<string>(buffer.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = y * width + x;
        const destIdx = (height - 1 - y) * width + (width - 1 - x);
        result[destIdx] = buffer[srcIdx] || '';
      }
    }
    return result;
  }

  applyScale(
    buffer: string[],
    width: number,
    height: number,
    scaleX: number,
    scaleY: number,
  ): { buffer: string[]; width: number; height: number } {
    const newWidth = Math.max(1, Math.round(width * scaleX));
    const newHeight = Math.max(1, Math.round(height * scaleY));
    const result = new Array<string>(newWidth * newHeight).fill('');

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcX = Math.floor(x / scaleX);
        const srcY = Math.floor(y / scaleY);

        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const srcIdx = srcY * width + srcX;
          const destIdx = y * newWidth + x;
          result[destIdx] = buffer[srcIdx] || '';
        }
      }
    }

    return { buffer: result, width: newWidth, height: newHeight };
  }
}
