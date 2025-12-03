import { Injectable, inject } from '@angular/core';
import { EditorDocumentService } from '../../editor-document.service';
import { PixelGenerationEngineService } from '../../pixel-generation';
import { GeneratePixelArtRequest } from '../../../shared/pixel-generation-dialog/pixel-generation-dialog';

@Injectable({ providedIn: 'root' })
export class CanvasGenerationService {
  private generationCheckInterval: number | null = null;
  private readonly document = inject(EditorDocumentService);
  private readonly pixelGenEngine = inject(PixelGenerationEngineService);

  extractSketchFromSelection(
    sourceType: 'layer' | 'visible',
    selectionRect: { x: number; y: number; width: number; height: number },
    isPointInSelection: (x: number, y: number) => boolean,
  ): string | null {
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const canvas = document.createElement('canvas');
    canvas.width = selectionRect.width;
    canvas.height = selectionRect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (sourceType === 'layer') {
      const layerId = this.document.selectedLayerId();
      const buf = this.document.getLayerBuffer(layerId);
      if (!buf) return null;

      for (let y = 0; y < selectionRect.height; y++) {
        for (let x = 0; x < selectionRect.width; x++) {
          const srcX = selectionRect.x + x;
          const srcY = selectionRect.y + y;
          if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
            if (isPointInSelection(srcX, srcY)) {
              const col = buf[srcY * w + srcX];
              if (col && col.length) {
                ctx.fillStyle = col;
                ctx.fillRect(x, y, 1, 1);
              }
            }
          }
        }
      }
    } else {
      const layers = this.document.getFlattenedLayers();
      for (let li = layers.length - 1; li >= 0; li--) {
        const layer = layers[li];
        if (!layer.visible) continue;
        const buf = this.document.getLayerBuffer(layer.id);
        if (!buf) continue;

        for (let y = 0; y < selectionRect.height; y++) {
          for (let x = 0; x < selectionRect.width; x++) {
            const srcX = selectionRect.x + x;
            const srcY = selectionRect.y + y;
            if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
              if (isPointInSelection(srcX, srcY)) {
                const col = buf[srcY * w + srcX];
                if (col && col.length) {
                  ctx.fillStyle = col;
                  ctx.fillRect(x, y, 1, 1);
                }
              }
            }
          }
        }
      }
    }

    return canvas.toDataURL('image/png');
  }

  handleGenerate(
    request: GeneratePixelArtRequest,
    onComplete: () => void,
    onError: (error: unknown) => void,
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = request.width;
    canvas.height = request.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onComplete();
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, request.width, request.height);
      const imageData = ctx.getImageData(0, 0, request.width, request.height);

      this.pixelGenEngine
        .generatePixelArt(
          imageData,
          request.prompt,
          request.width,
          request.height,
          'pixel-modern',
        )
        .subscribe({
          next: (jobId) => {
            if (this.generationCheckInterval !== null) {
              clearInterval(this.generationCheckInterval);
            }
            this.generationCheckInterval = setInterval(() => {
              const job = this.pixelGenEngine.getJob(jobId);
              if (!job || job.response.status === 'processing') {
                return;
              }

              if (this.generationCheckInterval !== null) {
                clearInterval(this.generationCheckInterval);
                this.generationCheckInterval = null;
              }

              if (
                job.response.status === 'completed' &&
                job.response.resultImageData
              ) {
                const newLayer = this.document.addLayer('Generated');
                const buf = this.document.getLayerBuffer(newLayer.id);
                if (!buf) {
                  onComplete();
                  return;
                }

                const resultData = job.response.resultImageData;
                const w = this.document.canvasWidth();
                const h = this.document.canvasHeight();

                for (let y = 0; y < Math.min(request.height, h); y++) {
                  for (let x = 0; x < Math.min(request.width, w); x++) {
                    const srcIdx = (y * request.width + x) * 4;
                    const r = resultData.data[srcIdx];
                    const g = resultData.data[srcIdx + 1];
                    const b = resultData.data[srcIdx + 2];
                    const a = resultData.data[srcIdx + 3];

                    if (a > 0) {
                      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
                      buf[y * w + x] = hex;
                    }
                  }
                }

                this.document.layerPixelsVersion.update((v) => v + 1);
                onComplete();
              } else {
                console.error('Generation failed:', job.response.error);
                onComplete();
              }
            }, 500) as unknown as number;
          },
          error: (error) => {
            console.error('Generation failed:', error);
            onError(error);
          },
        });
    };
    img.onerror = () => {
      console.error('Failed to load sketch image');
      onComplete();
    };
    img.src = request.sketchDataUrl;
  }

  clearGenerationInterval(): void {
    if (this.generationCheckInterval !== null) {
      clearInterval(this.generationCheckInterval);
      this.generationCheckInterval = null;
    }
  }
}
