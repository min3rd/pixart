# ONNX Model Download Script

## Mô tả (Description)
Script Node.js để tự động tải các ONNX model cho pixel art generation từ Hugging Face về thư mục `public/assets/models`.

This Node.js script automatically downloads ONNX models for pixel art generation from Hugging Face to the `public/assets/models` directory.

## Sử dụng (Usage)

### Cách chạy (How to run):
```bash
cd public/assets/models
node download_model_onnx.js
```

hoặc (or):
```bash
./download_model_onnx.js
```

### Workflow:
1. Script sẽ hiển thị danh sách các model pixel art phổ biến từ Hugging Face
2. Chọn model bằng cách nhập số (1-5) hoặc 'q' để thoát
3. Nếu file đã tồn tại, script sẽ hỏi có muốn ghi đè không
4. Có thể tải nhiều model trong một lần chạy
5. Script sẽ log tiến độ download và báo cáo kết quả

### Các model có sẵn (Available models):

### Các model có sẵn (Available models):

✅ **Các model sau đã được test và có thể download:**

**NOTE:** The following models have been tested and are ready to download from ONNX Model Zoo:

1. **SqueezeNet 1.0 (ONNX Model Zoo)** (~5MB)
   - Lightweight image classification model
   - Good for testing the download script
   - ✅ Verified working

2. **MobileNet v2 (ONNX Model Zoo)** (~14MB)
   - Mobile-optimized image classification model
   - ✅ Verified working

3. **ResNet-50 (ONNX Model Zoo)** (~98MB)
   - Deep residual network for image classification
   - ✅ Verified working

4. **Custom URL - For Your Pixel Art Model**
   - Nhập URL từ Hugging Face, ONNX Model Zoo, hoặc link trực tiếp
   - Use this option for pixel art specific models from Hugging Face

**💡 Tìm pixel art models:** Search Hugging Face for "pixel art onnx", "stable diffusion onnx", "controlnet onnx"

## Tính năng (Features)

- ✅ Download models from ONNX Model Zoo (tested and working)
- ✅ Cho phép chọn và tải nhiều model
- ✅ Hỗ trợ custom URL cho Hugging Face và các nguồn khác
- ✅ Kiểm tra file tồn tại và hỏi ghi đè
- ✅ Log chi tiết quá trình tải (start, progress, done, error)
- ✅ Hiển thị tiến độ download theo phần trăm
- ✅ Xử lý redirect tự động
- ✅ Hỗ trợ HTTP và HTTPS
- ✅ Báo cáo tổng kết sau khi hoàn thành

## Yêu cầu (Requirements)

- Node.js >= 14
- Kết nối Internet để tải model từ Hugging Face

## Ví dụ Output (Example Output)

```
========================================
  ONNX Model Downloader for Pixel Art  
========================================
  ONNX Model Downloader for Pixel Art  
========================================

This script downloads ONNX models for testing and development.

Target directory: /path/to/public/assets/models

✅ Pre-configured models are from ONNX Model Zoo and ready to download.
💡 For pixel art specific models, use the "Custom URL" option with:
   - Hugging Face models (search: "pixel art onnx")
   - Your own trained models
   - Direct download links to .onnx files


=== Available Pixel Art ONNX Models ===

1. SqueezeNet 1.0 (ONNX Model Zoo)
   Size: ~5MB
   Description: Lightweight image classification model - good for testing the download script
   URL: https://github.com/onnx/models/raw/main/validated/vision/classification/squeezenet/model/squeezenet1.0-12.onnx

2. MobileNet v2 (ONNX Model Zoo)
   Size: ~14MB
   Description: Mobile-optimized image classification model
   URL: https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx

3. ResNet-50 (ONNX Model Zoo)
   Size: ~98MB
   Description: Deep residual network for image classification
   URL: https://github.com/onnx/models/raw/main/validated/vision/classification/resnet/model/resnet50-v1-7.onnx

4. Custom URL - For Your Pixel Art Model
   Size: Unknown
   Description: Enter your own URL (Hugging Face, ONNX Model Zoo, or direct download link)

Select a model (1-4) or "q" to quit: 1

Add another model? (y/n): n

[INFO] Preparing to download 1 model(s)...

[START] Downloading "SqueezeNet 1.0 (ONNX Model Zoo)" to "squeezenet1.0-12.onnx"
[INFO] Starting download from: https://github.com/onnx/models/raw/main/validated/vision/classification/squeezenet/model/squeezenet1.0-12.onnx
[INFO] Following redirect to: https://media.githubusercontent.com/media/onnx/models/main/validated/vision/classification/squeezenet/model/squeezenet1.0-12.onnx
[PROGRESS] 5% - 0.24 MB / 4.72 MB
[PROGRESS] 10% - 0.47 MB / 4.72 MB
...
[PROGRESS] 100% - 4.72 MB / 4.72 MB
[SUCCESS] Download completed: 4.72 MB
[DONE] Model saved to: /path/to/public/assets/models/squeezenet1.0-12.onnx

[SUMMARY] Downloaded 1 out of 1 model(s)
```

## Lưu ý (Notes)

- Các model lớn có thể mất nhiều thời gian để tải
- Đảm bảo có đủ dung lượng ổ đĩa trước khi tải
- **QUAN TRỌNG:** Đảm bảo URL model là công khai và không yêu cầu xác thực
- **IMPORTANT:** Make sure the model URL is publicly accessible and doesn't require authentication
- Tìm model pixel art thực tế trên Hugging Face với từ khóa phù hợp
- Script có thể được tích hợp vào CI/CD pipeline

## Tùy chỉnh (Customization)

### Tìm model pixel art ONNX (Finding pixel art ONNX models):

1. Truy cập https://huggingface.co/models
2. Tìm kiếm với từ khóa: "pixel art onnx", "stable diffusion onnx", "controlnet onnx"
3. Mở trang model và tìm file .onnx trong tab "Files and versions"
4. Click chuột phải vào file .onnx và copy URL
5. Sử dụng URL đó với tùy chọn "Custom URL" trong script

### Thêm model vào danh sách (Adding models to the list):

Để thêm model mới vào danh sách mặc định, chỉnh sửa mảng `PIXEL_ART_MODELS` trong file `download_model_onnx.js`:

```javascript
const PIXEL_ART_MODELS = [
  {
    name: 'Your Model Name',
    url: 'https://huggingface.co/username/model-name/resolve/main/model.onnx',
    filename: 'output-filename.onnx',
    size: '~100MB',
    description: 'Model description'
  },
  // ...
];
```

**Lưu ý:** Chỉ thêm những model có URL công khai, không yêu cầu authentication.

## Troubleshooting

### HTTP 401 hoặc 403 errors:
- Model yêu cầu authentication hoặc không công khai
- Tìm model khác có quyền truy cập công khai
- Hoặc download model thủ công và copy vào thư mục `public/assets/models`

### Lỗi kết nối (Connection errors):
- Kiểm tra kết nối Internet
- Đảm bảo URL Hugging Face còn hoạt động
- Thử lại sau vài phút nếu server Hugging Face bận

### File không tải được (Download fails):
- Kiểm tra quyền ghi trong thư mục `public/assets/models`
- Đảm bảo có đủ dung lượng ổ đĩa
- Kiểm tra firewall không chặn kết nối

### Model không hoạt động (Model doesn't work):
- Xác nhận file đã tải đầy đủ (kiểm tra kích thước)
- Đảm bảo model tương thích với onnxruntime-web
- Kiểm tra format và input/output của model

## License

MIT
