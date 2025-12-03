import { Injectable, signal } from '@angular/core';
import { ShapeFillMode, GradientType } from '../../tools/tool.types';

export interface ShapeDrawOptions {
  strokeThickness: number;
  strokeColor: string;
  fillMode: ShapeFillMode;
  fillColor: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientType: GradientType;
  gradientAngle: number;
}

@Injectable({ providedIn: 'root' })
export class CanvasShapeService {
  readonly shapeStart = signal<{ x: number; y: number } | null>(null);
  readonly shapeCurrent = signal<{ x: number; y: number } | null>(null);
  readonly activeShapeTool = signal<'line' | 'circle' | 'square' | null>(null);
  readonly shapeConstrainUniform = signal(false);
  readonly penPoints = signal<{ x: number; y: number }[]>([]);
  readonly penDrawing = signal(false);

  private shaping = false;

  isShaping(): boolean {
    return this.shaping;
  }

  startShape(
    mode: 'line' | 'circle' | 'square',
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const point = {
      x: this.clampCoord(x, canvasWidth),
      y: this.clampCoord(y, canvasHeight),
    };
    this.shaping = true;
    this.activeShapeTool.set(mode);
    this.shapeStart.set(point);
    this.shapeCurrent.set(point);
  }

  updateShape(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
    shiftKey: boolean,
  ): void {
    if (!this.shaping) return;
    const clampedX = Math.max(0, Math.min(canvasWidth - 1, x));
    const clampedY = Math.max(0, Math.min(canvasHeight - 1, y));
    const active = this.activeShapeTool();
    if (active === 'square' || active === 'circle') {
      this.shapeConstrainUniform.set(shiftKey);
    } else {
      this.shapeConstrainUniform.set(false);
    }
    this.shapeCurrent.set({ x: clampedX, y: clampedY });
  }

  finishShape(constrainOverride?: boolean): {
    mode: 'line' | 'circle' | 'square';
    start: { x: number; y: number };
    current: { x: number; y: number };
    constrain: boolean;
  } | null {
    if (!this.shaping) return null;
    const mode = this.activeShapeTool();
    const start = this.shapeStart();
    const current = this.shapeCurrent();
    if (!mode || !start || !current) {
      this.clearShapeState();
      return null;
    }
    const constrain =
      typeof constrainOverride === 'boolean'
        ? constrainOverride
        : this.shapeConstrainUniform();
    this.clearShapeState();
    return { mode, start, current, constrain };
  }

  cancelShape(): void {
    if (!this.shaping) return;
    this.clearShapeState();
  }

  clearShapeState(): void {
    this.shaping = false;
    this.activeShapeTool.set(null);
    this.shapeStart.set(null);
    this.shapeCurrent.set(null);
    this.shapeConstrainUniform.set(false);
  }

  addPenPoint(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const clampedX = Math.max(0, Math.min(canvasWidth - 1, x));
    const clampedY = Math.max(0, Math.min(canvasHeight - 1, y));
    const points = this.penPoints();
    if (!this.penDrawing()) {
      this.penDrawing.set(true);
    }
    this.penPoints.set([...points, { x: clampedX, y: clampedY }]);
  }

  finishPenPath(): { x: number; y: number }[] | null {
    const points = this.penPoints();
    if (points.length < 2) {
      return null;
    }
    this.clearPenState();
    return points;
  }

  cancelPenPath(): boolean {
    const wasDrawing = this.penDrawing();
    this.clearPenState();
    return wasDrawing;
  }

  clearPenState(): void {
    this.penDrawing.set(false);
    this.penPoints.set([]);
  }

  applyPolylinePath(
    points: { x: number; y: number }[],
    applyLine: (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
    ) => void,
  ): void {
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      applyLine(start.x, start.y, end.x, end.y);
    }
  }

  applySplinePath(
    points: { x: number; y: number }[],
    applyLine: (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
    ) => void,
  ): void {
    if (points.length < 2) return;
    if (points.length === 2) {
      applyLine(points[0].x, points[0].y, points[1].x, points[1].y);
      return;
    }
    const splinePoints = this.catmullRomSpline(points, 10);
    for (let i = 0; i < splinePoints.length - 1; i++) {
      const start = splinePoints[i];
      const end = splinePoints[i + 1];
      applyLine(
        Math.round(start.x),
        Math.round(start.y),
        Math.round(end.x),
        Math.round(end.y),
      );
    }
  }

  catmullRomSpline(
    points: { x: number; y: number }[],
    segments: number,
  ): { x: number; y: number }[] {
    if (points.length < 2) return points;
    const result: { x: number; y: number }[] = [];
    const extended = [points[0], ...points, points[points.length - 1]];
    for (let i = 1; i < extended.length - 2; i++) {
      const p0 = extended[i - 1];
      const p1 = extended[i];
      const p2 = extended[i + 1];
      const p3 = extended[i + 2];
      for (let t = 0; t <= segments; t++) {
        const tt = t / segments;
        const tt2 = tt * tt;
        const tt3 = tt2 * tt;
        const x =
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * tt +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tt2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * tt3);
        const y =
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * tt +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tt2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * tt3);
        const epsilon = 0.001;
        if (
          result.length === 0 ||
          Math.abs(result[result.length - 1].x - x) > epsilon ||
          Math.abs(result[result.length - 1].y - y) > epsilon
        ) {
          result.push({ x, y });
        }
      }
    }
    return result;
  }

  computeRectBounds(
    start: { x: number; y: number },
    current: { x: number; y: number },
    constrainToSquare: boolean,
    canvasWidth: number,
    canvasHeight: number,
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    const width = Math.max(1, canvasWidth);
    const height = Math.max(1, canvasHeight);
    const sx = this.clampCoord(start.x, width);
    const sy = this.clampCoord(start.y, height);
    const cx = this.clampCoord(current.x, width);
    const cy = this.clampCoord(current.y, height);
    const dx = cx - sx;
    const dy = cy - sy;
    let ex = cx;
    let ey = cy;
    if (constrainToSquare) {
      const stepX = dx >= 0 ? 1 : -1;
      const stepY = dy >= 0 ? 1 : -1;
      const span = Math.max(Math.abs(dx), Math.abs(dy));
      ex = this.clampCoord(sx + stepX * span, width);
      ey = this.clampCoord(sy + stepY * span, height);
    }
    const minX = Math.max(0, Math.min(sx, ex));
    const maxX = Math.min(width - 1, Math.max(sx, ex));
    const minY = Math.max(0, Math.min(sy, ey));
    const maxY = Math.min(height - 1, Math.max(sy, ey));
    return { minX, minY, maxX, maxY };
  }

  private clampCoord(value: number, max: number): number {
    return Math.max(0, Math.min(Math.floor(value), max - 1));
  }
}
