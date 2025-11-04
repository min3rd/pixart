# Pixel Art Generation Service

## Overview

The Pixel Art Generation Service is a standalone module that enables the creation of pixel art images from sketches combined with text prompts. It provides both API-based generation (for external AI services) and local processing capabilities.

## Architecture

The service is composed of four main components:

### 1. Models (`pixel-generation-models.ts`)
Defines the core data structures and configurations:
- `PixelGenerationRequest`: Input parameters for generation
- `PixelGenerationResponse`: Output and status information
- `PixelArtStyle`: Pre-defined style configurations (8-bit, 16-bit, modern, etc.)
- `PromptAnalysis`: Results from analyzing text prompts

### 2. API Service (`pixel-generation-api.service.ts`)
Handles communication with external generation services:
- Configurable endpoint and authentication
- Request/response management
- Status polling for async operations
- Prompt analysis and color suggestion

### 3. Engine Service (`pixel-generation-engine.service.ts`)
Main orchestration layer:
- Coordinates between API and local processing
- Manages active generation jobs
- Converts between different image formats (ImageData, layer buffers, canvas)
- Provides status tracking and job cancellation

### 4. Local Processing Service (`pixel-generation-local.service.ts`)
Fallback pixel art generation using browser-based algorithms:
- Color quantization
- Floyd-Steinberg dithering
- Contrast adjustment
- Edge enhancement
- Multiple built-in color palettes

## Usage

### Basic Example

```typescript
import { PixelGenerationEngineService } from './services/pixel-generation';

@Component({...})
export class MyComponent {
  constructor(private pixelEngine: PixelGenerationEngineService) {}

  async generatePixelArt() {
    // Get sketch from canvas
    const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const sketchData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Generate pixel art
    const jobId = await this.pixelEngine.generatePixelArt(
      sketchData,
      'a small tree with green leaves',
      64,  // target width
      64,  // target height
      'retro-8bit',  // style
      ['#228b22', '#006400', '#8b4513']  // optional custom palette
    );

    // Poll for completion
    const checkStatus = setInterval(async () => {
      const job = this.pixelEngine.getJob(jobId);
      if (job?.response.status === 'completed') {
        clearInterval(checkStatus);
        const result = await this.pixelEngine.getResultAsImageData(jobId);
        // Use the result...
      }
    }, 1000);
  }
}
```

### Using with Layer Buffers

```typescript
async generateFromLayer(
  layerBuffer: string[],
  canvasWidth: number,
  canvasHeight: number
) {
  const jobId = await this.pixelEngine.generateFromLayerBuffer(
    layerBuffer,
    canvasWidth,
    canvasHeight,
    'a cute character sprite',
    32,
    32,
    'pixel-modern'
  );

  // Wait for completion
  // ...

  // Get result as layer buffer
  const resultBuffer = await this.pixelEngine.getResultAsLayerBuffer(
    jobId,
    canvasWidth,
    canvasHeight
  );
}
```

### Configuring External API

```typescript
import { PixelGenerationApiService } from './services/pixel-generation';

@Component({...})
export class AppComponent implements OnInit {
  constructor(private apiService: PixelGenerationApiService) {}

  ngOnInit() {
    this.apiService.configure({
      endpoint: 'https://your-api.example.com/api/pixel-generation',
      apiKey: 'your-api-key',
      timeout: 60000,
      retryAttempts: 3
    });
  }
}
```

## API Endpoints (External Service)

If implementing an external generation service, it should provide:

### POST /api/pixel-generation/generate
Create a new generation request.

**Request Body:**
```json
{
  "id": "req-123456",
  "sketchData": "data:image/png;base64,...",
  "prompt": "a small tree with green leaves",
  "width": 64,
  "height": 64,
  "style": "retro-8bit",
  "colorPalette": ["#228b22", "#006400"],
  "timestamp": 1699000000000
}
```

**Response:**
```json
{
  "id": "req-123456",
  "status": "processing",
  "progress": 0
}
```

### GET /api/pixel-generation/status/:id
Check generation status.

**Response (Processing):**
```json
{
  "id": "req-123456",
  "status": "processing",
  "progress": 45
}
```

**Response (Completed):**
```json
{
  "id": "req-123456",
  "status": "completed",
  "progress": 100,
  "resultDataUrl": "data:image/png;base64,...",
  "processingTime": 5432,
  "metadata": {
    "colorsUsed": 8,
    "pixelCount": 4096,
    "algorithm": "stable-diffusion-controlnet"
  }
}
```

## Pixel Art Styles

### retro-8bit
Classic 8-color palette with dithering, high contrast.
- **Max Colors:** 8
- **Dithering:** Enabled
- **Best for:** Retro game sprites, simple icons

### retro-16bit
16-color palette with dithering, moderate contrast.
- **Max Colors:** 16
- **Dithering:** Enabled
- **Best for:** SNES-era game graphics

### pixel-modern
Modern pixel art with 32 colors, smooth gradients.
- **Max Colors:** 32
- **Dithering:** Disabled
- **Best for:** Contemporary pixel art, detailed sprites

### low-res
Minimal 4-color palette, high contrast.
- **Max Colors:** 4
- **Dithering:** Enabled
- **Best for:** 1-bit style art, extreme simplification

### high-detail
High color count for detailed pixel work.
- **Max Colors:** 64
- **Dithering:** Disabled
- **Best for:** Large sprites, pixel art illustrations

## Integration Points

### With Editor Document Service
```typescript
import { EditorDocumentService } from '../editor-document.service';
import { PixelGenerationEngineService } from './pixel-generation';

// Generate from current layer
const currentLayer = editorDoc.getCurrentLayer();
if (currentLayer) {
  const jobId = await pixelEngine.generateFromLayerBuffer(
    currentLayer.buffer,
    editorDoc.canvasWidth,
    editorDoc.canvasHeight,
    prompt,
    targetWidth,
    targetHeight,
    style
  );
}

// Add result to new layer
const result = await pixelEngine.getResultAsLayerBuffer(jobId, width, height);
editorDoc.addLayer('Generated Pixel Art', result);
```

## Local Processing Algorithm

When API is not available or configured, the service uses local processing:

1. **Scale:** Resize sketch to target dimensions using nearest-neighbor
2. **Quantize:** Map colors to the selected palette
3. **Dither:** Apply Floyd-Steinberg dithering (if enabled)
4. **Contrast:** Adjust contrast based on style config
5. **Edge Enhancement:** Apply sharpening kernel to enhance pixel edges

## Performance Considerations

- **Local Processing:** Typically 100-500ms for small sprites (32x32 to 128x128)
- **API Processing:** Depends on external service, typically 2-10 seconds
- **Job Polling:** Default interval is 2 seconds
- **Memory:** ImageData objects are held in memory during processing

## Future Enhancements

- Integration with Stable Diffusion + ControlNet for AI-powered generation
- Support for animation frame generation
- Batch processing of multiple layers
- Custom dithering patterns
- Palette extraction from reference images
- Export generated assets as sprite sheets

## Error Handling

The service provides detailed error information:

```typescript
const job = pixelEngine.getJob(jobId);
if (job?.response.status === 'failed') {
  console.error('Generation failed:', job.response.error);
}
```

Common error scenarios:
- Empty sketch data
- Invalid dimensions (too large or too small)
- API timeout or connection errors
- Invalid color palette format

## Security Considerations

- API keys should be stored securely (environment variables, not in code)
- Sketch data is converted to base64 for transmission
- No user data is persisted by the service
- All processing is client-side unless using external API
