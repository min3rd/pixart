import { Injectable, signal } from '@angular/core';
import {
  PixelGenerationRequest,
  PixelGenerationResponse,
  PixelGenerationStatus,
  PixelArtStyle,
  PromptAnalysis,
} from './pixel-generation-models';

export interface PixelGenerationApiConfig {
  endpoint: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
}

@Injectable({ providedIn: 'root' })
export class PixelGenerationApiService {
  private readonly DEFAULT_CONFIG: PixelGenerationApiConfig = {
    endpoint: '/api/pixel-generation',
    timeout: 30000,
    retryAttempts: 3,
  };

  private readonly config = signal<PixelGenerationApiConfig>(this.DEFAULT_CONFIG);
  private readonly activeRequests = signal<Map<string, PixelGenerationResponse>>(new Map());

  readonly isConfigured = signal<boolean>(false);

  configure(config: Partial<PixelGenerationApiConfig>): void {
    this.config.set({ ...this.DEFAULT_CONFIG, ...config });
    this.isConfigured.set(true);
  }

  async createGenerationRequest(
    sketchData: ImageData | string,
    prompt: string,
    width: number,
    height: number,
    style?: PixelArtStyle,
    colorPalette?: string[],
  ): Promise<PixelGenerationResponse> {
    const requestId = this.generateRequestId();
    const timestamp = Date.now();

    const request: PixelGenerationRequest = {
      id: requestId,
      sketchData,
      prompt,
      width,
      height,
      style,
      colorPalette,
      timestamp,
    };

    const initialResponse: PixelGenerationResponse = {
      id: requestId,
      status: 'pending',
      progress: 0,
    };

    this.activeRequests.update((requests) => {
      const newRequests = new Map(requests);
      newRequests.set(requestId, initialResponse);
      return newRequests;
    });

    try {
      const response = await this.sendRequest(request);
      this.updateRequestStatus(requestId, response);
      return response;
    } catch (error) {
      const errorResponse: PixelGenerationResponse = {
        id: requestId,
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.updateRequestStatus(requestId, errorResponse);
      return errorResponse;
    }
  }

  async checkStatus(requestId: string): Promise<PixelGenerationResponse> {
    const cached = this.activeRequests().get(requestId);
    if (cached && (cached.status === 'completed' || cached.status === 'failed')) {
      return cached;
    }

    try {
      const response = await this.fetchStatus(requestId);
      this.updateRequestStatus(requestId, response);
      return response;
    } catch (error) {
      throw new Error(`Failed to check status: ${error}`);
    }
  }

  async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    const keywords = this.extractKeywords(prompt);
    const suggestedColors = this.suggestColors(keywords);
    const complexity = this.estimateComplexity(prompt);
    const estimatedProcessingTime = this.estimateProcessingTime(complexity);

    return {
      keywords,
      suggestedColors,
      complexity,
      estimatedProcessingTime,
    };
  }

  getActiveRequest(requestId: string): PixelGenerationResponse | undefined {
    return this.activeRequests().get(requestId);
  }

  clearRequest(requestId: string): void {
    this.activeRequests.update((requests) => {
      const newRequests = new Map(requests);
      newRequests.delete(requestId);
      return newRequests;
    });
  }

  private async sendRequest(
    request: PixelGenerationRequest,
  ): Promise<PixelGenerationResponse> {
    const cfg = this.config();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), cfg.timeout);

    try {
      const sketchDataPayload =
        typeof request.sketchData === 'string'
          ? request.sketchData
          : this.imageDataToBase64(request.sketchData);

      const response = await fetch(`${cfg.endpoint}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({
          ...request,
          sketchData: sketchDataPayload,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.normalizeResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private async fetchStatus(requestId: string): Promise<PixelGenerationResponse> {
    const cfg = this.config();

    const response = await fetch(`${cfg.endpoint}/status/${requestId}`, {
      headers: {
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeResponse(data);
  }

  private normalizeResponse(data: unknown): PixelGenerationResponse {
    const response = data as PixelGenerationResponse;
    return {
      id: response.id,
      status: response.status,
      progress: response.progress ?? 0,
      resultImageData: response.resultImageData,
      resultDataUrl: response.resultDataUrl,
      error: response.error,
      processingTime: response.processingTime,
      metadata: response.metadata,
    };
  }

  private updateRequestStatus(requestId: string, response: PixelGenerationResponse): void {
    this.activeRequests.update((requests) => {
      const newRequests = new Map(requests);
      newRequests.set(requestId, response);
      return newRequests;
    });
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private imageDataToBase64(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  }

  private extractKeywords(prompt: string): string[] {
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'and',
      'or',
    ]);

    return prompt
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  private suggestColors(keywords: string[]): string[] {
    const colorMap: Record<string, string[]> = {
      fire: ['#ff4500', '#ff6347', '#ff8c00'],
      water: ['#1e90ff', '#4682b4', '#00bfff'],
      grass: ['#32cd32', '#228b22', '#90ee90'],
      forest: ['#228b22', '#006400', '#2e8b57'],
      sky: ['#87ceeb', '#4682b4', '#6495ed'],
      night: ['#191970', '#000080', '#483d8b'],
      metal: ['#708090', '#778899', '#c0c0c0'],
      gold: ['#ffd700', '#daa520', '#b8860b'],
    };

    const suggestedColors: string[] = [];
    for (const keyword of keywords) {
      if (colorMap[keyword]) {
        suggestedColors.push(...colorMap[keyword]);
      }
    }

    return suggestedColors.length > 0
      ? suggestedColors.slice(0, 8)
      : ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'];
  }

  private estimateComplexity(prompt: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = prompt.split(/\s+/).length;
    if (wordCount <= 5) return 'simple';
    if (wordCount <= 15) return 'moderate';
    return 'complex';
  }

  private estimateProcessingTime(complexity: 'simple' | 'moderate' | 'complex'): number {
    const times = {
      simple: 2000,
      moderate: 5000,
      complex: 10000,
    };
    return times[complexity];
  }
}
