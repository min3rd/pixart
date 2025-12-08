import { Injectable, inject } from '@angular/core';
import { LogExportData } from './log.types';
import { LogStorageService } from './log-storage.service';

@Injectable({ providedIn: 'root' })
export class LogExportService {
  private readonly storage = inject(LogStorageService);

  exportLogsAsJson(): LogExportData {
    const entries = this.storage.loadEntries();
    const sessions = this.storage.loadSessions();

    return {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      sessions,
      entries,
    };
  }

  downloadLogsAsFile(filename?: string): void {
    const data = this.exportLogsAsJson();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download =
      filename || `pixart-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportSessionLogs(sessionId: string): LogExportData {
    const allEntries = this.storage.loadEntries();
    const allSessions = this.storage.loadSessions();

    const entries = allEntries.filter((e) => e.sessionId === sessionId);
    const sessions = allSessions.filter((s) => s.id === sessionId);

    return {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      sessions,
      entries,
    };
  }

  importLogs(data: LogExportData): boolean {
    try {
      const existingEntries = this.storage.loadEntries();
      const existingSessions = this.storage.loadSessions();

      const entryIds = new Set(existingEntries.map((e) => e.id));
      const newEntries = data.entries.filter((e) => !entryIds.has(e.id));

      const sessionIds = new Set(existingSessions.map((s) => s.id));
      const newSessions = data.sessions.filter((s) => !sessionIds.has(s.id));

      this.storage.saveEntries([...existingEntries, ...newEntries]);
      this.storage.saveSessions([...existingSessions, ...newSessions]);

      return true;
    } catch (error) {
      console.error('Failed to import logs:', error);
      return false;
    }
  }
}
