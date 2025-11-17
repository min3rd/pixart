import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Modal } from '../modal/modal';

export interface SkewResult {
  skewX: number;
  skewY: number;
}

@Component({
  selector: 'pa-skew-dialog',
  templateUrl: './skew-dialog.html',
  styleUrls: ['./skew-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal],
})
export class SkewDialog {
  readonly isOpen = signal(false);
  readonly originalWidth = signal<number>(0);
  readonly originalHeight = signal<number>(0);
  readonly originalBuffer = signal<string[]>([]);
  readonly skewXAngle = signal<number>(0);
  readonly skewYAngle = signal<number>(0);
  readonly skewXInput = signal<string>('0');
  readonly skewYInput = signal<string>('0');

  readonly onConfirm = output<SkewResult>();
  readonly onCancel = output<void>();

  readonly normalizedSkewX = computed(() => {
    const val = this.skewXInput().trim();
    if (val) {
      const num = Number.parseFloat(val);
      if (!Number.isNaN(num)) {
        return Math.max(-85, Math.min(85, num));
      }
    }
    return 0;
  });

  readonly normalizedSkewY = computed(() => {
    const val = this.skewYInput().trim();
    if (val) {
      const num = Number.parseFloat(val);
      if (!Number.isNaN(num)) {
        return Math.max(-85, Math.min(85, num));
      }
    }
    return 0;
  });

  readonly previewDimensions = computed(() => {
    const skewX = this.normalizedSkewX();
    const skewY = this.normalizedSkewY();
    const w = this.originalWidth();
    const h = this.originalHeight();

    const tanX = Math.tan((skewX * Math.PI) / 180);
    const tanY = Math.tan((skewY * Math.PI) / 180);

    const newW = Math.ceil(w + Math.abs(tanX * h));
    const newH = Math.ceil(h + Math.abs(tanY * w));

    return `${newW} × ${newH}`;
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        setTimeout(() => this.renderPreviews(), 50);
      }
    });

    effect(() => {
      this.normalizedSkewX();
      this.normalizedSkewY();
      if (this.isOpen()) {
        setTimeout(() => this.renderPreviews(), 0);
      }
    });
  }

  open(width: number, height: number, buffer: string[]) {
    this.originalWidth.set(width);
    this.originalHeight.set(height);
    this.originalBuffer.set(buffer);
    this.skewXAngle.set(0);
    this.skewYAngle.set(0);
    this.skewXInput.set('0');
    this.skewYInput.set('0');
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.originalWidth.set(0);
    this.originalHeight.set(0);
    this.originalBuffer.set([]);
    this.skewXAngle.set(0);
    this.skewYAngle.set(0);
    this.skewXInput.set('0');
    this.skewYInput.set('0');
  }

  handleConfirm() {
    const skewX = this.normalizedSkewX();
    const skewY = this.normalizedSkewY();
    this.onConfirm.emit({ skewX, skewY });
    this.close();
  }

  handleCancel() {
    this.onCancel.emit();
    this.close();
  }

  onSkewXInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.skewXInput.set(val);
    const num = Number.parseFloat(val);
    if (!Number.isNaN(num)) {
      this.skewXAngle.set(Math.max(-85, Math.min(85, num)));
    }
  }

  onSkewYInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.skewYInput.set(val);
    const num = Number.parseFloat(val);
    if (!Number.isNaN(num)) {
      this.skewYAngle.set(Math.max(-85, Math.min(85, num)));
    }
  }

  onSkewXSliderChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.skewXInput.set(val);
    this.skewXAngle.set(Number.parseFloat(val));
  }

  onSkewYSliderChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.skewYInput.set(val);
    this.skewYAngle.set(Number.parseFloat(val));
  }

  resetSkew() {
    this.skewXAngle.set(0);
    this.skewYAngle.set(0);
    this.skewXInput.set('0');
    this.skewYInput.set('0');
  }

  private renderPreviews() {
    this.renderOriginalPreview();
    this.renderSkewedPreview();
  }

  private renderOriginalPreview() {
    const canvas = document.getElementById(
      'skew-preview-original-canvas',
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

  private renderSkewedPreview() {
    const canvas = document.getElementById(
      'skew-preview-skewed-canvas',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const width = this.originalWidth();
    const height = this.originalHeight();
    const buffer = this.originalBuffer();
    const skewX = this.normalizedSkewX();
    const skewY = this.normalizedSkewY();

    const tanX = Math.tan((skewX * Math.PI) / 180);
    const tanY = Math.tan((skewY * Math.PI) / 180);

    const newWidth = Math.ceil(width + Math.abs(tanX * height));
    const newHeight = Math.ceil(height + Math.abs(tanY * width));

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
    ctx.transform(1, tanY, tanX, 1, tanX < 0 ? -tanX * height : 0, tanY < 0 ? -tanY * width : 0);
    ctx.drawImage(tempCanvas, 0, 0);
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
