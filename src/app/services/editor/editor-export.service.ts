import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EditorCanvasStateService } from './editor-canvas-state.service';
import { EditorLayerService } from './editor-layer.service';
import { AnimationItem } from './editor.types';
import { LogService } from '../logging/log.service';

export interface SpriteSheetOptions {
  padding: number;
  columns: number;
  backgroundColor?: string;
}

export type ImageFormat = 'png' | 'jpeg' | 'bmp';
export type ExportRegion = 'all' | 'current' | 'visible';

export interface ImageExportOptions {
  format: ImageFormat;
  region: ExportRegion;
  quality: number;
  currentLayerId?: string;
}

@Injectable({ providedIn: 'root' })
export class EditorExportService {
  private readonly canvasState = inject(EditorCanvasStateService);
  private readonly layerService = inject(EditorLayerService);
  private readonly logService = inject(LogService);

  exportAnimationAsSpriteSheet(
    animation: AnimationItem,
    options: SpriteSheetOptions = { padding: 0, columns: 8 },
  ): Observable<Blob | null> {
    return new Observable<Blob | null>((observer) => {
      const width = this.canvasState.canvasWidth();
      const height = this.canvasState.canvasHeight();
      const frameCount = animation.frames.length;

      if (frameCount === 0) {
        observer.next(null);
        observer.complete();
        return;
      }

      const columns = Math.min(options.columns, frameCount);
      const rows = Math.ceil(frameCount / columns);
      const padding = options.padding;

      const sheetWidth = columns * width + (columns - 1) * padding;
      const sheetHeight = rows * height + (rows - 1) * padding;

      const canvas = document.createElement('canvas');
      canvas.width = sheetWidth;
      canvas.height = sheetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        observer.next(null);
        observer.complete();
        return;
      }

      if (options.backgroundColor) {
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, sheetWidth, sheetHeight);
      }

      for (let i = 0; i < frameCount; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * (width + padding);
        const y = row * (height + padding);

        const frameCanvas = this.renderCurrentStateToCanvas(width, height);
        if (frameCanvas) {
          ctx.drawImage(frameCanvas, x, y);
        }
      }

      canvas.toBlob((blob) => {
        observer.next(blob);
        observer.complete();
      }, 'image/png');
    });
  }

  exportAnimationAsPackage(
    animation: AnimationItem,
  ): Observable<{ files: Map<string, Blob>; metadata: string } | null> {
    return new Observable<{
      files: Map<string, Blob>;
      metadata: string;
    } | null>((observer) => {
      const width = this.canvasState.canvasWidth();
      const height = this.canvasState.canvasHeight();
      const files = new Map<string, Blob>();
      const promises: Promise<void>[] = [];

      for (let i = 0; i < animation.frames.length; i++) {
        const frameCanvas = this.renderCurrentStateToCanvas(width, height);
        if (frameCanvas) {
          const promise = new Promise<void>((resolve) => {
            frameCanvas.toBlob((b) => {
              if (b) {
                files.set(`${animation.name}_frame_${i + 1}.png`, b);
              }
              resolve();
            }, 'image/png');
          });
          promises.push(promise);
        }
      }

      Promise.all(promises).then(() => {
        const metadata = JSON.stringify(
          {
            name: animation.name,
            frameCount: animation.frames.length,
            frames: animation.frames.map((f, idx) => ({
              index: idx,
              name: f.name,
              duration: f.duration,
              file: `${animation.name}_frame_${idx + 1}.png`,
            })),
            boneIds: animation.boneIds,
            totalDuration: animation.duration,
            canvasWidth: width,
            canvasHeight: height,
          },
          null,
          2,
        );

        observer.next({ files, metadata });
        observer.complete();
      });
    });
  }

  exportImage(options: ImageExportOptions): Promise<Blob | null> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const width = this.canvasState.canvasWidth();
      const height = this.canvasState.canvasHeight();

      const canvas = this.renderImageToCanvas(width, height, options);
      if (!canvas) {
        this.logService.log('export', 'export_image', {
          description: 'Image export failed - no canvas',
          parameters: { format: options.format, region: options.region },
          status: 'failure',
          duration: Math.round(performance.now() - startTime),
        });
        resolve(null);
        return;
      }

      const mimeType = this.getMimeType(options.format);
      const quality = options.format === 'jpeg' ? options.quality / 100 : 1;

      canvas.toBlob(
        (blob) => {
          const duration = Math.round(performance.now() - startTime);
          if (blob) {
            this.logService.log('export', 'export_image', {
              description: 'Image exported successfully',
              parameters: {
                format: options.format,
                region: options.region,
                quality: options.quality,
                size: blob.size,
                width,
                height,
              },
              status: 'success',
              duration,
            });
          } else {
            this.logService.log('export', 'export_image', {
              description: 'Image export failed - no blob',
              parameters: { format: options.format, region: options.region },
              status: 'failure',
              duration,
            });
          }
          resolve(blob);
        },
        mimeType,
        quality,
      );
    });
  }

  private renderImageToCanvas(
    width: number,
    height: number,
    options: ImageExportOptions,
  ): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;

    const layersToRender = this.getLayersToRender(options);

    for (let li = layersToRender.length - 1; li >= 0; li--) {
      const layer = layersToRender[li];
      const buf = this.canvasState.getLayerBuffer(layer.id);
      if (!buf || buf.length === 0) continue;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const color = buf[idx];
          if (color && color.length > 0) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    return canvas;
  }

  private getLayersToRender(options: ImageExportOptions) {
    const allLayers = this.layerService.getFlattenedLayers();

    switch (options.region) {
      case 'all':
        return allLayers;
      case 'current':
        if (options.currentLayerId) {
          const currentLayer = allLayers.find(
            (l) => l.id === options.currentLayerId,
          );
          return currentLayer ? [currentLayer] : [];
        }
        return [];
      case 'visible':
      default:
        return allLayers.filter((l) => l.visible);
    }
  }

  private getMimeType(format: ImageFormat): string {
    switch (format) {
      case 'png':
        return 'image/png';
      case 'jpeg':
        return 'image/jpeg';
      case 'bmp':
        return 'image/bmp';
      default:
        return 'image/png';
    }
  }

  private renderCurrentStateToCanvas(
    width: number,
    height: number,
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const layers = this.layerService.getFlattenedLayers();
    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      if (!layer.visible) continue;

      const buf = this.canvasState.getLayerBuffer(layer.id);
      if (!buf || buf.length === 0) continue;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const color = buf[idx];
          if (color && color.length > 0) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    return canvas;
  }
}
