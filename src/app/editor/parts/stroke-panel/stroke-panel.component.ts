import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  EditorStrokeService,
  StrokeStyle,
  StrokePosition,
} from '../../../services/editor/editor-stroke.service';
import { EditorDocumentService } from '../../../services/editor-document.service';

@Component({
  selector: 'pa-stroke-panel',
  templateUrl: './stroke-panel.component.html',
  styleUrls: ['./stroke-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe],
  host: {
    class: 'block h-full',
  },
})
export class StrokePanelComponent {
  readonly state = inject(EditorStrokeService);
  readonly document = inject(EditorDocumentService);

  readonly onApply = output<void>();
  readonly onCancel = output<void>();

  get strokeColor(): string {
    return this.state.strokeColor();
  }

  set strokeColor(value: string) {
    this.state.setStrokeColor(value);
  }

  get strokeWidth(): number {
    return this.state.strokeWidth();
  }

  set strokeWidth(value: number) {
    this.state.setStrokeWidth(value);
  }

  get strokeStyle(): StrokeStyle {
    return this.state.strokeStyle();
  }

  set strokeStyle(value: StrokeStyle) {
    this.state.setStrokeStyle(value);
  }

  get strokePosition(): StrokePosition {
    return this.state.strokePosition();
  }

  set strokePosition(value: StrokePosition) {
    this.state.setStrokePosition(value);
  }

  get previewEnabled(): boolean {
    return this.state.previewEnabled();
  }

  set previewEnabled(value: boolean) {
    this.state.setPreviewEnabled(value);
  }

  onStrokeWidthInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) {
      this.strokeWidth = value;
    }
  }

  onStrokeColorInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.strokeColor = value;
  }

  apply(): void {
    this.onApply.emit();
  }

  cancel(): void {
    this.onCancel.emit();
  }
}
