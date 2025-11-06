# Observable-based Undo/Redo System

## Tổng quan (Overview)

Hệ thống undo/redo đã được chuyển sang kiến trúc dựa trên Observable streams (RxJS), đảm bảo tính nhất quán và tự động hóa việc tạo snapshot cho mọi thay đổi dữ liệu dự án.

The undo/redo system has been migrated to an Observable streams-based architecture (RxJS), ensuring consistency and automating snapshot creation for all project data changes.

## Kiến trúc (Architecture)

### 1. EditorProjectStateService

Service chính quản lý luồng trạng thái dự án thông qua Observable stream.

Main service managing the project state flow through Observable stream.

**Đặc điểm chính (Key features):**

- Sử dụng `BehaviorSubject` để quản lý trạng thái dự án hiện tại
- Tự động tạo snapshot mỗi khi có thay đổi qua RxJS pipe
- Tích hợp với `EditorHistoryService` để lưu lịch sử undo/redo

**Core methods:**

```typescript
emitStateChange(snapshot: ProjectSnapshot, description?: string): void
getCurrentState(): ProjectStateChange | null
```

### 2. Luồng dữ liệu (Data Flow)

```
User Action
    ↓
EditorDocumentService (or other services)
    ↓
captureProjectSnapshot()
    ↓
EditorProjectStateService.emitStateChange()
    ↓
Observable Stream (projectState$)
    ↓
RxJS Pipe (distinctUntilChanged, tap)
    ↓
EditorHistoryService.pushSnapshot()
    ↓
Undo/Redo Stack
```

### 3. Automatic Snapshot Pipeline

Pipeline RxJS tự động xử lý snapshot:

```typescript
this.projectState$
  .pipe(
    skip(1),
    distinctUntilChanged((prev, curr) => {
      if (!prev || !curr) return prev === curr;
      return prev.timestamp === curr.timestamp;
    }),
    tap((change) => {
      if (change && change.snapshot) {
        this.historyService.pushSnapshot(change.snapshot, change.description);
      }
    })
  )
  .subscribe();
```

**Các bước xử lý (Processing steps):**
1. `skip(1)`: Bỏ qua giá trị khởi tạo ban đầu
2. `distinctUntilChanged`: Chỉ xử lý khi có thay đổi thực sự (dựa trên timestamp)
3. `tap`: Tự động gọi `pushSnapshot` để lưu vào undo stack

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
