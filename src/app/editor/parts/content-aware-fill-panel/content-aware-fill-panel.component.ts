import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContentAwareFillStateService } from '../../../services/editor/content-aware-fill-state.service';
import { EditorDocumentService } from '../../../services/editor-document.service';

@Component({
  selector: 'pa-content-aware-fill-panel',
  templateUrl: './content-aware-fill-panel.component.html',
  styleUrls: ['./content-aware-fill-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe],
  host: {
    class: 'block h-full',
  },
})
export class ContentAwareFillPanelComponent {
  readonly state = inject(ContentAwareFillStateService);
  readonly document = inject(EditorDocumentService);

  readonly onApply = output<void>();
  readonly onCancel = output<void>();

  get detailLevel(): number {
    return this.state.detailLevel();
  }

  set detailLevel(value: number) {
    this.state.setDetailLevel(value);
  }

  get sampleRadius(): number {
    return this.state.sampleRadius();
  }

  set sampleRadius(value: number) {
    this.state.setSampleRadius(value);
  }

  get exclusionMaskEnabled(): boolean {
    return this.state.exclusionMaskEnabled();
  }

  set exclusionMaskEnabled(value: boolean) {
    this.state.setExclusionMaskEnabled(value);
  }

  get previewEnabled(): boolean {
    return this.state.previewEnabled();
  }

  set previewEnabled(value: boolean) {
    this.state.setPreviewEnabled(value);
  }

  onDetailLevelInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) {
      this.detailLevel = value;
    }
  }

  onSampleRadiusInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) {
      this.sampleRadius = value;
    }
  }

  clearExclusionMask(): void {
    this.state.clearExclusionMask();
  }

  apply(): void {
    this.onApply.emit();
  }

  cancel(): void {
    this.onCancel.emit();
  }
}
