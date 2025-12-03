import { Injectable } from '@angular/core';
import { ShapeDrawOptions } from './canvas-shape.service';
import { GradientType } from '../../tools/tool.types';

@Injectable({ providedIn: 'root' })
export class CanvasRenderService {
  private readonly bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  private readonly gradientSteps = 8;

  renderSquarePreview(
    ctx: CanvasRenderingContext2D,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: ShapeDrawOptions,
    pxLineWidth: number,
  ): void {
    const widthRect = Math.max(1, bounds.maxX - bounds.minX + 1);
    const heightRect = Math.max(1, bounds.maxY - bounds.minY + 1);
    if (options.fillMode === 'gradient') {
      this.fillSquareGradientPreview(ctx, bounds, options);
    } else if (options.fillColor) {
      ctx.fillStyle = options.fillColor;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(bounds.minX, bounds.minY, widthRect, heightRect);
      ctx.globalAlpha = 1;
    }
    if (options.strokeThickness > 0 && options.strokeColor) {
      ctx.lineWidth = Math.max(pxLineWidth, options.strokeThickness);
      ctx.strokeStyle = options.strokeColor;
      ctx.strokeRect(bounds.minX, bounds.minY, widthRect, heightRect);
    }
  }

  renderEllipsePreview(
    ctx: CanvasRenderingContext2D,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: ShapeDrawOptions,
    pxLineWidth: number,
  ): void {
    const widthRect = Math.max(1, bounds.maxX - bounds.minX + 1);
    const heightRect = Math.max(1, bounds.maxY - bounds.minY + 1);
    const cx = bounds.minX + widthRect / 2;
    const cy = bounds.minY + heightRect / 2;
    const rx = widthRect / 2;
    const ry = heightRect / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (options.fillMode === 'gradient' && rx > 0 && ry > 0) {
      this.fillEllipseGradientPreview(ctx, bounds, options, cx, cy, rx, ry);
    } else if (options.fillColor) {
      ctx.fillStyle = options.fillColor;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (options.strokeThickness > 0 && options.strokeColor) {
      ctx.lineWidth = Math.max(pxLineWidth, options.strokeThickness);
      ctx.strokeStyle = options.strokeColor;
      ctx.stroke();
    }
  }

  fillSquareGradientPreview(
    ctx: CanvasRenderingContext2D,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: ShapeDrawOptions,
  ): void {
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = bounds.maxX;
    const maxY = bounds.maxY;
    const widthRect = Math.max(1, maxX - minX + 1);
    const heightRect = Math.max(1, maxY - minY + 1);
    const fillColor = options.fillColor;
    const startColor = options.gradientStartColor || fillColor;
    const endColor = options.gradientEndColor || startColor;
    const fallbackStart = startColor || endColor;
    const fallbackEnd = endColor || startColor;
    if (!fallbackStart && !fallbackEnd) return;
    const parsedStart = this.parseHexColor(startColor);
    const parsedEnd = this.parseHexColor(endColor);
    const gradientType: GradientType =
      options.gradientType === 'radial' ? 'radial' : 'linear';
    const gradientAngle =
      typeof options.gradientAngle === 'number' ? options.gradientAngle : 0;
    const angleRad = (gradientAngle * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const centerX = minX + widthRect / 2;
    const centerY = minY + heightRect / 2;
    let minProj = 0;
    let maxProj = 1;
    if (gradientType === 'linear') {
      let minVal = Number.POSITIVE_INFINITY;
      let maxVal = Number.NEGATIVE_INFINITY;
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
      ];
      for (const corner of corners) {
        const proj = (corner.x + 0.5) * dirX + (corner.y + 0.5) * dirY;
        if (proj < minVal) minVal = proj;
        if (proj > maxVal) maxVal = proj;
      }
      if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
        if (minVal === maxVal) maxVal = minVal + 1;
        minProj = minVal;
        maxProj = maxVal;
      }
    }
    const radius = Math.max(widthRect, heightRect) / 2;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.35;
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        let ratio = 0;
        if (gradientType === 'radial') {
          const dx = xx + 0.5 - centerX;
          const dy = yy + 0.5 - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          ratio = radius > 0 ? dist / radius : 0;
        } else {
          const proj = (xx + 0.5) * dirX + (yy + 0.5) * dirY;
          const span = maxProj - minProj;
          ratio = span !== 0 ? (proj - minProj) / span : 0;
        }
        const dither = this.computeDitheredRatio(ratio, xx, yy);
        const startFallback = fallbackStart || fallbackEnd;
        const endFallback = fallbackEnd || fallbackStart;
        if (!startFallback || !endFallback) continue;
        const color = this.mixParsedColors(
          parsedStart,
          parsedEnd,
          dither,
          startFallback,
          endFallback,
        );
        ctx.fillStyle = color;
        ctx.fillRect(xx, yy, 1, 1);
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  fillEllipseGradientPreview(
    ctx: CanvasRenderingContext2D,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: ShapeDrawOptions,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
  ): void {
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = bounds.maxX;
    const maxY = bounds.maxY;
    const fillColor = options.fillColor;
    const startColor = options.gradientStartColor || fillColor;
    const endColor = options.gradientEndColor || startColor;
    const fallbackStart = startColor || endColor;
    const fallbackEnd = endColor || startColor;
    if (!fallbackStart && !fallbackEnd) return;
    const parsedStart = this.parseHexColor(startColor);
    const parsedEnd = this.parseHexColor(endColor);
    const gradientType: GradientType =
      options.gradientType === 'linear' ? 'linear' : 'radial';
    const gradientAngle =
      typeof options.gradientAngle === 'number' ? options.gradientAngle : 0;
    const angleRad = (gradientAngle * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    let minProj = 0;
    let maxProj = 1;
    if (gradientType === 'linear') {
      let minVal = Number.POSITIVE_INFINITY;
      let maxVal = Number.NEGATIVE_INFINITY;
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
      ];
      for (const corner of corners) {
        const proj = (corner.x + 0.5) * dirX + (corner.y + 0.5) * dirY;
        if (proj < minVal) minVal = proj;
        if (proj > maxVal) maxVal = proj;
      }
      if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
        if (minVal === maxVal) maxVal = minVal + 1;
        minProj = minVal;
        maxProj = maxVal;
      }
    }
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.35;
    const invRx = rx > 0 ? 1 / rx : 0;
    const invRy = ry > 0 ? 1 / ry : 0;
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const dx = xx + 0.5 - cx;
        const dy = yy + 0.5 - cy;
        const norm =
          invRx > 0 && invRy > 0
            ? dx * dx * invRx * invRx + dy * dy * invRy * invRy
            : 0;
        if (norm > 1) continue;
        let ratio = 0;
        if (gradientType === 'radial') {
          ratio = Math.sqrt(norm);
        } else {
          const proj = (xx + 0.5) * dirX + (yy + 0.5) * dirY;
          const span = maxProj - minProj;
          ratio = span !== 0 ? (proj - minProj) / span : 0;
        }
        const dither = this.computeDitheredRatio(ratio, xx, yy);
        const startFallback = fallbackStart || fallbackEnd;
        const endFallback = fallbackEnd || fallbackStart;
        if (!startFallback || !endFallback) continue;
        const color = this.mixParsedColors(
          parsedStart,
          parsedEnd,
          dither,
          startFallback,
          endFallback,
        );
        ctx.fillStyle = color;
        ctx.fillRect(xx, yy, 1, 1);
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  computeDitheredRatio(ratio: number, x: number, y: number): number {
    const clamped = Math.min(1, Math.max(0, ratio));
    const steps = this.gradientSteps;
    if (steps <= 0) return clamped;
    const scaled = clamped * steps;
    const base = Math.floor(scaled);
    const fraction = scaled - base;
    const matrix = this.bayer4;
    const size = matrix.length;
    const xi = x % size;
    const yi = y % size;
    const threshold = (matrix[yi][xi] + 0.5) / (size * size);
    const offset = fraction > threshold ? 1 : 0;
    const index = Math.min(steps, Math.max(0, base + offset));
    return index / steps;
  }

  parseHexColor(
    value: string | undefined,
  ): { r: number; g: number; b: number } | null {
    if (!value || typeof value !== 'string') return null;
    const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
    if (!match) return null;
    const raw = match[1];
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  componentToHex(value: number): string {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  }

  composeHexColor(r: number, g: number, b: number): string {
    return `#${this.componentToHex(r)}${this.componentToHex(g)}${this.componentToHex(b)}`;
  }

  mixParsedColors(
    start: { r: number; g: number; b: number } | null,
    end: { r: number; g: number; b: number } | null,
    ratio: number,
    fallbackStart: string,
    fallbackEnd: string,
  ): string {
    const t = Math.min(1, Math.max(0, ratio));
    if (start && end) {
      const r = start.r + (end.r - start.r) * t;
      const g = start.g + (end.g - start.g) * t;
      const b = start.b + (end.b - start.b) * t;
      return this.composeHexColor(r, g, b);
    }
    const startValue = fallbackStart || fallbackEnd || '#000000';
    const endValue = fallbackEnd || fallbackStart || '#000000';
    return t <= 0.5 ? startValue : endValue;
  }

  computeTransformButtonPositions(
    ftState: { x: number; y: number; width: number; height: number },
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
  ): {
    btnSize: number;
    commitX: number;
    commitY: number;
    cancelX: number;
    cancelY: number;
    mirrorXX: number;
    mirrorXY: number;
    mirrorYX: number;
    mirrorYY: number;
  } {
    const btnSize = Math.max(3, Math.round(4 / Math.max(0.001, scale)));
    const margin = Math.max(1, Math.round(2 / Math.max(0.001, scale)));
    const canvasW = canvasWidth;
    const canvasH = canvasHeight;

    const totalButtonsWidth = 4 * btnSize + 3 * margin;
    const spaceAbove = ftState.y;
    const spaceBelow = canvasH - (ftState.y + ftState.height);
    const spaceRight = canvasW - (ftState.x + ftState.width);
    const spaceLeft = ftState.x;

    let baseX: number;
    let baseY: number;
    let horizontal = true;

    if (
      spaceAbove >= btnSize + 2 * margin &&
      spaceRight >= totalButtonsWidth
    ) {
      baseX = ftState.x + ftState.width - totalButtonsWidth;
      baseY = ftState.y - btnSize - margin;
    } else if (
      spaceBelow >= btnSize + 2 * margin &&
      spaceRight >= totalButtonsWidth
    ) {
      baseX = ftState.x + ftState.width - totalButtonsWidth;
      baseY = ftState.y + ftState.height + margin;
    } else if (spaceRight >= totalButtonsWidth) {
      baseX = ftState.x + ftState.width - totalButtonsWidth;
      baseY = Math.max(
        margin,
        Math.min(ftState.y + margin, canvasH - btnSize - margin),
      );
    } else if (spaceLeft >= totalButtonsWidth) {
      baseX = ftState.x + margin;
      baseY = Math.max(
        margin,
        Math.min(ftState.y + margin, canvasH - btnSize - margin),
      );
    } else {
      horizontal = false;
      const totalButtonsHeight = 4 * btnSize + 3 * margin;
      if (spaceRight >= btnSize + 2 * margin) {
        baseX = ftState.x + ftState.width + margin;
        baseY = Math.max(
          margin,
          Math.min(ftState.y, canvasH - totalButtonsHeight - margin),
        );
      } else if (spaceLeft >= btnSize + 2 * margin) {
        baseX = ftState.x - btnSize - margin;
        baseY = Math.max(
          margin,
          Math.min(ftState.y, canvasH - totalButtonsHeight - margin),
        );
      } else {
        baseX = Math.max(
          margin,
          Math.min(ftState.x + margin, canvasW - btnSize - margin),
        );
        baseY = Math.max(
          margin,
          Math.min(ftState.y + margin, canvasH - btnSize - margin),
        );
      }
    }

    let commitX: number,
      commitY: number;
    let cancelX: number,
      cancelY: number;
    let mirrorXX: number,
      mirrorXY: number;
    let mirrorYX: number,
      mirrorYY: number;

    if (horizontal) {
      mirrorYX = baseX;
      mirrorYY = baseY;
      mirrorXX = mirrorYX + btnSize + margin;
      mirrorXY = baseY;
      cancelX = mirrorXX + btnSize + margin;
      cancelY = baseY;
      commitX = cancelX + btnSize + margin;
      commitY = baseY;
    } else {
      mirrorYX = baseX;
      mirrorYY = baseY;
      mirrorXX = baseX;
      mirrorXY = mirrorYY + btnSize + margin;
      cancelX = baseX;
      cancelY = mirrorXY + btnSize + margin;
      commitX = baseX;
      commitY = cancelY + btnSize + margin;
    }

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(v, max));
    commitX = clamp(commitX, 0, canvasW - btnSize);
    commitY = clamp(commitY, 0, canvasH - btnSize);
    cancelX = clamp(cancelX, 0, canvasW - btnSize);
    cancelY = clamp(cancelY, 0, canvasH - btnSize);
    mirrorXX = clamp(mirrorXX, 0, canvasW - btnSize);
    mirrorXY = clamp(mirrorXY, 0, canvasH - btnSize);
    mirrorYX = clamp(mirrorYX, 0, canvasW - btnSize);
    mirrorYY = clamp(mirrorYY, 0, canvasH - btnSize);

    return {
      btnSize,
      commitX,
      commitY,
      cancelX,
      cancelY,
      mirrorXX,
      mirrorXY,
      mirrorYX,
      mirrorYY,
    };
  }

  computeDistortButtonPositions(
    distortState: {
      corners: {
        topLeft: { x: number; y: number };
        topRight: { x: number; y: number };
        bottomLeft: { x: number; y: number };
        bottomRight: { x: number; y: number };
      };
    },
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
  ): {
    btnSize: number;
    commitX: number;
    commitY: number;
    cancelX: number;
    cancelY: number;
  } {
    const btnSize = Math.max(3, Math.round(4 / Math.max(0.001, scale)));
    const margin = Math.max(1, Math.round(2 / Math.max(0.001, scale)));
    const canvasW = canvasWidth;
    const canvasH = canvasHeight;

    const corners = distortState.corners;
    const minX = Math.min(
      corners.topLeft.x,
      corners.topRight.x,
      corners.bottomLeft.x,
      corners.bottomRight.x,
    );
    const maxX = Math.max(
      corners.topLeft.x,
      corners.topRight.x,
      corners.bottomLeft.x,
      corners.bottomRight.x,
    );
    const minY = Math.min(
      corners.topLeft.y,
      corners.topRight.y,
      corners.bottomLeft.y,
      corners.bottomRight.y,
    );
    const maxY = Math.max(
      corners.topLeft.y,
      corners.topRight.y,
      corners.bottomLeft.y,
      corners.bottomRight.y,
    );

    const spaceAbove = minY;
    const spaceBelow = canvasH - maxY;
    const spaceRight = canvasW - maxX;

    let commitX: number,
      commitY: number;
    let cancelX: number,
      cancelY: number;

    if (spaceAbove >= btnSize + 2 * margin) {
      commitX = maxX - 2 * btnSize - margin;
      commitY = minY - btnSize - margin;
      cancelX = maxX - btnSize;
      cancelY = minY - btnSize - margin;
    } else if (spaceBelow >= btnSize + 2 * margin) {
      commitX = maxX - 2 * btnSize - margin;
      commitY = maxY + margin;
      cancelX = maxX - btnSize;
      cancelY = maxY + margin;
    } else {
      commitX = maxX + margin;
      commitY = minY;
      cancelX = maxX + margin;
      cancelY = minY + btnSize + margin;
    }

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(v, max));
    commitX = clamp(commitX, 0, canvasW - btnSize);
    commitY = clamp(commitY, 0, canvasH - btnSize);
    cancelX = clamp(cancelX, 0, canvasW - btnSize);
    cancelY = clamp(cancelY, 0, canvasH - btnSize);

    return {
      btnSize,
      commitX,
      commitY,
      cancelX,
      cancelY,
    };
  }

  computeWarpButtonPositions(
    warpState: { nodes: { x: number; y: number }[] },
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
  ): {
    btnSize: number;
    commitX: number;
    commitY: number;
    cancelX: number;
    cancelY: number;
  } {
    const btnSize = Math.max(3, Math.round(4 / Math.max(0.001, scale)));
    const margin = Math.max(1, Math.round(2 / Math.max(0.001, scale)));
    const canvasW = canvasWidth;
    const canvasH = canvasHeight;

    const minX = Math.min(...warpState.nodes.map((n) => n.x));
    const maxX = Math.max(...warpState.nodes.map((n) => n.x));
    const minY = Math.min(...warpState.nodes.map((n) => n.y));
    const maxY = Math.max(...warpState.nodes.map((n) => n.y));

    const spaceAbove = minY;
    const spaceBelow = canvasH - maxY;

    let commitX: number,
      commitY: number;
    let cancelX: number,
      cancelY: number;

    if (spaceAbove >= btnSize + 2 * margin) {
      commitX = maxX - 2 * btnSize - margin;
      commitY = minY - btnSize - margin;
      cancelX = maxX - btnSize;
      cancelY = minY - btnSize - margin;
    } else if (spaceBelow >= btnSize + 2 * margin) {
      commitX = maxX - 2 * btnSize - margin;
      commitY = maxY + margin;
      cancelX = maxX - btnSize;
      cancelY = maxY + margin;
    } else {
      commitX = maxX + margin;
      commitY = minY;
      cancelX = maxX + margin;
      cancelY = minY + btnSize + margin;
    }

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(v, max));
    commitX = clamp(commitX, 0, canvasW - btnSize);
    commitY = clamp(commitY, 0, canvasH - btnSize);
    cancelX = clamp(cancelX, 0, canvasW - btnSize);
    cancelY = clamp(cancelY, 0, canvasH - btnSize);

    return {
      btnSize,
      commitX,
      commitY,
      cancelX,
      cancelY,
    };
  }

  computePuppetWarpButtonPositions(
    puppetWarpState: {
      sourceX: number;
      sourceY: number;
      sourceWidth: number;
      sourceHeight: number;
      pins: { x: number; y: number }[];
    },
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
  ): {
    btnSize: number;
    commitX: number;
    commitY: number;
    cancelX: number;
    cancelY: number;
  } {
    const btnSize = Math.max(3, Math.round(4 / Math.max(0.001, scale)));
    const margin = Math.max(1, Math.round(2 / Math.max(0.001, scale)));
    const canvasW = canvasWidth;
    const canvasH = canvasHeight;

    if (puppetWarpState.pins.length === 0) {
      const minX = puppetWarpState.sourceX;
      const maxX = puppetWarpState.sourceX + puppetWarpState.sourceWidth;
      const minY = puppetWarpState.sourceY;
      const maxY = puppetWarpState.sourceY + puppetWarpState.sourceHeight;

      return {
        btnSize,
        commitX: maxX - 2 * btnSize - margin,
        commitY: maxY + margin,
        cancelX: maxX - btnSize,
        cancelY: maxY + margin,
      };
    }

    const minX = Math.min(...puppetWarpState.pins.map((p) => p.x));
    const maxX = Math.max(...puppetWarpState.pins.map((p) => p.x));
    const minY = Math.min(...puppetWarpState.pins.map((p) => p.y));
    const maxY = Math.max(...puppetWarpState.pins.map((p) => p.y));

    const spaceAbove = minY;
    const spaceBelow = canvasH - maxY;

    let commitX: number,
      commitY: number;
    let cancelX: number,
      cancelY: number;

    if (spaceAbove >= btnSize + 2 * margin) {
      commitX = maxX - 2 * btnSize - margin;
      commitY = minY - btnSize - margin;
      cancelX = maxX - btnSize;
      cancelY = minY - btnSize - margin;
    } else if (spaceBelow >= btnSize + 2 * margin) {
      commitX = maxX - 2 * btnSize - margin;
      commitY = maxY + margin;
      cancelX = maxX - btnSize;
      cancelY = maxY + margin;
    } else {
      commitX = maxX + margin;
      commitY = minY;
      cancelX = maxX + margin;
      cancelY = minY + btnSize + margin;
    }

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(v, max));
    commitX = clamp(commitX, 0, canvasW - btnSize);
    commitY = clamp(commitY, 0, canvasH - btnSize);
    cancelX = clamp(cancelX, 0, canvasW - btnSize);
    cancelY = clamp(cancelY, 0, canvasH - btnSize);

    return {
      btnSize,
      commitX,
      commitY,
      cancelX,
      cancelY,
    };
  }
}
