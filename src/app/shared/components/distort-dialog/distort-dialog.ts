import {
  ChangeDetectionStrategy,
  Component,
  computed,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Modal } from '../modal/modal';
import { FormsModule } from '@angular/forms';

export interface DistortCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

export interface DistortResult {
  corners: DistortCorners;
  sourceWidth: number;
  sourceHeight: number;
}

@Component({
  selector: 'pa-distort-dialog',
  templateUrl: './distort-dialog.html',
  styleUrls: ['./distort-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal, FormsModule],
})
export class DistortDialog {
  readonly isOpen = signal(false);
  readonly sourceWidth = signal<number>(0);
  readonly sourceHeight = signal<number>(0);

  readonly topLeftX = signal<string>('0');
  readonly topLeftY = signal<string>('0');
  readonly topRightX = signal<string>('0');
  readonly topRightY = signal<string>('0');
  readonly bottomRightX = signal<string>('0');
  readonly bottomRightY = signal<string>('0');
  readonly bottomLeftX = signal<string>('0');
  readonly bottomLeftY = signal<string>('0');

  readonly dragging = signal<
    'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | null
  >(null);
  readonly previewScale = signal(1);

  readonly onConfirm = output<DistortResult>();
  readonly onCancel = output<void>();

  readonly corners = computed<DistortCorners>(() => ({
    topLeft: {
      x: Number.parseFloat(this.topLeftX()) || 0,
      y: Number.parseFloat(this.topLeftY()) || 0,
    },
    topRight: {
      x: Number.parseFloat(this.topRightX()) || 0,
      y: Number.parseFloat(this.topRightY()) || 0,
    },
    bottomRight: {
      x: Number.parseFloat(this.bottomRightX()) || 0,
      y: Number.parseFloat(this.bottomRightY()) || 0,
    },
    bottomLeft: {
      x: Number.parseFloat(this.bottomLeftX()) || 0,
      y: Number.parseFloat(this.bottomLeftY()) || 0,
    },
  }));

  open(width: number, height: number) {
    this.sourceWidth.set(width);
    this.sourceHeight.set(height);

    this.topLeftX.set('0');
    this.topLeftY.set('0');
    this.topRightX.set(width.toString());
    this.topRightY.set('0');
    this.bottomRightX.set(width.toString());
    this.bottomRightY.set(height.toString());
    this.bottomLeftX.set('0');
    this.bottomLeftY.set(height.toString());

    this.previewScale.set(Math.min(400 / width, 400 / height, 1));
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.dragging.set(null);
  }

  handleConfirm() {
    const result: DistortResult = {
      corners: this.corners(),
      sourceWidth: this.sourceWidth(),
      sourceHeight: this.sourceHeight(),
    };
    this.onConfirm.emit(result);
    this.close();
  }

  handleCancel() {
    this.onCancel.emit();
    this.close();
  }

  handleReset() {
    const width = this.sourceWidth();
    const height = this.sourceHeight();
    this.topLeftX.set('0');
    this.topLeftY.set('0');
    this.topRightX.set(width.toString());
    this.topRightY.set('0');
    this.bottomRightX.set(width.toString());
    this.bottomRightY.set(height.toString());
    this.bottomLeftX.set('0');
    this.bottomLeftY.set(height.toString());
  }

  onCornerMouseDown(
    corner: 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft',
    event: MouseEvent,
  ) {
    event.preventDefault();
    this.dragging.set(corner);
  }

  onPreviewMouseMove(event: MouseEvent) {
    const dragCorner = this.dragging();
    if (!dragCorner) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const scale = this.previewScale();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    switch (dragCorner) {
      case 'topLeft':
        this.topLeftX.set(Math.round(x).toString());
        this.topLeftY.set(Math.round(y).toString());
        break;
      case 'topRight':
        this.topRightX.set(Math.round(x).toString());
        this.topRightY.set(Math.round(y).toString());
        break;
      case 'bottomRight':
        this.bottomRightX.set(Math.round(x).toString());
        this.bottomRightY.set(Math.round(y).toString());
        break;
      case 'bottomLeft':
        this.bottomLeftX.set(Math.round(x).toString());
        this.bottomLeftY.set(Math.round(y).toString());
        break;
    }
  }

  onPreviewMouseUp() {
    this.dragging.set(null);
  }
}
