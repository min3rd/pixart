import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ColorPickerStateService {
  readonly isPickingColor = signal(false);
  private colorCallback: ((color: string) => void) | null = null;

  startPicking(callback: (color: string) => void): void {
    this.colorCallback = callback;
    this.isPickingColor.set(true);
  }

  stopPicking(): void {
    this.colorCallback = null;
    this.isPickingColor.set(false);
  }

  deliverColor(color: string): void {
    if (this.colorCallback) {
      this.colorCallback(color);
    }
    this.stopPicking();
  }
}
