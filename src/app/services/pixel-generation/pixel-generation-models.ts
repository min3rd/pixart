export type PixelGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PixelGenerationRequest {
  id: string;
  sketchData: ImageData | string;
  prompt: string;
  width: number;
  height: number;
  style?: PixelArtStyle;
  colorPalette?: string[];
  timestamp: number;
}

export interface PixelGenerationResponse {
  id: string;
  status: PixelGenerationStatus;
  progress: number;
  resultImageData?: ImageData;
  resultDataUrl?: string;
  error?: string;
  processingTime?: number;
  metadata?: PixelGenerationMetadata;
}

export interface PixelGenerationMetadata {
  colorsUsed: number;
  pixelCount: number;
  algorithm: string;
  promptTokens?: number;
}

export type PixelArtStyle = 
  | 'retro-8bit'
  | 'retro-16bit'
  | 'pixel-modern'
  | 'low-res'
  | 'high-detail';

export interface PixelArtStyleConfig {
  maxColors: number;
  ditherEnabled: boolean;
  smoothingEnabled: boolean;
  contrastBoost: number;
}

export interface PromptAnalysis {
  keywords: string[];
  suggestedColors: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedProcessingTime: number;
}

export const PIXEL_ART_STYLE_CONFIGS: Record<PixelArtStyle, PixelArtStyleConfig> = {
  'retro-8bit': {
    maxColors: 8,
    ditherEnabled: true,
    smoothingEnabled: false,
    contrastBoost: 1.3,
  },
  'retro-16bit': {
    maxColors: 16,
    ditherEnabled: true,
    smoothingEnabled: false,
    contrastBoost: 1.2,
  },
  'pixel-modern': {
    maxColors: 32,
    ditherEnabled: false,
    smoothingEnabled: true,
    contrastBoost: 1.0,
  },
  'low-res': {
    maxColors: 4,
    ditherEnabled: true,
    smoothingEnabled: false,
    contrastBoost: 1.5,
  },
  'high-detail': {
    maxColors: 64,
    ditherEnabled: false,
    smoothingEnabled: true,
    contrastBoost: 1.1,
  },
};
