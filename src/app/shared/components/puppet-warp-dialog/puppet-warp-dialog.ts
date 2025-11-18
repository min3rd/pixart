import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark, heroLockClosed, heroLockOpen, heroTrash } from '@ng-icons/heroicons/outline';
import { Modal } from '../modal/modal';
import { PuppetWarpPinData } from '../../../services/editor/editor-puppet-warp.service';

export interface PuppetWarpResult {
  pins: PuppetWarpPinData[];
}

@Component({
  selector: 'pa-puppet-warp-dialog',
  templateUrl: './puppet-warp-dialog.html',
  styleUrls: ['./puppet-warp-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, NgIconComponent, Modal],
  viewProviders: [provideIcons({ heroXMark, heroLockClosed, heroLockOpen, heroTrash })],
})
export class PuppetWarpDialog {
  readonly visible = signal(false);
  readonly onApply = output<PuppetWarpResult>();
  readonly onToggleLock = output<string>();
  readonly onRemovePin = output<string>();
  readonly onUpdateRadius = output<{ pinId: string; radius: number }>();

  readonly originalWidth = signal(0);
  readonly originalHeight = signal(0);
  readonly pins = signal<PuppetWarpPinData[]>([]);
  readonly selectedPin = signal<PuppetWarpPinData | null>(null);
  readonly defaultRadius = signal(50);

  readonly canApply = computed(() => {
    return this.pins().length > 0;
  });

  readonly selectedPinRadius = computed(() => {
    const pin = this.selectedPin();
    return pin ? pin.radius : this.defaultRadius();
  });

  open(
    x: number,
    y: number,
    width: number,
    height: number,
    pins?: PuppetWarpPinData[],
    defaultRadius?: number,
  ): void {
    this.originalWidth.set(width);
    this.originalHeight.set(height);
    this.pins.set(pins || []);
    this.defaultRadius.set(defaultRadius || Math.min(width, height) * 0.15);
    this.selectedPin.set(null);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  apply(): void {
    if (!this.canApply()) return;

    const result: PuppetWarpResult = {
      pins: this.pins(),
    };

    this.onApply.emit(result);
    this.close();
  }

  selectPin(pin: PuppetWarpPinData): void {
    this.selectedPin.set(pin);
  }

  toggleLock(pinId: string): void {
    this.onToggleLock.emit(pinId);
  }

  removePin(pinId: string): void {
    this.onRemovePin.emit(pinId);
    if (this.selectedPin()?.id === pinId) {
      this.selectedPin.set(null);
    }
  }

  updatePinRadius(value: string): void {
    const pin = this.selectedPin();
    if (!pin) return;

    const num = Number.parseFloat(value);
    if (!Number.isNaN(num) && num > 0) {
      this.onUpdateRadius.emit({ pinId: pin.id, radius: num });
    }
  }

  reset(): void {
    this.selectedPin.set(null);
  }
}
