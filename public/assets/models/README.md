# ONNX Model Placeholder

This directory should contain the ONNX model file for AI-powered pixel art generation.

## Model Requirements

The model should:
- Accept sketch input (3-channel RGB image as float32)
- Accept prompt embedding (77-length float32 array)
- Output generated image (3-channel RGB image as float32)

## Recommended Models

For lightweight pixel art generation, consider:

1. **Quantized ControlNet for Pixel Art** (~100-200MB)
   - Fine-tuned on pixel art datasets
   - Optimized for WebGPU/WASM

2. **Custom Lightweight GAN** (~50-100MB)
   - Trained specifically for pixel art
   - Lower quality but faster

3. **Distilled Stable Diffusion** (~200-500MB)
   - Better quality but larger size
   - May require model quantization

## Obtaining a Model

### Option 1: Use Pre-trained Model
Download a pre-trained ONNX model and place it here as `pixel-art-generator.onnx`

### Option 2: Convert PyTorch Model
```python
import torch
import torch.onnx

# Load your PyTorch model
model = YourPixelArtModel()
model.eval()

# Create dummy inputs
dummy_sketch = torch.randn(1, 3, 512, 512)
dummy_prompt = torch.randn(1, 77)

# Export to ONNX
torch.onnx.export(
    model,
    (dummy_sketch, dummy_prompt),
    "pixel-art-generator.onnx",
    input_names=['sketch', 'prompt'],
    output_names=['output'],
    dynamic_axes={
        'sketch': {2: 'height', 3: 'width'},
        'output': {2: 'height', 3: 'width'}
    }
)
```

### Option 3: Use Hugging Face
Many pixel art models are available on Hugging Face that can be converted to ONNX format.

## Model Not Found Behavior

If no model is found at the expected path, the engine will:
1. Fall back to traditional image processing algorithms
2. Display a warning in the console
3. Continue to work with color quantization and dithering

This ensures the application works even without an AI model.
