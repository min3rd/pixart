export type LogActionCategory =
  | 'file'
  | 'layer'
  | 'drawing'
  | 'selection'
  | 'history'
  | 'canvas'
  | 'frame'
  | 'animation'
  | 'tool'
  | 'keyboard'
  | 'transform'
  | 'color'
  | 'clipboard'
  | 'export'
  | 'bone'
  | 'keyframe'
  | 'system';

export type LogActionStatus = 'success' | 'failure' | 'pending';

export interface LogContext {
  selectedLayerId?: string | null;
  selectedLayerIds?: string[];
  activeTool?: string;
  currentFrameIndex?: number;
  currentAnimationIndex?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  selectedBoneId?: string | null;
  [key: string]: unknown;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  userId: string;
  category: LogActionCategory;
  action: string;
  description?: string;
  parameters?: Record<string, unknown>;
  status: LogActionStatus;
  duration?: number;
  context?: LogContext;
  error?: string;
}

export interface LogSession {
  id: string;
  startTime: string;
  endTime?: string;
  userAgent: string;
  userId: string;
}

export interface LogQueryOptions {
  sessionId?: string;
  category?: LogActionCategory;
  action?: string;
  status?: LogActionStatus;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface LogExportData {
  version: string;
  exportTime: string;
  sessions: LogSession[];
  entries: LogEntry[];
}

export interface LogStorageInfo {
  totalEntries: number;
  totalSessions: number;
  oldestEntry?: string;
  newestEntry?: string;
  estimatedSize: number;
}
