import { Injectable, signal, computed } from '@angular/core';
import {
  PixelGenerationResponse,
  PixelArtStyle,
  PIXEL_ART_STYLE_CONFIGS,
  PixelGenerationMetadata,
} from './pixel-generation-models';
import { PixelGenerationLocalService } from './pixel-generation-local.service';
import { PixelGenerationOnnxService } from './pixel-generation-onnx.service';

export interface ProcessingJob {
  id: string;
  response: PixelGenerationResponse;
  startTime: number;
}

export type GenerationMode = 'auto' | 'onnx' | 'local';

@Injectable({ providedIn: 'root' })
export class PixelGenerationEngineService {
  private readonly jobs = signal<Map<string, ProcessingJob>>(new Map());
  private readonly generationMode = signal<GenerationMode>('auto');
  private readonly useAI = signal(true);

  readonly activeJobs = computed(() => Array.from(this.jobs().values()));
  readonly processingCount = computed(
    () => this.activeJobs().filter((job) => job.response.status === 'processing').length,
  );
  readonly isOnnxAvailable = computed(() => this.onnxService.isModelReady());
  readonly aiEnabled = this.useAI;

  constructor(
    private readonly localService: PixelGenerationLocalService,
    private readonly onnxService: PixelGenerationOnnxService,
  ) {}

  setGenerationMode(mode: GenerationMode): void {
    this.generationMode.set(mode);
  }

  setAIEnabled(enabled: boolean): void {
    this.useAI.set(enabled);
  }

  async initializeAI(): Promise<boolean> {
    try {
      await this.onnxService.loadModel();
      return true;
    } catch (error) {
      console.error('Failed to initialize AI model:', error);
      return false;
    }
  }

  async generatePixelArt(
    sketchImageData: ImageData,
    prompt: string,
    targetWidth: number,
    targetHeight: number,
    style: PixelArtStyle = 'pixel-modern',
    customColorPalette?: string[],
  ): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: ProcessingJob = {
      id: jobId,
      response: {
        id: jobId,
        status: 'processing',
        progress: 0,
      },
      startTime: Date.now(),
    };

    this.jobs.update((jobs) => {
      const newJobs = new Map(jobs);
      newJobs.set(jobId, job);
      return newJobs;
    });

    setTimeout(async () => {
      try {
        let result: PixelGenerationResponse;

        const mode = this.generationMode();
        const shouldUseAI = this.useAI() && (mode === 'auto' || mode === 'onnx');

        if (shouldUseAI && this.onnxService.isModelReady()) {
          result = await this.onnxService.generateWithOnnx(
            sketchImageData,
            prompt,
            targetWidth,
            targetHeight,
            style,
          );
        } else if (shouldUseAI && mode === 'onnx') {
          try {
            await this.onnxService.loadModel();
            result = await this.onnxService.generateWithOnnx(
              sketchImageData,
              prompt,
              targetWidth,
              targetHeight,
              style,
            );
          } catch (error) {
            console.warn('ONNX generation failed, falling back to local processing:', error);
            result = await this.localService.processLocally(
              sketchImageData,
              prompt,
              targetWidth,
              targetHeight,
              style,
              customColorPalette,
            );
          }
        } else {
          result = await this.localService.processLocally(
            sketchImageData,
            prompt,
            targetWidth,
            targetHeight,
            style,
            customColorPalette,
          );
        }

        this.jobs.update((jobs) => {
          const newJobs = new Map(jobs);
          newJobs.set(jobId, { ...job, response: result });
          return newJobs;
        });
      } catch (error) {
        const errorResponse: PixelGenerationResponse = {
          id: jobId,
          status: 'failed',
          progress: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        
        this.jobs.update((jobs) => {
          const newJobs = new Map(jobs);
          newJobs.set(jobId, { ...job, response: errorResponse });
          return newJobs;
        });
      }
    }, 100);

    return jobId;
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

  cancelJob(jobId: string): void {
    this.jobs.update((jobs) => {
      const newJobs = new Map(jobs);
      newJobs.delete(jobId);
      return newJobs;
    });
  }

  async getResultAsImageData(jobId: string): Promise<ImageData | null> {
    const job = this.jobs().get(jobId);
    if (!job) return null;

    const { response } = job;
    if (response.status !== 'completed') return null;

    return response.resultImageData || null;
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

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
