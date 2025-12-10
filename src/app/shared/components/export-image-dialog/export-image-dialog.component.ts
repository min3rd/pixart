import {
  ChangeDetectionStrategy,
  Component,
  computed,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Modal } from '../modal/modal';

export type ImageFormat = 'png' | 'jpeg' | 'bmp';
export type ExportRegion = 'all' | 'current' | 'visible';

export interface ExportImageResult {
  format: ImageFormat;
  region: ExportRegion;
  quality: number;
}

@Component({
  selector: 'pa-export-image-dialog',
  templateUrl: './export-image-dialog.component.html',
  styleUrls: ['./export-image-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal],
})
export class ExportImageDialog {
  readonly isOpen = signal(false);
  readonly format = signal<ImageFormat>('png');
  readonly region = signal<ExportRegion>('visible');
  readonly quality = signal<number>(95);

  readonly onConfirm = output<ExportImageResult>();
  readonly onCancel = output<void>();

  readonly showQualitySlider = computed(() => this.format() === 'jpeg');

  readonly formatOptions: { value: ImageFormat; key: string }[] = [
    { value: 'png', key: 'exportImage.format.png' },
    { value: 'jpeg', key: 'exportImage.format.jpeg' },
    { value: 'bmp', key: 'exportImage.format.bmp' },
  ];

  readonly regionOptions: { value: ExportRegion; key: string }[] = [
    { value: 'all', key: 'exportImage.region.all' },
    { value: 'current', key: 'exportImage.region.current' },
    { value: 'visible', key: 'exportImage.region.visible' },
  ];

  open() {
    this.format.set('png');
    this.region.set('visible');
    this.quality.set(95);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  handleConfirm() {
    this.onConfirm.emit({
      format: this.format(),
      region: this.region(),
      quality: this.quality(),
    });
    this.close();
  }

  handleCancel() {
    this.onCancel.emit();
    this.close();
  }

  onFormatChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.format.set(select.value as ImageFormat);
  }

  onRegionChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.region.set(select.value as ExportRegion);
  }

  onQualityChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.quality.set(Number.parseInt(input.value, 10));
  }
}
