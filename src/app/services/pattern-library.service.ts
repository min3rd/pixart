import { Injectable, signal, computed } from '@angular/core';

export interface Pattern {
  id: string;
  name: string;
  nameKey: string;
  category: 'shape' | 'texture' | 'custom';
  generate: (size: number) => ImageData;
}

export interface CustomPattern {
  id: string;
  name: string;
  imageDataBase64: string;
  pixelData?: number[];
  width: number;
  height: number;
  scale: number;
  opacity: number;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class PatternLibraryService {
  private readonly patterns = signal<Pattern[]>([
    {
      id: 'checker-8',
      name: 'Checker 8x8',
      nameKey: 'patterns.checker8',
      category: 'shape',
      generate: (size: number) => this.generateChecker(size, 8),
    },
    {
      id: 'checker-4',
      name: 'Checker 4x4',
      nameKey: 'patterns.checker4',
      category: 'shape',
      generate: (size: number) => this.generateChecker(size, 4),
    },
    {
      id: 'checker-2',
      name: 'Checker 2x2',
      nameKey: 'patterns.checker2',
      category: 'shape',
      generate: (size: number) => this.generateChecker(size, 2),
    },
    {
      id: 'dots-8',
      name: 'Dots 8x8',
      nameKey: 'patterns.dots8',
      category: 'shape',
      generate: (size: number) => this.generateDots(size, 8),
    },
    {
      id: 'dots-4',
      name: 'Dots 4x4',
      nameKey: 'patterns.dots4',
      category: 'shape',
      generate: (size: number) => this.generateDots(size, 4),
    },
    {
      id: 'stripes-h-8',
      name: 'Horizontal Stripes 8px',
      nameKey: 'patterns.stripesH8',
      category: 'shape',
      generate: (size: number) => this.generateHorizontalStripes(size, 8),
    },
    {
      id: 'stripes-h-4',
      name: 'Horizontal Stripes 4px',
      nameKey: 'patterns.stripesH4',
      category: 'shape',
      generate: (size: number) => this.generateHorizontalStripes(size, 4),
    },
    {
      id: 'stripes-v-8',
      name: 'Vertical Stripes 8px',
      nameKey: 'patterns.stripesV8',
      category: 'shape',
      generate: (size: number) => this.generateVerticalStripes(size, 8),
    },
    {
      id: 'stripes-v-4',
      name: 'Vertical Stripes 4px',
      nameKey: 'patterns.stripesV4',
      category: 'shape',
      generate: (size: number) => this.generateVerticalStripes(size, 4),
    },
    {
      id: 'grid-8',
      name: 'Grid 8x8',
      nameKey: 'patterns.grid8',
      category: 'shape',
      generate: (size: number) => this.generateGrid(size, 8),
    },
    {
      id: 'grid-4',
      name: 'Grid 4x4',
      nameKey: 'patterns.grid4',
      category: 'shape',
      generate: (size: number) => this.generateGrid(size, 4),
    },
    {
      id: 'noise',
      name: 'Noise',
      nameKey: 'patterns.noise',
      category: 'texture',
      generate: (size: number) => this.generateNoise(size),
    },
    {
      id: 'diagonal-lines-8',
      name: 'Diagonal Lines 8px',
      nameKey: 'patterns.diagonalLines8',
      category: 'shape',
      generate: (size: number) => this.generateDiagonalLines(size, 8),
    },
    {
      id: 'diagonal-lines-4',
      name: 'Diagonal Lines 4px',
      nameKey: 'patterns.diagonalLines4',
      category: 'shape',
      generate: (size: number) => this.generateDiagonalLines(size, 4),
    },
  ]);

  readonly allPatterns = this.patterns.asReadonly();

  private readonly customPatternsData = signal<CustomPattern[]>([]);
  private readonly STORAGE_KEY = 'pixart.customPatterns.v1';

  readonly customPatterns = this.customPatternsData.asReadonly();

  readonly allPatternsIncludingCustom = computed(() => {
    const builtIn = this.patterns();
    const custom = this.customPatternsData().map(cp => this.customPatternToPattern(cp));
    return [...builtIn, ...custom];
  });

  constructor() {
    this.loadCustomPatterns();
  }

  getPattern(id: string): Pattern | undefined {
    return this.allPatternsIncludingCustom().find((p) => p.id === id);
  }

  getPatternsByCategory(category: 'shape' | 'texture' | 'custom'): Pattern[] {
    return this.allPatternsIncludingCustom().filter((p) => p.category === category);
  }

  addCustomPattern(customPattern: Omit<CustomPattern, 'id' | 'createdAt'>): CustomPattern {
    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const newPattern: CustomPattern = {
      ...customPattern,
      id: `custom_${uniqueId}`,
      createdAt: Date.now(),
    };
    this.customPatternsData.update(list => [...list, newPattern]);
    this.saveCustomPatterns();
    return newPattern;
  }

  removeCustomPattern(id: string): boolean {
    const current = this.customPatternsData();
    const idx = current.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.customPatternsData.update(list => list.filter(p => p.id !== id));
    this.saveCustomPatterns();
    return true;
  }

  getCustomPattern(id: string): CustomPattern | undefined {
    return this.customPatternsData().find(p => p.id === id);
  }

  updateCustomPattern(id: string, updates: Partial<Omit<CustomPattern, 'id' | 'createdAt'>>): boolean {
    const current = this.customPatternsData();
    const idx = current.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.customPatternsData.update(list => list.map(p =>
      p.id === id ? { ...p, ...updates } : p
    ));
    this.saveCustomPatterns();
    return true;
  }

  private customPatternToPattern(cp: CustomPattern): Pattern {
    return {
      id: cp.id,
      name: cp.name,
      nameKey: '',
      category: 'custom',
      generate: (size: number) => this.generateFromCustomPattern(cp, size),
    };
  }

  private generateFromCustomPattern(cp: CustomPattern, size: number): ImageData {
    const imageData = new ImageData(size, size);
    const data = imageData.data;

    let srcPixels: number[] | Uint8ClampedArray | null = null;

    if (cp.pixelData && cp.pixelData.length === cp.width * cp.height * 4) {
      srcPixels = cp.pixelData;
    } else {
      const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      if (!canvas) {
        return imageData;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return imageData;

      canvas.width = cp.width;
      canvas.height = cp.height;

      const srcData = this.decodeBase64ToImageData(cp.imageDataBase64, cp.width, cp.height, ctx);
      if (!srcData) return imageData;
      srcPixels = srcData.data;
    }

    const scaleW = Math.max(1, Math.floor(cp.width * cp.scale));
    const scaleH = Math.max(1, Math.floor(cp.height * cp.scale));

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const srcX = (x % scaleW) / cp.scale;
        const srcY = (y % scaleH) / cp.scale;
        const sx = Math.min(Math.floor(srcX), cp.width - 1);
        const sy = Math.min(Math.floor(srcY), cp.height - 1);
        const srcIdx = (sy * cp.width + sx) * 4;
        const destIdx = (y * size + x) * 4;

        data[destIdx] = srcPixels[srcIdx];
        data[destIdx + 1] = srcPixels[srcIdx + 1];
        data[destIdx + 2] = srcPixels[srcIdx + 2];
        data[destIdx + 3] = Math.floor(srcPixels[srcIdx + 3] * cp.opacity);
      }
    }

    return imageData;
  }

  private decodeBase64ToImageData(base64: string, width: number, height: number, ctx: CanvasRenderingContext2D): ImageData | null {
    try {
      const img = new Image();
      img.src = base64;

      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, width, height);
      }

      return ctx.createImageData(width, height);
    } catch {
      return null;
    }
  }

  private loadCustomPatterns(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CustomPattern[];
      if (Array.isArray(parsed)) {
        this.customPatternsData.set(parsed);
      }
    } catch (error) {
      console.error('Failed to load custom patterns', error);
    }
  }

  private saveCustomPatterns(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.customPatternsData()));
    } catch (error) {
      console.error('Failed to save custom patterns', error);
    }
  }

  private generateChecker(size: number, cellSize: number): ImageData {
    const imageData = new ImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        const isBlack = (cellX + cellY) % 2 === 0;
        const idx = (y * size + x) * 4;
        const value = isBlack ? 0 : 255;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }
    return imageData;
  }

  private generateDots(size: number, spacing: number): ImageData {
    const imageData = new ImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const isDot =
          x % spacing === Math.floor(spacing / 2) &&
          y % spacing === Math.floor(spacing / 2);
        const value = isDot ? 0 : 255;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }
    return imageData;
  }

  private generateHorizontalStripes(size: number, stripeHeight: number): ImageData {
    const imageData = new ImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      const isBlack = Math.floor(y / stripeHeight) % 2 === 0;
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const value = isBlack ? 0 : 255;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }
    return imageData;
  }

  private generateVerticalStripes(size: number, stripeWidth: number): ImageData {
    const imageData = new ImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isBlack = Math.floor(x / stripeWidth) % 2 === 0;
        const idx = (y * size + x) * 4;
        const value = isBlack ? 0 : 255;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }
    return imageData;
  }

  private generateGrid(size: number, cellSize: number): ImageData {
    const imageData = new ImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const isLine = x % cellSize === 0 || y % cellSize === 0;
        const value = isLine ? 0 : 255;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }
    return imageData;
  }

  private generateNoise(size: number): ImageData {
    const imageData = new ImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const value = Math.random() * 255;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    return imageData;
  }

  private generateDiagonalLines(size: number, spacing: number): ImageData {
    const imageData = new ImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const isLine = (x + y) % spacing === 0;
        const value = isLine ? 0 : 255;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }
    return imageData;
  }
}
