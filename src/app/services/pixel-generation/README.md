# Pixel Art Generation Engine

## Mô tả

Engine xử lý phác họa thành pixel art **chạy hoàn toàn trong browser**, sử dụng các thuật toán xử lý ảnh truyền thống.

## Cách thức hoạt động

Engine **KHÔNG sử dụng AI/ML models**. Thay vào đó, nó áp dụng các thuật toán xử lý ảnh cổ điển:

### 1. Scaling (Điều chỉnh kích thước)
- Resize phác họa về kích thước mục tiêu
- Sử dụng nearest-neighbor interpolation để giữ nét pixel

### 2. Color Quantization (Giảm màu)
- Giảm số lượng màu trong ảnh xuống palette đã chọn (4, 8, 16, 32, hoặc 64 màu)
- Với mỗi pixel, tìm màu gần nhất trong palette bằng khoảng cách Euclidean trong không gian RGB
- Công thức: `distance = sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)`

### 3. Floyd-Steinberg Dithering (Tùy chọn)
- Thuật toán error diffusion để tạo ảo giác nhiều màu hơn
- Phân tán sai số màu sắc sang các pixel lân cận theo tỷ lệ:
  - Phải: 7/16
  - Dưới trái: 3/16
  - Dưới: 5/16
  - Dưới phải: 1/16

### 4. Contrast Adjustment (Điều chỉnh độ tương phản)
- Tăng/giảm độ tương phản theo style
- Công thức: `new_value = (old_value - 128) * factor + 128`

### 5. Edge Enhancement (Làm nét cạnh)
- Áp dụng kernel sharpening 3x3 để làm nổi bật đường viền
- Kernel:
  ```
  [ 0, -1,  0]
  [-1,  5, -1]
  [ 0, -1,  0]
  ```

## Hạn chế

**Prompt text không được sử dụng để sinh ảnh**. Engine chỉ xử lý phác họa hiện có:
- Prompt chỉ được dùng để gợi ý màu sắc (keyword matching đơn giản)
- Không có khả năng "hiểu" hoặc "sinh" nội dung mới từ prompt
- Kết quả phụ thuộc hoàn toàn vào chất lượng phác họa đầu vào

## Kết luận về "AI/ML"

Engine này **không phải là AI-powered**. Đây là bộ xử lý ảnh truyền thống sử dụng:
- Thuật toán giảm màu (color quantization)
- Thuật toán dithering (Floyd-Steinberg)
- Bộ lọc làm nét (sharpening filter)

Để có AI-powered generation thực sự (như yêu cầu ban đầu về Stable Diffusion, ControlNet), cần:
1. Tích hợp với API external chạy model AI (Stable Diffusion + ControlNet)
2. Hoặc sử dụng WebGPU để chạy model nhỏ trong browser
3. Hoặc sử dụng dịch vụ cloud như Replicate, HuggingFace Inference API

## Cấu trúc

- `pixel-generation-models.ts`: Type definitions và configurations
- `pixel-generation-engine.service.ts`: Orchestration service
- `pixel-generation-local.service.ts`: Core image processing algorithms
