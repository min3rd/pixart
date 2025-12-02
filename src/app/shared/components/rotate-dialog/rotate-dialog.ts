import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Modal } from '../modal/modal';

export interface RotateResult {
  angle: number;
}

@Component({
  selector: 'pa-rotate-dialog',
  templateUrl: './rotate-dialog.html',
  styleUrls: ['./rotate-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal],
})
export class RotateDialog {
  readonly isOpen = signal(false);
  readonly originalWidth = signal<number>(0);
  readonly originalHeight = signal<number>(0);
  readonly originalBuffer = signal<string[]>([]);
  readonly angle = signal<number>(0);
  readonly angleInput = signal<string>('0');

  readonly onConfirm = output<RotateResult>();
  readonly onCancel = output<void>();

  readonly normalizedAngle = computed(() => {
    const val = this.angleInput().trim();
    if (val) {
      const num = Number.parseFloat(val);
      if (!Number.isNaN(num)) {
        return ((num % 360) + 360) % 360;
      }
    }
    return 0;
  });

  readonly previewDimensions = computed(() => {
    const angle = this.normalizedAngle();
    const radians = (angle * Math.PI) / 180;
    const w = this.originalWidth();
    const h = this.originalHeight();

    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));

    const newW = Math.ceil(w * cos + h * sin);
    const newH = Math.ceil(w * sin + h * cos);

    return `${newW} × ${newH}`;
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        setTimeout(() => this.renderPreviews(), 50);
      }
    });

    effect(() => {
      this.normalizedAngle();
      if (this.isOpen()) {
        setTimeout(() => this.renderPreviews(), 0);
      }
    });
  }

  open(width: number, height: number, buffer: string[]) {
    this.originalWidth.set(width);
    this.originalHeight.set(height);
    this.originalBuffer.set(buffer);
    this.angle.set(0);
    this.angleInput.set('0');
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.originalWidth.set(0);
    this.originalHeight.set(0);
    this.originalBuffer.set([]);
    this.angle.set(0);
    this.angleInput.set('0');
  }

  handleConfirm() {
    const angle = this.normalizedAngle();
    this.onConfirm.emit({ angle });
    this.close();
  }

  handleCancel() {
    this.onCancel.emit();
    this.close();
  }

  onAngleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.angleInput.set(val);
    const num = Number.parseFloat(val);
    if (!Number.isNaN(num)) {
      this.angle.set(num);
    }
  }

  onAngleSliderChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.angleInput.set(val);
    this.angle.set(Number.parseFloat(val));
  }

  resetAngle() {
    this.angle.set(0);
    this.angleInput.set('0');
  }

  private renderPreviews() {
    this.renderOriginalPreview();
    this.renderRotatedPreview();
  }

  private renderOriginalPreview() {
    const canvas = document.getElementById(
      'rotate-preview-original-canvas',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const width = this.originalWidth();
    const height = this.originalHeight();
    const buffer = this.originalBuffer();

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < buffer.length; i++) {
      const color = buffer[i];
      if (color) {
        const rgba = this.hexToRgba(color);
        const idx = i * 4;
        imageData.data[idx] = rgba.r;
        imageData.data[idx + 1] = rgba.g;
        imageData.data[idx + 2] = rgba.b;
        imageData.data[idx + 3] = rgba.a;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private renderRotatedPreview() {
    const canvas = document.getElementById(
      'rotate-preview-rotated-canvas',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const width = this.originalWidth();
    const height = this.originalHeight();
    const buffer = this.originalBuffer();
    const angle = this.normalizedAngle();

    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const newWidth = Math.ceil(Math.abs(width * cos) + Math.abs(height * sin));
    const newHeight = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos));

    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, newWidth, newHeight);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const imageData = tempCtx.createImageData(width, height);
    for (let i = 0; i < buffer.length; i++) {
      const color = buffer[i];
      if (color) {
        const rgba = this.hexToRgba(color);
        const idx = i * 4;
        imageData.data[idx] = rgba.r;
        imageData.data[idx + 1] = rgba.g;
        imageData.data[idx + 2] = rgba.b;
        imageData.data[idx + 3] = rgba.a;
      }
    }
    tempCtx.putImageData(imageData, 0, 0);

    ctx.save();
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(radians);
    ctx.drawImage(tempCanvas, -width / 2, -height / 2);
    ctx.restore();
  }

  private hexToRgba(hex: string): {
    r: number;
    g: number;
    b: number;
    a: number;
  } {
    if (!hex || hex.length < 7) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    const a = hex.length >= 9 ? Number.parseInt(hex.slice(7, 9), 16) : 255;
    return { r, g, b, a };
  }
}
