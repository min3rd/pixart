import { Injectable } from '@angular/core';
import {
  PixelGenerationResponse,
  PixelArtStyle,
  PIXEL_ART_STYLE_CONFIGS,
  PixelGenerationMetadata,
} from './pixel-generation-models';

@Injectable({ providedIn: 'root' })
export class PixelGenerationLocalService {
  async processLocally(
    sketchData: ImageData,
    prompt: string,
    width: number,
    height: number,
    style: PixelArtStyle,
    colorPalette?: string[],
  ): Promise<PixelGenerationResponse> {
    const requestId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = performance.now();

    try {
      const styleConfig = PIXEL_ART_STYLE_CONFIGS[style];

      let processedData = this.scaleImage(sketchData, width, height);

      const palette = colorPalette || this.generateDefaultPalette(styleConfig.maxColors);

      processedData = this.quantizeColors(processedData, palette);

      if (styleConfig.ditherEnabled) {
        processedData = this.applyDithering(processedData, palette);
      }

      if (styleConfig.contrastBoost !== 1.0) {
        processedData = this.adjustContrast(processedData, styleConfig.contrastBoost);
      }

      processedData = this.edgeEnhancement(processedData);

      const processingTime = performance.now() - startTime;

      const metadata: PixelGenerationMetadata = {
        colorsUsed: this.countUniqueColors(processedData),
        pixelCount: width * height,
        algorithm: `local-${style}`,
      };

      return {
        id: requestId,
        status: 'completed',
        progress: 100,
        resultImageData: processedData,
        processingTime,
        metadata,
      };
    } catch (error) {
      return {
        id: requestId,
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  private scaleImage(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Cannot create canvas context');
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      throw new Error('Cannot create temp canvas context');
    }

    tempCtx.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    return ctx.getImageData(0, 0, targetWidth, targetHeight);
  }

  private quantizeColors(imageData: ImageData, palette: string[]): ImageData {
    const result = new ImageData(imageData.width, imageData.height);
    const paletteRgb = palette.map((hex) => this.hexToRgb(hex));

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];

      if (a === 0) {
        result.data[i] = 0;
        result.data[i + 1] = 0;
        result.data[i + 2] = 0;
        result.data[i + 3] = 0;
        continue;
      }

      const closest = this.findClosestColor({ r, g, b }, paletteRgb);

      result.data[i] = closest.r;
      result.data[i + 1] = closest.g;
      result.data[i + 2] = closest.b;
      result.data[i + 3] = a;
    }

    return result;
  }

  private applyDithering(imageData: ImageData, palette: string[]): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    );
    const paletteRgb = palette.map((hex) => this.hexToRgb(hex));

    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const idx = (y * imageData.width + x) * 4;

        const oldR = result.data[idx];
        const oldG = result.data[idx + 1];
        const oldB = result.data[idx + 2];
        const oldA = result.data[idx + 3];

        if (oldA === 0) continue;

        const closest = this.findClosestColor({ r: oldR, g: oldG, b: oldB }, paletteRgb);

        result.data[idx] = closest.r;
        result.data[idx + 1] = closest.g;
        result.data[idx + 2] = closest.b;

        const errR = oldR - closest.r;
        const errG = oldG - closest.g;
        const errB = oldB - closest.b;

        this.distributeError(result, x + 1, y, imageData.width, errR, errG, errB, 7 / 16);
        this.distributeError(result, x - 1, y + 1, imageData.width, errR, errG, errB, 3 / 16);
        this.distributeError(result, x, y + 1, imageData.width, errR, errG, errB, 5 / 16);
        this.distributeError(result, x + 1, y + 1, imageData.width, errR, errG, errB, 1 / 16);
      }
    }

    return result;
  }

  private distributeError(
    imageData: ImageData,
    x: number,
    y: number,
    width: number,
    errR: number,
    errG: number,
    errB: number,
    factor: number,
  ): void {
    if (x < 0 || x >= width || y >= imageData.height) return;

    const idx = (y * width + x) * 4;
    if (imageData.data[idx + 3] === 0) return;

    imageData.data[idx] = Math.max(0, Math.min(255, imageData.data[idx] + errR * factor));
    imageData.data[idx + 1] = Math.max(0, Math.min(255, imageData.data[idx + 1] + errG * factor));
    imageData.data[idx + 2] = Math.max(0, Math.min(255, imageData.data[idx + 2] + errB * factor));
  }

  private adjustContrast(imageData: ImageData, factor: number): ImageData {
    const result = new ImageData(imageData.width, imageData.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const a = imageData.data[i + 3];
      if (a === 0) {
        result.data[i] = 0;
        result.data[i + 1] = 0;
        result.data[i + 2] = 0;
        result.data[i + 3] = 0;
        continue;
      }

      for (let c = 0; c < 3; c++) {
        const value = imageData.data[i + c];
        const adjusted = ((value - 128) * factor + 128);
        result.data[i + c] = Math.max(0, Math.min(255, adjusted));
      }
      result.data[i + 3] = a;
    }

    return result;
  }

  private edgeEnhancement(imageData: ImageData): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    );
    const kernel = [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0],
    ];

    for (let y = 1; y < imageData.height - 1; y++) {
      for (let x = 1; x < imageData.width - 1; x++) {
        const idx = (y * imageData.width + x) * 4;
        const a = imageData.data[idx + 3];

        if (a === 0) continue;

        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const nIdx = ((y + ky) * imageData.width + (x + kx)) * 4;
              sum += imageData.data[nIdx + c] * kernel[ky + 1][kx + 1];
            }
          }
          result.data[idx + c] = Math.max(0, Math.min(255, sum));
        }
      }
    }

    return result;
  }

  private findClosestColor(
    color: { r: number; g: number; b: number },
    palette: Array<{ r: number; g: number; b: number }>,
  ): { r: number; g: number; b: number } {
    let minDistance = Infinity;
    let closest = palette[0];

    for (const paletteColor of palette) {
      const distance = this.colorDistance(color, paletteColor);
      if (distance < minDistance) {
        minDistance = distance;
        closest = paletteColor;
      }
    }

    return closest;
  }

  private colorDistance(
    c1: { r: number; g: number; b: number },
    c2: { r: number; g: number; b: number },
  ): number {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return dr * dr + dg * dg + db * db;
  }

  private generateDefaultPalette(maxColors: number): string[] {
    const palettes: Record<number, string[]> = {
      4: ['#000000', '#555555', '#aaaaaa', '#ffffff'],
      8: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8'],
      16: [
        '#000000',
        '#1d2b53',
        '#7e2553',
        '#008751',
        '#ab5236',
        '#5f574f',
        '#c2c3c7',
        '#fff1e8',
        '#ff004d',
        '#ffa300',
        '#ffec27',
        '#00e436',
        '#29adff',
        '#83769c',
        '#ff77a8',
        '#ffccaa',
      ],
      32: this.generate32ColorPalette(),
      64: this.generate64ColorPalette(),
    };

    return palettes[maxColors] || palettes[16];
  }

  private generate32ColorPalette(): string[] {
    return [
      '#000000',
      '#1a1c2c',
      '#5d275d',
      '#b13e53',
      '#ef7d57',
      '#ffcd75',
      '#a7f070',
      '#38b764',
      '#257179',
      '#29366f',
      '#3b5dc9',
      '#41a6f6',
      '#73eff7',
      '#f4f4f4',
      '#94b0c2',
      '#566c86',
      '#333c57',
      '#8b4852',
      '#c25454',
      '#ed7b7b',
      '#ffa5a5',
      '#ffd4a3',
      '#ffe2bd',
      '#c2f970',
      '#8cd612',
      '#4d9121',
      '#2f5233',
      '#00467f',
      '#1b62ab',
      '#2c8fdf',
      '#5eb3ff',
      '#a5d8ff',
    ];
  }

  private generate64ColorPalette(): string[] {
    const palette: string[] = [];
    for (let r = 0; r < 4; r++) {
      for (let g = 0; g < 4; g++) {
        for (let b = 0; b < 4; b++) {
          const rVal = Math.floor((r / 3) * 255);
          const gVal = Math.floor((g / 3) * 255);
          const bVal = Math.floor((b / 3) * 255);
          palette.push(this.rgbToHex(rVal, gVal, bVal));
        }
      }
    }
    return palette;
  }

  private countUniqueColors(imageData: ImageData): number {
    const colors = new Set<string>();
    for (let i = 0; i < imageData.data.length; i += 4) {
      const a = imageData.data[i + 3];
      if (a > 0) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        colors.add(this.rgbToHex(r, g, b));
      }
    }
    return colors.size;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return { r: 0, g: 0, b: 0 };
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('')
    );
  }
}
