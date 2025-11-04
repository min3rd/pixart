# Pixel Art Generation API - Example Implementation Guide

This document provides guidance for implementing an external pixel art generation service that can integrate with the Pixart editor.

## API Server Requirements

### Technology Stack Recommendations

- **Python**: Flask/FastAPI with PIL/Pillow for image processing
- **Node.js**: Express with Sharp or Canvas for image processing
- **Any language**: Must support HTTP REST API and Base64 image encoding

### Core Dependencies

For AI-powered generation:
- Stable Diffusion (recommended: v1.5 or SDXL)
- ControlNet (for sketch-to-image)
- PyTorch or TensorFlow

For traditional processing:
- Image processing library (PIL, Sharp, ImageMagick)
- Color quantization algorithms
- Dithering implementation

## Example Python Implementation

### Setup

```bash
pip install fastapi uvicorn pillow numpy torch diffusers
```

### Basic Server Structure

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import base64
from io import BytesIO
from PIL import Image
import uuid

app = FastAPI()

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class GenerationRequest(BaseModel):
    id: str
    sketchData: str  # Base64 encoded image
    prompt: str
    width: int
    height: int
    style: Optional[str] = "pixel-modern"
    colorPalette: Optional[List[str]] = None
    timestamp: int

class GenerationResponse(BaseModel):
    id: str
    status: str  # pending, processing, completed, failed
    progress: int
    resultDataUrl: Optional[str] = None
    error: Optional[str] = None
    processingTime: Optional[int] = None
    metadata: Optional[dict] = None

# In-memory job storage (use Redis/database in production)
jobs = {}

@app.post("/api/pixel-generation/generate")
async def create_generation(request: GenerationRequest):
    try:
        # Decode sketch image
        sketch_img = decode_base64_image(request.sketchData)
        
        # Create job
        job = {
            "id": request.id,
            "status": "processing",
            "progress": 0,
            "request": request,
            "sketch": sketch_img
        }
        jobs[request.id] = job
        
        # Start processing asynchronously
        # In production, use Celery or similar task queue
        process_generation_async(request.id)
        
        return GenerationResponse(
            id=request.id,
            status="processing",
            progress=0
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/pixel-generation/status/{request_id}")
async def check_status(request_id: str):
    job = jobs.get(request_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    response_data = {
        "id": request_id,
        "status": job["status"],
        "progress": job["progress"]
    }
    
    if job["status"] == "completed":
        response_data["resultDataUrl"] = job.get("resultDataUrl")
        response_data["processingTime"] = job.get("processingTime")
        response_data["metadata"] = job.get("metadata")
    elif job["status"] == "failed":
        response_data["error"] = job.get("error")
    
    return GenerationResponse(**response_data)

def decode_base64_image(data_url: str) -> Image.Image:
    """Decode Base64 image data"""
    if data_url.startswith('data:image'):
        data_url = data_url.split(',')[1]
    
    image_data = base64.b64decode(data_url)
    return Image.open(BytesIO(image_data))

def encode_image_to_base64(image: Image.Image) -> str:
    """Encode PIL Image to Base64 data URL"""
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

def process_generation_async(job_id: str):
    """Process generation job (simplified version)"""
    import threading
    
    def process():
        import time
        job = jobs[job_id]
        start_time = time.time()
        
        try:
            request = job["request"]
            sketch = job["sketch"]
            
            # Update progress
            job["progress"] = 25
            
            # Process image (simplified - implement your algorithm here)
            result = process_pixel_art(
                sketch,
                request.prompt,
                request.width,
                request.height,
                request.style,
                request.colorPalette
            )
            
            job["progress"] = 75
            
            # Encode result
            result_data_url = encode_image_to_base64(result)
            
            # Count unique colors
            colors_used = len(set(result.getdata()))
            
            # Complete job
            processing_time = int((time.time() - start_time) * 1000)
            job["status"] = "completed"
            job["progress"] = 100
            job["resultDataUrl"] = result_data_url
            job["processingTime"] = processing_time
            job["metadata"] = {
                "colorsUsed": colors_used,
                "pixelCount": request.width * request.height,
                "algorithm": "basic-quantization"
            }
            
        except Exception as e:
            job["status"] = "failed"
            job["error"] = str(e)
    
    thread = threading.Thread(target=process)
    thread.start()

def process_pixel_art(
    sketch: Image.Image,
    prompt: str,
    width: int,
    height: int,
    style: str,
    color_palette: Optional[List[str]]
) -> Image.Image:
    """
    Process sketch into pixel art
    This is a simplified version - implement your own algorithm
    """
    # Resize to target dimensions
    sketch = sketch.resize((width, height), Image.NEAREST)
    
    # Convert to RGB if needed
    if sketch.mode != 'RGB':
        sketch = sketch.convert('RGB')
    
    # Get color palette
    if not color_palette:
        color_palette = get_default_palette(style)
    
    # Quantize colors
    result = quantize_to_palette(sketch, color_palette)
    
    return result

def get_default_palette(style: str) -> List[str]:
    """Get default color palette for style"""
    palettes = {
        "retro-8bit": [
            "#000000", "#1d2b53", "#7e2553", "#008751",
            "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8"
        ],
        "retro-16bit": [
            "#000000", "#1d2b53", "#7e2553", "#008751",
            "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
            "#ff004d", "#ffa300", "#ffec27", "#00e436",
            "#29adff", "#83769c", "#ff77a8", "#ffccaa"
        ],
        # Add more palettes...
    }
    return palettes.get(style, palettes["retro-8bit"])

def quantize_to_palette(image: Image.Image, palette: List[str]) -> Image.Image:
    """Quantize image colors to palette"""
    # Convert palette to RGB
    palette_rgb = [tuple(int(c[i:i+2], 16) for i in (1, 3, 5)) for c in palette]
    
    # Create new image
    result = Image.new('RGB', image.size)
    pixels = result.load()
    
    for y in range(image.height):
        for x in range(image.width):
            original_color = image.getpixel((x, y))[:3]
            
            # Find nearest palette color
            nearest = min(palette_rgb, key=lambda c: sum(
                (c[i] - original_color[i]) ** 2 for i in range(3)
            ))
            
            pixels[x, y] = nearest
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## AI-Powered Generation with Stable Diffusion

For advanced AI-powered generation:

```python
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
import torch

# Initialize models (do this once at startup)
controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-canny",
    torch_dtype=torch.float16
)

pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    controlnet=controlnet,
    torch_dtype=torch.float16,
    safety_checker=None
)
pipe.to("cuda")  # Use GPU

def generate_with_ai(sketch: Image.Image, prompt: str, width: int, height: int):
    """Generate using Stable Diffusion + ControlNet"""
    
    # Prepare control image (edge detection)
    control_image = prepare_control_image(sketch, width, height)
    
    # Generate
    result = pipe(
        prompt=f"pixel art, {prompt}, 16-bit style, vibrant colors",
        image=control_image,
        num_inference_steps=20,
        guidance_scale=7.5,
        width=width,
        height=height
    ).images[0]
    
    # Post-process to pixel art style
    result = pixelate_image(result, width, height)
    
    return result

def prepare_control_image(sketch: Image.Image, width: int, height: int):
    """Prepare sketch for ControlNet"""
    import cv2
    import numpy as np
    
    # Resize
    sketch = sketch.resize((width, height))
    
    # Convert to numpy array
    image = np.array(sketch)
    
    # Apply Canny edge detection
    edges = cv2.Canny(image, 100, 200)
    edges = edges[:, :, None]
    edges = np.concatenate([edges, edges, edges], axis=2)
    
    return Image.fromarray(edges)

def pixelate_image(image: Image.Image, target_width: int, target_height: int):
    """Convert AI-generated image to pixel art"""
    # Resize down
    small = image.resize((target_width, target_height), Image.LANCZOS)
    
    # Quantize colors
    small = small.quantize(colors=32)
    
    # Convert back to RGB
    return small.convert('RGB')
```

## Deployment

### Docker Container

```dockerfile
FROM python:3.9

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables

```bash
# API Configuration
API_KEY=your-secret-key
CORS_ORIGINS=https://pixart.example.com

# Model Configuration
MODEL_PATH=/models/stable-diffusion
CONTROLNET_PATH=/models/controlnet

# Processing
MAX_WORKERS=4
MAX_QUEUE_SIZE=100
TIMEOUT_SECONDS=60
```

### Production Considerations

1. **Rate Limiting**: Implement per-user rate limits
2. **Authentication**: Require API keys for all requests
3. **Caching**: Cache common generations
4. **Queue System**: Use Celery/RabbitMQ for job queue
5. **Monitoring**: Log processing times, errors, and usage
6. **Scaling**: Use load balancer for multiple instances
7. **Storage**: Store results in S3/Cloud Storage for retrieval

## Testing the API

### Using cURL

```bash
# Create generation request
curl -X POST http://localhost:8000/api/pixel-generation/generate \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "sketchData": "data:image/png;base64,iVBORw0KG...",
    "prompt": "a small tree",
    "width": 64,
    "height": 64,
    "style": "pixel-modern",
    "timestamp": 1699000000000
  }'

# Check status
curl http://localhost:8000/api/pixel-generation/status/test-123
```

### Using Python Client

```python
import requests
import base64

# Encode sketch
with open("sketch.png", "rb") as f:
    sketch_data = base64.b64encode(f.read()).decode()

# Create request
response = requests.post("http://localhost:8000/api/pixel-generation/generate", json={
    "id": "test-123",
    "sketchData": f"data:image/png;base64,{sketch_data}",
    "prompt": "a small tree with green leaves",
    "width": 64,
    "height": 64,
    "style": "pixel-modern",
    "timestamp": 1699000000000
})

print(response.json())

# Poll for completion
import time
while True:
    status = requests.get(f"http://localhost:8000/api/pixel-generation/status/test-123")
    data = status.json()
    print(f"Status: {data['status']}, Progress: {data['progress']}%")
    
    if data['status'] in ['completed', 'failed']:
        break
    
    time.sleep(1)
```

## Performance Optimization

### GPU Acceleration

```python
# Use GPU for processing
if torch.cuda.is_available():
    pipe.to("cuda")
else:
    pipe.to("cpu")

# Mixed precision for faster inference
pipe.enable_attention_slicing()
pipe.enable_vae_slicing()
```

### Batch Processing

```python
# Process multiple requests in parallel
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

def process_batch(job_ids):
    for job_id in job_ids:
        executor.submit(process_generation_async, job_id)
```

### Caching

```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=100)
def get_cached_result(prompt_hash, width, height, style):
    """Cache common generations"""
    # Return cached result if available
    pass

def hash_request(prompt, width, height, style):
    content = f"{prompt}_{width}_{height}_{style}"
    return hashlib.md5(content.encode()).hexdigest()
```

## References

- [Stable Diffusion](https://github.com/Stability-AI/stablediffusion)
- [ControlNet](https://github.com/lllyasviel/ControlNet)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PIL/Pillow](https://pillow.readthedocs.io/)
- [Diffusers Library](https://github.com/huggingface/diffusers)
