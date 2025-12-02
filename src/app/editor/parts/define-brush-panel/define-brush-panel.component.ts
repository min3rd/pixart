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
import { DefineBrushService } from '../../../services/editor/define-brush.service';

@Component({
  selector: 'pa-define-brush-panel',
  templateUrl: './define-brush-panel.component.html',
  styleUrls: ['./define-brush-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgIcon, TranslocoPipe],
})
export class DefineBrushPanelComponent {
  readonly defineBrushService = inject(DefineBrushService);

  readonly isActive = this.defineBrushService.isActive;
  readonly hasSelection = this.defineBrushService.hasSelection;
  readonly brushName = this.defineBrushService.brushName;
  readonly brushType = this.defineBrushService.brushType;
  readonly brushOpacity = this.defineBrushService.brushOpacity;
  readonly brushSpacing = this.defineBrushService.brushSpacing;
  readonly customBrushes = this.defineBrushService.customBrushes;

  readonly thumbnailSrc = signal<string | null>(null);
  readonly previewSrc = signal<string | null>(null);

  private previewUpdateEffect = effect(() => {
    const active = this.isActive();
    const opacity = this.brushOpacity();
    const spacing = this.brushSpacing();
    if (active) {
      const thumb = this.defineBrushService.generateThumbnail(64);
      this.thumbnailSrc.set(thumb);
      const preview = this.defineBrushService.generatePreview(128);
      this.previewSrc.set(preview);
    } else {
      this.thumbnailSrc.set(null);
      this.previewSrc.set(null);
    }
  });

  onCreateBrush(): void {
    this.defineBrushService.activate();
  }

  onSave(): void {
    this.defineBrushService.saveBrush();
  }

  onCancel(): void {
    this.defineBrushService.deactivate();
  }

  onNameChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    this.defineBrushService.setName(target.value);
  }

  onTypeChange(type: 'soft' | 'hard' | 'normal'): void {
    this.defineBrushService.setType(type);
  }

  onOpacityChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const value = parseInt(target.value, 10);
    if (!isNaN(value)) {
      this.defineBrushService.setOpacity(value / 100);
    }
  }

  onSpacingChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const value = parseInt(target.value, 10);
    if (!isNaN(value)) {
      this.defineBrushService.setSpacing(value / 100);
    }
  }

  onDeleteBrush(id: string): void {
    this.defineBrushService.deleteBrush(id);
  }

  get opacityPercent(): number {
    return Math.round(this.brushOpacity() * 100);
  }

  get spacingPercent(): number {
    return Math.round(this.brushSpacing() * 100);
  }
}
