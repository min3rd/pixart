import { Injectable, signal, computed } from '@angular/core';
import { ToolDefinition, ToolService } from './tool.types';

export interface EyedropperSnapshot {
  lastPickedColor: string | null;
}

@Injectable({ providedIn: 'root' })
export class EyedropperToolService implements ToolService<EyedropperSnapshot> {
  readonly definition: ToolDefinition = {
    id: 'eyedropper',
    name: 'Eyedropper',
    labelKey: 'tools.eyedropper',
    icon: 'bootstrapEyedropper',
  };

  readonly lastPickedColor = signal<string | null>(null);

  readonly lastPickedColorRGB = computed(() => {
    const hex = this.lastPickedColor();
    if (!hex) return null;
    return this.hexToRgb(hex);
  });

  readonly lastPickedColorHSL = computed(() => {
    const hex = this.lastPickedColor();
    if (!hex) return null;
    return this.hexToHsl(hex);
  });

  setLastPickedColor(color: string): void {
    const normalized = this.normalizeHex(color);
    this.lastPickedColor.set(normalized);
  }

  clearLastPickedColor(): void {
    this.lastPickedColor.set(null);
  }

  private normalizeHex(color: string): string {
    let hex = color.trim().toLowerCase();
    if (!hex.startsWith('#')) {
      hex = '#' + hex;
    }
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex.slice(0, 7);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = this.normalizeHex(hex);
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return { r, g, b };
  }

  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const { r, g, b } = this.hexToRgb(hex);
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l: Math.round(l * 100) };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  snapshot(): EyedropperSnapshot {
    return {
      lastPickedColor: this.lastPickedColor(),
    };
  }

  restore(data?: Partial<EyedropperSnapshot>): void {
    if (data?.lastPickedColor) {
      this.lastPickedColor.set(data.lastPickedColor);
    }
  }
}
