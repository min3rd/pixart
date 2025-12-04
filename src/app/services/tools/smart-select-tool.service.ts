import { Injectable, signal } from '@angular/core';
import { ToolDefinition, ToolService, SmartSelectToolSnapshot } from './tool.types';

export type SmartSelectMode = 'normal' | 'add' | 'subtract';

@Injectable({ providedIn: 'root' })
export class SmartSelectToolService implements ToolService<SmartSelectToolSnapshot> {
  readonly definition: ToolDefinition = {
    id: 'smart-select',
    name: 'Smart select',
    labelKey: 'tools.smartSelect',
    icon: 'heroiconsCursorArrowRays',
  };

  readonly tolerance = signal(32);
  readonly mode = signal<SmartSelectMode>('normal');

  setTolerance(value: number): void {
    const clamped = Math.max(0, Math.min(50, Math.round(value)));
    this.tolerance.set(clamped);
  }

  setMode(mode: SmartSelectMode): void {
    this.mode.set(mode);
  }

  snapshot(): SmartSelectToolSnapshot {
    return {
      tolerance: this.tolerance(),
    };
  }

  restore(snapshot: Partial<SmartSelectToolSnapshot> | undefined): void {
    if (!snapshot) return;
    if (typeof snapshot.tolerance === 'number') {
      this.setTolerance(snapshot.tolerance);
    }
  }

  performSmartSelect(
    startX: number,
    startY: number,
    buffer: string[],
    width: number,
    height: number,
    tolerance: number,
    existingMask?: Set<string> | null,
    mode: SmartSelectMode = 'normal',
  ): Set<string> {
    const targetColor = this.getPixelColor(startX, startY, buffer, width);
    if (!targetColor) {
      return existingMask ? new Set(existingMask) : new Set();
    }

    const newSelection = this.floodFillSelect(
      startX,
      startY,
      buffer,
      width,
      height,
      targetColor,
      tolerance,
    );

    return this.combineSelections(existingMask, newSelection, mode);
  }

  expandSmartSelect(
    points: { x: number; y: number }[],
    buffer: string[],
    width: number,
    height: number,
    tolerance: number,
    existingMask: Set<string> | null,
    mode: SmartSelectMode = 'normal',
  ): Set<string> {
    let result = existingMask ? new Set(existingMask) : new Set<string>();

    for (const point of points) {
      const targetColor = this.getPixelColor(point.x, point.y, buffer, width);
      if (!targetColor) continue;

      const newSelection = this.floodFillSelect(
        point.x,
        point.y,
        buffer,
        width,
        height,
        targetColor,
        tolerance,
      );

      result = this.combineSelections(result, newSelection, mode);
    }

    return result;
  }

  private getPixelColor(
    x: number,
    y: number,
    buffer: string[],
    width: number,
  ): string | null {
    const idx = y * width + x;
    if (idx < 0 || idx >= buffer.length) return null;
    return buffer[idx] || null;
  }

  private floodFillSelect(
    startX: number,
    startY: number,
    buffer: string[],
    width: number,
    height: number,
    targetColor: string,
    tolerance: number,
  ): Set<string> {
    const selected = new Set<string>();
    const visited = new Set<string>();
    const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];

    const targetRGB = this.hexToRGB(targetColor);
    if (!targetRGB) return selected;

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const currentColor = this.getPixelColor(x, y, buffer, width);
      if (!currentColor) continue;

      const currentRGB = this.hexToRGB(currentColor);
      if (!currentRGB) continue;

      if (this.colorDistance(targetRGB, currentRGB) <= tolerance) {
        selected.add(key);

        queue.push({ x: x + 1, y });
        queue.push({ x: x - 1, y });
        queue.push({ x, y: y + 1 });
        queue.push({ x, y: y - 1 });
      }
    }

    return selected;
  }

  private combineSelections(
    existing: Set<string> | null | undefined,
    newSelection: Set<string>,
    mode: SmartSelectMode,
  ): Set<string> {
    if (!existing || mode === 'normal') {
      return newSelection;
    }

    const result = new Set<string>();

    if (mode === 'add') {
      for (const key of existing) {
        result.add(key);
      }
      for (const key of newSelection) {
        result.add(key);
      }
    } else if (mode === 'subtract') {
      for (const key of existing) {
        if (!newSelection.has(key)) {
          result.add(key);
        }
      }
    }

    return result;
  }

  private hexToRGB(hex: string): { r: number; g: number; b: number } | null {
    if (!hex) return null;

    let cleanHex = hex.replace('#', '');

    if (cleanHex.length === 3) {
      cleanHex = cleanHex
        .split('')
        .map((c) => c + c)
        .join('');
    }

    if (cleanHex.length === 8) {
      cleanHex = cleanHex.substring(0, 6);
    }

    if (cleanHex.length !== 6) return null;

    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

    return { r, g, b };
  }

  private colorDistance(
    c1: { r: number; g: number; b: number },
    c2: { r: number; g: number; b: number },
  ): number {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
}
