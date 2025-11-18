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
import { WarpGridSize, WarpGridNode } from '../../../services/editor/editor-warp.service';

export interface WarpResult {
  nodes: WarpGridNode[];
  gridSize: WarpGridSize;
  smoothing: number;
}

@Component({
  selector: 'pa-warp-dialog',
  templateUrl: './warp-dialog.html',
  styleUrls: ['./warp-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, NgIconComponent, Modal],
  viewProviders: [provideIcons({ heroXMark })],
})
export class WarpDialog {
  readonly visible = signal(false);
  readonly onApply = output<WarpResult>();

  readonly originalWidth = signal(0);
  readonly originalHeight = signal(0);
  readonly gridSize = signal<WarpGridSize>('3x3');
  readonly smoothing = signal(0.5);
  readonly nodes = signal<WarpGridNode[]>([]);

  readonly canApply = computed(() => {
    return this.nodes().length > 0;
  });

  open(
    x: number,
    y: number,
    width: number,
    height: number,
    gridSize: WarpGridSize = '3x3',
    nodes?: WarpGridNode[],
  ): void {
    this.originalWidth.set(width);
    this.originalHeight.set(height);
    this.gridSize.set(gridSize);
    this.smoothing.set(0.5);
    
    if (nodes) {
      this.nodes.set(nodes);
    } else {
      this.nodes.set([]);
    }

    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  apply(): void {
    if (!this.canApply()) return;

    const result: WarpResult = {
      nodes: this.nodes(),
      gridSize: this.gridSize(),
      smoothing: this.smoothing(),
    };

    this.onApply.emit(result);
    this.close();
  }

  updateGridSize(value: string): void {
    if (value === '3x3' || value === '4x4' || value === '5x5') {
      this.gridSize.set(value);
    }
  }

  updateSmoothing(value: string): void {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num) && num >= 0 && num <= 1) {
      this.smoothing.set(num);
    }
  }

  reset(): void {
    this.smoothing.set(0.5);
  }
}
