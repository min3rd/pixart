# PixArt Logging System

A comprehensive logging system for tracking all user actions in the PixArt editor.

## Overview

The logging system captures all user operations including file operations, layer management, drawing, selections, undo/redo, canvas operations, frames, animations, keyboard shortcuts, and tool changes.

## Architecture

### Core Services

- **LogService** - Main service providing logging API
- **LogStorageService** - Manages localStorage with automatic cleanup
- **LogQueryService** - Provides filtering and querying capabilities
- **LogExportService** - Handles export/import of logs as JSON

### Log Format

Each log entry includes:
- `id` - Unique identifier
- `timestamp` - ISO 8601 timestamp
- `sessionId` - Unique session identifier
- `userId` - User identifier (default: "anonymous")
- `category` - Action category (file, layer, drawing, selection, etc.)
- `action` - Specific action name
- `description` - Optional description
- `parameters` - Action parameters (sensitive data redacted)
- `status` - success | failure | pending
- `duration` - Optional duration in milliseconds
- `context` - Current editor state context
- `error` - Optional error message

## Usage

### Basic Logging

```typescript
import { LogService } from './services/logging';

class MyService {
  private readonly logService = inject(LogService);

  myAction() {
    this.logService.log('file', 'create_project', {
      parameters: { projectId: 'proj-123', name: 'My Project' },
      status: 'success',
    });
  }
}
```

### Tracking Operation Duration

```typescript
// Async operation
await this.logService.logAsync('file', 'save_project', 
  async () => {
    return await this.saveToFile();
  },
  { parameters: { projectId: 'proj-123' } }
);

// Sync operation
const result = this.logService.logSync('layer', 'add_layer',
  () => {
    return this.createLayer();
  },
  { parameters: { layerName: 'New Layer' } }
);
```

### Querying Logs

```typescript
// Get recent logs
const recent = this.logService.getRecentLogs(50);

// Filter by category
const fileLogs = this.logService.getLogsByCategory('file');

// Filter by session
const sessionLogs = this.logService.getSessionLogs('session-id');

// Get failed operations
const failures = this.logService.getFailedLogs();

// Search logs
const results = this.logService.searchLogs('layer');

// Advanced query
const filtered = this.logService.query({
  category: 'file',
  startTime: '2025-12-01T00:00:00Z',
  endTime: '2025-12-08T23:59:59Z',
  status: 'success',
  limit: 100,
});
```

### Exporting Logs

```typescript
// Export as JSON object
const data = this.logService.exportLogsAsJson();

// Download as file
this.logService.downloadLogsAsFile();

// Export specific session
const sessionData = this.logService.exportSessionLogs('session-id');
```

### Storage Management

```typescript
// Clear all logs
this.logService.clearAllLogs();

// Clear logs older than N days
this.logService.clearOldLogs(30);

// Get storage info
const info = this.logService.storageInfo();
console.log(info.totalEntries, info.estimatedSize);
```

## Integration Points

The logging system is integrated into:

- **EditorLayerService** - Layer operations
- **FileService** - File operations
- **EditorHistoryService** - Undo/redo
- **EditorToolsService** - Tool selection
- **HotkeysService** - Keyboard shortcuts
- **EditorSelectionService** - Selections
- **EditorFrameService** - Frame operations

## Features

✅ Session management with unique IDs per browser session  
✅ Automatic sensitive data redaction (passwords, tokens, API keys)  
✅ localStorage with automatic size management and cleanup  
✅ In-memory cache for recent logs (performance optimization)  
✅ Query/filter API with multiple criteria  
✅ Export/import as JSON  
✅ Structured for action replay capability  
✅ Async/sync operation helpers with automatic duration tracking  
✅ Non-intrusive integration (no impact on existing functionality)  

## Storage Management

The system automatically manages localStorage space:

- **Max Storage Size**: 5 MB
- **Cleanup Threshold**: 90% of max size
- **Target Size After Cleanup**: 70% of max size
- **Strategy**: Removes oldest entries first

## Security

Sensitive data is automatically redacted from log parameters:
- Passwords
- Tokens
- API keys
- Secrets
- Authorization headers

These values are replaced with `[REDACTED]` in the logs.

## Testing

Run unit tests:
```bash
npm test -- --include='**/log.service.spec.ts'
```

All tests include:
- Service initialization
- Session management
- Basic logging
- Sensitive data sanitization
- Success/failure tracking
- Query filtering
- Export functionality
- Storage cleanup
