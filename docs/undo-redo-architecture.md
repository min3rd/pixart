# Signal-based Undo/Redo System

## Tổng quan (Overview)

Hệ thống undo/redo đã được chuyển sang kiến trúc dựa trên Angular signals, đảm bảo tính nhất quán và tự động hóa việc tạo snapshot cho mọi thay đổi dữ liệu dự án.

The undo/redo system has been migrated to an Angular signals-based architecture, ensuring consistency and automating snapshot creation for all project data changes.

## Kiến trúc (Architecture)

### 1. EditorProjectStateService

Service chính quản lý trạng thái dự án thông qua Angular signals.

Main service managing the project state through Angular signals.

**Đặc điểm chính (Key features):**

- Sử dụng Angular `signal` để quản lý trạng thái dự án hiện tại
- Tự động tạo snapshot mỗi khi gọi `setState()`
- Tích hợp với `EditorHistoryService` để lưu lịch sử undo/redo

**Core methods:**

```typescript
setState(snapshot: ProjectSnapshot, description?: string): void
getCurrentState(): ProjectSnapshot | null
```

### 2. Luồng dữ liệu (Data Flow)

```
User Action
    ↓
EditorDocumentService (or other services)
    ↓
captureProjectSnapshot()
    ↓
EditorProjectStateService.setState()
    ↓
Signal Update + pushSnapshot()
    ↓
EditorHistoryService.pushSnapshot()
    ↓
Undo/Redo Stack
```

### 3. Automatic Snapshot Mechanism

Snapshot tự động được tạo trong `setState()`:

```typescript
setState(snapshot: ProjectSnapshot, description?: string) {
  this.projectState.set(snapshot);
  this.historyService.pushSnapshot(snapshot, description);
}
```

**Ưu điểm (Benefits):**
1. Signal-based state management theo Angular best practices
2. Snapshot tự động tạo mỗi khi state thay đổi
3. Đơn giản, dễ test, không cần RxJS subscriptions
4. Không có memory leaks (signals tự động cleanup)

## Sử dụng (Usage)

### Tạo snapshot cho thao tác

Mọi thao tác thay đổi dữ liệu đều cần gọi `saveSnapshot()`:

```typescript
setCanvasSize(width: number, height: number) {
  this.saveSnapshot('Resize canvas');
  this.canvasState.setCanvasSize(width, height);
  // ... other updates
  this.canvasState.incrementPixelsVersion();
}
```

### Undo/Redo

```typescript
undo() {
  if (!this.canUndo()) return false;
  const currentState = this.captureProjectSnapshot();
  const entry = this.historyService.popUndo();
  if (!entry) return false;
  this.historyService.pushToRedoStack(currentState);
  this.restoreSnapshot(entry.snapshot);
  this.canvasState.setCanvasSaved(false);
  return true;
}

redo() {
  if (!this.canRedo()) return false;
  const currentState = this.captureProjectSnapshot();
  const entry = this.historyService.popRedo();
  if (!entry) return false;
  this.historyService.pushToUndoStack(currentState);
  this.restoreSnapshot(entry.snapshot);
  this.canvasState.setCanvasSaved(false);
  return true;
}
```

## Lợi ích (Benefits)

1. **Tập trung hóa (Centralized)**: Mọi snapshot đều đi qua một pipeline duy nhất
2. **Tự động hóa (Automated)**: Không cần logic snapshot thủ công ở mỗi service
3. **Reactive**: Dễ dàng mở rộng với các side-effects khác (logging, analytics, etc.)
4. **Testable**: Dễ kiểm tra và unit test với Observable streams
5. **Nhất quán (Consistent)**: Đảm bảo mọi thay đổi đều được ghi lại

## Testing

Các test cases bao gồm:

- Kiểm tra Observable stream emit đúng dữ liệu
- Kiểm tra tự động tạo snapshot qua history service
- Kiểm tra tích hợp undo/redo với các thao tác layer, canvas, selection
- Kiểm tra trạng thái hiện tại được lưu đúng

Xem chi tiết trong:
- `editor-project-state.service.spec.ts`
- `editor-document.service.spec.ts`

## Migration Notes

Các thay đổi chính so với hệ thống cũ:

1. `EditorProjectStateService` là service mới quản lý luồng Observable
2. `EditorDocumentService.saveSnapshot()` giờ gọi `projectStateService.emitStateChange()`
3. Không còn gọi trực tiếp `historyService.pushSnapshot()` ngoài pipeline
4. Mọi thao tác đã được migrate sang luồng mới

## Future Enhancements

Các cải tiến có thể thực hiện:

1. Debounce/throttle cho các thao tác liên tục (như drawing)
2. Compression cho snapshots lớn
3. Persistent storage cho history (IndexedDB)
4. Undo/redo groups cho batch operations
5. Time-travel debugging với replay actions
