import { Injectable, signal } from '@angular/core';
import {
  TextToolSnapshot,
  ToolDefinition,
  ToolHistoryAdapter,
  ToolMetaKey,
  ToolService,
  PixelFontFamily,
} from './tool.types';

export const PIXEL_FONTS: { id: PixelFontFamily; name: string }[] = [
  { id: 'Press Start 2P', name: 'Press Start 2P' },
  { id: 'VT323', name: 'VT323' },
  { id: 'Silkscreen', name: 'Silkscreen' },
  { id: 'DotGothic16', name: 'DotGothic16' },
  { id: 'Share Tech Mono', name: 'Share Tech Mono' },
];

export const VALID_PIXEL_FONTS: readonly PixelFontFamily[] = PIXEL_FONTS.map(f => f.id);

function isValidPixelFont(font: unknown): font is PixelFontFamily {
  return VALID_PIXEL_FONTS.includes(font as PixelFontFamily);
}

@Injectable({ providedIn: 'root' })
export class TextToolService implements ToolService<TextToolSnapshot> {
  readonly definition: ToolDefinition = {
    id: 'text',
    name: 'Text',
    labelKey: 'tools.text',
    icon: 'bootstrapFonts',
  };

  readonly content = signal<string>('');
  readonly fontFamily = signal<PixelFontFamily>('Press Start 2P');
  readonly fontSize = signal<number>(16);
  readonly color = signal<string>('#000000');

  private historyAdapter?: ToolHistoryAdapter;

  connectHistory(adapter: ToolHistoryAdapter) {
    this.historyAdapter = adapter;
  }

  setContent(content: string) {
    if (typeof content !== 'string') return;
    const prev = this.content();
    if (prev === content) return;
    this.historyAdapter?.('textContent', prev, content);
    this.content.set(content);
  }

  setFontFamily(fontFamily: PixelFontFamily) {
    if (!isValidPixelFont(fontFamily)) return;
    const prev = this.fontFamily();
    if (prev === fontFamily) return;
    this.historyAdapter?.('textFontFamily', prev, fontFamily);
    this.fontFamily.set(fontFamily);
  }

  setFontSize(size: number) {
    const next = Math.max(8, Math.min(64, Math.floor(size)));
    const prev = this.fontSize();
    if (prev === next) return;
    this.historyAdapter?.('textFontSize', prev, next);
    this.fontSize.set(next);
  }

  setColor(color: string) {
    if (typeof color !== 'string' || !color.length) return;
    const prev = this.color();
    if (prev === color) return;
    this.historyAdapter?.('textColor', prev, color);
    this.color.set(color);
  }

  snapshot(): TextToolSnapshot {
    return {
      content: this.content(),
      fontFamily: this.fontFamily(),
      fontSize: this.fontSize(),
      color: this.color(),
    };
  }

  restore(snapshot: Partial<TextToolSnapshot> | undefined) {
    if (!snapshot) return;
    if (typeof snapshot.content === 'string') {
      this.content.set(snapshot.content);
    }
    if (snapshot.fontFamily && isValidPixelFont(snapshot.fontFamily)) {
      this.fontFamily.set(snapshot.fontFamily);
    }
    if (typeof snapshot.fontSize === 'number') {
      this.fontSize.set(Math.max(8, Math.min(64, Math.floor(snapshot.fontSize))));
    }
    if (typeof snapshot.color === 'string' && snapshot.color.length) {
      this.color.set(snapshot.color);
    }
  }

  applyMeta(key: ToolMetaKey, value: unknown): boolean {
    if (key === 'textContent' && typeof value === 'string') {
      this.content.set(value);
      return true;
    }
    if (key === 'textFontFamily' && isValidPixelFont(value)) {
      this.fontFamily.set(value);
      return true;
    }
    if (key === 'textFontSize' && typeof value === 'number') {
      this.fontSize.set(Math.max(8, Math.min(64, Math.floor(value))));
      return true;
    }
    if (key === 'textColor' && typeof value === 'string' && value.length) {
      this.color.set(value);
      return true;
    }
    return false;
  }
}
