# Pixel Art Generation Engine - Feature Documentation

## Overview

The Pixel Art Generation Engine is a comprehensive system that enables users to create pixel art from sketches combined with text prompts. This feature integrates seamlessly with the Pixart editor, supporting both external AI-powered generation (via API) and local browser-based processing.

## Architecture

### Service Layer

The feature consists of four core services located in `src/app/services/pixel-generation/`:

1. **Models** (`pixel-generation-models.ts`)
   - Data structures and type definitions
   - Style configurations
   - Request/response interfaces

2. **API Service** (`pixel-generation-api.service.ts`)
   - External API communication
   - Request management
   - Status polling
   - Prompt analysis

3. **Engine Service** (`pixel-generation-engine.service.ts`)
   - Main orchestration layer
   - Job management
   - Format conversion (ImageData ↔ layer buffers ↔ canvas)
   - Result retrieval

4. **Local Processing** (`pixel-generation-local.service.ts`)
   - Fallback pixel art generation
   - Color quantization and dithering
   - Image enhancement algorithms

### UI Components

**Dialog Component** (`src/app/shared/components/pixel-art-generation-dialog/`)
- User interface for pixel art generation
- Real-time progress tracking
- Result preview and layer integration

## User Workflow

1. **Open Dialog**: User clicks "Generate Pixel Art from Sketch" in Insert menu
2. **Input Parameters**:
   - Text prompt describing desired output
   - Target dimensions (width/height)
   - Art style selection (8-bit, 16-bit, modern, etc.)
   - Source selection (use current layer as sketch)
3. **Generate**: System processes the sketch and prompt
4. **Review Result**: User sees the generated pixel art with metadata
5. **Apply**: User chooses to add to new layer or replace current layer

## Pixel Art Styles

### retro-8bit
- **Palette**: 8 colors
- **Features**: High contrast, dithering enabled
- **Use Case**: Classic NES-style sprites, simple icons

### retro-16bit
- **Palette**: 16 colors
- **Features**: Moderate contrast, dithering enabled
- **Use Case**: SNES-era graphics, character sprites

### pixel-modern
- **Palette**: 32 colors
- **Features**: Smooth gradients, no dithering
- **Use Case**: Contemporary pixel art, detailed scenes

### low-res
- **Palette**: 4 colors
- **Features**: Extreme simplification, high contrast
- **Use Case**: 1-bit style, retro gaming aesthetic

### high-detail
- **Palette**: 64 colors
- **Features**: High color count, smooth gradients
- **Use Case**: Large sprites, pixel illustrations

## Integration Points

### With Editor Document Service

```typescript
// Generate from selected layer
const selectedLayer = editorDoc.selectedLayer();
if (selectedLayer && !isGroup(selectedLayer)) {
  const layerBuffer = editorDoc.getLayerBuffer(selectedLayer.id);
  const jobId = await pixelEngine.generateFromLayerBuffer(
    layerBuffer,
    canvasWidth,
    canvasHeight,
    prompt,
    targetWidth,
    targetHeight,
    style
  );
}

// Add result to new layer
const resultBuffer = await pixelEngine.getResultAsLayerBuffer(
  jobId,
  canvasWidth,
  canvasHeight
);
editorDoc.addLayer('Generated Art', resultBuffer);
```

### Menu Integration

The feature is accessible via:
- **Insert Menu**: "Generate Pixel Art from Sketch"
- **Keyboard Shortcut**: Configurable via hotkeys service (default: `Ctrl+Shift+G`)

## API Specification (External Service)

If implementing an external generation service, the following endpoints are required:

### POST /api/pixel-generation/generate

Create a generation request.

**Request:**
```json
{
  "id": "req-1699000000000-abc123",
  "sketchData": "data:image/png;base64,...",
  "prompt": "a small tree with green leaves and brown trunk",
  "width": 64,
  "height": 64,
  "style": "pixel-modern",
  "colorPalette": ["#228b22", "#006400", "#8b4513"],
  "timestamp": 1699000000000
}
```

**Response:**
```json
{
  "id": "req-1699000000000-abc123",
  "status": "processing",
  "progress": 0
}
```

### GET /api/pixel-generation/status/:id

Check generation status.

**Response (Processing):**
```json
{
  "id": "req-1699000000000-abc123",
  "status": "processing",
  "progress": 45
}
```

**Response (Completed):**
```json
{
  "id": "req-1699000000000-abc123",
  "status": "completed",
  "progress": 100,
  "resultDataUrl": "data:image/png;base64,...",
  "processingTime": 5432,
  "metadata": {
    "colorsUsed": 16,
    "pixelCount": 4096,
    "algorithm": "stable-diffusion-controlnet",
    "promptTokens": 12
  }
}
```

**Response (Failed):**
```json
{
  "id": "req-1699000000000-abc123",
  "status": "failed",
  "progress": 0,
  "error": "Invalid sketch data"
}
```

## Local Processing Algorithm

When external API is unavailable, the system uses local processing:

1. **Scale**: Resize sketch to target dimensions using nearest-neighbor interpolation
2. **Quantize**: Map all colors to the selected palette using nearest color matching
3. **Dither**: Apply Floyd-Steinberg dithering algorithm (if enabled by style)
4. **Contrast**: Adjust contrast based on style configuration
5. **Edge Enhancement**: Apply sharpening kernel to enhance pixel edges

### Algorithm Details

**Color Quantization:**
- Uses Euclidean distance in RGB space
- Finds nearest palette color for each pixel
- Preserves alpha channel

**Floyd-Steinberg Dithering:**
- Error diffusion to adjacent pixels
- Distribution: right (7/16), bottom-left (3/16), bottom (5/16), bottom-right (1/16)
- Creates perception of more colors

**Edge Enhancement:**
- 3x3 sharpening kernel
- Emphasizes pixel boundaries
- Creates crisper results

## Configuration

### API Configuration

```typescript
import { PixelGenerationApiService } from './services/pixel-generation';

// In app initialization or component
apiService.configure({
  endpoint: 'https://your-api.example.com/api/pixel-generation',
  apiKey: 'your-api-key-here',
  timeout: 60000,        // 60 seconds
  retryAttempts: 3
});
```

### Environment-Specific Settings

For production deployment, configure via environment files:

```typescript
// environment.ts
export const environment = {
  pixelGeneration: {
    apiEndpoint: 'https://api.pixart.io/pixel-generation',
    apiKey: process.env.PIXEL_GEN_API_KEY,
    useLocalFallback: true
  }
};
```

## Performance Characteristics

### Local Processing
- **Small sprites (32x32)**: ~100-200ms
- **Medium sprites (64x64)**: ~200-400ms
- **Large images (128x128)**: ~400-800ms
- **Very large (256x256)**: ~1-2 seconds

### API Processing
- Network latency dependent
- Typical range: 2-10 seconds
- Depends on external service capacity

### Memory Usage
- ImageData objects held in memory during processing
- Typical usage: 4 bytes per pixel
- 64x64 image = ~16KB
- 256x256 image = ~256KB

## Error Handling

### Common Errors

1. **Empty Sketch**: No pixels in selected layer
   - **Solution**: Draw something on the layer first

2. **No Layer Selected**: User hasn't selected a layer
   - **Solution**: Select a layer in the layers panel

3. **API Timeout**: External service not responding
   - **Solution**: Falls back to local processing automatically

4. **Invalid Dimensions**: Width/height out of range
   - **Solution**: Use values between 16 and 512 pixels

### Error Recovery

The system handles errors gracefully:
- Shows user-friendly error messages
- Automatically falls back to local processing if API fails
- Allows users to retry with different parameters
- Preserves original layer data

## Security Considerations

### API Communication
- API keys should be stored in environment variables
- All API requests use HTTPS
- Sketch data is Base64-encoded for transmission
- No sensitive user data persisted on server

### Client-Side Processing
- All local processing occurs in browser sandbox
- No external data transmission when using local mode
- ImageData objects are cleaned up after processing

### Rate Limiting
- Implement client-side throttling to prevent API abuse
- Recommended: Max 10 requests per minute per user
- Queue requests if limit exceeded

## Future Enhancements

### Planned Features

1. **AI Integration**
   - Stable Diffusion + ControlNet support
   - Multiple AI model options
   - Fine-tuned pixel art models

2. **Advanced Options**
   - Custom palette extraction from reference images
   - Animation frame generation
   - Batch processing of multiple layers
   - Style transfer from reference pixel art

3. **Export Capabilities**
   - Direct export as sprite sheet
   - Multiple size variations
   - Optimized color palettes
   - Animation preview

4. **Collaboration**
   - Share generation parameters
   - Template/preset library
   - Community color palettes

### Technical Improvements

- **WebGL Acceleration**: Use GPU for faster local processing
- **Web Workers**: Offload processing to background threads
- **Progressive Results**: Show intermediate results during processing
- **Caching**: Cache results for repeated generations

## Testing

### Unit Tests

Test coverage for:
- Color quantization algorithm accuracy
- Dithering pattern correctness
- Image scaling quality
- API request/response handling

### Integration Tests

- Dialog workflow completion
- Layer integration
- Error handling scenarios
- API fallback behavior

### Manual Testing Checklist

- [ ] Generate from empty layer (should show error)
- [ ] Generate from sketch layer
- [ ] Test all 5 style presets
- [ ] Test with various dimensions (16x16 to 256x256)
- [ ] Test prompt variations
- [ ] Add to new layer
- [ ] Replace current layer
- [ ] Cancel during processing
- [ ] Test with API unavailable (fallback to local)

## Troubleshooting

### Issue: Generated art looks blurry
**Solution**: Use smaller target dimensions or high-detail style

### Issue: Colors don't match prompt
**Solution**: Use custom color palette option or adjust prompt description

### Issue: Processing takes too long
**Solution**: Use smaller dimensions or simpler style (8-bit, low-res)

### Issue: API not working
**Solution**: Check API configuration, network connection, verify local fallback works

## Support and Contact

For issues, feature requests, or questions:
- **GitHub Issues**: https://github.com/min3rd/pixart/issues
- **Documentation**: See `src/app/services/pixel-generation/README.md`
- **Email**: min6th@gmail.com

## License

This feature is part of the Pixart project and is licensed under the MIT License.
