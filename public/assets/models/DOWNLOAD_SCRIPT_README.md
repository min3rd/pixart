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

**📝 Lưu ý:** Danh sách dưới đây chỉ là ví dụ. Để tìm model pixel art ONNX thực tế, hãy:
1. Tìm kiếm trên Hugging Face với từ khóa: "pixel art onnx", "stable diffusion onnx", "controlnet onnx"
2. Kiểm tra model có file .onnx công khai không
3. Sử dụng tùy chọn "Custom URL" để tải model bạn chọn

**NOTE:** The list below contains example models. To find actual pixel art ONNX models:
1. Search Hugging Face for: "pixel art onnx", "stable diffusion onnx", "controlnet onnx"
2. Verify the model has publicly accessible .onnx files
3. Use the "Custom URL" option to download your chosen model

1. **Example: ONNX Community ResNet-50** (~100MB)
   - Model ví dụ - ResNet-50 cho phân loại ảnh
   - Công khai và có thể truy cập (chỉ để test script)

2. **Example: ONNX Community MobileNet v3 Small** (~10MB)
   - Model ví dụ nhẹ để kiểm tra
   - Công khai và có thể truy cập (chỉ để test script)

3. **Custom URL - For Your Pixel Art Model**
   - Nhập URL Hugging Face hoặc link download trực tiếp
   - Sử dụng option này cho model pixel art thực tế của bạn

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

📝 NOTE: The pre-configured models are examples.
   For pixel art models, search Hugging Face for:
   - "pixel art onnx"
   - "stable diffusion onnx pixel"
   - "controlnet onnx"
   Then use the "Custom URL" option to download your chosen model.

💡 TIP: Make sure the model URL ends with .onnx and is publicly accessible.


=== Available Pixel Art ONNX Models ===

1. Example: ONNX Community ResNet-50
   Size: ~100MB
   Description: Example model - ResNet-50 for image classification
   URL: https://huggingface.co/...

2. Example: ONNX Community MobileNet v3 Small
   Size: ~10MB
   Description: Example lightweight model for testing
   URL: https://huggingface.co/...

3. Custom URL - For Your Pixel Art Model
   Size: Unknown
   Description: Enter your own Hugging Face model URL

Select a model (1-3) or "q" to quit: 3

Enter the Hugging Face model URL: https://huggingface.co/your-model/resolve/main/model.onnx
Enter the output filename (e.g., my-model.onnx): my-pixel-art.onnx

Add another model? (y/n): n

[INFO] Preparing to download 1 model(s)...

[START] Downloading "Custom Model" to "my-pixel-art.onnx"
[INFO] Starting download from: https://huggingface.co/your-model/resolve/main/model.onnx
[PROGRESS] 5% - 5 MB / 100 MB
[PROGRESS] 10% - 10 MB / 100 MB
...
[PROGRESS] 100% - 100 MB / 100 MB
[SUCCESS] Download completed: 100 MB
[DONE] Model saved to: /path/to/public/assets/models/my-pixel-art.onnx

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
