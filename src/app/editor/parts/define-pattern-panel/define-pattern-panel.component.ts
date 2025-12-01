import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DefinePatternService } from '../../../services/editor/define-pattern.service';
import { EditorDocumentService } from '../../../services/editor-document.service';

@Component({
  selector: 'pa-define-pattern-panel',
  templateUrl: './define-pattern-panel.component.html',
  styleUrls: ['./define-pattern-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgIcon, TranslocoPipe],
})
export class DefinePatternPanelComponent implements OnInit, OnDestroy {
  readonly definePatternService = inject(DefinePatternService);
  readonly documentService = inject(EditorDocumentService);

  readonly isActive = this.definePatternService.isActive;
  readonly hasSelection = this.definePatternService.hasSelection;
  readonly patternName = this.definePatternService.patternName;
  readonly patternScale = this.definePatternService.patternScale;
  readonly patternOpacity = this.definePatternService.patternOpacity;
  readonly livePreviewEnabled = this.definePatternService.livePreviewEnabled;

  readonly thumbnailSrc = signal<string | null>(null);
  readonly tilePreviewSrc = signal<string | null>(null);

  private previewUpdateEffect = effect(() => {
    const active = this.isActive();
    const scale = this.patternScale();
    const opacity = this.patternOpacity();
    if (active) {
      const thumb = this.definePatternService.generateThumbnail(64);
      this.thumbnailSrc.set(thumb);
      const preview = this.definePatternService.generateTilePreview(48, 3);
      this.tilePreviewSrc.set(preview);
    } else {
      this.thumbnailSrc.set(null);
      this.tilePreviewSrc.set(null);
    }
  });

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  onCreatePattern(): void {
    this.definePatternService.activate();
  }

  onSave(): void {
    this.definePatternService.savePattern();
  }

  onCancel(): void {
    this.definePatternService.deactivate();
  }

  onNameChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.definePatternService.setName(value);
  }

  onScaleChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.definePatternService.setScale(value);
    }
  }

  onOpacityChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) {
      this.definePatternService.setOpacity(value / 100);
    }
  }

  onLivePreviewChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.definePatternService.setLivePreview(checked);
  }

  get opacityPercent(): number {
    return Math.round(this.patternOpacity() * 100);
  }
}
