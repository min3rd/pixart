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
  readonly gradientStartColor = signal<string>('#000000');
  readonly gradientEndColor = signal<string>('#ffffff');
  readonly gradientType = signal<'linear' | 'radial'>('linear');
  readonly gradientAngle = signal<number>(0);

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
    if (
      mode !== 'color' &&
      mode !== 'erase' &&
      mode !== 'pattern' &&
      mode !== 'gradient'
    )
      return;
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

  setGradientStartColor(color: string) {
    if (typeof color !== 'string' || !color.length) return;
    this.gradientStartColor.set(color);
  }

  setGradientEndColor(color: string) {
    if (typeof color !== 'string' || !color.length) return;
    this.gradientEndColor.set(color);
  }

  setGradientType(type: 'linear' | 'radial') {
    this.gradientType.set(type);
  }

  setGradientAngle(angle: number) {
    if (typeof angle !== 'number') return;
    this.gradientAngle.set(angle);
  }

  snapshot(): FillToolSnapshot {
    return {
      color: this.color(),
      mode: this.mode(),
      patternId: this.patternId(),
      gradientStartColor: this.gradientStartColor(),
      gradientEndColor: this.gradientEndColor(),
      gradientType: this.gradientType(),
      gradientAngle: this.gradientAngle(),
    };
  }

  restore(snapshot: Partial<FillToolSnapshot> | undefined): void {
    if (!snapshot) return;
    if (typeof snapshot.color === 'string' && snapshot.color.length) {
      this.color.set(snapshot.color);
    }
    if (
      snapshot.mode === 'color' ||
      snapshot.mode === 'erase' ||
      snapshot.mode === 'pattern' ||
      snapshot.mode === 'gradient'
    ) {
      this.mode.set(snapshot.mode);
    }
    if (typeof snapshot.patternId === 'string' && snapshot.patternId.length) {
      this.patternId.set(snapshot.patternId);
    }
    if (
      typeof snapshot.gradientStartColor === 'string' &&
      snapshot.gradientStartColor.length
    ) {
      this.gradientStartColor.set(snapshot.gradientStartColor);
    }
    if (
      typeof snapshot.gradientEndColor === 'string' &&
      snapshot.gradientEndColor.length
    ) {
      this.gradientEndColor.set(snapshot.gradientEndColor);
    }
    if (
      snapshot.gradientType === 'linear' ||
      snapshot.gradientType === 'radial'
    ) {
      this.gradientType.set(snapshot.gradientType);
    }
    if (typeof snapshot.gradientAngle === 'number') {
      this.gradientAngle.set(snapshot.gradientAngle);
    }
  }

  applyMeta(key: ToolMetaKey, value: unknown): boolean {
    if (key === 'fillColor' && typeof value === 'string' && value.length) {
      this.color.set(value);
      return true;
    }
    if (
      key === 'fillMode' &&
      (value === 'color' ||
        value === 'erase' ||
        value === 'pattern' ||
        value === 'gradient')
    ) {
      this.mode.set(value);
      return true;
    }
    return false;
  }
}
