import { Injectable, signal, computed } from '@angular/core';
import {
  PixelGenerationResponse,
  PixelArtStyle,
  PIXEL_ART_STYLE_CONFIGS,
  PixelGenerationMetadata,
} from './pixel-generation-models';
import { PixelGenerationApiService } from './pixel-generation-api.service';

export interface ProcessingJob {
  id: string;
  response: PixelGenerationResponse;
  startTime: number;
  checkInterval?: number;
}

@Injectable({ providedIn: 'root' })
export class PixelGenerationEngineService {
  private readonly POLL_INTERVAL_MS = 2000;
  private readonly jobs = signal<Map<string, ProcessingJob>>(new Map());

  readonly activeJobs = computed(() => Array.from(this.jobs().values()));
  readonly processingCount = computed(
    () => this.activeJobs().filter((job) => job.response.status === 'processing').length,
  );

  constructor(private readonly apiService: PixelGenerationApiService) {}

  async generatePixelArt(
    sketchImageData: ImageData,
    prompt: string,
    targetWidth: number,
    targetHeight: number,
    style: PixelArtStyle = 'pixel-modern',
    customColorPalette?: string[],
  ): Promise<string> {
    const processedSketch = this.preprocessSketch(sketchImageData, targetWidth, targetHeight);

    const analysis = await this.apiService.analyzePrompt(prompt);

    const colorPalette = customColorPalette || analysis.suggestedColors;

    const response = await this.apiService.createGenerationRequest(
      processedSketch,
      prompt,
      targetWidth,
      targetHeight,
      style,
      colorPalette,
    );

    const job: ProcessingJob = {
      id: response.id,
      response,
      startTime: Date.now(),
    };

    this.jobs.update((jobs) => {
      const newJobs = new Map(jobs);
      newJobs.set(response.id, job);
      return newJobs;
    });

    if (response.status === 'processing' || response.status === 'pending') {
      this.pollJobStatus(response.id);
    }

    return response.id;
  }

  async generateFromCanvas(
    canvas: HTMLCanvasElement,
    prompt: string,
    targetWidth: number,
    targetHeight: number,
    style: PixelArtStyle = 'pixel-modern',
  ): Promise<string> {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return this.generatePixelArt(imageData, prompt, targetWidth, targetHeight, style);
  }

  async generateFromLayerBuffer(
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
    prompt: string,
    targetWidth: number,
    targetHeight: number,
    style: PixelArtStyle = 'pixel-modern',
  ): Promise<string> {
    const imageData = this.layerBufferToImageData(
      layerBuffer,
      canvasWidth,
      canvasHeight,
    );
    return this.generatePixelArt(imageData, prompt, targetWidth, targetHeight, style);
  }

  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs().get(jobId);
  }

  async checkJobStatus(jobId: string): Promise<PixelGenerationResponse> {
    const response = await this.apiService.checkStatus(jobId);

    this.jobs.update((jobs) => {
      const job = jobs.get(jobId);
      if (job) {
        const newJobs = new Map(jobs);
        newJobs.set(jobId, { ...job, response });
        return newJobs;
      }
      return jobs;
    });

    return response;
  }

  cancelJob(jobId: string): void {
    const job = this.jobs().get(jobId);
    if (job?.checkInterval) {
      clearInterval(job.checkInterval);
    }

    this.jobs.update((jobs) => {
      const newJobs = new Map(jobs);
      newJobs.delete(jobId);
      return newJobs;
    });

    this.apiService.clearRequest(jobId);
  }

  async getResultAsImageData(jobId: string): Promise<ImageData | null> {
    const job = this.jobs().get(jobId);
    if (!job) return null;

    const { response } = job;
    if (response.status !== 'completed') return null;

    if (response.resultImageData) {
      return response.resultImageData;
    }

    if (response.resultDataUrl) {
      return this.dataUrlToImageData(response.resultDataUrl);
    }

    return null;
  }

  async getResultAsLayerBuffer(
    jobId: string,
    canvasWidth: number,
    canvasHeight: number,
  ): Promise<string[] | null> {
    const imageData = await this.getResultAsImageData(jobId);
    if (!imageData) return null;

    return this.imageDataToLayerBuffer(imageData, canvasWidth, canvasHeight);
  }

  private preprocessSketch(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
  ): ImageData {
    if (imageData.width === targetWidth && imageData.height === targetHeight) {
      return imageData;
    }

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

  private layerBufferToImageData(
    layerBuffer: string[],
    width: number,
    height: number,
  ): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Cannot create canvas context');
    }

    const imageData = ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bufferIdx = y * width + x;
        const color = layerBuffer[bufferIdx];

        if (color && color.length > 0) {
          const rgb = this.hexToRgb(color);
          if (rgb) {
            const dataIdx = (y * width + x) * 4;
            imageData.data[dataIdx] = rgb.r;
            imageData.data[dataIdx + 1] = rgb.g;
            imageData.data[dataIdx + 2] = rgb.b;
            imageData.data[dataIdx + 3] = 255;
          }
        }
      }
    }

    return imageData;
  }

  private imageDataToLayerBuffer(imageData: ImageData, width: number, height: number): string[] {
    const buffer: string[] = new Array(width * height).fill('');

    for (let y = 0; y < Math.min(imageData.height, height); y++) {
      for (let x = 0; x < Math.min(imageData.width, width); x++) {
        const srcIdx = (y * imageData.width + x) * 4;
        const alpha = imageData.data[srcIdx + 3];

        if (alpha > 0) {
          const r = imageData.data[srcIdx];
          const g = imageData.data[srcIdx + 1];
          const b = imageData.data[srcIdx + 2];

          const bufferIdx = y * width + x;
          buffer[bufferIdx] = this.rgbToHex(r, g, b);
        }
      }
    }

    return buffer;
  }

  private async dataUrlToImageData(dataUrl: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Cannot create canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  private pollJobStatus(jobId: string): void {
    const checkInterval = window.setInterval(async () => {
      try {
        const response = await this.checkJobStatus(jobId);

        if (response.status === 'completed' || response.status === 'failed') {
          clearInterval(checkInterval);
          this.jobs.update((jobs) => {
            const job = jobs.get(jobId);
            if (job) {
              const newJobs = new Map(jobs);
              newJobs.set(jobId, { ...job, checkInterval: undefined });
              return newJobs;
            }
            return jobs;
          });
        }
      } catch (error) {
        console.error(`Error polling job ${jobId}:`, error);
        clearInterval(checkInterval);
        
        this.jobs.update((jobs) => {
          const job = jobs.get(jobId);
          if (job) {
            const newJobs = new Map(jobs);
            const failedResponse: PixelGenerationResponse = {
              ...job.response,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Failed to check job status',
            };
            newJobs.set(jobId, { ...job, response: failedResponse, checkInterval: undefined });
            return newJobs;
          }
          return jobs;
        });
      }
    }, this.POLL_INTERVAL_MS);

    this.jobs.update((jobs) => {
      const job = jobs.get(jobId);
      if (job) {
        const newJobs = new Map(jobs);
        newJobs.set(jobId, { ...job, checkInterval });
        return newJobs;
      }
      return jobs;
    });
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
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
