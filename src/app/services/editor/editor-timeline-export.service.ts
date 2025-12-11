import { Injectable, inject } from '@angular/core';
import { EditorDocumentService } from '../editor-document.service';
import { LogService } from '../logging/log.service';

export type TimelineExportFormat = 'png' | 'jpeg' | 'bmp' | 'gif' | 'spritesheet';
export type TimelineExportRange = 'all' | 'current' | 'custom';

export interface TimelineExportOptions {
  format: TimelineExportFormat;
  range: TimelineExportRange;
  framePattern: string;
  fromFrame: number;
  toFrame: number;
  spritesheetColumns?: number;
  spritesheetPadding?: number;
}

@Injectable({ providedIn: 'root' })
export class EditorTimelineExportService {
  private readonly document = inject(EditorDocumentService);
  private readonly logService = inject(LogService);

  exportTimeline(options: TimelineExportOptions): void {
    const startTime = performance.now();
    const frames = this.getFramesToExport(options);

    if (frames.length === 0) {
      this.logService.log('export', 'export_timeline', {
        description: 'No frames to export',
        status: 'failure',
        duration: Math.round(performance.now() - startTime),
      });
      return;
    }

    if (options.format === 'spritesheet') {
      this.exportAsSpriteSheet(frames, options, startTime);
    } else {
      this.exportAsIndividualFrames(frames, options, startTime);
    }
  }

  private getFramesToExport(options: TimelineExportOptions): any[] {
    const allFrames = this.document.frames();

    switch (options.range) {
      case 'all':
        return allFrames;
      case 'current': {
        const currentIdx = this.document.currentFrameIndex();
        return currentIdx >= 0 && currentIdx < allFrames.length
          ? [allFrames[currentIdx]]
          : [];
      }
      case 'custom': {
        const from = Math.max(0, options.fromFrame - 1);
        const to = Math.min(allFrames.length - 1, options.toFrame - 1);
        return from <= to ? allFrames.slice(from, to + 1) : [];
      }
      default:
        return allFrames;
    }
  }

  private exportAsIndividualFrames(
    frames: any[],
    options: TimelineExportOptions,
    startTime: number,
  ): void {
    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();
    const allFrames = this.document.frames();

    const frameIndexMap = new Map(allFrames.map((f, i) => [f, i]));

    frames.forEach((frame, localIndex) => {
      const canvas = this.renderFrameToCanvas(
        frame,
        canvasWidth,
        canvasHeight,
      );
      if (!canvas) return;

      const mimeType = this.getMimeType(options.format);
      const actualFrameIndex = frameIndexMap.get(frame);
      const frameNumber =
        actualFrameIndex !== undefined ? actualFrameIndex + 1 : localIndex + 1;
      const fileName = this.formatFrameName(options.framePattern, frameNumber);

      canvas.toBlob((blob) => {
        if (blob) {
          this.downloadBlob(blob, `${fileName}.${options.format}`);
        }
      }, mimeType);
    });

    this.logService.log('export', 'export_timeline', {
      description: 'Timeline exported as individual frames',
      parameters: {
        format: options.format,
        frameCount: frames.length,
      },
      status: 'success',
      duration: Math.round(performance.now() - startTime),
    });
  }

  private exportAsSpriteSheet(
    frames: any[],
    options: TimelineExportOptions,
    startTime: number,
  ): void {
    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();
    const columns = options.spritesheetColumns || 8;
    const padding = options.spritesheetPadding || 0;
    const rows = Math.ceil(frames.length / columns);

    const sheetWidth = columns * canvasWidth + (columns - 1) * padding;
    const sheetHeight = rows * canvasHeight + (rows - 1) * padding;

    const canvas = document.createElement('canvas');
    canvas.width = sheetWidth;
    canvas.height = sheetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      this.logService.log('export', 'export_timeline', {
        description: 'Failed to create sprite sheet context',
        status: 'failure',
        duration: Math.round(performance.now() - startTime),
      });
      return;
    }

    ctx.imageSmoothingEnabled = false;

    frames.forEach((frame, index) => {
      const frameCanvas = this.renderFrameToCanvas(
        frame,
        canvasWidth,
        canvasHeight,
      );
      if (!frameCanvas) return;

      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = col * (canvasWidth + padding);
      const y = row * (canvasHeight + padding);

      ctx.drawImage(frameCanvas, x, y);
    });

    canvas.toBlob((blob) => {
      if (blob) {
        this.downloadBlob(blob, 'spritesheet.png');
      }
    }, 'image/png');

    this.logService.log('export', 'export_timeline', {
      description: 'Timeline exported as sprite sheet',
      parameters: {
        frameCount: frames.length,
        columns,
        rows,
        sheetWidth,
        sheetHeight,
      },
      status: 'success',
      duration: Math.round(performance.now() - startTime),
    });
  }

  private renderFrameToCanvas(
    frame: any,
    width: number,
    height: number,
  ): HTMLCanvasElement | null {
    if (
      !frame ||
      !Array.isArray(frame.layers) ||
      !frame.buffers ||
      typeof frame.buffers !== 'object'
    ) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;

    const flatLayers = this.flattenLayers(frame.layers);

    for (let li = flatLayers.length - 1; li >= 0; li--) {
      const layer = flatLayers[li];
      if (!layer.visible) continue;

      const buf = frame.buffers[layer.id];
      if (!Array.isArray(buf) || buf.length !== width * height) continue;

      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      for (let i = 0; i < buf.length; i++) {
        const col = buf[i];
        if (col && col.length) {
          const color = this.parseColor(col);
          if (color) {
            const idx = i * 4;
            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = color.a;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    return canvas;
  }

  private parseColor(colorStr: string): {
    r: number;
    g: number;
    b: number;
    a: number;
  } | null {
    if (colorStr.startsWith('rgb(')) {
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          return { r, g, b, a: 255 };
        }
      }
    } else if (colorStr.startsWith('rgba(')) {
      const match = colorStr.match(
        /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,
      );
      if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        const alpha = parseFloat(match[4]);
        if (
          !Number.isNaN(r) &&
          !Number.isNaN(g) &&
          !Number.isNaN(b) &&
          !Number.isNaN(alpha)
        ) {
          return { r, g, b, a: Math.round(alpha * 255) };
        }
      }
    } else if (colorStr.startsWith('#')) {
      const hex = colorStr.slice(1);
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          return { r, g, b, a: 255 };
        }
      } else if (hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = parseInt(hex.slice(6, 8), 16);
        if (
          !Number.isNaN(r) &&
          !Number.isNaN(g) &&
          !Number.isNaN(b) &&
          !Number.isNaN(a)
        ) {
          return { r, g, b, a };
        }
      }
    }
    return null;
  }

  private flattenLayers(items: any[]): any[] {
    const result: any[] = [];
    for (const item of items) {
      if (item.type === 'group' && item.children) {
        result.push(...this.flattenLayers(item.children));
      } else {
        result.push(item);
      }
    }
    return result;
  }

  private getMimeType(format: TimelineExportFormat): string {
    switch (format) {
      case 'png':
        return 'image/png';
      case 'jpeg':
        return 'image/jpeg';
      case 'bmp':
        return 'image/bmp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/png';
    }
  }

  private formatFrameName(pattern: string, frameNumber: number): string {
    return pattern.replace(/{frame}/g, frameNumber.toString().padStart(3, '0'));
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
