import { Injectable, signal, computed, inject } from '@angular/core';
import { EditorDocumentService } from './editor-document.service';

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class PaletteService {
  private readonly STORAGE_KEY = 'pixart.palettes.v1';
  private readonly document = inject(EditorDocumentService);

  private readonly _palettes = signal<ColorPalette[]>([]);
  readonly palettes = this._palettes.asReadonly();

  readonly paletteCount = computed(() => this._palettes().length);

  constructor() {
    this.loadFromStorage();
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private isStorageAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  createPalette(name: string, colors: string[] = []): ColorPalette {
    const now = Date.now();
    const palette: ColorPalette = {
      id: this.generateId(),
      name: name.trim() || 'Untitled Palette',
      colors: this.deduplicateColors(colors),
      createdAt: now,
      updatedAt: now,
    };

    this._palettes.update((palettes) => [palette, ...palettes]);
    this.saveToStorage();
    return palette;
  }

  getPalette(id: string): ColorPalette | null {
    return this._palettes().find((p) => p.id === id) || null;
  }

  updatePalette(
    id: string,
    updates: Partial<Pick<ColorPalette, 'name' | 'colors'>>,
  ): boolean {
    const index = this._palettes().findIndex((p) => p.id === id);
    if (index === -1) return false;

    this._palettes.update((palettes) => {
      const updated = [...palettes];
      updated[index] = {
        ...updated[index],
        ...updates,
        colors: updates.colors
          ? this.deduplicateColors(updates.colors)
          : updated[index].colors,
        updatedAt: Date.now(),
      };
      return updated;
    });

    this.saveToStorage();
    return true;
  }

  renamePalette(id: string, name: string): boolean {
    return this.updatePalette(id, { name: name.trim() });
  }

  deletePalette(id: string): boolean {
    const index = this._palettes().findIndex((p) => p.id === id);
    if (index === -1) return false;

    this._palettes.update((palettes) => palettes.filter((p) => p.id !== id));
    this.saveToStorage();
    return true;
  }

  addColorToPalette(id: string, color: string): boolean {
    const palette = this.getPalette(id);
    if (!palette) return false;

    const normalizedColor = this.normalizeColor(color);
    if (palette.colors.includes(normalizedColor)) return false;

    return this.updatePalette(id, {
      colors: [...palette.colors, normalizedColor],
    });
  }

  removeColorFromPalette(id: string, colorIndex: number): boolean {
    const palette = this.getPalette(id);
    if (!palette || colorIndex < 0 || colorIndex >= palette.colors.length)
      return false;

    const newColors = [...palette.colors];
    newColors.splice(colorIndex, 1);
    return this.updatePalette(id, { colors: newColors });
  }

  reorderColorInPalette(
    id: string,
    fromIndex: number,
    toIndex: number,
  ): boolean {
    const palette = this.getPalette(id);
    if (!palette) return false;

    if (
      fromIndex < 0 ||
      fromIndex >= palette.colors.length ||
      toIndex < 0 ||
      toIndex >= palette.colors.length
    )
      return false;

    const newColors = [...palette.colors];
    const [removed] = newColors.splice(fromIndex, 1);
    newColors.splice(toIndex, 0, removed);
    return this.updatePalette(id, { colors: newColors });
  }

  extractColorsFromSelection(): string[] {
    const sel = this.document.selectionRect();
    if (!sel) return [];

    const layerId = this.document.selectedLayerId();
    const buffer = this.document.getLayerBuffer(layerId);
    if (!buffer || buffer.length === 0) return [];

    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();
    const shape = this.document.selectionShape();
    const poly = this.document.selectionPolygon();
    const colorSet = new Set<string>();

    for (let y = 0; y < sel.height; y++) {
      for (let x = 0; x < sel.width; x++) {
        const px = sel.x + x;
        const py = sel.y + y;
        if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight)
          continue;

        if (this.isPixelInSelection(px, py, sel, shape, poly)) {
          const idx = py * canvasWidth + px;
          const color = buffer[idx];
          if (color && color.length > 0) {
            colorSet.add(this.normalizeColor(color));
          }
        }
      }
    }

    return this.sortColors(Array.from(colorSet));
  }

  private isPixelInSelection(
    x: number,
    y: number,
    sel: { x: number; y: number; width: number; height: number },
    shape: 'rect' | 'ellipse' | 'lasso',
    poly: { x: number; y: number }[] | null,
  ): boolean {
    if (x < sel.x || x >= sel.x + sel.width || y < sel.y || y >= sel.y + sel.height) {
      return false;
    }

    if (shape === 'rect') {
      return true;
    }

    if (shape === 'ellipse') {
      const cx = sel.x + sel.width / 2;
      const cy = sel.y + sel.height / 2;
      const rx = sel.width / 2;
      const ry = sel.height / 2;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    }

    if (shape === 'lasso' && poly && poly.length >= 3) {
      return this.pointInPolygon(x, y, poly);
    }

    return true;
  }

  private pointInPolygon(
    x: number,
    y: number,
    polygon: { x: number; y: number }[],
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  extractColorsFromLayer(layerId?: string): string[] {
    const id = layerId || this.document.selectedLayerId();
    const buffer = this.document.getLayerBuffer(id);
    if (!buffer || buffer.length === 0) return [];

    const colorSet = new Set<string>();
    for (const color of buffer) {
      if (color && color.length > 0) {
        colorSet.add(this.normalizeColor(color));
      }
    }

    return this.sortColors(Array.from(colorSet));
  }

  createPaletteFromSelection(name?: string): ColorPalette | null {
    const colors = this.extractColorsFromSelection();
    if (colors.length === 0) return null;
    return this.createPalette(name || 'Selection Palette', colors);
  }

  createPaletteFromLayer(name?: string, layerId?: string): ColorPalette | null {
    const colors = this.extractColorsFromLayer(layerId);
    if (colors.length === 0) return null;
    return this.createPalette(name || 'Layer Palette', colors);
  }

  private deduplicateColors(colors: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const color of colors) {
      const normalized = this.normalizeColor(color);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
    return result;
  }

  private readonly HUE_DIFF_THRESHOLD = 30;
  private readonly SATURATION_DIFF_THRESHOLD = 20;

  private normalizeColor(color: string): string {
    if (!color) return '#000000';

    let hex = color.trim().toLowerCase();

    if (hex.startsWith('rgb')) {
      const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = Math.max(0, Math.min(255, parseInt(match[1], 10)));
        const g = Math.max(0, Math.min(255, parseInt(match[2], 10)));
        const b = Math.max(0, Math.min(255, parseInt(match[3], 10)));
        hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }

    if (hex.startsWith('#') && hex.length === 9) {
      hex = hex.slice(0, 7);
    }

    if (hex.startsWith('#') && hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }

    if (!hex.startsWith('#')) {
      hex = `#${hex}`;
    }

    return hex.slice(0, 7).toLowerCase();
  }

  private circularHueDifference(h1: number, h2: number): number {
    const diff = Math.abs(h1 - h2);
    return Math.min(diff, 360 - diff);
  }

  private sortColors(colors: string[]): string[] {
    return colors.sort((a, b) => {
      const hslA = this.hexToHsl(a);
      const hslB = this.hexToHsl(b);

      const hueDiff = this.circularHueDifference(hslA.h, hslB.h);
      if (hueDiff > this.HUE_DIFF_THRESHOLD) {
        const hueA = hslA.h;
        const hueB = hslB.h;
        return hueA - hueB;
      }

      if (Math.abs(hslA.s - hslB.s) > this.SATURATION_DIFF_THRESHOLD) {
        return hslB.s - hslA.s;
      }

      return hslB.l - hslA.l;
    });
  }

  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l: l * 100 };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  private loadFromStorage(): void {
    try {
      if (!this.isStorageAvailable()) return;
      const raw = window.localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as ColorPalette[];
      if (Array.isArray(parsed)) {
        this._palettes.set(parsed);
      }
    } catch (error) {
      console.error('Failed to load palettes from storage', error);
    }
  }

  private saveToStorage(): void {
    try {
      if (!this.isStorageAvailable()) return;
      window.localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(this._palettes()),
      );
    } catch (error) {
      console.error('Failed to save palettes to storage', error);
    }
  }
}
