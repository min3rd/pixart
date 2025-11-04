import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroXMark,
  heroSparkles,
  heroCheckCircle,
} from '@ng-icons/heroicons/outline';
import {
  BoneTemplateType,
  BoneTemplate,
} from '../../../services/bone-generation.service';

export interface BoneGenerationResult {
  templateType: BoneTemplateType;
}

@Component({
  selector: 'pa-bone-generation-dialog',
  templateUrl: './bone-generation-dialog.component.html',
  styleUrls: ['./bone-generation-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslocoPipe, NgIconComponent],
  providers: [
    provideIcons({
      heroXMark,
      heroSparkles,
      heroCheckCircle,
    }),
  ],
  host: {
    class: 'block',
  },
})
export class BoneGenerationDialog {
  readonly visible = signal(false);
  readonly suggestedTemplate = signal<BoneTemplateType>('human');
  readonly selectedTemplate = signal<BoneTemplateType>('human');
  readonly availableTemplates = signal<BoneTemplate[]>([]);

  readonly confirmed = output<BoneGenerationResult>();
  readonly cancelled = output<void>();

  open(
    suggestedTemplate: BoneTemplateType,
    availableTemplates: BoneTemplate[],
  ) {
    this.suggestedTemplate.set(suggestedTemplate);
    this.selectedTemplate.set(suggestedTemplate);
    this.availableTemplates.set(availableTemplates);
    this.visible.set(true);
  }

  close() {
    this.visible.set(false);
  }

  selectTemplate(type: BoneTemplateType) {
    this.selectedTemplate.set(type);
  }

  confirm() {
    this.confirmed.emit({
      templateType: this.selectedTemplate(),
    });
    this.close();
  }

  cancel() {
    this.cancelled.emit();
    this.close();
  }
}
