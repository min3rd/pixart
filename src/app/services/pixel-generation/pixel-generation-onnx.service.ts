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

  private readonly COMMON_MODEL_NAMES = [
    'pixel-art-generator.onnx',
    'resnet50.onnx',
    'model.onnx',
    'stable-diffusion.onnx',
    'controlnet.onnx',
  ];

  constructor() {
    this.initializeOnnxRuntime();
  }

  private initializeOnnxRuntime(): void {
    try {
      console.log('[ONNX] Initializing ONNX Runtime...');
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        ort.env.wasm.numThreads = 4;
        ort.env.wasm.simd = true;
        console.log('[ONNX] WebGPU support detected, configured WASM with 4 threads and SIMD enabled');
      } else {
        console.log('[ONNX] WebGPU not available, using WASM backend only');
      }
      console.log('[ONNX] ONNX Runtime initialized successfully');
    } catch (error) {
      console.error('[ONNX] Failed to initialize ONNX Runtime:', error);
      console.error('[ONNX] Generation will still attempt to work but may have reduced performance');
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

    console.log(`[ONNX] Attempting to load model from: ${url}`);
    console.log(`[ONNX] Execution providers: ${executionProviders.join(', ')}`);

    return from(this.findAvailableModel(url)).pipe(
      switchMap((availableUrl) => {
        if (!availableUrl) {
          const errorMsg = `No ONNX model found. Checked:\n- ${url}\n${this.COMMON_MODEL_NAMES.map(name => `- /assets/models/${name}`).join('\n')}\n\nPlease download an ONNX model to public/assets/models/. See public/assets/models/README.md for instructions.`;
          console.error(`[ONNX] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        if (availableUrl !== url) {
          console.log(`[ONNX] Default model not found, using alternative: ${availableUrl}`);
        }

        console.log(`[ONNX] Model file exists, creating inference session...`);
        return from(
          ort.InferenceSession.create(availableUrl, {
            executionProviders,
          }),
        );
      }),
      map((session) => {
        this.session = session;
        this.modelLoaded.set(true);
        this.modelLoading.set(false);
        console.log(`[ONNX] Model loaded successfully`);
        console.log(`[ONNX] Model inputs:`, session.inputNames);
        console.log(`[ONNX] Model outputs:`, session.outputNames);
      }),
      catchError((error) => {
        const errorDetails = this.buildDetailedErrorMessage(error, url);
        this.loadError.set(errorDetails);
        this.modelLoading.set(false);
        console.error(`[ONNX] Failed to load model:`, error);
        console.error(`[ONNX] Error details:`, errorDetails);
        throw new Error(errorDetails);
      }),
    );
  }

  private async findAvailableModel(preferredUrl: string): Promise<string | null> {
    console.log(`[ONNX] ========================================`);
    console.log(`[ONNX] Searching for available ONNX models...`);
    console.log(`[ONNX] ========================================`);
    
    if (await this.checkModelFileExists(preferredUrl)) {
      console.log(`[ONNX] ✓ Found preferred model: ${preferredUrl}`);
      return preferredUrl;
    }

    console.log(`[ONNX] Preferred model not found: ${preferredUrl}`);
    console.log(`[ONNX] Checking for alternative models...`);

    for (const modelName of this.COMMON_MODEL_NAMES) {
      const modelUrl = `/assets/models/${modelName}`;
      if (await this.checkModelFileExists(modelUrl)) {
        console.log(`[ONNX] ✓✓✓ Found alternative model: ${modelUrl} ✓✓✓`);
        return modelUrl;
      }
    }

    console.error(`[ONNX] ========================================`);
    console.error(`[ONNX] ✗✗✗ NO ONNX MODELS FOUND ✗✗✗`);
    console.error(`[ONNX] Checked all common model names:`);
    this.COMMON_MODEL_NAMES.forEach(name => {
      console.error(`[ONNX]   - /assets/models/${name}`);
    });
    console.error(`[ONNX] ========================================`);
    console.error(`[ONNX] SOLUTION: Place an ONNX model file in public/assets/models/`);
    console.error(`[ONNX] Supported filenames: ${this.COMMON_MODEL_NAMES.join(', ')}`);
    console.error(`[ONNX] See public/assets/models/README.md for instructions`);
    console.error(`[ONNX] ========================================`);
    return null;
  }

  private async checkModelFileExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        console.log(`[ONNX] ✓ File exists: ${url}`);
        return true;
      }
      console.log(`[ONNX] ✗ File not found (HEAD ${response.status}): ${url}`);
      return false;
    } catch (error) {
      console.log(`[ONNX] HEAD request failed for ${url}, trying GET with Range...`);
      try {
        const response = await fetch(url, { 
          method: 'GET', 
          headers: { 'Range': 'bytes=0-0' } 
        });
        if (response.ok || response.status === 206) {
          console.log(`[ONNX] ✓ File exists (GET Range): ${url}`);
          return true;
        }
        console.log(`[ONNX] ✗ File not found (GET ${response.status}): ${url}`);
        return false;
      } catch (fallbackError) {
        console.error(`[ONNX] ✗ Cannot access file at ${url}:`, fallbackError);
        return false;
      }
    }
  }

  private buildDetailedErrorMessage(error: unknown, modelUrl: string): string {
    let message = `Failed to load ONNX model from: ${modelUrl}\n\n`;

    if (error instanceof Error) {
      message += `Error: ${error.message}\n\n`;

      if (error.message.includes('404') || error.message.includes('not found')) {
        message += `Reason: Model file not found at the specified path.\n\n`;
        message += `Solutions:\n`;
        message += `1. Download the model using the download script in public/assets/models/\n`;
        message += `2. Or manually place your ONNX model file at: ${modelUrl}\n`;
        message += `3. Check public/assets/models/README.md for detailed instructions\n`;
      } else if (error.message.includes('CORS') || error.message.includes('Access-Control')) {
        message += `Reason: CORS (Cross-Origin Resource Sharing) error.\n\n`;
        message += `Solutions:\n`;
        message += `1. Ensure the model file is served from the same origin\n`;
        message += `2. Check server CORS configuration if using a separate CDN\n`;
      } else if (error.message.includes('format') || error.message.includes('invalid')) {
        message += `Reason: Invalid or corrupted ONNX model file.\n\n`;
        message += `Solutions:\n`;
        message += `1. Re-download the model file\n`;
        message += `2. Verify the model file is a valid ONNX format\n`;
        message += `3. Check model file size is not 0 bytes\n`;
      } else if (error.message.includes('memory') || error.message.includes('allocation')) {
        message += `Reason: Insufficient memory to load the model.\n\n`;
        message += `Solutions:\n`;
        message += `1. Try using a smaller/quantized model\n`;
        message += `2. Close other browser tabs to free memory\n`;
        message += `3. Use a device with more RAM\n`;
      } else {
        message += `Reason: Unknown error during model loading.\n\n`;
        message += `Solutions:\n`;
        message += `1. Check browser console for detailed error messages\n`;
        message += `2. Ensure ONNX Runtime Web is compatible with your browser\n`;
        message += `3. Try a different browser or update your current browser\n`;
      }
    } else {
      message += `Error: ${String(error)}\n\n`;
      message += `Please check the browser console for more details.\n`;
    }

    return message;
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
    
    console.log(`[ONNX] Starting generation request: ${requestId}`);
    console.log(`[ONNX] Parameters - Width: ${width}, Height: ${height}, Style: ${style}`);

    const promptEmbedding = this.encodePrompt(prompt);

    const loadModel$ = this.session
      ? of(undefined)
      : this.loadModel().pipe(
          catchError((error) => {
            const errorMsg = error instanceof Error ? error.message : 'Failed to load ONNX model. Check console for details.';
            console.error(`[ONNX] Model loading failed for request ${requestId}:`, errorMsg);
            throw new Error(errorMsg);
          }),
        );

    return loadModel$.pipe(
      switchMap(() => {
        if (!this.session) {
          const errorMsg = 'ONNX model session is not initialized. Model may have failed to load.';
          console.error(`[ONNX] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        console.log(`[ONNX] Preprocessing image for request ${requestId}...`);
        const preprocessed = this.preprocessImage(sketchData, width, height);

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

        console.log(`[ONNX] Running inference for request ${requestId}...`);
        return from(this.session.run(feeds));
      }),
      map((results) => {
        console.log(`[ONNX] Inference completed for request ${requestId}`);
        
        const outputTensor = results['output'];
        if (!outputTensor) {
          console.error(`[ONNX] No output tensor found in results. Available outputs:`, Object.keys(results));
          throw new Error('Model did not produce expected output tensor');
        }

        const outputData = outputTensor.data as Float32Array;

        const resultImageData = this.postprocessImage(
          outputData,
          width,
          height,
          style,
        );

        const processingTime = performance.now() - startTime;
        console.log(`[ONNX] Request ${requestId} completed in ${processingTime.toFixed(2)}ms`);

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
        console.error(`[ONNX] Request ${requestId} failed:`, errorMsg);
        console.error(`[ONNX] Full error:`, error);
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
