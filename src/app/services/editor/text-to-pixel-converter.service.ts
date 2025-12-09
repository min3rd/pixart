import { Injectable } from '@angular/core';

export interface TextRenderOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  targetWidth?: number;
  targetHeight?: number;
  renderScale?: number;
}

export interface PixelizedTextResult {
  width: number;
  height: number;
  imageData: ImageData;
}

@Injectable({ providedIn: 'root' })
export class TextToPixelConverterService {
  private readonly DEFAULT_RENDER_SCALE = 4;
  private readonly MIN_RENDER_SCALE = 2;
  private readonly MAX_RENDER_SCALE = 8;

  async renderTextToPixels(options: TextRenderOptions): Promise<PixelizedTextResult | null> {
    const fontLoaded = await this.ensureFontLoaded(options.fontFamily);
    const effectiveFont = fontLoaded ? `"${options.fontFamily}"` : 'monospace';
    
    const renderScale = this.validateRenderScale(options.renderScale);
    const scaledFontSize = options.fontSize * renderScale;
    const lines = options.text.split('\n');
    const lineHeight = Math.ceil(scaledFontSize * 1.2);

    const maxExpectedWidth = Math.min(scaledFontSize * options.text.length * 1.5, 8000);
    const maxExpectedHeight = Math.min(scaledFontSize * lines.length * 2, 2000);
    
    const measureCanvas = document.createElement('canvas');
    measureCanvas.width = maxExpectedWidth;
    measureCanvas.height = maxExpectedHeight;
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;

    measureCtx.font = `${scaledFontSize}px ${effectiveFont}, sans-serif`;

    let maxWidth = 1;
    for (const line of lines) {
      const metrics = measureCtx.measureText(line);
      maxWidth = Math.max(maxWidth, Math.ceil(metrics.width) + 8 * renderScale);
    }
    const textHeight = Math.ceil(lineHeight * lines.length) + 8 * renderScale;

    const highResWidth = Math.max(maxWidth, 10 * renderScale);
    const highResHeight = Math.max(textHeight, scaledFontSize + 8 * renderScale);

    const highResCanvas = document.createElement('canvas');
    highResCanvas.width = highResWidth;
    highResCanvas.height = highResHeight;

    const ctx = highResCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.font = `${scaledFontSize}px ${effectiveFont}, sans-serif`;
    ctx.fillStyle = options.color;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 4 * renderScale, 4 * renderScale + i * lineHeight);
    }

    const finalWidth = Math.ceil(highResWidth / renderScale);
    const finalHeight = Math.ceil(highResHeight / renderScale);

    const downscaledImageData = this.downsampleImageData(
      ctx.getImageData(0, 0, highResWidth, highResHeight),
      finalWidth,
      finalHeight
    );

    return {
      width: finalWidth,
      height: finalHeight,
      imageData: downscaledImageData,
    };
  }

  private downsampleImageData(
    sourceImageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ): ImageData {
    const sourceWidth = sourceImageData.width;
    const sourceHeight = sourceImageData.height;
    const sourceData = sourceImageData.data;

    const scaleX = sourceWidth / targetWidth;
    const scaleY = sourceHeight / targetHeight;

    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;
    const targetCtx = targetCanvas.getContext('2d');
    if (!targetCtx) return sourceImageData;

    const targetImageData = targetCtx.createImageData(targetWidth, targetHeight);
    const targetData = targetImageData.data;

    const blockWidth = Math.ceil(scaleX);
    const blockHeight = Math.ceil(scaleY);
    const totalSamples = blockWidth * blockHeight;

    for (let ty = 0; ty < targetHeight; ty++) {
      const srcStartY = Math.floor(ty * scaleY);
      const srcEndY = Math.min(srcStartY + blockHeight, sourceHeight);
      
      for (let tx = 0; tx < targetWidth; tx++) {
        let r = 0, g = 0, b = 0, a = 0;
        let validSamples = 0;

        const srcStartX = Math.floor(tx * scaleX);
        const srcEndX = Math.min(srcStartX + blockWidth, sourceWidth);

        for (let sy = srcStartY; sy < srcEndY; sy++) {
          const rowIdx = sy * sourceWidth * 4;
          for (let sx = srcStartX; sx < srcEndX; sx++) {
            const srcIdx = rowIdx + sx * 4;
            const srcAlpha = sourceData[srcIdx + 3];
            
            if (srcAlpha > 0) {
              r += sourceData[srcIdx] * srcAlpha;
              g += sourceData[srcIdx + 1] * srcAlpha;
              b += sourceData[srcIdx + 2] * srcAlpha;
              a += srcAlpha;
              validSamples++;
            }
          }
        }

        const targetIdx = (ty * targetWidth + tx) * 4;
        if (a > 0 && validSamples > 0) {
          targetData[targetIdx] = Math.round(r / a);
          targetData[targetIdx + 1] = Math.round(g / a);
          targetData[targetIdx + 2] = Math.round(b / a);
          targetData[targetIdx + 3] = Math.round(a / validSamples);
        } else {
          targetData[targetIdx] = 0;
          targetData[targetIdx + 1] = 0;
          targetData[targetIdx + 2] = 0;
          targetData[targetIdx + 3] = 0;
        }
      }
    }

    return targetImageData;
  }

  private validateRenderScale(scale?: number): number {
    if (!scale || scale < this.MIN_RENDER_SCALE) {
      return this.DEFAULT_RENDER_SCALE;
    }
    return Math.min(scale, this.MAX_RENDER_SCALE);
  }

  private async ensureFontLoaded(fontFamily: string): Promise<boolean> {
    if (typeof document === 'undefined' || !document.fonts) {
      return false;
    }

    try {
      await document.fonts.load(`16px "${fontFamily}"`);
      await document.fonts.ready;
      const loaded = document.fonts.check(`16px "${fontFamily}"`);
      return loaded;
    } catch (error) {
      console.warn(`Failed to load font "${fontFamily}", using fallback:`, error);
      return false;
    }
  }
}
