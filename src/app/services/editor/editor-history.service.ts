import { Injectable, signal } from '@angular/core';
import { HistoryEntry, ProjectSnapshot } from './history.types';

@Injectable({ providedIn: 'root' })
export class EditorHistoryService {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private historyLimit = 50;
  readonly undoVersion = signal(0);
  readonly redoVersion = signal(0);

  pushSnapshot(snapshot: ProjectSnapshot, description?: string) {
    const entry: HistoryEntry = {
      snapshot: this.deepCloneSnapshot(snapshot),
      description: description || '',
      timestamp: Date.now(),
    };
    this.undoStack.push(entry);
    if (this.undoStack.length > this.historyLimit) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.undoVersion.update((v) => v + 1);
    this.redoVersion.update((v) => v + 1);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  popUndo(): HistoryEntry | null {
    if (!this.canUndo()) return null;
    const entry = this.undoStack.pop() as HistoryEntry;
    this.redoStack.push(entry);
    this.undoVersion.update((v) => v + 1);
    this.redoVersion.update((v) => v + 1);
    return entry;
  }

  popRedo(): HistoryEntry | null {
    if (!this.canRedo()) return null;
    const entry = this.redoStack.pop() as HistoryEntry;
    this.undoStack.push(entry);
    this.undoVersion.update((v) => v + 1);
    this.redoVersion.update((v) => v + 1);
    return entry;
  }

  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.undoVersion.set(0);
    this.redoVersion.set(0);
  }

  private deepCloneSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
    return {
      canvas: { ...snapshot.canvas },
      layers: snapshot.layers.map((l) => ({ ...l })),
      layerBuffers: Object.fromEntries(
        Object.entries(snapshot.layerBuffers).map(([k, v]) => [k, [...v]]),
      ),
      selectedLayerId: snapshot.selectedLayerId,
      selectedLayerIds: [...snapshot.selectedLayerIds],
      selection: snapshot.selection
        ? {
            rect: snapshot.selection.rect ? { ...snapshot.selection.rect } : null,
            shape: snapshot.selection.shape,
            polygon: snapshot.selection.polygon
              ? [...snapshot.selection.polygon]
              : null,
            mask: snapshot.selection.mask ? [...snapshot.selection.mask] : null,
          }
        : null,
      frames: snapshot.frames.map((f) => ({ ...f })),
      currentFrameIndex: snapshot.currentFrameIndex,
      animations: snapshot.animations.map((a) => ({ ...a })),
      currentAnimationIndex: snapshot.currentAnimationIndex,
      boneHierarchy: snapshot.boneHierarchy.map((b) => ({ ...b })),
      selectedBoneId: snapshot.selectedBoneId,
      bones: Object.fromEntries(
        Object.entries(snapshot.bones).map(([k, v]) => [
          k,
          v.map((b) => ({ ...b })),
        ]),
      ),
      keyframes: snapshot.keyframes ? { ...snapshot.keyframes } : null,
      pixelBindings: snapshot.pixelBindings
        ? { ...snapshot.pixelBindings }
        : null,
      animationCurrentTime: snapshot.animationCurrentTime,
      animationDuration: snapshot.animationDuration,
      timelineMode: snapshot.timelineMode,
      toolSnapshot: snapshot.toolSnapshot ? { ...snapshot.toolSnapshot } : null,
    };
  }
}
