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

    const e = state.x + anchorOffsetX - (a * anchorOffsetX + c * anchorOffsetY);
    const f = state.y + anchorOffsetY - (b * anchorOffsetX + d * anchorOffsetY);

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
    return corners.map((corner) =>
      this.applyTransformToPoint(corner.x, corner.y, matrix),
    );
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
    if (!inverseMatrix)
      return { buffer: sourceBuffer, width: sourceWidth, height: sourceHeight };

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

  applyRotate180(buffer: string[], width: number, height: number): string[] {
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

  applyRotateByAngle(
    buffer: string[],
    width: number,
    height: number,
    angleDegrees: number,
  ): { buffer: string[]; width: number; height: number } {
    const radians = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const newWidth = Math.ceil(
      Math.abs(width * cos) + Math.abs(height * sin),
    );
    const newHeight = Math.ceil(
      Math.abs(width * sin) + Math.abs(height * cos),
    );

    const result = new Array<string>(newWidth * newHeight).fill('');

    const centerX = width / 2;
    const centerY = height / 2;
    const newCenterX = newWidth / 2;
    const newCenterY = newHeight / 2;

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const offsetX = x - newCenterX;
        const offsetY = y - newCenterY;

        const srcX = offsetX * cos + offsetY * sin + centerX;
        const srcY = -offsetX * sin + offsetY * cos + centerY;

        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);

        if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
          const srcIdx = y0 * width + x0;
          const destIdx = y * newWidth + x;
          result[destIdx] = buffer[srcIdx] || '';
        }
      }
    }

    return { buffer: result, width: newWidth, height: newHeight };
  }

  applySkew(
    buffer: string[],
    width: number,
    height: number,
    skewXDegrees: number,
    skewYDegrees: number,
  ): { buffer: string[]; width: number; height: number } {
    const tanX = Math.tan((skewXDegrees * Math.PI) / 180);
    const tanY = Math.tan((skewYDegrees * Math.PI) / 180);

    const newWidth = Math.ceil(width + Math.abs(tanX * height));
    const newHeight = Math.ceil(height + Math.abs(tanY * width));

    const result = new Array<string>(newWidth * newHeight).fill('');

    const offsetX = tanX < 0 ? -tanX * height : 0;
    const offsetY = tanY < 0 ? -tanY * width : 0;

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcX = (x - offsetX - tanX * y);
        const srcY = (y - offsetY - tanY * x);

        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);

        if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
          const srcIdx = y0 * width + x0;
          const destIdx = y * newWidth + x;
          result[destIdx] = buffer[srcIdx] || '';
        }
      }
    }

    return { buffer: result, width: newWidth, height: newHeight };
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
        const srcX = x / scaleX;
        const srcY = y / scaleY;

        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, width - 1);
        const y1 = Math.min(y0 + 1, height - 1);

        if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
          const fx = srcX - x0;
          const fy = srcY - y0;

          const idx00 = y0 * width + x0;
          const idx10 = y0 * width + x1;
          const idx01 = y1 * width + x0;
          const idx11 = y1 * width + x1;

          const c00 = buffer[idx00] || '';
          const c10 = buffer[idx10] || '';
          const c01 = buffer[idx01] || '';
          const c11 = buffer[idx11] || '';

          let finalColor = c00;

          if (fx === 0 && fy === 0) {
            finalColor = c00;
          } else if (c00 && c10 && c01 && c11) {
            finalColor = this.bilinearInterpolateColor(
              c00,
              c10,
              c01,
              c11,
              fx,
              fy,
            );
          } else if (c00) {
            finalColor = c00;
          } else if (c10 && fx > 0.5) {
            finalColor = c10;
          } else if (c01 && fy > 0.5) {
            finalColor = c01;
          } else if (c11 && fx > 0.5 && fy > 0.5) {
            finalColor = c11;
          }

          const destIdx = y * newWidth + x;
          result[destIdx] = finalColor;
        }
      }
    }

    return { buffer: result, width: newWidth, height: newHeight };
  }

  private bilinearInterpolateColor(
    c00: string,
    c10: string,
    c01: string,
    c11: string,
    fx: number,
    fy: number,
  ): string {
    const rgba00 = this.hexToRgba(c00);
    const rgba10 = this.hexToRgba(c10);
    const rgba01 = this.hexToRgba(c01);
    const rgba11 = this.hexToRgba(c11);

    const r =
      (1 - fx) * (1 - fy) * rgba00.r +
      fx * (1 - fy) * rgba10.r +
      (1 - fx) * fy * rgba01.r +
      fx * fy * rgba11.r;
    const g =
      (1 - fx) * (1 - fy) * rgba00.g +
      fx * (1 - fy) * rgba10.g +
      (1 - fx) * fy * rgba01.g +
      fx * fy * rgba11.g;
    const b =
      (1 - fx) * (1 - fy) * rgba00.b +
      fx * (1 - fy) * rgba10.b +
      (1 - fx) * fy * rgba01.b +
      fx * fy * rgba11.b;
    const a =
      (1 - fx) * (1 - fy) * rgba00.a +
      fx * (1 - fy) * rgba10.a +
      (1 - fx) * fy * rgba01.a +
      fx * fy * rgba11.a;

    return this.rgbaToHex(
      Math.round(r),
      Math.round(g),
      Math.round(b),
      Math.round(a),
    );
  }

  private hexToRgba(hex: string): {
    r: number;
    g: number;
    b: number;
    a: number;
  } {
    if (!hex || hex.length < 7) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    const a = hex.length >= 9 ? Number.parseInt(hex.slice(7, 9), 16) : 255;
    return { r, g, b, a };
  }

  private rgbaToHex(r: number, g: number, b: number, a: number): string {
    const rr = Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0');
    const gg = Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0');
    const bb = Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0');
    const aa = Math.max(0, Math.min(255, a)).toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb}${aa}`;
  }
}
