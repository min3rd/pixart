import { Injectable, signal, computed } from '@angular/core';

export interface BoneTransform {
  boneId: string;
  bonePointId: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Keyframe {
  id: string;
  time: number;
  boneTransforms: BoneTransform[];
}

export interface PixelBinding {
  pixelX: number;
  pixelY: number;
  layerId: string;
  boneId: string;
  bonePointId: string;
  offsetX: number;
  offsetY: number;
  weight: number;
}

@Injectable({ providedIn: 'root' })
export class EditorKeyframeService {
  private readonly keyframes = signal<Map<string, Keyframe[]>>(new Map());
  private readonly pixelBindings = signal<Map<string, PixelBinding[]>>(
    new Map(),
  );
  private readonly currentTime = signal<number>(0);
  private readonly animationDuration = signal<number>(3000);
  private readonly timelineMode = signal<'frame' | 'time'>('frame');

  readonly isTimelineMode = computed(() => this.timelineMode() === 'time');

  getKeyframes(animationId: string): Keyframe[] {
    return this.keyframes().get(animationId) || [];
  }

  addKeyframe(animationId: string, keyframe: Keyframe): void {
    const current = new Map(this.keyframes());
    const animKeyframes = current.get(animationId) || [];
    const updated = [...animKeyframes, keyframe].sort(
      (a, b) => a.time - b.time,
    );
    current.set(animationId, updated);
    this.keyframes.set(current);
  }

  updateKeyframe(
    animationId: string,
    keyframeId: string,
    updates: Partial<Keyframe>,
  ): void {
    const current = new Map(this.keyframes());
    const animKeyframes = current.get(animationId) || [];
    const updated = animKeyframes.map((kf) =>
      kf.id === keyframeId ? { ...kf, ...updates } : kf,
    );
    current.set(animationId, updated);
    this.keyframes.set(current);
  }

  deleteKeyframe(animationId: string, keyframeId: string): void {
    const current = new Map(this.keyframes());
    const animKeyframes = current.get(animationId) || [];
    current.set(
      animationId,
      animKeyframes.filter((kf) => kf.id !== keyframeId),
    );
    this.keyframes.set(current);
  }

  getCurrentTime(): number {
    return this.currentTime();
  }

  setCurrentTime(time: number): void {
    this.currentTime.set(Math.max(0, Math.min(time, this.animationDuration())));
  }

  getAnimationDuration(): number {
    return this.animationDuration();
  }

  setAnimationDuration(duration: number): void {
    this.animationDuration.set(Math.max(100, duration));
  }

  setTimelineMode(mode: 'frame' | 'time'): void {
    this.timelineMode.set(mode);
  }

  getTimelineMode(): 'frame' | 'time' {
    return this.timelineMode();
  }

  interpolateBoneTransform(
    animationId: string,
    boneId: string,
    bonePointId: string,
    time: number,
  ): BoneTransform | null {
    const keyframes = this.getKeyframes(animationId);
    if (keyframes.length === 0) return null;

    const relevantKeyframes = keyframes.filter((kf) =>
      kf.boneTransforms.some(
        (bt) => bt.boneId === boneId && bt.bonePointId === bonePointId,
      ),
    );

    if (relevantKeyframes.length === 0) return null;

    const before = relevantKeyframes
      .filter((kf) => kf.time <= time)
      .sort((a, b) => b.time - a.time)[0];

    const after = relevantKeyframes
      .filter((kf) => kf.time > time)
      .sort((a, b) => a.time - b.time)[0];

    if (!before && !after) return null;
    if (!after) {
      return (
        before.boneTransforms.find(
          (bt) => bt.boneId === boneId && bt.bonePointId === bonePointId,
        ) || null
      );
    }
    if (!before) {
      return (
        after.boneTransforms.find(
          (bt) => bt.boneId === boneId && bt.bonePointId === bonePointId,
        ) || null
      );
    }

    const beforeTransform = before.boneTransforms.find(
      (bt) => bt.boneId === boneId && bt.bonePointId === bonePointId,
    );
    const afterTransform = after.boneTransforms.find(
      (bt) => bt.boneId === boneId && bt.bonePointId === bonePointId,
    );

    if (!beforeTransform || !afterTransform) {
      return beforeTransform || afterTransform || null;
    }

    const t = (time - before.time) / (after.time - before.time);

    return {
      boneId,
      bonePointId,
      x: this.lerp(beforeTransform.x, afterTransform.x, t),
      y: this.lerp(beforeTransform.y, afterTransform.y, t),
      rotation: this.lerpAngle(
        beforeTransform.rotation,
        afterTransform.rotation,
        t,
      ),
      scaleX: this.lerp(beforeTransform.scaleX, afterTransform.scaleX, t),
      scaleY: this.lerp(beforeTransform.scaleY, afterTransform.scaleY, t),
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return a + diff * t;
  }

  addPixelBinding(frameId: string, binding: PixelBinding): void {
    const current = new Map(this.pixelBindings());
    const frameBindings = current.get(frameId) || [];
    current.set(frameId, [...frameBindings, binding]);
    this.pixelBindings.set(current);
  }

  getPixelBindings(frameId: string): PixelBinding[] {
    const bindings = this.pixelBindings().get(frameId) || [];
    return bindings.map(binding => ({
      ...binding,
      weight: binding.weight ?? 1.0
    }));
  }

  clearPixelBindings(frameId: string): void {
    const current = new Map(this.pixelBindings());
    current.delete(frameId);
    this.pixelBindings.set(current);
  }

  snapshot(): {
    keyframes: Record<string, Keyframe[]>;
    pixelBindings: Record<string, PixelBinding[]>;
    currentTime: number;
    animationDuration: number;
    timelineMode: 'frame' | 'time';
  } {
    const keyframesObj: Record<string, Keyframe[]> = {};
    for (const [key, value] of this.keyframes().entries()) {
      keyframesObj[key] = value;
    }

    const bindingsObj: Record<string, PixelBinding[]> = {};
    for (const [key, value] of this.pixelBindings().entries()) {
      bindingsObj[key] = value;
    }

    return {
      keyframes: keyframesObj,
      pixelBindings: bindingsObj,
      currentTime: this.currentTime(),
      animationDuration: this.animationDuration(),
      timelineMode: this.timelineMode(),
    };
  }

  restore(data: {
    keyframes?: Record<string, Keyframe[]>;
    pixelBindings?: Record<string, PixelBinding[]>;
    currentTime?: number;
    animationDuration?: number;
    timelineMode?: 'frame' | 'time';
  }): void {
    if (data.keyframes) {
      const keyframesMap = new Map<string, Keyframe[]>();
      for (const [key, value] of Object.entries(data.keyframes)) {
        keyframesMap.set(key, value);
      }
      this.keyframes.set(keyframesMap);
    }

    if (data.pixelBindings) {
      const bindingsMap = new Map<string, PixelBinding[]>();
      for (const [key, value] of Object.entries(data.pixelBindings)) {
        bindingsMap.set(key, value);
      }
      this.pixelBindings.set(bindingsMap);
    }

    if (typeof data.currentTime === 'number') {
      this.currentTime.set(data.currentTime);
    }

    if (typeof data.animationDuration === 'number') {
      this.animationDuration.set(data.animationDuration);
    }

    if (data.timelineMode) {
      this.timelineMode.set(data.timelineMode);
    }
  }
}
