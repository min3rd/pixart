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

1. **epiCPhotoGasm (Artistic ONNX Model)** (~1.5GB)
   - Model sinh ảnh nghệ thuật chất lượng cao
   - Có thể điều chỉnh cho pixel art generation

2. **ControlNet Pixel Art (ONNX)** (~200MB)
   - Model ControlNet chuyên về pixel art style transfer
   - Cân bằng giữa chất lượng và kích thước

3. **Waifu Diffusion U-Net (ONNX)** (~1.7GB)
   - Model diffusion phong cách anime, thành phần U-Net
   - Phù hợp cho stylized art generation

4. **MobileNet v3 Small (ONNX)** (~10MB)
   - Model nhẹ cho feature extraction
   - Model cơ bản, cần fine-tuning cho pixel art

5. **Custom URL**
   - Nhập URL Hugging Face tùy chỉnh
   - Linh hoạt cho các model khác

## Tính năng (Features)

- ✅ Tìm kiếm và liệt kê các model pixel art từ Hugging Face
- ✅ Cho phép chọn và tải nhiều model
- ✅ Hỗ trợ custom URL cho model không có sẵn trong danh sách
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

This script downloads ONNX models from Hugging Face
for pixel art generation.

Target directory: /path/to/public/assets/models


=== Available Pixel Art ONNX Models ===

1. Stable Diffusion 1.5 (ONNX) - Pixel Art Fine-tuned
   Size: ~1.5GB
   Description: Fine-tuned Stable Diffusion model for pixel art generation
   URL: https://huggingface.co/...

...

Select a model (1-5) or "q" to quit: 4

Add another model? (y/n): n

[INFO] Preparing to download 1 model(s)...

[START] Downloading "MobileNet Pixel Art Generator (ONNX)" to "mobilenet-pixel-art.onnx"
[INFO] Starting download from: https://huggingface.co/...
[PROGRESS] 5% - 512.5 KB / 10 MB
[PROGRESS] 10% - 1 MB / 10 MB
...
[PROGRESS] 100% - 10 MB / 10 MB
[SUCCESS] Download completed: 10 MB
[DONE] Model saved to: /path/to/public/assets/models/mobilenet-pixel-art.onnx

[SUMMARY] Downloaded 1 out of 1 model(s)
```

## Lưu ý (Notes)

- Các model lớn có thể mất nhiều thời gian để tải
- Đảm bảo có đủ dung lượng ổ đĩa trước khi tải
- Một số URL có thể thay đổi, cập nhật trong source code nếu cần
- Script có thể được tích hợp vào CI/CD pipeline

## Tùy chỉnh (Customization)

Để thêm model mới vào danh sách, chỉnh sửa mảng `PIXEL_ART_MODELS` trong file `download_model_onnx.js`:

```javascript
const PIXEL_ART_MODELS = [
  {
    name: 'Your Model Name',
    url: 'https://huggingface.co/path/to/model.onnx',
    filename: 'output-filename.onnx',
    size: '~100MB',
    description: 'Model description'
  },
  // ...
];
```

## Troubleshooting

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
