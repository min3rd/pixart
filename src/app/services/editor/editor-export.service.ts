import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EditorCanvasStateService } from './editor-canvas-state.service';
import { EditorLayerService } from './editor-layer.service';
import { AnimationItem } from './editor.types';

export interface SpriteSheetOptions {
  padding: number;
  columns: number;
  backgroundColor?: string;
}

@Injectable({ providedIn: 'root' })
export class EditorExportService {
  private readonly canvasState = inject(EditorCanvasStateService);
  private readonly layerService = inject(EditorLayerService);

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
