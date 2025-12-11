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

    frames.forEach((frame, index) => {
      const canvas = this.renderFrameToCanvas(
        frame,
        canvasWidth,
        canvasHeight,
      );
      if (!canvas) return;

      const mimeType = this.getMimeType(options.format);
      const fileName = this.formatFrameName(options.framePattern, index + 1);

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
    if (!frame || !frame.layers || !frame.buffers) {
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
      if (!buf || buf.length !== width * height) continue;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const col = buf[y * width + x];
          if (col && col.length) {
            ctx.fillStyle = col;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    return canvas;
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
