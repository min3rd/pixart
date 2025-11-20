import { Injectable, signal } from '@angular/core';

export interface Pattern {
  id: string;
  name: string;
  nameKey: string;
  category: 'shape' | 'texture';
  generate: (size: number) => ImageData;
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

  getPattern(id: string): Pattern | undefined {
    return this.patterns().find((p) => p.id === id);
  }

  getPatternsByCategory(category: 'shape' | 'texture'): Pattern[] {
    return this.patterns().filter((p) => p.category === category);
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
