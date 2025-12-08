import { Injectable, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  LogEntry,
  LogActionCategory,
  LogActionStatus,
  LogContext,
  LogSession,
} from './log.types';
import { LogStorageService } from './log-storage.service';
import { LogQueryService } from './log-query.service';
import { LogExportService } from './log-export.service';

@Injectable({ providedIn: 'root' })
export class LogService implements OnDestroy {
  private readonly storage = inject(LogStorageService);
  private readonly queryService = inject(LogQueryService);
  private readonly exportService = inject(LogExportService);

  private readonly currentSession = signal<LogSession | null>(null);
  private readonly inMemoryLogs = signal<LogEntry[]>([]);
  private readonly IN_MEMORY_LIMIT = 100;

  readonly sessionId = computed(() => this.currentSession()?.id ?? '');
  readonly recentLogs = computed(() => this.inMemoryLogs());
  readonly storageInfo = this.storage.storageInfo;

  private userId = 'anonymous';
  private logCounter = 0;
  private beforeUnloadHandler?: () => void;

  constructor() {
    this.initializeSession();
  }

  ngOnDestroy(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    this.endSession();
  }

  setUserId(userId: string): void {
    this.userId = userId;
    const session = this.currentSession();
    if (session) {
      session.userId = userId;
      this.storage.saveSession(session);
    }
  }

  log(
    category: LogActionCategory,
    action: string,
    options?: {
      description?: string;
      parameters?: Record<string, unknown>;
      status?: LogActionStatus;
      duration?: number;
      context?: LogContext;
      error?: string;
    },
  ): void {
    const entry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId(),
      userId: this.userId,
      category,
      action,
      description: options?.description,
      parameters: this.sanitizeParameters(options?.parameters),
      status: options?.status ?? 'success',
      duration: options?.duration,
      context: options?.context,
      error: options?.error,
    };

    this.storage.saveEntry(entry);

    this.inMemoryLogs.update((logs) => {
      const updated = [entry, ...logs];
      return updated.slice(0, this.IN_MEMORY_LIMIT);
    });
  }

  logAsync<T>(
    category: LogActionCategory,
    action: string,
    fn: () => Promise<T>,
    options?: {
      description?: string;
      parameters?: Record<string, unknown>;
      context?: LogContext;
    },
  ): Promise<T> {
    const startTime = performance.now();
    return fn()
      .then((result) => {
        const duration = Math.round(performance.now() - startTime);
        this.log(category, action, {
          ...options,
          status: 'success',
          duration,
        });
        return result;
      })
      .catch((error) => {
        const duration = Math.round(performance.now() - startTime);
        this.log(category, action, {
          ...options,
          status: 'failure',
          duration,
          error: error?.message || String(error),
        });
        throw error;
      });
  }

  logSync<T>(
    category: LogActionCategory,
    action: string,
    fn: () => T,
    options?: {
      description?: string;
      parameters?: Record<string, unknown>;
      context?: LogContext;
    },
  ): T {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = Math.round(performance.now() - startTime);
      this.log(category, action, {
        ...options,
        status: 'success',
        duration,
      });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.log(category, action, {
        ...options,
        status: 'failure',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  query = this.queryService.query.bind(this.queryService);
  getRecentLogs = this.queryService.getRecentLogs.bind(this.queryService);
  getSessionLogs = this.queryService.getSessionLogs.bind(this.queryService);
  getLogsByCategory = this.queryService.getLogsByCategory.bind(
    this.queryService,
  );
  getLogsByTimeRange = this.queryService.getLogsByTimeRange.bind(
    this.queryService,
  );
  getFailedLogs = this.queryService.getFailedLogs.bind(this.queryService);
  searchLogs = this.queryService.searchLogs.bind(this.queryService);
  getLogStats = this.queryService.getLogStats.bind(this.queryService);

  exportLogsAsJson = this.exportService.exportLogsAsJson.bind(
    this.exportService,
  );
  downloadLogsAsFile = this.exportService.downloadLogsAsFile.bind(
    this.exportService,
  );
  exportSessionLogs = this.exportService.exportSessionLogs.bind(
    this.exportService,
  );
  importLogs = this.exportService.importLogs.bind(this.exportService);

  clearAllLogs = this.storage.clearAllLogs.bind(this.storage);
  clearOldLogs = this.storage.clearOldLogs.bind(this.storage);

  endSession(): void {
    const session = this.currentSession();
    if (session && !session.endTime) {
      session.endTime = new Date().toISOString();
      this.storage.saveSession(session);
    }
  }

  private initializeSession(): void {
    const sessionId = this.generateSessionId();
    const session: LogSession = {
      id: sessionId,
      startTime: new Date().toISOString(),
      userAgent: navigator.userAgent,
      userId: this.userId,
    };
    this.currentSession.set(session);
    this.storage.saveSession(session);

    this.log('system', 'session_start', {
      description: 'New session started',
    });

    this.beforeUnloadHandler = () => {
      this.endSession();
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateLogId(): string {
    this.logCounter++;
    return `log_${Date.now()}_${this.logCounter}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private sanitizeParameters(
    params?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!params) return undefined;

    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'apikey',
      'api_key',
      'auth',
      'authorization',
    ];

    for (const [key, value] of Object.entries(params)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
