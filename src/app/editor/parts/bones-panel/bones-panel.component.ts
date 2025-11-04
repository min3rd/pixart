import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPlus,
  heroTrash,
  heroPencil,
  heroLink,
  heroXMark,
  heroArrowPath,
} from '@ng-icons/heroicons/outline';
import { EditorDocumentService } from '../../../services/editor-document.service';
import {
  EditorBoneService,
  type Bone,
  type BonePoint,
} from '../../../services/editor/editor-bone.service';
import { EditorToolsService } from '../../../services/editor-tools.service';
import {
  EditPointDialog,
  type EditPointResult,
} from '../../../shared/components/edit-point-dialog/edit-point-dialog.component';

@Component({
  selector: 'pa-bones-panel',
  templateUrl: './bones-panel.component.html',
  styleUrls: ['./bones-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoPipe,
    NgIconComponent,
    FormsModule,
    EditPointDialog,
  ],
  providers: [
    provideIcons({
      heroPlus,
      heroTrash,
      heroPencil,
      heroLink,
      heroXMark,
      heroArrowPath,
    }),
  ],
  host: {
    class: 'block h-full',
  },
})
export class BonesPanel {
  @ViewChild(EditPointDialog) editPointDialog?: EditPointDialog;

  readonly document = inject(EditorDocumentService);
  readonly boneService = inject(EditorBoneService);
  readonly translocoService = inject(TranslocoService);
  readonly tools = inject(EditorToolsService);
  readonly editingBoneId = signal<string>('');
  readonly newBoneName = signal<string>('');
  readonly editingPointBoneId = signal<string>('');
  readonly editingPointId = signal<string>('');
  readonly autoBindingBoneId = signal<string>('');

  readonly currentFrameBones = computed(() => {
    const currentFrame =
      this.document.frames()[this.document.currentFrameIndex()];
    if (!currentFrame) return [];
    return this.boneService.getBones(currentFrame.id);
  });

  selectBone(id: string) {
    this.boneService.selectBone(id);
  }

  removeBone(id: string, event: Event) {
    event.stopPropagation();
    const msg = this.translocoService.translate('bones.confirmRemove');
    if (confirm(msg)) {
      const currentFrame =
        this.document.frames()[this.document.currentFrameIndex()];
      if (currentFrame) {
        this.boneService.deleteBone(currentFrame.id, id);
      }
    }
  }

  startRename(id: string, currentName: string, event: Event) {
    event.stopPropagation();
    this.editingBoneId.set(id);
    this.newBoneName.set(currentName);
  }

  saveRename(id: string) {
    const name = this.newBoneName().trim();
    if (name) {
      const currentFrame =
        this.document.frames()[this.document.currentFrameIndex()];
      if (currentFrame) {
        const bone = this.currentFrameBones().find((b) => b.id === id);
        if (bone) {
          this.boneService.updateBone(currentFrame.id, id, {
            ...bone,
            id: name,
          });
        }
      }
    }
    this.editingBoneId.set('');
    this.newBoneName.set('');
  }

  cancelRename() {
    this.editingBoneId.set('');
    this.newBoneName.set('');
  }

  toggleBoneAttachment(boneId: string, event: Event) {
    event.stopPropagation();
    const currentAnim = this.document.getCurrentAnimation();
    if (!currentAnim) return;

    if (this.isBoneAttachedToCurrentAnimation(boneId)) {
      this.document.detachBoneFromAnimation(currentAnim.id, boneId);
    } else {
      this.document.attachBoneToAnimation(currentAnim.id, boneId);
    }
  }

  isBoneAttachedToCurrentAnimation(boneId: string): boolean {
    const currentAnim = this.document.getCurrentAnimation();
    if (!currentAnim) return false;
    return currentAnim.boneIds.includes(boneId);
  }

  getCurrentAnimationName(): string {
    const anim = this.document.getCurrentAnimation();
    return anim ? anim.name : 'None';
  }

  getAttachedBonesCount(): number {
    const anim = this.document.getCurrentAnimation();
    return anim ? anim.boneIds.length : 0;
  }

  getPointsCount(bone: Bone): number {
    return bone.points.length;
  }

  getRootPoints(bone: Bone) {
    return bone.points.filter((p) => !p.parentId);
  }

  getChildPoints(bone: Bone, parentId: string) {
    return bone.points.filter((p) => p.parentId === parentId);
  }

  getAllDescendants(bone: Bone, parentId: string, depth = 1): any[] {
    const children = this.getChildPoints(bone, parentId);
    const result: any[] = [];

    for (const child of children) {
      result.push({
        point: child,
        depth: depth,
      });
      const descendants = this.getAllDescendants(bone, child.id, depth + 1);
      result.push(...descendants);
    }

    return result;
  }

  selectPoint(pointId: string, event: Event) {
    event.stopPropagation();
    this.boneService.selectPoint(pointId);
  }

  removePoint(boneId: string, pointId: string, event: Event) {
    event.stopPropagation();
    const msg = this.translocoService.translate('bones.confirmRemovePoint');
    if (confirm(msg)) {
      const currentFrame =
        this.document.frames()[this.document.currentFrameIndex()];
      if (currentFrame) {
        this.boneService.deletePoint(currentFrame.id, boneId, pointId);
      }
    }
  }

  onPointDoubleClick(boneId: string, point: BonePoint, event: Event) {
    event.stopPropagation();
    this.editingPointBoneId.set(boneId);
    this.editingPointId.set(point.id);
    const currentFrame =
      this.document.frames()[this.document.currentFrameIndex()];
    if (!currentFrame) return;
    const bone = this.currentFrameBones().find((b) => b.id === boneId);
    if (!bone) return;
    this.editPointDialog?.open(point.id, point.name, point.color || bone.color);
  }

  handleEditPointConfirm(result: EditPointResult) {
    const boneId = this.editingPointBoneId();
    const pointId = this.editingPointId();
    const currentFrame =
      this.document.frames()[this.document.currentFrameIndex()];
    if (!currentFrame || !boneId || !pointId) return;

    const bone = this.currentFrameBones().find((b) => b.id === boneId);
    const point = bone?.points.find((p) => p.id === pointId);
    if (!point) return;

    const oldColor = point.color || bone?.color;
    const updates: Partial<BonePoint> = {};
    if (result.name !== undefined) {
      updates.name = result.name;
    }
    if (result.color) {
      updates.color = result.color;
    }

    this.boneService.updatePointProperties(
      currentFrame.id,
      boneId,
      pointId,
      updates,
    );

    if (result.color && oldColor !== result.color) {
      this.updateBoundPixelColors(
        currentFrame.id,
        boneId,
        pointId,
        result.color,
      );
    }

    this.editingPointBoneId.set('');
    this.editingPointId.set('');
  }

  handleEditPointCancel() {
    this.editingPointBoneId.set('');
    this.editingPointId.set('');
  }

  private updateBoundPixelColors(
    frameId: string,
    boneId: string,
    pointId: string,
    newColor: string,
  ) {
    const bindings = this.document.keyframeService.getPixelBindings(frameId);
    const pointBindings = bindings.filter(
      (b) => b.boneId === boneId && b.bonePointId === pointId,
    );

    if (pointBindings.length === 0) return;

    for (const binding of pointBindings) {
      this.document.applyBrushToLayer(
        binding.layerId,
        binding.pixelX,
        binding.pixelY,
        1,
        newColor,
      );
    }
  }

  autoBindBonePixels(boneId: string, event: Event) {
    event.stopPropagation();
    const currentFrame =
      this.document.frames()[this.document.currentFrameIndex()];
    if (!currentFrame) return;

    const bone = this.currentFrameBones().find((b) => b.id === boneId);
    if (!bone || bone.points.length === 0) return;

    const layerId = this.document.selectedLayerId();
    const layerBuffer = this.document.getLayerBuffer(layerId);
    if (!layerBuffer) return;

    this.autoBindingBoneId.set(boneId);

    const radius = this.tools.boneAutoBindRadius();
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();

    this.document.keyframeService.clearPixelBindings(currentFrame.id);

    for (const point of bone.points) {
      this.boneService.autoBindPixels(
        currentFrame.id,
        layerBuffer,
        w,
        h,
        boneId,
        point.id,
        point.x,
        point.y,
        radius,
      );
    }

    setTimeout(() => {
      this.autoBindingBoneId.set('');
    }, 500);
  }

  getPointDisplayName(point: BonePoint): string {
    return point.name || `Point (${point.x}, ${point.y})`;
  }

  getPointDisplayColor(bone: Bone, point: BonePoint): string {
    return point.color || bone.color;
  }
}
