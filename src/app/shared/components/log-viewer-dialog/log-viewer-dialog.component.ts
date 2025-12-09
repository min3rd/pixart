import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { Modal } from '../modal/modal';
import { LogService } from '../../../services/logging/log.service';
import {
  LogEntry,
  LogActionCategory,
  LogActionStatus,
} from '../../../services/logging/log.types';

@Component({
  selector: 'pa-log-viewer-dialog',
  templateUrl: './log-viewer-dialog.component.html',
  styleUrls: ['./log-viewer-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslocoPipe, NgIcon, Modal],
})
export class LogViewerDialog {
  private readonly logService = inject(LogService);

  readonly isOpen = signal(false);
  readonly searchTerm = signal('');
  readonly selectedCategory = signal<LogActionCategory | 'all'>('all');
  readonly selectedStatus = signal<LogActionStatus | 'all'>('all');

  readonly allLogs = computed(() => {
    return this.logService.recentLogs();
  });

  readonly filteredLogs = computed(() => {
    let logs = this.allLogs();
    const search = this.searchTerm().toLowerCase().trim();
    const category = this.selectedCategory();
    const status = this.selectedStatus();

    if (category !== 'all') {
      logs = logs.filter((log) => log.category === category);
    }

    if (status !== 'all') {
      logs = logs.filter((log) => log.status === status);
    }

    if (search) {
      logs = logs.filter(
        (log) =>
          log.action.toLowerCase().includes(search) ||
          log.description?.toLowerCase().includes(search) ||
          log.category.toLowerCase().includes(search) ||
          JSON.stringify(log.parameters).toLowerCase().includes(search),
      );
    }

    return logs;
  });

  readonly categories: (LogActionCategory | 'all')[] = [
    'all',
    'file',
    'layer',
    'drawing',
    'selection',
    'history',
    'canvas',
    'frame',
    'animation',
    'tool',
    'keyboard',
    'transform',
    'color',
    'clipboard',
    'export',
    'bone',
    'keyframe',
    'system',
  ];

  readonly statuses: (LogActionStatus | 'all')[] = [
    'all',
    'success',
    'failure',
    'pending',
  ];

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.logService.recentLogs();
      }
    });
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  onCategoryChange(value: string): void {
    this.selectedCategory.set(value as LogActionCategory | 'all');
  }

  onStatusChange(value: string): void {
    this.selectedStatus.set(value as LogActionStatus | 'all');
  }

  copyEntry(log: LogEntry): void {
    const text = this.formatLogEntry(log);
    navigator.clipboard.writeText(text);
  }

  copyAll(): void {
    const text = this.filteredLogs()
      .map((log) => this.formatLogEntry(log))
      .join('\n\n');
    navigator.clipboard.writeText(text);
  }

  saveLogs(): void {
    this.logService.downloadLogsAsFile();
  }

  replayLog(log: LogEntry): void {
    console.log('Replay log:', log);
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  formatDuration(duration?: number): string {
    if (!duration) return '-';
    return `${duration}ms`;
  }

  private formatLogEntry(log: LogEntry): string {
    const lines = [
      `[${this.formatTimestamp(log.timestamp)}] ${log.category.toUpperCase()} - ${log.action}`,
      `Status: ${log.status}`,
    ];

    if (log.description) {
      lines.push(`Description: ${log.description}`);
    }

    if (log.duration) {
      lines.push(`Duration: ${this.formatDuration(log.duration)}`);
    }

    if (log.parameters) {
      lines.push(`Parameters: ${JSON.stringify(log.parameters, null, 2)}`);
    }

    if (log.error) {
      lines.push(`Error: ${log.error}`);
    }

    return lines.join('\n');
  }
}
