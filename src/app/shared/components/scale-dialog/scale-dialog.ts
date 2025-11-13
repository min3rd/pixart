import {
  ChangeDetectionStrategy,
  Component,
  computed,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Modal } from '../modal/modal';

export interface ScaleResult {
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  maintainAspectRatio: boolean;
}

@Component({
  selector: 'pa-scale-dialog',
  templateUrl: './scale-dialog.html',
  styleUrls: ['./scale-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal],
})
export class ScaleDialog {
  readonly isOpen = signal(false);
  readonly originalWidth = signal<number>(0);
  readonly originalHeight = signal<number>(0);
  readonly targetWidth = signal<string>('');
  readonly targetHeight = signal<string>('');
  readonly scalePercentX = signal<string>('100');
  readonly scalePercentY = signal<string>('100');
  readonly maintainAspectRatio = signal(true);

  readonly onConfirm = output<ScaleResult>();
  readonly onCancel = output<void>();

  readonly previewWidth = computed(() => {
    const val = this.targetWidth().trim();
    if (val) {
      const num = Number.parseInt(val, 10);
      return Number.isNaN(num) ? this.originalWidth() : Math.max(1, num);
    }
    const pct = this.scalePercentX().trim();
    if (pct) {
      const pctNum = Number.parseFloat(pct);
      if (!Number.isNaN(pctNum)) {
        return Math.max(1, Math.round((this.originalWidth() * pctNum) / 100));
      }
    }
    return this.originalWidth();
  });

  readonly previewHeight = computed(() => {
    const val = this.targetHeight().trim();
    if (val) {
      const num = Number.parseInt(val, 10);
      return Number.isNaN(num) ? this.originalHeight() : Math.max(1, num);
    }
    const pct = this.scalePercentY().trim();
    if (pct) {
      const pctNum = Number.parseFloat(pct);
      if (!Number.isNaN(pctNum)) {
        return Math.max(1, Math.round((this.originalHeight() * pctNum) / 100));
      }
    }
    return this.originalHeight();
  });

  readonly actualScaleX = computed(() => {
    const orig = this.originalWidth();
    if (orig === 0) return 1;
    return this.previewWidth() / orig;
  });

  readonly actualScaleY = computed(() => {
    const orig = this.originalHeight();
    if (orig === 0) return 1;
    return this.previewHeight() / orig;
  });

  readonly previewDimensions = computed(() => {
    const w = this.previewWidth();
    const h = this.previewHeight();
    return `${w} × ${h}`;
  });

  open(width: number, height: number) {
    this.originalWidth.set(width);
    this.originalHeight.set(height);
    this.targetWidth.set(width.toString());
    this.targetHeight.set(height.toString());
    this.scalePercentX.set('100');
    this.scalePercentY.set('100');
    this.maintainAspectRatio.set(true);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.originalWidth.set(0);
    this.originalHeight.set(0);
    this.targetWidth.set('');
    this.targetHeight.set('');
    this.scalePercentX.set('100');
    this.scalePercentY.set('100');
    this.maintainAspectRatio.set(true);
  }

  handleConfirm() {
    const scaleX = this.actualScaleX();
    const scaleY = this.actualScaleY();
    const width = this.previewWidth();
    const height = this.previewHeight();
    const maintainAspectRatio = this.maintainAspectRatio();
    this.onConfirm.emit({ scaleX, scaleY, width, height, maintainAspectRatio });
    this.close();
  }

  handleCancel() {
    this.onCancel.emit();
    this.close();
  }

  onWidthInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.targetWidth.set(val);
    if (this.maintainAspectRatio() && val) {
      const num = Number.parseInt(val, 10);
      if (!Number.isNaN(num) && this.originalWidth() > 0) {
        const ratio = num / this.originalWidth();
        const newHeight = Math.round(this.originalHeight() * ratio);
        this.targetHeight.set(newHeight.toString());
        this.scalePercentX.set((ratio * 100).toFixed(2));
        this.scalePercentY.set((ratio * 100).toFixed(2));
      }
    } else if (val) {
      const num = Number.parseInt(val, 10);
      if (!Number.isNaN(num) && this.originalWidth() > 0) {
        const ratio = num / this.originalWidth();
        this.scalePercentX.set((ratio * 100).toFixed(2));
      }
    }
  }

  onHeightInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.targetHeight.set(val);
    if (this.maintainAspectRatio() && val) {
      const num = Number.parseInt(val, 10);
      if (!Number.isNaN(num) && this.originalHeight() > 0) {
        const ratio = num / this.originalHeight();
        const newWidth = Math.round(this.originalWidth() * ratio);
        this.targetWidth.set(newWidth.toString());
        this.scalePercentX.set((ratio * 100).toFixed(2));
        this.scalePercentY.set((ratio * 100).toFixed(2));
      }
    } else if (val) {
      const num = Number.parseInt(val, 10);
      if (!Number.isNaN(num) && this.originalHeight() > 0) {
        const ratio = num / this.originalHeight();
        this.scalePercentY.set((ratio * 100).toFixed(2));
      }
    }
  }

  onPercentXInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.scalePercentX.set(val);
    if (val) {
      const pct = Number.parseFloat(val);
      if (!Number.isNaN(pct)) {
        const newWidth = Math.round((this.originalWidth() * pct) / 100);
        this.targetWidth.set(newWidth.toString());
        if (this.maintainAspectRatio()) {
          this.scalePercentY.set(val);
          const newHeight = Math.round((this.originalHeight() * pct) / 100);
          this.targetHeight.set(newHeight.toString());
        }
      }
    }
  }

  onPercentYInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.scalePercentY.set(val);
    if (val) {
      const pct = Number.parseFloat(val);
      if (!Number.isNaN(pct)) {
        const newHeight = Math.round((this.originalHeight() * pct) / 100);
        this.targetHeight.set(newHeight.toString());
        if (this.maintainAspectRatio()) {
          this.scalePercentX.set(val);
          const newWidth = Math.round((this.originalWidth() * pct) / 100);
          this.targetWidth.set(newWidth.toString());
        }
      }
    }
  }

  onMaintainAspectRatioChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.maintainAspectRatio.set(input.checked);
  }
}
