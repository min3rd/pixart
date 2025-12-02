import { Injectable, signal } from '@angular/core';
import {
  PenLineMode,
  PenToolSnapshot,
  ToolDefinition,
  ToolHistoryAdapter,
  ToolMetaKey,
  ToolRestoreContext,
  ToolService,
} from './tool.types';

@Injectable({ providedIn: 'root' })
export class PenToolService implements ToolService<PenToolSnapshot> {
  readonly definition: ToolDefinition = {
    id: 'pen',
    name: 'Pen',
    labelKey: 'tools.pen',
    icon: 'bootstrapPen',
  };

  readonly thickness = signal<number>(1);
  readonly color = signal<string>('#000000');
  readonly lineMode = signal<PenLineMode>('polyline');

  private historyAdapter?: ToolHistoryAdapter;

  connectHistory(adapter: ToolHistoryAdapter) {
    this.historyAdapter = adapter;
  }

  setThickness(value: number, max?: number) {
    const limit = max && max > 0 ? max : Number.MAX_SAFE_INTEGER;
    const next = Math.max(1, Math.min(Math.floor(value), limit));
    const prev = this.thickness();
    if (prev === next) return;
    this.historyAdapter?.('penThickness', prev, next);
    this.thickness.set(next);
  }

  setColor(color: string) {
    if (typeof color !== 'string' || !color.length) return;
    const prev = this.color();
    if (prev === color) return;
    this.historyAdapter?.('penColor', prev, color);
    this.color.set(color);
  }

  setLineMode(mode: PenLineMode) {
    if (mode !== 'polyline' && mode !== 'spline') return;
    const prev = this.lineMode();
    if (prev === mode) return;
    this.historyAdapter?.('penLineMode', prev, mode);
    this.lineMode.set(mode);
  }

  snapshot(): PenToolSnapshot {
    return {
      thickness: this.thickness(),
      color: this.color(),
      lineMode: this.lineMode(),
    };
  }

  restore(
    snapshot: Partial<PenToolSnapshot> | undefined,
    context?: ToolRestoreContext,
  ) {
    if (!snapshot) return;
    const limit =
      context?.maxBrush && context.maxBrush > 0
        ? context.maxBrush
        : Number.MAX_SAFE_INTEGER;
    if (typeof snapshot.thickness === 'number') {
      const next = Math.max(1, Math.min(Math.floor(snapshot.thickness), limit));
      this.thickness.set(next);
    }
    if (typeof snapshot.color === 'string' && snapshot.color.length) {
      this.color.set(snapshot.color);
    }
    if (snapshot.lineMode === 'polyline' || snapshot.lineMode === 'spline') {
      this.lineMode.set(snapshot.lineMode);
    }
  }

  applyMeta(key: ToolMetaKey, value: unknown): boolean {
    if (key === 'penThickness' && typeof value === 'number') {
      this.thickness.set(Math.max(1, Math.floor(value)));
      return true;
    }
    if (key === 'penColor' && typeof value === 'string' && value.length) {
      this.color.set(value);
      return true;
    }
    if (
      key === 'penLineMode' &&
      (value === 'polyline' || value === 'spline')
    ) {
      this.lineMode.set(value);
      return true;
    }
    return false;
  }
}
