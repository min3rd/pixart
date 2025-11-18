import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { Modal } from '../modal/modal';

export interface PerspectiveCorner {
  x: number;
  y: number;
}

export interface PerspectiveResult {
  corners: {
    topLeft: PerspectiveCorner;
    topRight: PerspectiveCorner;
    bottomRight: PerspectiveCorner;
    bottomLeft: PerspectiveCorner;
  };
  preserveAspectRatio: boolean;
  keepParallelEdges: boolean;
}

@Component({
  selector: 'pa-perspective-dialog',
  templateUrl: './perspective-dialog.html',
  styleUrls: ['./perspective-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, NgIconComponent, Modal],
  viewProviders: [provideIcons({ heroXMark })],
})
export class PerspectiveDialog {
  readonly visible = signal(false);
  readonly onApply = output<PerspectiveResult>();

  readonly originalWidth = signal(0);
  readonly originalHeight = signal(0);

  readonly topLeftX = signal(0);
  readonly topLeftY = signal(0);
  readonly topRightX = signal(0);
  readonly topRightY = signal(0);
  readonly bottomRightX = signal(0);
  readonly bottomRightY = signal(0);
  readonly bottomLeftX = signal(0);
  readonly bottomLeftY = signal(0);

  readonly preserveAspectRatio = signal(false);
  readonly keepParallelEdges = signal(false);

  readonly canApply = computed(() => {
    return true;
  });

  open(
    x: number,
    y: number,
    width: number,
    height: number,
    corners?: PerspectiveResult['corners'],
  ): void {
    this.originalWidth.set(width);
    this.originalHeight.set(height);

    if (corners) {
      this.topLeftX.set(corners.topLeft.x);
      this.topLeftY.set(corners.topLeft.y);
      this.topRightX.set(corners.topRight.x);
      this.topRightY.set(corners.topRight.y);
      this.bottomRightX.set(corners.bottomRight.x);
      this.bottomRightY.set(corners.bottomRight.y);
      this.bottomLeftX.set(corners.bottomLeft.x);
      this.bottomLeftY.set(corners.bottomLeft.y);
    } else {
      this.topLeftX.set(x);
      this.topLeftY.set(y);
      this.topRightX.set(x + width);
      this.topRightY.set(y);
      this.bottomRightX.set(x + width);
      this.bottomRightY.set(y + height);
      this.bottomLeftX.set(x);
      this.bottomLeftY.set(y + height);
    }

    this.preserveAspectRatio.set(false);
    this.keepParallelEdges.set(false);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  reset(): void {
    const width = this.originalWidth();
    const height = this.originalHeight();
    const x = this.topLeftX();
    const y = this.topLeftY();

    this.topLeftX.set(x);
    this.topLeftY.set(y);
    this.topRightX.set(x + width);
    this.topRightY.set(y);
    this.bottomRightX.set(x + width);
    this.bottomRightY.set(y + height);
    this.bottomLeftX.set(x);
    this.bottomLeftY.set(y + height);
  }

  apply(): void {
    if (!this.canApply()) return;

    const result: PerspectiveResult = {
      corners: {
        topLeft: { x: this.topLeftX(), y: this.topLeftY() },
        topRight: { x: this.topRightX(), y: this.topRightY() },
        bottomRight: { x: this.bottomRightX(), y: this.bottomRightY() },
        bottomLeft: { x: this.bottomLeftX(), y: this.bottomLeftY() },
      },
      preserveAspectRatio: this.preserveAspectRatio(),
      keepParallelEdges: this.keepParallelEdges(),
    };

    this.onApply.emit(result);
    this.close();
  }

  updateTopLeftX(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      this.topLeftX.set(Math.round(num));
    }
  }

  updateTopLeftY(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      this.topLeftY.set(Math.round(num));
    }
  }

  updateTopRightX(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      this.topRightX.set(Math.round(num));
    }
  }

  updateTopRightY(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      this.topRightY.set(Math.round(num));
    }
  }

  updateBottomRightX(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      this.bottomRightX.set(Math.round(num));
    }
  }

  updateBottomRightY(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      this.bottomRightY.set(Math.round(num));
    }
  }

  updateBottomLeftX(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      this.bottomLeftX.set(Math.round(num));
    }
  }

  updateBottomLeftY(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      this.bottomLeftY.set(Math.round(num));
    }
  }

  togglePreserveAspectRatio(): void {
    this.preserveAspectRatio.update((v) => !v);
  }

  toggleKeepParallelEdges(): void {
    this.keepParallelEdges.update((v) => !v);
  }
}
