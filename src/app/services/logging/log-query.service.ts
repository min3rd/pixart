import { Injectable, inject } from '@angular/core';
import { LogEntry, LogQueryOptions } from './log.types';
import { LogStorageService } from './log-storage.service';

@Injectable({ providedIn: 'root' })
export class LogQueryService {
  private readonly storage = inject(LogStorageService);

  query(options: LogQueryOptions = {}): LogEntry[] {
    let entries = this.storage.loadEntries();

    if (options.sessionId) {
      entries = entries.filter((e) => e.sessionId === options.sessionId);
    }

    if (options.category) {
      entries = entries.filter((e) => e.category === options.category);
    }

    if (options.action) {
      entries = entries.filter((e) => e.action === options.action);
    }

    if (options.status) {
      entries = entries.filter((e) => e.status === options.status);
    }

    if (options.startTime) {
      entries = entries.filter((e) => e.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      entries = entries.filter((e) => e.timestamp <= options.endTime!);
    }

    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const offset = options.offset ?? 0;
    const limit = options.limit ?? entries.length;

    return entries.slice(offset, offset + limit);
  }

  getRecentLogs(limit = 50): LogEntry[] {
    return this.query({ limit });
  }

  getSessionLogs(sessionId: string): LogEntry[] {
    return this.query({ sessionId });
  }

  getLogsByCategory(category: string, limit = 100): LogEntry[] {
    const entries = this.storage.loadEntries();
    return entries
      .filter((e) => e.category === category)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  getLogsByTimeRange(startTime: string, endTime: string): LogEntry[] {
    return this.query({ startTime, endTime });
  }

  getFailedLogs(limit = 50): LogEntry[] {
    return this.query({ status: 'failure', limit });
  }

  searchLogs(searchTerm: string, limit = 100): LogEntry[] {
    const entries = this.storage.loadEntries();
    const lowerSearch = searchTerm.toLowerCase();

    return entries
      .filter(
        (e) =>
          e.action.toLowerCase().includes(lowerSearch) ||
          e.description?.toLowerCase().includes(lowerSearch) ||
          e.category.toLowerCase().includes(lowerSearch),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  getLogStats() {
    const entries = this.storage.loadEntries();

    const categoryCount = new Map<string, number>();
    const actionCount = new Map<string, number>();
    const statusCount = new Map<string, number>();

    entries.forEach((entry) => {
      categoryCount.set(
        entry.category,
        (categoryCount.get(entry.category) || 0) + 1,
      );
      actionCount.set(entry.action, (actionCount.get(entry.action) || 0) + 1);
      statusCount.set(entry.status, (statusCount.get(entry.status) || 0) + 1);
    });

    return {
      total: entries.length,
      byCategory: Object.fromEntries(categoryCount),
      byAction: Object.fromEntries(actionCount),
      byStatus: Object.fromEntries(statusCount),
    };
  }
}
