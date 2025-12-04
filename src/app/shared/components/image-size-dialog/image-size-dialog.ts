import {
  ChangeDetectionStrategy,
  Component,
  computed,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Modal } from '../modal/modal';

export interface ImageSizeResult {
  width: number;
  height: number;
}

@Component({
  selector: 'pa-image-size-dialog',
  templateUrl: './image-size-dialog.html',
  styleUrls: ['./image-size-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal],
})
export class ImageSizeDialog {
  readonly isOpen = signal(false);
  readonly originalWidth = signal<number>(0);
  readonly originalHeight = signal<number>(0);
  readonly targetWidth = signal<string>('');
  readonly targetHeight = signal<string>('');
  readonly maintainAspectRatio = signal(true);

  readonly onConfirm = output<ImageSizeResult>();
  readonly onCancel = output<void>();

  readonly previewWidth = computed(() => {
    const val = this.targetWidth().trim();
    if (val) {
      const num = Number.parseInt(val, 10);
      return Number.isNaN(num) ? this.originalWidth() : Math.max(1, num);
    }
    return this.originalWidth();
  });

  readonly previewHeight = computed(() => {
    const val = this.targetHeight().trim();
    if (val) {
      const num = Number.parseInt(val, 10);
      return Number.isNaN(num) ? this.originalHeight() : Math.max(1, num);
    }
    return this.originalHeight();
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
    this.maintainAspectRatio.set(true);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.originalWidth.set(0);
    this.originalHeight.set(0);
    this.targetWidth.set('');
    this.targetHeight.set('');
    this.maintainAspectRatio.set(true);
  }

  handleConfirm() {
    const width = this.previewWidth();
    const height = this.previewHeight();
    this.onConfirm.emit({ width, height });
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
      }
    }
  }

  onMaintainAspectRatioChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.maintainAspectRatio.set(input.checked);
  }
}
