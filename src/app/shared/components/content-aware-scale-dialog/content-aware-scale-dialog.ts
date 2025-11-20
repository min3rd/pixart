import {
  ChangeDetectionStrategy,
  Component,
  computed,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Modal } from '../modal/modal';

export interface ContentAwareScaleResult {
  targetWidth: number;
  targetHeight: number;
  protectImportantAreas: boolean;
}

@Component({
  selector: 'pa-content-aware-scale-dialog',
  templateUrl: './content-aware-scale-dialog.html',
  styleUrls: ['./content-aware-scale-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal],
})
export class ContentAwareScaleDialog {
  readonly isOpen = signal(false);
  readonly originalWidth = signal<number>(0);
  readonly originalHeight = signal<number>(0);
  readonly targetWidth = signal<string>('');
  readonly targetHeight = signal<string>('');
  readonly protectImportantAreas = signal(true);

  readonly onConfirm = output<ContentAwareScaleResult>();
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

  readonly canApply = computed(() => {
    const w = this.previewWidth();
    const h = this.previewHeight();
    return w > 0 && h > 0 && w <= this.originalWidth() && h <= this.originalHeight();
  });

  open(width: number, height: number) {
    this.originalWidth.set(width);
    this.originalHeight.set(height);
    this.targetWidth.set(width.toString());
    this.targetHeight.set(height.toString());
    this.protectImportantAreas.set(true);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.originalWidth.set(0);
    this.originalHeight.set(0);
    this.targetWidth.set('');
    this.targetHeight.set('');
    this.protectImportantAreas.set(true);
  }

  handleConfirm() {
    const targetWidth = this.previewWidth();
    const targetHeight = this.previewHeight();
    const protectImportantAreas = this.protectImportantAreas();
    this.onConfirm.emit({ targetWidth, targetHeight, protectImportantAreas });
    this.close();
  }

  handleCancel() {
    this.onCancel.emit();
    this.close();
  }

  onWidthInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.targetWidth.set(input.value);
  }

  onHeightInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.targetHeight.set(input.value);
  }

  onProtectImportantAreasChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.protectImportantAreas.set(input.checked);
  }
}
