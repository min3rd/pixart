import { Injectable, signal } from '@angular/core';
import {
  FillToolMode,
  FillToolSnapshot,
  ToolDefinition,
  ToolHistoryAdapter,
  ToolMetaKey,
  ToolService,
} from './tool.types';

@Injectable({ providedIn: 'root' })
export class FillToolService implements ToolService<FillToolSnapshot> {
  readonly definition: ToolDefinition = {
    id: 'fill',
    name: 'Fill',
    labelKey: 'tools.fill',
    icon: 'bootstrapDroplet',
  };

  readonly color = signal<string>('#000000');
  readonly mode = signal<FillToolMode>('color');
  readonly patternId = signal<string>('checker-8');
  readonly contentAwareThreshold = signal<number>(32);

  private historyAdapter?: ToolHistoryAdapter;

  connectHistory(adapter: ToolHistoryAdapter) {
    this.historyAdapter = adapter;
  }

  setColor(color: string) {
    if (typeof color !== 'string' || !color.length) return;
    const prev = this.color();
    if (prev === color) return;
    this.historyAdapter?.('fillColor', prev, color);
    this.color.set(color);
  }

  setMode(mode: FillToolMode) {
    if (mode !== 'color' && mode !== 'erase' && mode !== 'pattern' && mode !== 'content-aware') return;
    const prev = this.mode();
    if (prev === mode) return;
    this.historyAdapter?.('fillMode', prev, mode);
    this.mode.set(mode);
  }

  setPatternId(patternId: string) {
    if (typeof patternId !== 'string' || !patternId.length) return;
    const prev = this.patternId();
    if (prev === patternId) return;
    this.patternId.set(patternId);
  }

  setContentAwareThreshold(threshold: number) {
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 255) return;
    const prev = this.contentAwareThreshold();
    if (prev === threshold) return;
    this.contentAwareThreshold.set(threshold);
  }

  snapshot(): FillToolSnapshot {
    return {
      color: this.color(),
      mode: this.mode(),
      patternId: this.patternId(),
      contentAwareThreshold: this.contentAwareThreshold(),
    };
  }

  restore(snapshot: Partial<FillToolSnapshot> | undefined): void {
    if (!snapshot) return;
    if (typeof snapshot.color === 'string' && snapshot.color.length) {
      this.color.set(snapshot.color);
    }
    if (snapshot.mode === 'color' || snapshot.mode === 'erase' || snapshot.mode === 'pattern' || snapshot.mode === 'content-aware') {
      this.mode.set(snapshot.mode);
    }
    if (typeof snapshot.patternId === 'string' && snapshot.patternId.length) {
      this.patternId.set(snapshot.patternId);
    }
    if (typeof snapshot.contentAwareThreshold === 'number') {
      this.contentAwareThreshold.set(snapshot.contentAwareThreshold);
    }
  }

  applyMeta(key: ToolMetaKey, value: unknown): boolean {
    if (key === 'fillColor' && typeof value === 'string' && value.length) {
      this.color.set(value);
      return true;
    }
    if (key === 'fillMode' && (value === 'color' || value === 'erase' || value === 'pattern' || value === 'content-aware')) {
      this.mode.set(value);
      return true;
    }
    return false;
  }
}
