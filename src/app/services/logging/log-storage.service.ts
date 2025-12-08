import { Injectable, signal } from '@angular/core';
import { LogEntry, LogSession, LogStorageInfo } from './log.types';

@Injectable({ providedIn: 'root' })
export class LogStorageService {
  private readonly STORAGE_KEY_ENTRIES = 'pixart.logs.entries';
  private readonly STORAGE_KEY_SESSIONS = 'pixart.logs.sessions';
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024;
  private readonly CLEANUP_THRESHOLD = 0.9;

  readonly storageInfo = signal<LogStorageInfo>({
    totalEntries: 0,
    totalSessions: 0,
    estimatedSize: 0,
  });

  constructor() {
    this.updateStorageInfo();
  }

  saveEntry(entry: LogEntry): void {
    const entries = this.loadEntries();
    entries.push(entry);
    this.checkAndCleanupIfNeeded(entries);
    this.saveEntries(entries);
    this.updateStorageInfo();
  }

  loadEntries(): LogEntry[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_ENTRIES);
      if (!data) return [];
      return JSON.parse(data) as LogEntry[];
    } catch (error) {
      console.error('Failed to load log entries:', error);
      return [];
    }
  }

  saveEntries(entries: LogEntry[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_ENTRIES, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save log entries:', error);
      this.handleStorageQuotaExceeded(entries);
    }
  }

  loadSessions(): LogSession[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_SESSIONS);
      if (!data) return [];
      return JSON.parse(data) as LogSession[];
    } catch (error) {
      console.error('Failed to load log sessions:', error);
      return [];
    }
  }

  saveSessions(sessions: LogSession[]): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEY_SESSIONS,
        JSON.stringify(sessions),
      );
    } catch (error) {
      console.error('Failed to save log sessions:', error);
    }
  }

  saveSession(session: LogSession): void {
    const sessions = this.loadSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    this.saveSessions(sessions);
    this.updateStorageInfo();
  }

  clearAllLogs(): void {
    localStorage.removeItem(this.STORAGE_KEY_ENTRIES);
    localStorage.removeItem(this.STORAGE_KEY_SESSIONS);
    this.updateStorageInfo();
  }

  clearOldLogs(daysToKeep: number): void {
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - daysToKeep);
    const cutoffISO = cutoffTime.toISOString();

    const entries = this.loadEntries();
    const filteredEntries = entries.filter((e) => e.timestamp >= cutoffISO);
    this.saveEntries(filteredEntries);

    const sessions = this.loadSessions();
    const filteredSessions = sessions.filter((s) => s.startTime >= cutoffISO);
    this.saveSessions(filteredSessions);

    this.updateStorageInfo();
  }

  private checkAndCleanupIfNeeded(entries: LogEntry[]): void {
    const estimatedSize = this.estimateSize(entries);
    if (estimatedSize > this.MAX_STORAGE_SIZE * this.CLEANUP_THRESHOLD) {
      const targetSize = this.MAX_STORAGE_SIZE * 0.7;
      this.cleanupToSize(entries, targetSize);
    }
  }

  private cleanupToSize(entries: LogEntry[], targetSize: number): void {
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let currentSize = this.estimateSize(entries);
    while (entries.length > 0 && currentSize > targetSize) {
      const removed = entries.shift();
      if (removed) {
        const removedSize = JSON.stringify(removed).length * 2;
        currentSize -= removedSize;
      }
    }
  }

  private handleStorageQuotaExceeded(entries: LogEntry[]): void {
    const targetSize = this.MAX_STORAGE_SIZE * 0.5;
    this.cleanupToSize(entries, targetSize);
    try {
      this.saveEntries(entries);
    } catch (error) {
      console.error('Failed to save after cleanup:', error);
    }
  }

  private estimateSize(entries: LogEntry[]): number {
    try {
      return JSON.stringify(entries).length * 2;
    } catch {
      return 0;
    }
  }

  private updateStorageInfo(): void {
    const entries = this.loadEntries();
    const sessions = this.loadSessions();

    const sortedEntries = [...entries].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );

    const info: LogStorageInfo = {
      totalEntries: entries.length,
      totalSessions: sessions.length,
      oldestEntry: sortedEntries[0]?.timestamp,
      newestEntry: sortedEntries[sortedEntries.length - 1]?.timestamp,
      estimatedSize: this.estimateSize(entries),
    };

    this.storageInfo.set(info);
  }
}
