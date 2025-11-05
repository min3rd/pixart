import { Injectable, signal } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import * as ort from 'onnxruntime-web';
import {
  PixelGenerationResponse,
  PixelArtStyle,
  PixelGenerationMetadata,
} from './pixel-generation-models';

export interface OnnxModelConfig {
  modelUrl: string;
  inputSize: number;
  outputSize: number;
}

@Injectable({ providedIn: 'root' })
export class PixelGenerationOnnxService {
  private session: ort.InferenceSession | null = null;
  private readonly modelLoaded = signal(false);
  private readonly modelLoading = signal(false);
  private readonly loadError = signal<string | null>(null);

  readonly isModelReady = this.modelLoaded;
  readonly isLoading = this.modelLoading;
  readonly error = this.loadError;

  private readonly MODEL_CONFIG: OnnxModelConfig = {
    modelUrl: '/assets/models/pixel-art-generator.onnx',
    inputSize: 512,
    outputSize: 512,
  };

  constructor() {
    this.initializeOnnxRuntime();
  }

  private initializeOnnxRuntime(): void {
    try {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        ort.env.wasm.numThreads = 4;
        ort.env.wasm.simd = true;
      }
    } catch (error) {
      console.error('Failed to initialize ONNX Runtime:', error);
    }
  }

  loadModel(modelUrl?: string): Observable<void> {
    if (this.modelLoaded()) {
      return of(undefined);
    }

    if (this.modelLoading()) {
      return new Observable<void>((observer) => {
        const checkInterval = setInterval(() => {
          if (!this.modelLoading()) {
            clearInterval(checkInterval);
            if (this.modelLoaded()) {
              observer.next();
              observer.complete();
            } else if (this.loadError()) {
              observer.error(new Error(this.loadError()!));
            }
          }
        }, 100);
      });
    }

    this.modelLoading.set(true);
    this.loadError.set(null);

    const url = modelUrl || this.MODEL_CONFIG.modelUrl;

    const executionProviders: ort.InferenceSession.ExecutionProviderConfig[] =
      [];

    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      executionProviders.push('webgpu');
    }
    executionProviders.push('wasm');

    return from(
      ort.InferenceSession.create(url, {
        executionProviders,
      }),
    ).pipe(
      map((session) => {
        this.session = session;
        this.modelLoaded.set(true);
        this.modelLoading.set(false);
        console.log('ONNX model loaded successfully');
      }),
      catchError((error) => {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to load model';
        this.loadError.set(errorMsg);
        this.modelLoading.set(false);
        console.error('Failed to load ONNX model:', error);
        throw new Error(errorMsg);
      }),
    );
  }

  generateWithOnnx(
    sketchData: ImageData,
    prompt: string,
    width: number,
    height: number,
    style: PixelArtStyle,
  ): Observable<PixelGenerationResponse> {
    const requestId = `onnx-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = performance.now();

    const loadModel$ = this.session
      ? of(undefined)
      : this.loadModel().pipe(
          catchError((error) => {
            throw new Error('Model not loaded');
          }),
        );

    return loadModel$.pipe(
      switchMap(() => {
        if (!this.session) {
          throw new Error('Model not loaded');
        }

        const preprocessed = this.preprocessImage(sketchData, width, height);

        const promptEmbedding = this.encodePrompt(prompt);

        const inputTensor = new ort.Tensor('float32', preprocessed.data, [
          1,
          3,
          preprocessed.height,
          preprocessed.width,
        ]);

        const promptTensor = new ort.Tensor('float32', promptEmbedding, [
          1,
          promptEmbedding.length,
        ]);

        const feeds: Record<string, ort.Tensor> = {
          sketch: inputTensor,
          prompt: promptTensor,
        };

        return from(this.session.run(feeds));
      }),
      map((results) => {
        const outputTensor = results['output'];
        const outputData = outputTensor.data as Float32Array;

        const resultImageData = this.postprocessImage(
          outputData,
          width,
          height,
          style,
        );

        const processingTime = performance.now() - startTime;

        const promptEmbedding = this.encodePrompt(prompt);

        const metadata: PixelGenerationMetadata = {
          colorsUsed: this.countUniqueColors(resultImageData),
          pixelCount: width * height,
          algorithm: `onnx-webgpu-${style}`,
          promptTokens: promptEmbedding.length,
        };

        return {
          id: requestId,
          status: 'completed',
          progress: 100,
          resultImageData,
          processingTime,
          metadata,
        } as PixelGenerationResponse;
      }),
      catchError((error) => {
        const errorMsg =
          error instanceof Error ? error.message : 'ONNX processing failed';
        return of({
          id: requestId,
          status: 'failed',
          progress: 0,
          error: errorMsg,
        } as PixelGenerationResponse);
      })
    );
  }

  private preprocessImage(imageData: ImageData, targetWidth: number, targetHeight: number): {
    data: Float32Array;
    width: number;
    height: number;
  } {
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
    ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    const resizedData = ctx.getImageData(0, 0, targetWidth, targetHeight);

    const float32Data = new Float32Array(3 * targetWidth * targetHeight);

    for (let i = 0; i < targetWidth * targetHeight; i++) {
      const r = resizedData.data[i * 4] / 255.0;
      const g = resizedData.data[i * 4 + 1] / 255.0;
      const b = resizedData.data[i * 4 + 2] / 255.0;

      float32Data[i] = r;
      float32Data[targetWidth * targetHeight + i] = g;
      float32Data[targetWidth * targetHeight * 2 + i] = b;
    }

    return {
      data: float32Data,
      width: targetWidth,
      height: targetHeight,
    };
  }

  private encodePrompt(prompt: string): Float32Array {
    const maxLength = 77;
    const embedding = new Float32Array(maxLength);
    
    const words = prompt.toLowerCase().split(/\s+/);
    
    const colorKeywords: Record<string, number> = {
      'red': 0.9, 'blue': 0.8, 'green': 0.7, 'yellow': 0.6,
      'orange': 0.5, 'purple': 0.4, 'pink': 0.3, 'brown': 0.2,
      'black': 0.1, 'white': 1.0, 'gray': 0.15, 'grey': 0.15,
    };

    words.forEach((word, index) => {
      if (index < maxLength) {
        embedding[index] = colorKeywords[word] || 0.5;
      }
    });

    return embedding;
  }

  private postprocessImage(
    outputData: Float32Array,
    width: number,
    height: number,
    style: PixelArtStyle,
  ): ImageData {
    const imageData = new ImageData(width, height);

    for (let i = 0; i < width * height; i++) {
      const r = Math.max(0, Math.min(255, outputData[i] * 255));
      const g = Math.max(0, Math.min(255, outputData[width * height + i] * 255));
      const b = Math.max(0, Math.min(255, outputData[width * height * 2 + i] * 255));

      imageData.data[i * 4] = r;
      imageData.data[i * 4 + 1] = g;
      imageData.data[i * 4 + 2] = b;
      imageData.data[i * 4 + 3] = 255;
    }

    return this.applyPixelArtStyle(imageData, style);
  }

  private applyPixelArtStyle(imageData: ImageData, style: PixelArtStyle): ImageData {
    const paletteSizes: Record<PixelArtStyle, number> = {
      'retro-8bit': 8,
      'retro-16bit': 16,
      'pixel-modern': 32,
      'low-res': 4,
      'high-detail': 64,
    };

    const paletteSize = paletteSizes[style];
    
    return this.quantizeColors(imageData, paletteSize);
  }

  private quantizeColors(imageData: ImageData, paletteSize: number): ImageData {
    const result = new ImageData(imageData.width, imageData.height);
    
    const quantize = (value: number) => {
      const levels = paletteSize;
      return Math.round(value / 255 * (levels - 1)) * (255 / (levels - 1));
    };

    for (let i = 0; i < imageData.data.length; i += 4) {
      result.data[i] = quantize(imageData.data[i]);
      result.data[i + 1] = quantize(imageData.data[i + 1]);
      result.data[i + 2] = quantize(imageData.data[i + 2]);
      result.data[i + 3] = imageData.data[i + 3];
    }

    return result;
  }

  private countUniqueColors(imageData: ImageData): number {
    const colors = new Set<string>();
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      if (a > 0) {
        colors.add(`${r},${g},${b}`);
      }
    }
    return colors.size;
  }

  unloadModel(): Observable<void> {
    return new Observable<void>((observer) => {
      if (this.session) {
        this.session
          .release()
          .then(() => {
            this.session = null;
            this.modelLoaded.set(false);
            observer.next();
            observer.complete();
          })
          .catch((error) => observer.error(error));
      } else {
        observer.next();
        observer.complete();
      }
    });
  }
}
