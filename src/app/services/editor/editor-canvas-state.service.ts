import { Injectable, signal } from '@angular/core';

export interface PixelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

@Injectable({ providedIn: 'root' })
export class EditorCanvasStateService {
  readonly canvasWidth = signal<number>(64);
  readonly canvasHeight = signal<number>(64);
  readonly canvasSaved = signal<boolean>(true);
  readonly layerPixelsVersion = signal(0);
  private layerPixelMaps = new Map<string, Map<string, string>>();

  getPixel(layerId: string, x: number, y: number): string {
    const map = this.layerPixelMaps.get(layerId);
    if (!map) return '';
    return map.get(`${x},${y}`) || '';
  }

  setPixel(layerId: string, x: number, y: number, color: string): void {
    let map = this.layerPixelMaps.get(layerId);
    if (!map) {
      map = new Map<string, string>();
      this.layerPixelMaps.set(layerId, map);
    }
    const key = `${x},${y}`;
    if (color && color.length > 0) {
      map.set(key, color);
    } else {
      map.delete(key);
    }
  }

  deletePixel(layerId: string, x: number, y: number): void {
    const map = this.layerPixelMaps.get(layerId);
    if (map) {
      map.delete(`${x},${y}`);
    }
  }

  getLayerPixelMap(layerId: string): Map<string, string> {
    return this.layerPixelMaps.get(layerId) || new Map();
  }

  setLayerPixelMap(layerId: string, pixelMap: Map<string, string>): void {
    this.layerPixelMaps.set(layerId, pixelMap);
  }

  getLayerBuffer(layerId: string): string[] {
    const w = this.canvasWidth();
    const h = this.canvasHeight();
    const buf = new Array<string>(w * h).fill('');
    const map = this.layerPixelMaps.get(layerId);
    if (map) {
      for (const [key, color] of map.entries()) {
        const coords = this.parseCoordinateKey(key);
        if (!coords) continue;
        const { x, y } = coords;
        if (x >= 0 && x < w && y >= 0 && y < h) {
          buf[y * w + x] = color;
        }
      }
    }
    return buf;
  }

  setLayerBuffer(layerId: string, buffer: string[]): void {
    const w = this.canvasWidth();
    const h = this.canvasHeight();
    const map = new Map<string, string>();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const color = buffer[idx];
        if (color && color.length > 0) {
          map.set(`${x},${y}`, color);
        }
      }
    }
    this.layerPixelMaps.set(layerId, map);
  }

  deleteLayerBuffer(layerId: string): void {
    this.layerPixelMaps.delete(layerId);
  }

  getAllBuffers(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const layerId of this.layerPixelMaps.keys()) {
      result.set(layerId, this.getLayerBuffer(layerId));
    }
    return result;
  }

  replaceAllBuffers(buffers: Map<string, string[]>): void {
    this.layerPixelMaps.clear();
    for (const [layerId, buffer] of buffers.entries()) {
      this.setLayerBuffer(layerId, buffer);
    }
  }

  getAllPixelMaps(): Map<string, Map<string, string>> {
    return this.layerPixelMaps;
  }

  replaceAllPixelMaps(maps: Map<string, Map<string, string>>): void {
    this.layerPixelMaps = maps;
  }

  ensureLayerBuffer(layerId: string, width: number, height: number): void {
    if (!this.layerPixelMaps.has(layerId)) {
      this.layerPixelMaps.set(layerId, new Map<string, string>());
      this.layerPixelsVersion.update((v) => v + 1);
    }
  }

  parseCoordinateKey(key: string): { x: number; y: number } | null {
    const parts = key.split(',');
    if (parts.length !== 2) return null;
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    return { x, y };
  }

  getPixelBounds(layerId: string): PixelBounds | null {
    const map = this.layerPixelMaps.get(layerId);
    if (!map || map.size === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const key of map.keys()) {
      const coords = this.parseCoordinateKey(key);
      if (!coords) continue;
      const { x, y } = coords;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }

  getAllPixelBounds(): PixelBounds | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const map of this.layerPixelMaps.values()) {
      for (const key of map.keys()) {
        const coords = this.parseCoordinateKey(key);
        if (!coords) continue;
        const { x, y } = coords;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }

  getOutOfBoundsPixels(layerId: string): Map<string, string> {
    const w = this.canvasWidth();
    const h = this.canvasHeight();
    const map = this.layerPixelMaps.get(layerId);
    const outOfBounds = new Map<string, string>();
    if (!map) return outOfBounds;
    for (const [key, color] of map.entries()) {
      const coords = this.parseCoordinateKey(key);
      if (!coords) continue;
      const { x, y } = coords;
      if (x < 0 || x >= w || y < 0 || y >= h) {
        outOfBounds.set(key, color);
      }
    }
    return outOfBounds;
  }

  hasOutOfBoundsPixels(layerId: string): boolean {
    const w = this.canvasWidth();
    const h = this.canvasHeight();
    const map = this.layerPixelMaps.get(layerId);
    if (!map) return false;
    for (const key of map.keys()) {
      const coords = this.parseCoordinateKey(key);
      if (!coords) continue;
      const { x, y } = coords;
      if (x < 0 || x >= w || y < 0 || y >= h) {
        return true;
      }
    }
    return false;
  }

  setCanvasSize(width: number, height: number): void {
    this.canvasWidth.set(width);
    this.canvasHeight.set(height);
  }

  setCanvasSaved(saved: boolean): void {
    this.canvasSaved.set(saved);
  }

  incrementPixelsVersion(): void {
    this.layerPixelsVersion.update((v) => v + 1);
  }
}
