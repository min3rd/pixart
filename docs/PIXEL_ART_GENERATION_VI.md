# Pixel Art Generation Engine - Tài liệu Tiếng Việt

## Tổng quan

Engine tạo hình ảnh pixel từ phác họa và prompt chạy **hoàn toàn trong ứng dụng** (không cần server bên ngoài). Người dùng vẽ phác họa trên canvas, nhập mô tả bằng text, và engine sẽ tự động tạo ra pixel art.

## Kiến trúc

### Services (src/app/services/pixel-generation/)

#### 1. Models (`pixel-generation-models.ts`)
Định nghĩa các kiểu dữ liệu và cấu hình:

- **5 phong cách pixel art**:
  - `retro-8bit`: 8 màu, phong cách NES cổ điển
  - `retro-16bit`: 16 màu, phong cách SNES
  - `pixel-modern`: 32 màu, pixel art hiện đại
  - `low-res`: 4 màu, độ phân giải thấp
  - `high-detail`: 64 màu, chi tiết cao

#### 2. Engine Service (`pixel-generation-engine.service.ts`)
Service điều phối chính:

- Quản lý các job xử lý
- Chuyển đổi giữa các định dạng ảnh (ImageData ↔ layer buffer ↔ canvas)
- Gọi local processor để xử lý
- Theo dõi trạng thái job

#### 3. Local Processing Service (`pixel-generation-local.service.ts`) 
Engine xử lý ảnh chính với các thuật toán:

**Color Quantization (Giảm màu)**:
- Tìm màu gần nhất trong bảng màu bằng khoảng cách Euclidean trong không gian RGB
- Áp dụng cho từng pixel

**Floyd-Steinberg Dithering**:
- Phân tán lỗi màu sắc sang pixel liên kề
- Tạo ảo giác nhiều màu hơn thực tế
- Tỷ lệ phân tán: phải (7/16), dưới trái (3/16), dưới (5/16), dưới phải (1/16)

**Edge Enhancement (Làm nét cạnh)**:
- Áp dụng kernel sharpening 3x3
- Làm nổi bật đường viền pixel

**Contrast Adjustment (Điều chỉnh độ tương phản)**:
- Tăng/giảm độ tương phản theo style
- Công thức: `(value - 128) * factor + 128`

### UI Components

**Pixel Art Generation Dialog** (`src/app/shared/components/pixel-art-generation-dialog/`)

Giao diện người dùng bao gồm:
- Input prompt (mô tả text)
- Chọn kích thước (width x height)
- Chọn phong cách (dropdown 5 styles)
- Progress bar hiển thị tiến độ
- Preview kết quả với metadata
- Nút "Thêm vào layer mới" / "Thay thế layer hiện tại"

## Quy trình sử dụng

### Bước 1: Vẽ phác họa
Người dùng vẽ phác họa cơ bản trên layer hiện tại bằng các tool vẽ.

### Bước 2: Mở dialog
Chọn "Generate Pixel Art from Sketch" từ menu Insert (hoặc Ctrl+Shift+G).

### Bước 3: Nhập thông tin
- **Prompt**: Mô tả những gì muốn tạo (VD: "một cái cây nhỏ với lá xanh")
- **Width/Height**: Kích thước mong muốn (16-512 pixels)
- **Style**: Chọn một trong 5 phong cách
- Tick "Use current layer as sketch" để dùng layer hiện tại

### Bước 4: Tạo ảnh
Click "Generate" và chờ xử lý (thường < 1 giây cho sprite nhỏ).

### Bước 5: Xem kết quả
- Xem metadata: số màu đã dùng, thời gian xử lý
- Chọn "Add to New Layer" để thêm layer mới
- Hoặc "Replace Current Layer" để thay thế layer hiện tại

## Chi tiết kỹ thuật

### Performance

**Thời gian xử lý (ước tính)**:
- 32x32 pixels: ~100-200ms
- 64x64 pixels: ~200-400ms  
- 128x128 pixels: ~400-800ms
- 256x256 pixels: ~1-2 giây

**Bộ nhớ sử dụng**:
- ImageData: 4 bytes/pixel
- 64x64 = ~16KB
- 256x256 = ~256KB

### Bảng màu mặc định

**retro-8bit** (8 màu):
```
#000000, #1d2b53, #7e2553, #008751
#ab5236, #5f574f, #c2c3c7, #fff1e8
```

**retro-16bit** (16 màu):
8 màu retro-8bit + 8 màu bổ sung

**pixel-modern** (32 màu):
Bảng màu rộng hơn cho pixel art hiện đại

**low-res** (4 màu):
```
#000000, #555555, #aaaaaa, #ffffff
```

**high-detail** (64 màu):
Gradient 4x4x4 trong không gian RGB

### Định dạng ảnh hỗ trợ

**ImageData**: 
- Định dạng chuẩn của Canvas API
- Mảng RGBA (4 bytes/pixel)

**Layer Buffer**:
- Mảng string[] chứa mã màu hex
- Format: `["#ff0000", "#00ff00", ...]`
- Độ dài: `width * height`

**Canvas**:
- HTMLCanvasElement
- Chuyển qua ImageData để xử lý

## Internationalization

Hỗ trợ 2 ngôn ngữ:
- **English** (en): `public/i18n/en.json`
- **Vietnamese** (vi): `public/i18n/vi.json`

Tất cả text trong UI đều dùng Transloco keys, không hard-code.

## Các file liên quan

### Source Code
```
src/app/services/pixel-generation/
├── pixel-generation-models.ts          (1,815 bytes)
├── pixel-generation-engine.service.ts  (6,500 bytes)
├── pixel-generation-local.service.ts   (10,722 bytes)
├── index.ts                            (192 bytes)
└── README.md                           (7,836 bytes)

src/app/shared/components/pixel-art-generation-dialog/
├── pixel-art-generation-dialog.component.ts    (5,200 bytes)
├── pixel-art-generation-dialog.component.html  (9,311 bytes)
└── pixel-art-generation-dialog.component.css   (161 bytes)
```

### Documentation
```
docs/
├── PIXEL_ART_GENERATION.md    (10,475 bytes)
└── API_SERVER_EXAMPLE.md      (13,394 bytes - deprecated)

PIXEL_ART_GENERATION_VI.md     (file này)
```

### Translations
```
public/i18n/
├── en.json  (section pixelGeneration)
└── vi.json  (section pixelGeneration)
```

## Tích hợp vào Editor

### Bước 1: Import dialog vào editor component

```typescript
import { PixelArtGenerationDialog } from './shared/components/pixel-art-generation-dialog';

@Component({
  // ...
  imports: [
    // ...
    PixelArtGenerationDialog,
  ],
})
export class EditorPage {
  // ...
}
```

### Bước 2: Thêm vào template

```html
<pa-pixel-art-generation-dialog
  #pixelArtDialog
  (confirmed)="onPixelArtGenerated($event)"
  (cancelled)="onPixelArtCancelled()"
/>
```

### Bước 3: Thêm vào menu Insert

```typescript
openPixelArtDialog() {
  this.pixelArtDialog.open();
}
```

### Bước 4: Xử lý kết quả

```typescript
async onPixelArtGenerated(result: PixelArtGenerationResult) {
  const layerBuffer = await this.pixelEngine.getResultAsLayerBuffer(
    result.jobId,
    this.canvasWidth,
    this.canvasHeight
  );
  
  if (!layerBuffer) return;
  
  if (result.addToNewLayer) {
    this.editorDoc.addLayer('Generated Pixel Art', layerBuffer);
  } else {
    // Replace current layer
    const selectedLayer = this.editorDoc.selectedLayer();
    if (selectedLayer && !isGroup(selectedLayer)) {
      this.editorDoc.updateLayerBuffer(selectedLayer.id, layerBuffer);
    }
  }
}

onPixelArtCancelled() {
  // User cancelled, do nothing
}
```

### Bước 5: Đăng ký hotkey (optional)

```typescript
// In hotkeys service registration
this.hotkeys.register({
  id: 'insert.pixelArt',
  category: 'insert',
  defaultKey: 'Ctrl+Shift+G',
  handler: () => this.openPixelArtDialog()
});
```

## Ví dụ sử dụng

### Ví dụ 1: Tạo sprite cây
```
Prompt: "một cái cây nhỏ với lá xanh và thân màu nâu"
Style: pixel-modern
Size: 32x32
Result: Sprite cây với lá xanh, thân nâu, phong cách pixel art hiện đại
```

### Ví dụ 2: Character sprite retro
```
Prompt: "nhân vật game retro, tóc đen, áo đỏ"
Style: retro-8bit
Size: 16x16
Result: Character sprite phong cách NES 8-bit
```

### Ví dụ 3: Icon đơn giản
```
Prompt: "icon ngôi nhà đơn giản"
Style: low-res
Size: 24x24
Result: Icon nhà 4 màu, rất đơn giản
```

## Troubleshooting (Xử lý lỗi)

### Lỗi: "No layer selected"
**Nguyên nhân**: Chưa chọn layer để làm phác họa.
**Giải pháp**: Chọn một layer trong panel Layers.

### Lỗi: "Empty layer"  
**Nguyên nhân**: Layer đã chọn không có pixel nào.
**Giải pháp**: Vẽ phác họa trước khi generate.

### Kết quả không như mong muốn
**Nguyên nhân**: Prompt không rõ ràng hoặc phác họa chưa tốt.
**Giải pháp**:
- Viết prompt chi tiết hơn
- Vẽ phác họa rõ ràng hơn
- Thử style khác
- Điều chỉnh kích thước

### Xử lý chậm
**Nguyên nhân**: Kích thước ảnh quá lớn.
**Giải pháp**:
- Giảm kích thước xuống (64x64 thay vì 256x256)
- Dùng style đơn giản hơn (low-res thay vì high-detail)

## Best Practices (Cách dùng tốt nhất)

### Phác họa
- Vẽ đơn giản, rõ ràng
- Sử dụng màu tương phản
- Tập trung vào hình dạng chính

### Prompt
- Mô tả ngắn gọn, rõ ràng
- Nêu màu sắc mong muốn
- Đề cập phong cách nếu có

### Kích thước
- Sprite nhỏ: 16x16, 24x24, 32x32
- Sprite vừa: 48x48, 64x64
- Sprite lớn: 96x96, 128x128
- Illustration: 256x256+

### Phong cách
- Game retro → retro-8bit hoặc retro-16bit
- Pixel art hiện đại → pixel-modern
- Icon đơn giản → low-res
- Chi tiết cao → high-detail

## Hạn chế hiện tại

1. **Không có AI thật**: Chỉ xử lý ảnh cơ bản, không có học máy
2. **Prompt chỉ gợi ý màu**: Không phân tích ngữ nghĩa sâu
3. **Phụ thuộc phác họa**: Cần phác họa tốt để kết quả đẹp
4. **Chậm với ảnh lớn**: >128x128 có thể mất vài giây

## Phát triển tương lai

### Gần
- Tích hợp vào editor menu ✅
- Keyboard shortcut
- Unit tests

### Trung hạn
- Web Workers (xử lý background)
- WebGL acceleration
- Cache kết quả
- Custom palette từ ảnh tham khảo

### Dài hạn
- Tích hợp AI model (Stable Diffusion + ControlNet)
- Tạo animation frames
- Batch processing nhiều layers
- Export sprite sheet

## Liên hệ & Hỗ trợ

- **GitHub**: https://github.com/min3rd/pixart
- **Issues**: https://github.com/min3rd/pixart/issues
- **Email**: min6th@gmail.com

## License

MIT License - Xem LICENSE file trong repository.
