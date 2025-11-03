import { Injectable, signal, inject } from '@angular/core';
import { EditorKeyframeService } from './editor-keyframe.service';

export interface BonePoint {
  id: string;
  x: number;
  y: number;
  parentId?: string;
}

export interface Bone {
  id: string;
  points: BonePoint[];
  color: string;
  thickness: number;
}

export interface FrameBones {
  frameId: string;
  bones: Bone[];
}

@Injectable({ providedIn: 'root' })
export class EditorBoneService {
  private readonly keyframeService = inject(EditorKeyframeService);
  private readonly bones = signal<Map<string, Bone[]>>(new Map());
  private readonly selectedBoneId = signal<string | null>(null);
  private readonly selectedPointId = signal<string | null>(null);

  getBones(frameId: string): Bone[] {
    return this.bones().get(frameId) || [];
  }

  addBone(frameId: string, bone: Bone): void {
    const current = new Map(this.bones());
    const frameBones = current.get(frameId) || [];
    current.set(frameId, [...frameBones, bone]);
    this.bones.set(current);
  }

  updateBone(frameId: string, boneId: string, updates: Partial<Bone>): void {
    const current = new Map(this.bones());
    const frameBones = current.get(frameId) || [];
    const updated = frameBones.map((b) =>
      b.id === boneId ? { ...b, ...updates } : b,
    );
    current.set(frameId, updated);
    this.bones.set(current);
  }

  deleteBone(frameId: string, boneId: string): void {
    const current = new Map(this.bones());
    const frameBones = current.get(frameId) || [];
    current.set(
      frameId,
      frameBones.filter((b) => b.id !== boneId),
    );
    this.bones.set(current);
  }

  addPointToBone(
    frameId: string,
    boneId: string,
    point: BonePoint,
  ): void {
    const current = new Map(this.bones());
    const frameBones = current.get(frameId) || [];
    const updated = frameBones.map((b) => {
      if (b.id === boneId) {
        return { ...b, points: [...b.points, point] };
      }
      return b;
    });
    current.set(frameId, updated);
    this.bones.set(current);
  }

  updatePoint(
    frameId: string,
    boneId: string,
    pointId: string,
    x: number,
    y: number,
    animationId?: string,
    currentTime?: number,
  ): void {
    const current = new Map(this.bones());
    const frameBones = current.get(frameId) || [];
    const updated = frameBones.map((b) => {
      if (b.id === boneId) {
        return {
          ...b,
          points: b.points.map((p) =>
            p.id === pointId ? { ...p, x, y } : p,
          ),
        };
      }
      return b;
    });
    current.set(frameId, updated);
    this.bones.set(current);

    if (animationId && typeof currentTime === 'number') {
      this.saveBoneTransformToKeyframe(animationId, boneId, pointId, x, y, currentTime);
    }
  }

  private saveBoneTransformToKeyframe(
    animationId: string,
    boneId: string,
    bonePointId: string,
    x: number,
    y: number,
    time: number,
  ): void {
    const keyframes = this.keyframeService.getKeyframes(animationId);
    let keyframe = keyframes.find(kf => Math.abs(kf.time - time) < 50);

    if (!keyframe) {
      keyframe = {
        id: `keyframe-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        time,
        boneTransforms: [],
      };
      this.keyframeService.addKeyframe(animationId, keyframe);
    }

    const existingTransformIndex = keyframe.boneTransforms.findIndex(
      bt => bt.boneId === boneId && bt.bonePointId === bonePointId
    );

    const transform = {
      boneId,
      bonePointId,
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };

    if (existingTransformIndex >= 0) {
      const updatedTransforms = [...keyframe.boneTransforms];
      updatedTransforms[existingTransformIndex] = transform;
      this.keyframeService.updateKeyframe(animationId, keyframe.id, {
        boneTransforms: updatedTransforms,
      });
    } else {
      this.keyframeService.updateKeyframe(animationId, keyframe.id, {
        boneTransforms: [...keyframe.boneTransforms, transform],
      });
    }
  }

  autoBindPixels(
    frameId: string,
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
    boneId: string,
    pointId: string,
    pointX: number,
    pointY: number,
    radius: number,
  ): void {
    const radiusSq = radius * radius;
    
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const idx = y * canvasWidth + x;
        const pixel = layerBuffer[idx];
        
        if (!pixel || pixel.length === 0) continue;
        
        const dx = x - pointX;
        const dy = y - pointY;
        const distSq = dx * dx + dy * dy;
        
        if (distSq <= radiusSq) {
          const binding = {
            pixelX: x,
            pixelY: y,
            layerId: frameId,
            boneId,
            bonePointId: pointId,
            offsetX: dx,
            offsetY: dy,
          };
          
          this.keyframeService.addPixelBinding(frameId, binding);
        }
      }
    }
  }

  getTransformedPixelPosition(
    frameId: string,
    pixelX: number,
    pixelY: number,
    animationId: string,
    currentTime: number,
  ): { x: number; y: number } | null {
    const bindings = this.keyframeService.getPixelBindings(frameId);
    const binding = bindings.find(b => b.pixelX === pixelX && b.pixelY === pixelY);
    
    if (!binding) return null;
    
    const transform = this.keyframeService.interpolateBoneTransform(
      animationId,
      binding.boneId,
      binding.bonePointId,
      currentTime,
    );
    
    if (!transform) return null;
    
    return {
      x: transform.x + binding.offsetX,
      y: transform.y + binding.offsetY,
    };
  }

  deletePoint(frameId: string, boneId: string, pointId: string): void {
    const current = new Map(this.bones());
    const frameBones = current.get(frameId) || [];
    const updated = frameBones.map((b) => {
      if (b.id === boneId) {
        const remainingPoints = b.points.filter((p) => p.id !== pointId);
        const updatedPoints = remainingPoints.map((p) => {
          if (p.parentId === pointId) {
            const deletedPoint = b.points.find((pt) => pt.id === pointId);
            return { ...p, parentId: deletedPoint?.parentId || undefined };
          }
          return p;
        });
        return { ...b, points: updatedPoints };
      }
      return b;
    });
    current.set(frameId, updated);
    this.bones.set(current);
  }

  getSelectedBone(): string | null {
    return this.selectedBoneId();
  }

  getSelectedPoint(): string | null {
    return this.selectedPointId();
  }

  selectBone(boneId: string | null): void {
    this.selectedBoneId.set(boneId);
  }

  selectPoint(pointId: string | null): void {
    this.selectedPointId.set(pointId);
  }

  clearSelection(): void {
    this.selectedBoneId.set(null);
    this.selectedPointId.set(null);
  }

  snapshot(): Map<string, Bone[]> {
    return new Map(this.bones());
  }

  restore(data: Map<string, Bone[]>): void {
    this.bones.set(new Map(data));
  }

  clear(): void {
    this.bones.set(new Map());
    this.clearSelection();
  }
}
