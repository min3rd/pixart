# Pixel Art Generation Engine

## Mô tả

Engine xử lý phác họa thành pixel art với **2 chế độ**:
1. **AI-powered (ONNX Runtime Web + WebGPU)**: Sử dụng model AI để sinh ảnh từ prompt và sketch
2. **Traditional processing (fallback)**: Sử dụng thuật toán xử lý ảnh truyền thống

## Kiến trúc

### Services

1. **pixel-generation-onnx.service.ts** (MỚI)
   - Tích hợp ONNX Runtime Web với WebGPU support
   - Load và chạy model AI để generate pixel art
   - Tự động fallback về WASM nếu WebGPU không khả dụng

2. **pixel-generation-local.service.ts**
   - Xử lý ảnh truyền thống (color quantization, dithering)
   - Fallback khi không có model AI

3. **pixel-generation-engine.service.ts**
   - Orchestration service
   - Auto-detect và chọn giữa AI hoặc traditional processing
   - Quản lý jobs và state

## Cách hoạt động với ONNX

### 1. WebGPU Acceleration
Khi WebGPU khả dụng (Chrome 113+, Edge 113+):
```typescript
// Tự động sử dụng WebGPU
await onnxService.loadModel();
const result = await onnxService.generateWithOnnx(sketch, prompt, width, height, style);
```

### 2. WASM Fallback
Khi WebGPU không khả dụng:
- Tự động chuyển sang WASM backend
- Chậm hơn nhưng vẫn chạy được

### 3. Traditional Fallback
Khi không có model hoặc ONNX fail:
- Sử dụng traditional image processing
- Luôn hoạt động, không phụ thuộc vào model

## Preprocessing & Postprocessing

### Input Preprocessing
```typescript
// Convert ImageData → Float32 tensor [1, 3, H, W]
// Normalize to [0, 1] range
// Resize to target dimensions
```

### Prompt Encoding
```typescript
// Simple keyword-based encoding
// 77-length embedding vector
// Color keywords mapped to values
```

### Output Postprocessing
```typescript
// Float32 tensor → ImageData
// Apply pixel art style (color quantization)
// Clamp values to [0, 255]
```

## Model Requirements

Model file: `public/assets/models/pixel-art-generator.onnx`

**Input:**
- `sketch`: Float32[1, 3, H, W] - RGB image normalized to [0,1]
- `prompt`: Float32[1, 77] - Prompt embedding

**Output:**
- `output`: Float32[1, 3, H, W] - Generated RGB image [0,1]

Xem `public/assets/models/README.md` để biết cách tạo/convert model.

## Performance

### With WebGPU (AI mode)
- 64x64: ~500ms-1s (tùy model)
- 128x128: ~1-2s
- 256x256: ~2-4s

### With WASM (AI mode)
- 64x64: ~2-5s
- 128x128: ~5-10s
- Chậm hơn đáng kể

### Traditional mode
- 64x64: ~100-200ms
- 128x128: ~400-800ms
- Nhanh nhất, luôn khả dụng

## Usage

```typescript
// Initialize AI (optional, will auto-load when needed)
await pixelEngine.initializeAI();

// Generate with auto mode (AI if available, fallback to traditional)
const jobId = await pixelEngine.generatePixelArt(
  sketchData,
  "a small tree with green leaves",
  64, 64,
  'pixel-modern'
);

// Or force a specific mode
pixelEngine.setGenerationMode('onnx');  // Force AI
pixelEngine.setGenerationMode('local'); // Force traditional
pixelEngine.setGenerationMode('auto');  // Auto-detect (default)

// Disable AI entirely
pixelEngine.setAIEnabled(false);
```

## Dependencies

```json
{
  "onnxruntime-web": "^1.x.x"
}
```

ONNX Runtime Web hỗ trợ:
- WebGPU (fastest)
- WebAssembly (fallback)
- Multi-threading với Web Workers

## Hạn chế

### AI Mode
- Cần model file (~100-500MB)
- Tốc độ phụ thuộc vào GPU/hardware
- WebGPU chỉ khả dụng trên browser mới
- Model quality phụ thuộc vào training data

### Traditional Mode  
- Prompt chỉ dùng để gợi ý màu
- Không "hiểu" prompt để sinh content mới
- Kết quả phụ thuộc hoàn toàn vào sketch đầu vào

## Browser Support

### WebGPU
- Chrome/Edge 113+
- Firefox: experimental
- Safari: không hỗ trợ

### WASM
- Tất cả browsers hiện đại

## Tương lai

- [ ] Model quantization cho kích thước nhỏ hơn
- [ ] Progressive rendering (hiển thị từng bước)
- [ ] Multiple model support (user chọn model)
- [ ] Model caching để load nhanh hơn
- [ ] Web Worker để không block UI
