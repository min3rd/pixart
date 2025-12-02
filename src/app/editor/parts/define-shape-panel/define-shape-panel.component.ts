import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DefineShapeService } from '../../../services/editor/define-shape.service';
import { EditorDocumentService } from '../../../services/editor-document.service';
import { ShapeType } from '../../../services/shape-library.service';

@Component({
  selector: 'pa-define-shape-panel',
  templateUrl: './define-shape-panel.component.html',
  styleUrls: ['./define-shape-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgIcon, TranslocoPipe],
})
export class DefineShapePanelComponent {
  readonly defineShapeService = inject(DefineShapeService);
  readonly documentService = inject(EditorDocumentService);

  readonly isActive = this.defineShapeService.isActive;
  readonly hasSelection = this.defineShapeService.hasSelection;
  readonly shapeName = this.defineShapeService.shapeName;
  readonly shapeType = this.defineShapeService.shapeType;
  readonly cornerRadius = this.defineShapeService.cornerRadius;
  readonly pathSmoothing = this.defineShapeService.pathSmoothing;
  readonly livePreviewEnabled = this.defineShapeService.livePreviewEnabled;

  readonly thumbnailSrc = signal<string | null>(null);
  readonly vectorPreviewSrc = signal<string | null>(null);

  private previewUpdateEffect = effect(() => {
    const active = this.isActive();
    const type = this.shapeType();
    const radius = this.cornerRadius();
    const smooth = this.pathSmoothing();
    if (active) {
      const thumb = this.defineShapeService.generateThumbnail(64);
      this.thumbnailSrc.set(thumb);
      const preview = this.defineShapeService.generateVectorPreview(128);
      this.vectorPreviewSrc.set(preview);
    } else {
      this.thumbnailSrc.set(null);
      this.vectorPreviewSrc.set(null);
    }
  });

  onCreateShape(): void {
    this.defineShapeService.activate();
  }

  onSave(): void {
    this.defineShapeService.saveShape();
  }

  onCancel(): void {
    this.defineShapeService.deactivate();
  }

  onNameChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    this.defineShapeService.setName(target.value);
  }

  onShapeTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    this.defineShapeService.setShapeType(target.value as ShapeType);
  }

  onCornerRadiusChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const value = parseInt(target.value, 10);
    if (!isNaN(value)) {
      this.defineShapeService.setCornerRadius(value);
    }
  }

  onPathSmoothingChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const value = parseInt(target.value, 10);
    if (!isNaN(value)) {
      this.defineShapeService.setPathSmoothing(value / 100);
    }
  }

  onLivePreviewChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    this.defineShapeService.setLivePreview(target.checked);
  }

  get pathSmoothingPercent(): number {
    return Math.round(this.pathSmoothing() * 100);
  }
}
