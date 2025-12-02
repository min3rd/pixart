import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroClipboard,
  heroClipboardDocument,
  heroArrowPath,
  heroChevronDown,
  heroChevronUp,
} from '@ng-icons/heroicons/outline';
import { EditorKeyframeService } from '../../../services/editor/editor-keyframe.service';
import { EditorBoneService } from '../../../services/editor/editor-bone.service';
import { EditorAnimationCollectionService } from '../../../services/editor/editor-animation-collection.service';
import type {
  Keyframe,
  BoneTransform,
} from '../../../services/editor/editor-keyframe.service';

export interface BoneConfigClipboard {
  transforms: BoneTransform[];
  sourceKeyframeId: string;
  sourceTime: number;
}

@Component({
  selector: 'pa-bone-keyframe-info-panel',
  templateUrl: './bone-keyframe-info-panel.component.html',
  styleUrls: ['./bone-keyframe-info-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoPipe, NgIconComponent],
  providers: [
    provideIcons({
      heroClipboard,
      heroClipboardDocument,
      heroArrowPath,
      heroChevronDown,
      heroChevronUp,
    }),
  ],
  host: {
    class: 'block',
  },
})
export class BoneKeyframeInfoPanel {
  readonly keyframeService = inject(EditorKeyframeService);
  readonly boneService = inject(EditorBoneService);
  readonly animationService = inject(EditorAnimationCollectionService);

  readonly selectedKeyframeId = input<string | null>(null);
  readonly currentTime = input<number>(0);

  readonly configCopied = output<BoneConfigClipboard>();
  readonly configPasted = output<BoneTransform[]>();

  readonly isExpanded = signal<boolean>(true);
  readonly clipboard = signal<BoneConfigClipboard | null>(null);
  readonly expandedBones = signal<Set<string>>(new Set());

  readonly selectedKeyframe = computed<Keyframe | null>(() => {
    const keyframeId = this.selectedKeyframeId();
    if (!keyframeId) return null;

    const animation = this.animationService.getCurrentAnimation();
    if (!animation) return null;

    const keyframes = this.keyframeService.getKeyframes(animation.id);
    return keyframes.find((kf) => kf.id === keyframeId) ?? null;
  });

  readonly boneTransforms = computed<BoneTransform[]>(() => {
    const keyframe = this.selectedKeyframe();
    return keyframe?.boneTransforms ?? [];
  });

  readonly groupedTransforms = computed<Map<string, BoneTransform[]>>(() => {
    const transforms = this.boneTransforms();
    const grouped = new Map<string, BoneTransform[]>();

    for (const transform of transforms) {
      const boneId = transform.boneId;
      if (!grouped.has(boneId)) {
        grouped.set(boneId, []);
      }
      grouped.get(boneId)!.push(transform);
    }

    return grouped;
  });

  readonly hasTransforms = computed<boolean>(() => {
    return this.boneTransforms().length > 0;
  });

  toggleExpanded(): void {
    this.isExpanded.update((v) => !v);
  }

  toggleBoneExpanded(boneId: string): void {
    this.expandedBones.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(boneId)) {
        newSet.delete(boneId);
      } else {
        newSet.add(boneId);
      }
      return newSet;
    });
  }

  isBoneExpanded(boneId: string): boolean {
    return this.expandedBones().has(boneId);
  }

  copyConfig(): void {
    const keyframe = this.selectedKeyframe();
    if (!keyframe || keyframe.boneTransforms.length === 0) return;

    const clipboardData: BoneConfigClipboard = {
      transforms: [...keyframe.boneTransforms],
      sourceKeyframeId: keyframe.id,
      sourceTime: keyframe.time,
    };

    this.clipboard.set(clipboardData);
    this.configCopied.emit(clipboardData);
  }

  pasteConfig(): void {
    const clipboardData = this.clipboard();
    if (!clipboardData) return;

    const animation = this.animationService.getCurrentAnimation();
    const keyframeId = this.selectedKeyframeId();
    if (!animation || !keyframeId) return;

    const keyframe = this.keyframeService
      .getKeyframes(animation.id)
      .find((kf) => kf.id === keyframeId);
    if (!keyframe) return;

    const updatedTransforms = [...clipboardData.transforms];
    this.keyframeService.updateKeyframe(animation.id, keyframeId, {
      boneTransforms: updatedTransforms,
    });

    this.configPasted.emit(updatedTransforms);
  }

  canPaste(): boolean {
    const clip = this.clipboard();
    return (
      clip !== null &&
      this.selectedKeyframeId() !== null &&
      clip.sourceKeyframeId !== this.selectedKeyframeId()
    );
  }

  formatPosition(value: number): string {
    return value.toFixed(1);
  }

  formatRotation(value: number): string {
    return `${value.toFixed(1)}°`;
  }

  formatScale(value: number): string {
    return value.toFixed(2);
  }

  formatTime(ms: number): string {
    return `${(ms / 1000).toFixed(2)}s`;
  }

  getBoneIds(): string[] {
    return Array.from(this.groupedTransforms().keys());
  }

  getTransformsForBone(boneId: string): BoneTransform[] {
    return this.groupedTransforms().get(boneId) ?? [];
  }
}
