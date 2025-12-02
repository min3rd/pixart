import { Injectable, signal, computed, inject } from '@angular/core';
import {
  ContentAwareFillService,
  ContentAwareFillOptions,
} from '../content-aware-fill.service';

export interface SamplingArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContentAwareFillState {
  isActive: boolean;
  detailLevel: number;
  sampleRadius: number;
  exclusionMaskEnabled: boolean;
  previewEnabled: boolean;
  samplingArea: SamplingArea | null;
  exclusionMask: Set<string>;
}

@Injectable({ providedIn: 'root' })
export class ContentAwareFillStateService {
  private readonly contentAwareFillService = inject(ContentAwareFillService);

  readonly isActive = signal(false);
  readonly detailLevel = signal(5);
  readonly sampleRadius = signal(5);
  readonly exclusionMaskEnabled = signal(false);
  readonly previewEnabled = signal(true);
  readonly samplingArea = signal<SamplingArea | null>(null);
  readonly exclusionMask = signal<Set<string>>(new Set());
  readonly previewImageData = signal<ImageData | null>(null);

  readonly options = computed<ContentAwareFillOptions>(() => ({
    threshold: this.detailLevel() * 10,
    sampleRadius: this.sampleRadius(),
  }));

  activate(): void {
    this.isActive.set(true);
  }

  deactivate(): void {
    this.isActive.set(false);
    this.samplingArea.set(null);
    this.exclusionMask.set(new Set());
    this.previewImageData.set(null);
  }

  setDetailLevel(level: number): void {
    this.detailLevel.set(Math.max(1, Math.min(10, level)));
  }

  setSampleRadius(radius: number): void {
    this.sampleRadius.set(Math.max(1, Math.min(20, radius)));
  }

  setExclusionMaskEnabled(enabled: boolean): void {
    this.exclusionMaskEnabled.set(enabled);
  }

  setPreviewEnabled(enabled: boolean): void {
    this.previewEnabled.set(enabled);
  }

  setSamplingArea(area: SamplingArea | null): void {
    this.samplingArea.set(area);
  }

  addExclusionPoint(x: number, y: number): void {
    const mask = this.exclusionMask();
    const newMask = new Set(mask);
    newMask.add(`${x},${y}`);
    this.exclusionMask.set(newMask);
  }

  removeExclusionPoint(x: number, y: number): void {
    const mask = this.exclusionMask();
    const newMask = new Set(mask);
    newMask.delete(`${x},${y}`);
    this.exclusionMask.set(newMask);
  }

  clearExclusionMask(): void {
    this.exclusionMask.set(new Set());
  }

  isExcluded(x: number, y: number): boolean {
    return this.exclusionMask().has(`${x},${y}`);
  }

  generatePreview(
    sourceData: ImageData,
    maskData: Uint8Array,
    width: number,
    height: number,
  ): ImageData {
    const effectiveMask = this.createEffectiveMask(maskData, width, height);

    const result = this.contentAwareFillService.fillSelection(
      sourceData,
      effectiveMask,
      width,
      height,
      this.options(),
    );

    this.previewImageData.set(result);
    return result;
  }

  applyFill(
    sourceData: ImageData,
    maskData: Uint8Array,
    width: number,
    height: number,
  ): ImageData {
    const effectiveMask = this.createEffectiveMask(maskData, width, height);

    return this.contentAwareFillService.fillSelection(
      sourceData,
      effectiveMask,
      width,
      height,
      this.options(),
    );
  }

  private createEffectiveMask(
    maskData: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const effectiveMask = new Uint8Array(maskData);

    if (this.exclusionMaskEnabled() && this.exclusionMask().size > 0) {
      const exclusion = this.exclusionMask();
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (exclusion.has(`${x},${y}`)) {
            effectiveMask[y * width + x] = 0;
          }
        }
      }
    }

    return effectiveMask;
  }
}
