import { Injectable, signal } from '@angular/core';
import {
  EditorFreeTransformService,
  FreeTransformState,
} from '../editor-free-transform.service';
import { EditorDistortService } from '../editor-distort.service';
import { EditorPerspectiveService } from '../editor-perspective.service';
import { EditorWarpService } from '../editor-warp.service';
import { EditorPuppetWarpService } from '../editor-puppet-warp.service';
import { EditorTransformService } from '../editor-transform.service';

export interface TransformRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TransformBufferState {
  originalBuffer: string[] | null;
  originalRect: TransformRect | null;
  layerId: string | null;
  fullLayerBackup: string[] | null;
}

@Injectable({ providedIn: 'root' })
export class CanvasTransformStateService {
  private freeTransformOriginalBuffer: string[] | null = null;
  private freeTransformOriginalRect: TransformRect | null = null;
  private freeTransformLayerId: string | null = null;
  private freeTransformPreviewIndices: number[] | null = null;
  private freeTransformPreviewBackup: Map<number, string> | null = null;
  private freeTransformDuplicate = false;
  private freeTransformMirrorX = false;
  private freeTransformMirrorY = false;

  private distortOriginalBuffer: string[] | null = null;
  private distortOriginalRect: TransformRect | null = null;
  private distortLayerId: string | null = null;
  private distortFullLayerBackup: string[] | null = null;

  private perspectiveOriginalBuffer: string[] | null = null;
  private perspectiveOriginalRect: TransformRect | null = null;
  private perspectiveLayerId: string | null = null;
  private perspectiveFullLayerBackup: string[] | null = null;

  private warpOriginalBuffer: string[] | null = null;
  private warpOriginalRect: TransformRect | null = null;
  private warpLayerId: string | null = null;
  private warpFullLayerBackup: string[] | null = null;

  private puppetWarpOriginalBuffer: string[] | null = null;
  private puppetWarpOriginalRect: TransformRect | null = null;
  private puppetWarpLayerId: string | null = null;
  private puppetWarpFullLayerBackup: string[] | null = null;

  getFreeTransformState(): {
    originalBuffer: string[] | null;
    originalRect: TransformRect | null;
    layerId: string | null;
    previewIndices: number[] | null;
    previewBackup: Map<number, string> | null;
    duplicate: boolean;
    mirrorX: boolean;
    mirrorY: boolean;
  } {
    return {
      originalBuffer: this.freeTransformOriginalBuffer,
      originalRect: this.freeTransformOriginalRect,
      layerId: this.freeTransformLayerId,
      previewIndices: this.freeTransformPreviewIndices,
      previewBackup: this.freeTransformPreviewBackup,
      duplicate: this.freeTransformDuplicate,
      mirrorX: this.freeTransformMirrorX,
      mirrorY: this.freeTransformMirrorY,
    };
  }

  setFreeTransformMirrorX(value: boolean): void {
    this.freeTransformMirrorX = value;
  }

  setFreeTransformMirrorY(value: boolean): void {
    this.freeTransformMirrorY = value;
  }

  toggleFreeTransformMirrorX(): boolean {
    this.freeTransformMirrorX = !this.freeTransformMirrorX;
    return this.freeTransformMirrorX;
  }

  toggleFreeTransformMirrorY(): boolean {
    this.freeTransformMirrorY = !this.freeTransformMirrorY;
    return this.freeTransformMirrorY;
  }

  initFreeTransform(
    selectionRect: TransformRect,
    layerId: string,
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.freeTransformDuplicate = false;
    this.freeTransformPreviewIndices = null;
    this.freeTransformPreviewBackup = null;
    this.freeTransformMirrorX = false;
    this.freeTransformMirrorY = false;

    const original: string[] = new Array<string>(
      selectionRect.width * selectionRect.height,
    ).fill('');

    for (let y = 0; y < selectionRect.height; y++) {
      for (let x = 0; x < selectionRect.width; x++) {
        const srcX = selectionRect.x + x;
        const srcY = selectionRect.y + y;
        if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
          const srcIdx = srcY * canvasWidth + srcX;
          const dstIdx = y * selectionRect.width + x;
          original[dstIdx] = layerBuffer[srcIdx] || '';
          layerBuffer[srcIdx] = '';
        }
      }
    }

    this.freeTransformOriginalBuffer = original;
    this.freeTransformOriginalRect = { ...selectionRect };
    this.freeTransformLayerId = layerId;
  }

  updateFreeTransformPreview(
    indices: number[],
    backup: Map<number, string>,
  ): void {
    this.freeTransformPreviewIndices = indices;
    this.freeTransformPreviewBackup = backup;
  }

  clearFreeTransform(): void {
    this.freeTransformOriginalBuffer = null;
    this.freeTransformOriginalRect = null;
    this.freeTransformLayerId = null;
    this.freeTransformDuplicate = false;
    this.freeTransformPreviewIndices = null;
    this.freeTransformPreviewBackup = null;
    this.freeTransformMirrorX = false;
    this.freeTransformMirrorY = false;
  }

  getDistortState(): TransformBufferState {
    return {
      originalBuffer: this.distortOriginalBuffer,
      originalRect: this.distortOriginalRect,
      layerId: this.distortLayerId,
      fullLayerBackup: this.distortFullLayerBackup,
    };
  }

  initDistort(
    selectionRect: TransformRect,
    layerId: string,
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.distortFullLayerBackup = [...layerBuffer];

    const original: string[] = new Array<string>(
      selectionRect.width * selectionRect.height,
    ).fill('');

    for (let y = 0; y < selectionRect.height; y++) {
      for (let x = 0; x < selectionRect.width; x++) {
        const srcX = selectionRect.x + x;
        const srcY = selectionRect.y + y;
        if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
          const srcIdx = srcY * canvasWidth + srcX;
          const dstIdx = y * selectionRect.width + x;
          original[dstIdx] = layerBuffer[srcIdx] || '';
          layerBuffer[srcIdx] = '';
        }
      }
    }

    this.distortOriginalBuffer = original;
    this.distortOriginalRect = { ...selectionRect };
    this.distortLayerId = layerId;
  }

  clearDistort(): void {
    this.distortOriginalBuffer = null;
    this.distortOriginalRect = null;
    this.distortLayerId = null;
    this.distortFullLayerBackup = null;
  }

  getPerspectiveState(): TransformBufferState {
    return {
      originalBuffer: this.perspectiveOriginalBuffer,
      originalRect: this.perspectiveOriginalRect,
      layerId: this.perspectiveLayerId,
      fullLayerBackup: this.perspectiveFullLayerBackup,
    };
  }

  initPerspective(
    selectionRect: TransformRect,
    layerId: string,
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.perspectiveFullLayerBackup = [...layerBuffer];

    const original: string[] = new Array<string>(
      selectionRect.width * selectionRect.height,
    ).fill('');

    for (let y = 0; y < selectionRect.height; y++) {
      for (let x = 0; x < selectionRect.width; x++) {
        const srcX = selectionRect.x + x;
        const srcY = selectionRect.y + y;
        if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
          const srcIdx = srcY * canvasWidth + srcX;
          const dstIdx = y * selectionRect.width + x;
          original[dstIdx] = layerBuffer[srcIdx] || '';
          layerBuffer[srcIdx] = '';
        }
      }
    }

    this.perspectiveOriginalBuffer = original;
    this.perspectiveOriginalRect = { ...selectionRect };
    this.perspectiveLayerId = layerId;
  }

  clearPerspective(): void {
    this.perspectiveOriginalBuffer = null;
    this.perspectiveOriginalRect = null;
    this.perspectiveLayerId = null;
    this.perspectiveFullLayerBackup = null;
  }

  getWarpState(): TransformBufferState {
    return {
      originalBuffer: this.warpOriginalBuffer,
      originalRect: this.warpOriginalRect,
      layerId: this.warpLayerId,
      fullLayerBackup: this.warpFullLayerBackup,
    };
  }

  initWarp(
    selectionRect: TransformRect,
    layerId: string,
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.warpFullLayerBackup = [...layerBuffer];

    const original: string[] = new Array<string>(
      selectionRect.width * selectionRect.height,
    ).fill('');

    for (let y = 0; y < selectionRect.height; y++) {
      for (let x = 0; x < selectionRect.width; x++) {
        const srcX = selectionRect.x + x;
        const srcY = selectionRect.y + y;
        if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
          const srcIdx = srcY * canvasWidth + srcX;
          const dstIdx = y * selectionRect.width + x;
          original[dstIdx] = layerBuffer[srcIdx] || '';
          layerBuffer[srcIdx] = '';
        }
      }
    }

    this.warpOriginalBuffer = original;
    this.warpOriginalRect = { ...selectionRect };
    this.warpLayerId = layerId;
  }

  clearWarp(): void {
    this.warpOriginalBuffer = null;
    this.warpOriginalRect = null;
    this.warpLayerId = null;
    this.warpFullLayerBackup = null;
  }

  getPuppetWarpState(): TransformBufferState {
    return {
      originalBuffer: this.puppetWarpOriginalBuffer,
      originalRect: this.puppetWarpOriginalRect,
      layerId: this.puppetWarpLayerId,
      fullLayerBackup: this.puppetWarpFullLayerBackup,
    };
  }

  initPuppetWarp(
    selectionRect: TransformRect,
    layerId: string,
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.puppetWarpFullLayerBackup = [...layerBuffer];

    const original: string[] = new Array<string>(
      selectionRect.width * selectionRect.height,
    ).fill('');

    for (let y = 0; y < selectionRect.height; y++) {
      for (let x = 0; x < selectionRect.width; x++) {
        const srcX = selectionRect.x + x;
        const srcY = selectionRect.y + y;
        if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
          const srcIdx = srcY * canvasWidth + srcX;
          const dstIdx = y * selectionRect.width + x;
          original[dstIdx] = layerBuffer[srcIdx] || '';
          layerBuffer[srcIdx] = '';
        }
      }
    }

    this.puppetWarpOriginalBuffer = original;
    this.puppetWarpOriginalRect = { ...selectionRect };
    this.puppetWarpLayerId = layerId;
  }

  clearPuppetWarp(): void {
    this.puppetWarpOriginalBuffer = null;
    this.puppetWarpOriginalRect = null;
    this.puppetWarpLayerId = null;
    this.puppetWarpFullLayerBackup = null;
  }

  restoreFullLayerBackup(
    type: 'distort' | 'perspective' | 'warp' | 'puppetWarp',
    layerBuffer: string[],
  ): void {
    let backup: string[] | null = null;
    switch (type) {
      case 'distort':
        backup = this.distortFullLayerBackup;
        break;
      case 'perspective':
        backup = this.perspectiveFullLayerBackup;
        break;
      case 'warp':
        backup = this.warpFullLayerBackup;
        break;
      case 'puppetWarp':
        backup = this.puppetWarpFullLayerBackup;
        break;
    }
    if (backup) {
      for (let i = 0; i < layerBuffer.length; i++) {
        layerBuffer[i] = backup[i];
      }
    }
  }
}
