import {
  ChangeDetectionStrategy,
  Component,
  signal,
  inject,
  computed,
  effect,
  ElementRef,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EditorToolsService } from '../../../services/editor-tools.service';
import { PatternLibraryService, Pattern } from '../../../services/pattern-library.service';
import { FillToolMode, GradientType } from '../../../services/tools/tool.types';
import { Modal } from '../modal/modal';

export interface FillSelectionDialogResult {
  mode: FillToolMode;
  color?: string;
  patternId?: string;
  gradientStartColor?: string;
  gradientEndColor?: string;
  gradientType?: GradientType;
  gradientAngle?: number;
}

@Component({
  selector: 'pa-fill-selection-dialog',
  templateUrl: './fill-selection-dialog.component.html',
  styleUrls: ['./fill-selection-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal],
  host: {
    class: 'block',
  },
})
export class FillSelectionDialog {
  private readonly tools = inject(EditorToolsService);
  private readonly patternLibrary = inject(PatternLibraryService);

  readonly visible = signal(false);
  readonly mode = signal<FillToolMode>('color');
  readonly color = signal<string>('#000000');
  readonly patternId = signal<string>('checker-8');
  readonly gradientStartColor = signal<string>('#000000');
  readonly gradientEndColor = signal<string>('#ffffff');
  readonly gradientType = signal<GradientType>('linear');
  readonly gradientAngle = signal<number>(0);

  readonly allPatterns = this.patternLibrary.allPatterns;
  readonly shapePatterns = computed(() =>
    this.allPatterns().filter((p) => p.category === 'shape')
  );
  readonly texturePatterns = computed(() =>
    this.allPatterns().filter((p) => p.category === 'texture')
  );

  private resolveCallback?: (result: FillSelectionDialogResult | null) => void;
  private readonly elementRef = inject(ElementRef);

  constructor() {
    effect(() => {
      const isVisible = this.visible();
      if (isVisible) {
        setTimeout(() => this.renderPatternPreviews(), 0);
      }
    });
  }

  private renderPatternPreviews(): void {
    const patterns = this.allPatterns();
    for (const pattern of patterns) {
      const canvasEl = this.elementRef.nativeElement.querySelector(
        `#fill-selection-pattern-canvas-${pattern.id}`
      ) as HTMLCanvasElement;
      if (canvasEl) {
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
          const imageData = pattern.generate(64);
          ctx.putImageData(imageData, 0, 0);
        }
      }
    }
  }

  open(): Promise<FillSelectionDialogResult | null> {
    this.mode.set(this.tools.fillMode());
    this.color.set(this.tools.fillColor());
    this.patternId.set(this.tools.fillPatternId());
    this.gradientStartColor.set(this.tools.fillGradientStartColor());
    this.gradientEndColor.set(this.tools.fillGradientEndColor());
    this.gradientType.set(this.tools.fillGradientType());
    this.gradientAngle.set(this.tools.fillGradientAngle());
    this.visible.set(true);

    return new Promise((resolve) => {
      this.resolveCallback = resolve;
    });
  }

  close() {
    this.visible.set(false);
    if (this.resolveCallback) {
      this.resolveCallback(null);
      this.resolveCallback = undefined;
    }
  }

  selectMode(mode: FillToolMode) {
    this.mode.set(mode);
  }

  updateColor(event: Event) {
    const input = event.target as HTMLInputElement;
    this.color.set(input.value);
  }

  selectPattern(patternId: string) {
    this.patternId.set(patternId);
  }

  updateGradientStartColor(event: Event) {
    const input = event.target as HTMLInputElement;
    this.gradientStartColor.set(input.value);
  }

  updateGradientEndColor(event: Event) {
    const input = event.target as HTMLInputElement;
    this.gradientEndColor.set(input.value);
  }

  selectGradientType(type: GradientType) {
    this.gradientType.set(type);
  }

  updateGradientAngle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.gradientAngle.set(parseInt(input.value, 10));
  }

  apply() {
    const result: FillSelectionDialogResult = {
      mode: this.mode(),
      color: this.color(),
      patternId: this.patternId(),
      gradientStartColor: this.gradientStartColor(),
      gradientEndColor: this.gradientEndColor(),
      gradientType: this.gradientType(),
      gradientAngle: this.gradientAngle(),
    };
    this.visible.set(false);
    if (this.resolveCallback) {
      this.resolveCallback(result);
      this.resolveCallback = undefined;
    }
  }

  cancel() {
    this.close();
  }
}
