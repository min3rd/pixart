import { Injectable, signal } from '@angular/core';
import { ToolDefinition, ToolService, SmartSelectToolSnapshot } from './tool.types';

export type SmartSelectMode = 'normal' | 'add' | 'subtract';

@Injectable({ providedIn: 'root' })
export class SmartSelectToolService implements ToolService<SmartSelectToolSnapshot> {
  readonly definition: ToolDefinition = {
    id: 'smart-select',
    name: 'Smart select',
    labelKey: 'tools.smartSelect',
    icon: 'heroCursorArrowRays',
  };

  readonly tolerance = signal(32);
  readonly mode = signal<SmartSelectMode>('normal');
  private sampledColors: Set<string> = new Set();

  setTolerance(value: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
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

  resetSampledColors(): void {
    this.sampledColors.clear();
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
  ): { newPixels: Set<string>; combined: Set<string> } {
    this.sampledColors.clear();
    
    const targetColor = this.getPixelColor(startX, startY, buffer, width);
    if (!targetColor) {
      return { newPixels: new Set(), combined: existingMask ? new Set(existingMask) : new Set() };
    }

    this.sampledColors.add(targetColor);

    const newSelection = this.selectAllMatchingPixels(
      buffer,
      width,
      height,
      tolerance,
    );

    return { newPixels: newSelection, combined: this.combineSelections(existingMask, newSelection, mode) };
  }

  expandSmartSelect(
    points: { x: number; y: number }[],
    buffer: string[],
    width: number,
    height: number,
    tolerance: number,
    existingMask: Set<string> | null,
    mode: SmartSelectMode = 'normal',
  ): { newPixels: Set<string>; combined: Set<string> } {
    for (const point of points) {
      const color = this.getPixelColor(point.x, point.y, buffer, width);
      if (color) {
        this.sampledColors.add(color);
      }
    }

    const newSelection = this.selectAllMatchingPixels(
      buffer,
      width,
      height,
      tolerance,
    );

    const combined = this.combineSelections(existingMask, newSelection, mode);
    return { newPixels: newSelection, combined };
  }

  private selectAllMatchingPixels(
    buffer: string[],
    width: number,
    height: number,
    tolerance: number,
  ): Set<string> {
    const selected = new Set<string>();
    
    const sampledRGBs: { r: number; g: number; b: number }[] = [];
    for (const color of this.sampledColors) {
      const rgb = this.hexToRGB(color);
      if (rgb) {
        sampledRGBs.push(rgb);
      }
    }

    if (sampledRGBs.length === 0) {
      return selected;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = this.getPixelColor(x, y, buffer, width);
        if (!color) continue;

        const rgb = this.hexToRGB(color);
        if (!rgb) continue;

        for (const sampledRGB of sampledRGBs) {
          if (this.colorDistance(sampledRGB, rgb) <= tolerance) {
            selected.add(`${x},${y}`);
            break;
          }
        }
      }
    }

    return selected;
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

  private combineSelections(
    existing: Set<string> | null | undefined,
    newSelection: Set<string>,
    mode: SmartSelectMode,
  ): Set<string> {
    if (!existing || mode === 'normal') {
      return newSelection;
    }

    if (mode === 'add') {
      return new Set([...existing, ...newSelection]);
    }

    if (mode === 'subtract') {
      const result = new Set<string>();
      for (const key of existing) {
        if (!newSelection.has(key)) {
          result.add(key);
        }
      }
      return result;
    }

    return newSelection;
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
