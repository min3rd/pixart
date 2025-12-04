import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CanvasViewportService {
  private static readonly SCALE_TOLERANCE = 0.0001;

  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly scale = signal(1);
  readonly rotation = signal(0);

  private _minScale = 0.05;
  private _maxScale = 256;

  get minScale(): number {
    return this._minScale;
  }

  get maxScale(): number {
    return this._maxScale;
  }

  updateMaxScale(canvasWidth: number, canvasHeight: number): void {
    const maxDim = Math.max(1, Math.max(canvasWidth, canvasHeight));
    const targetPx = 512;
    const computed = Math.ceil(targetPx / maxDim);
    this._maxScale = Math.min(Math.max(8, computed), 256);
  }

  updateMinScale(canvasWidth: number, canvasHeight: number): void {
    const maxDim = Math.max(1, canvasWidth, canvasHeight);
    this._minScale = 1 / maxDim;
  }

  updateScaleLimits(canvasWidth: number, canvasHeight: number): void {
    this.updateMaxScale(canvasWidth, canvasHeight);
    this.updateMinScale(canvasWidth, canvasHeight);
  }

  isAtMinZoom(): boolean {
    return this.scale() <= this._minScale + CanvasViewportService.SCALE_TOLERANCE;
  }

  isAtMaxZoom(): boolean {
    return this.scale() >= this._maxScale - CanvasViewportService.SCALE_TOLERANCE;
  }

  applyZoom(
    nextScale: number,
    anchor?: { clientX: number; clientY: number },
    containerRect?: DOMRect | null,
  ): void {
    const clamped = Math.min(
      this._maxScale,
      Math.max(this.minScale, nextScale),
    );
    const prev = this.scale();

    if (Math.abs(clamped - prev) < CanvasViewportService.SCALE_TOLERANCE) {
      return;
    }

    const prevPanX = this.panX();
    const prevPanY = this.panY();

    const pivotX =
      anchor?.clientX ??
      (containerRect ? containerRect.left + containerRect.width / 2 : 0);
    const pivotY =
      anchor?.clientY ??
      (containerRect ? containerRect.top + containerRect.height / 2 : 0);
    const containerOffsetX = containerRect ? pivotX - containerRect.left : 0;
    const containerOffsetY = containerRect ? pivotY - containerRect.top : 0;
    const worldX = containerRect ? (containerOffsetX - prevPanX) / prev : 0;
    const worldY = containerRect ? (containerOffsetY - prevPanY) / prev : 0;

    this.scale.set(clamped);

    if (containerRect) {
      const newOffsetX = worldX * clamped;
      const newOffsetY = worldY * clamped;
      this.panX.set(containerOffsetX - newOffsetX);
      this.panY.set(containerOffsetY - newOffsetY);
    }
  }

  centerAndFitCanvas(
    canvasWidth: number,
    canvasHeight: number,
    containerMeasure: {
      contentWidth: number;
      contentHeight: number;
      paddingLeft: number;
      paddingTop: number;
    },
  ): void {
    const w = Math.max(1, canvasWidth);
    const h = Math.max(1, canvasHeight);
    const { contentWidth, contentHeight, paddingLeft, paddingTop } =
      containerMeasure;

    if (contentWidth <= 0 || contentHeight <= 0) return;

    const fitScale = Math.max(
      this.minScale,
      Math.min(contentWidth / w, contentHeight / h),
    );
    const initialScale = Math.min(this._maxScale, fitScale);
    this.scale.set(initialScale);

    const displayWidth = w * initialScale;
    const displayHeight = h * initialScale;
    const offsetX = paddingLeft + (contentWidth - displayWidth) / 2;
    const offsetY = paddingTop + (contentHeight - displayHeight) / 2;
    this.panX.set(offsetX);
    this.panY.set(offsetY);
  }

  measureContainer(container: HTMLElement | null): {
    contentWidth: number;
    contentHeight: number;
    paddingLeft: number;
    paddingTop: number;
  } {
    if (!container) {
      return {
        contentWidth: 0,
        contentHeight: 0,
        paddingLeft: 0,
        paddingTop: 0,
      };
    }
    const styles =
      typeof window !== 'undefined' ? window.getComputedStyle(container) : null;
    const paddingLeft = styles ? parseFloat(styles.paddingLeft) || 0 : 0;
    const paddingRight = styles ? parseFloat(styles.paddingRight) || 0 : 0;
    const paddingTop = styles ? parseFloat(styles.paddingTop) || 0 : 0;
    const paddingBottom = styles ? parseFloat(styles.paddingBottom) || 0 : 0;
    const contentWidth = Math.max(
      1,
      container.clientWidth - paddingLeft - paddingRight,
    );
    const contentHeight = Math.max(
      1,
      container.clientHeight - paddingTop - paddingBottom,
    );
    return { contentWidth, contentHeight, paddingLeft, paddingTop };
  }

  increaseZoom(step = 0.1, containerRect?: DOMRect | null): void {
    const factor = 1 + Math.max(0, step);
    this.applyZoom(this.scale() * factor, undefined, containerRect);
  }

  decreaseZoom(step = 0.1, containerRect?: DOMRect | null): void {
    const factor = 1 + Math.max(0, step);
    this.applyZoom(this.scale() / factor, undefined, containerRect);
  }

  resetRotation(): void {
    this.rotation.set(0);
  }

  pan(dx: number, dy: number): void {
    this.panX.set(this.panX() + dx);
    this.panY.set(this.panY() + dy);
  }

  screenToLogical(
    clientX: number,
    clientY: number,
    canvasRect: DOMRect,
  ): { x: number; y: number } {
    const visX = clientX - canvasRect.left;
    const visY = clientY - canvasRect.top;
    const currentScale = this.scale();
    const currentPanX = this.panX();
    const currentPanY = this.panY();
    return {
      x: Math.floor((visX - currentPanX) / currentScale),
      y: Math.floor((visY - currentPanY) / currentScale),
    };
  }
}
