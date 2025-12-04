import { Injectable, inject, signal } from '@angular/core';
import { EditorDocumentService } from '../../editor-document.service';
import { EditorToolsService } from '../../editor-tools.service';
import { EditorBoneService, Bone, BonePoint } from '../editor-bone.service';
import { EditorFreeTransformService, TransformHandle } from '../editor-free-transform.service';
import { EditorDistortService, DistortHandle } from '../editor-distort.service';
import { EditorPerspectiveService, PerspectiveHandle } from '../editor-perspective.service';
import { EditorWarpService } from '../editor-warp.service';
import { EditorPuppetWarpService } from '../editor-puppet-warp.service';
import { ColorPickerStateService } from '../../color-picker-state.service';
import { CanvasViewportService } from './canvas-viewport.service';
import { CanvasRenderService } from './canvas-render.service';
import { CanvasFreeTransformHandler } from './canvas-free-transform.handler';
import { CanvasDistortHandler } from './canvas-distort.handler';
import { CanvasPerspectiveHandler } from './canvas-perspective.handler';
import { CanvasWarpHandler } from './canvas-warp.handler';
import { CanvasPuppetWarpHandler } from './canvas-puppet-warp.handler';
import { EditorSelectionService } from '../editor-selection.service';
import { SmartSelectMode } from '../../tools/smart-select-tool.service';

export interface PointerState {
  panning: boolean;
  painting: boolean;
  lastPaintPos: { x: number; y: number } | null;
  selectionStart: { x: number; y: number } | null;
  selectionDragging: boolean;
  selectionMoving: boolean;
  selectionMoveStart: { x: number; y: number } | null;
  selectionContentMoving: boolean;
  selectionContentMoveStart: { x: number; y: number } | null;
  shiftPressed: boolean;
  lastPointer: { x: number; y: number };
  shaping: boolean;
  currentBoneId: string | null;
  draggingPointId: string | null;
  draggingPointBoneId: string | null;
  smartSelecting: boolean;
  smartSelectPoints: { x: number; y: number }[];
  smartSelectMode: SmartSelectMode;
}

export interface PointerCallbacks {
  capturePointer: (ev: PointerEvent) => void;
  releasePointer: (ev: PointerEvent) => void;
  startShape: (mode: 'line' | 'circle' | 'square', x: number, y: number) => void;
  finishShape: (shiftKey: boolean) => void;
  addPenPoint: (x: number, y: number) => void;
  getCurrentFrameId: () => string;
  startSelectionContentMove: () => void;
  moveSelectionContent: (dx: number, dy: number) => void;
  endSelectionContentMove: () => void;
  isPointInSelection: (x: number, y: number) => boolean;
  drawLinePaint: (
    layerId: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    brushSize: number,
    color: string | null,
  ) => void;
}

@Injectable({ providedIn: 'root' })
export class CanvasPointerService {
  private readonly document = inject(EditorDocumentService);
  private readonly tools = inject(EditorToolsService);
  private readonly boneService = inject(EditorBoneService);
  private readonly freeTransform = inject(EditorFreeTransformService);
  private readonly distort = inject(EditorDistortService);
  private readonly perspective = inject(EditorPerspectiveService);
  private readonly warp = inject(EditorWarpService);
  private readonly puppetWarp = inject(EditorPuppetWarpService);
  private readonly colorPickerState = inject(ColorPickerStateService);
  private readonly viewport = inject(CanvasViewportService);
  private readonly renderService = inject(CanvasRenderService);
  private readonly freeTransformHandler = inject(CanvasFreeTransformHandler);
  private readonly distortHandler = inject(CanvasDistortHandler);
  private readonly perspectiveHandler = inject(CanvasPerspectiveHandler);
  private readonly warpHandler = inject(CanvasWarpHandler);
  private readonly puppetWarpHandler = inject(CanvasPuppetWarpHandler);
  private readonly selectionService = inject(EditorSelectionService);

  readonly moveSelectionHotkeyActive = signal(false);
  private moveSelectionHotkeyParts = new Set<string>();

  activateMoveSelectionHotkey(binding: string): void {
    this.moveSelectionHotkeyActive.set(true);
    this.moveSelectionHotkeyParts.clear();
    for (const part of binding.split('+')) {
      if (part) {
        this.moveSelectionHotkeyParts.add(part);
      }
    }
  }

  deactivateMoveSelectionHotkey(): void {
    this.moveSelectionHotkeyActive.set(false);
    this.moveSelectionHotkeyParts.clear();
  }

  handleMoveSelectionHotkeyRelease(event: KeyboardEvent): void {
    if (!this.moveSelectionHotkeyActive()) return;
    const part = this.normalizeMoveSelectionKey(event.key);
    if (part && this.moveSelectionHotkeyParts.has(part)) {
      this.deactivateMoveSelectionHotkey();
    }
  }

  private normalizeMoveSelectionKey(key: string): string | null {
    const lower = key.toLowerCase();
    if (lower === 'control' || lower === 'meta') return 'ctrl';
    if (lower === 'shift' || lower === 'alt') return lower;
    return lower;
  }

  handlePointerMove(
    ev: PointerEvent,
    canvasRect: DOMRect,
    state: PointerState,
    callbacks: PointerCallbacks,
  ): { hoverX: number | null; hoverY: number | null; mouseX: number; mouseY: number } {
    const visX = ev.clientX - canvasRect.left;
    const visY = ev.clientY - canvasRect.top;
    const mouseX = Math.round(visX);
    const mouseY = Math.round(visY);

    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const currentScale = this.viewport.scale();
    const currentPanX = this.viewport.panX();
    const currentPanY = this.viewport.panY();
    const logicalX = Math.floor((visX - currentPanX) / currentScale);
    const logicalY = Math.floor((visY - currentPanY) / currentScale);

    let hoverX: number | null = null;
    let hoverY: number | null = null;

    if (logicalX >= 0 && logicalX < w && logicalY >= 0 && logicalY < h) {
      hoverX = logicalX;
      hoverY = logicalY;
    }

    if (state.panning) {
      const dx = ev.clientX - state.lastPointer.x;
      const dy = ev.clientY - state.lastPointer.y;
      this.viewport.panX.set(this.viewport.panX() + dx);
      this.viewport.panY.set(this.viewport.panY() + dy);
      state.lastPointer.x = ev.clientX;
      state.lastPointer.y = ev.clientY;
    }

    if (this.freeTransform.isDraggingHandle()) {
      const handle = this.freeTransform.isDraggingHandle();
      if (handle === 'rotate-center') {
        this.freeTransform.setSnapRotation(ev.shiftKey || state.shiftPressed);
        this.freeTransform.setConstrainProportions(false);
      } else {
        this.freeTransform.setConstrainProportions(ev.shiftKey || state.shiftPressed);
        this.freeTransform.setSnapRotation(false);
      }
      this.freeTransform.updateHandleDrag(logicalX, logicalY);
      this.freeTransformHandler.renderLivePreview();
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (this.distort.isDraggingHandle()) {
      this.distort.updateHandleDrag(logicalX, logicalY);
      this.distortHandler.renderLivePreview();
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (this.perspective.isDraggingHandle()) {
      this.perspective.updateHandleDrag(logicalX, logicalY);
      this.perspectiveHandler.renderLivePreview();
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (this.warp.isDraggingNode()) {
      this.warp.updateNodeDrag(logicalX, logicalY);
      this.warpHandler.renderLivePreview();
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (this.puppetWarp.isDraggingPin()) {
      this.puppetWarp.updatePinDrag(logicalX, logicalY);
      this.puppetWarpHandler.renderLivePreview();
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (state.selectionMoving && state.selectionMoveStart) {
      if (logicalX < 0 || logicalX >= w || logicalY < 0 || logicalY >= h) {
        return { hoverX, hoverY, mouseX, mouseY };
      }
      const dx = logicalX - state.selectionMoveStart.x;
      const dy = logicalY - state.selectionMoveStart.y;
      if (dx !== 0 || dy !== 0) {
        this.document.moveSelection(dx, dy);
        state.selectionMoveStart = { x: logicalX, y: logicalY };
      }
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (state.selectionContentMoving && state.selectionContentMoveStart) {
      if (logicalX < 0 || logicalX >= w || logicalY < 0 || logicalY >= h) {
        return { hoverX, hoverY, mouseX, mouseY };
      }
      const dx = logicalX - state.selectionContentMoveStart.x;
      const dy = logicalY - state.selectionContentMoveStart.y;
      if (dx !== 0 || dy !== 0) {
        callbacks.moveSelectionContent(dx, dy);
        state.selectionContentMoveStart = { x: logicalX, y: logicalY };
      }
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (state.selectionDragging) {
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      const tool = this.tools.currentTool();
      if (tool === 'lasso-select') {
        this.document.addLassoPoint(clampedX, clampedY);
      } else {
        let endX = clampedX;
        let endY = clampedY;
        if (ev.shiftKey && state.selectionStart) {
          const dx = clampedX - state.selectionStart.x;
          const dy = clampedY - state.selectionStart.y;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          const max = Math.max(absDx, absDy);
          const sx = dx >= 0 ? 1 : -1;
          const sy = dy >= 0 ? 1 : -1;
          endX = state.selectionStart.x + sx * max;
          endY = state.selectionStart.y + sy * max;
          endX = Math.max(0, Math.min(endX, w - 1));
          endY = Math.max(0, Math.min(endY, h - 1));
        }
        this.document.updateSelection(endX, endY);
      }
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (state.smartSelecting) {
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      const lastPoint = state.smartSelectPoints[state.smartSelectPoints.length - 1];
      if (!lastPoint || lastPoint.x !== clampedX || lastPoint.y !== clampedY) {
        state.smartSelectPoints.push({ x: clampedX, y: clampedY });
        this.updateSmartSelection(state);
      }
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (state.shaping) {
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (state.draggingPointId && state.draggingPointBoneId) {
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      const frameId = callbacks.getCurrentFrameId();
      const currentAnim = this.document.getCurrentAnimation();
      const animationId = currentAnim?.id;
      const currentTime = this.document.keyframeService?.getCurrentTime();
      this.boneService.updatePoint(
        frameId,
        state.draggingPointBoneId,
        state.draggingPointId,
        clampedX,
        clampedY,
        animationId,
        currentTime,
      );
      return { hoverX, hoverY, mouseX, mouseY };
    }

    if (state.painting) {
      const selectedLayer = this.document.selectedLayer();
      if (selectedLayer?.locked) {
        return { hoverX, hoverY, mouseX, mouseY };
      }
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      const layerId = this.document.selectedLayerId();
      const tool = this.tools.currentTool();
      const color = tool === 'eraser' ? null : this.tools.brushColor();
      const size = tool === 'eraser' ? this.tools.eraserSize() : this.tools.brushSize();
      if (state.lastPaintPos) {
        callbacks.drawLinePaint(
          layerId,
          state.lastPaintPos.x,
          state.lastPaintPos.y,
          clampedX,
          clampedY,
          size,
          color,
        );
      } else {
        this.document.applyBrushToLayer(
          layerId,
          clampedX,
          clampedY,
          size,
          color,
          tool === 'eraser' ? { eraserStrength: this.tools.eraserStrength() } : undefined,
        );
      }
      state.lastPaintPos = { x: clampedX, y: clampedY };
    }

    return { hoverX, hoverY, mouseX, mouseY };
  }

  handlePointerDown(
    ev: PointerEvent,
    canvasRect: DOMRect,
    state: PointerState,
    callbacks: PointerCallbacks,
    shapeConstrainUniform: (value: boolean) => void,
  ): void {
    const visX = ev.clientX - canvasRect.left;
    const visY = ev.clientY - canvasRect.top;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const currentScale = this.viewport.scale();
    const currentPanX = this.viewport.panX();
    const currentPanY = this.viewport.panY();
    const logicalX = Math.floor((visX - currentPanX) / currentScale);
    const logicalY = Math.floor((visY - currentPanY) / currentScale);
    const tool = this.tools.currentTool();
    const insideCanvas = logicalX >= 0 && logicalX < w && logicalY >= 0 && logicalY < h;

    if (ev.button === 1 || ev.ctrlKey) {
      state.panning = true;
      state.lastPointer.x = ev.clientX;
      state.lastPointer.y = ev.clientY;
      callbacks.capturePointer(ev);
    }

    if (ev.button === 2) return;

    if (ev.button === 0) {
      if (this.handleDistortPointerDown(ev, logicalX, logicalY, w, h, state, callbacks)) return;
      if (this.handlePerspectivePointerDown(ev, logicalX, logicalY, w, h, state, callbacks)) return;
      if (this.handleWarpPointerDown(ev, logicalX, logicalY, w, h, insideCanvas, state, callbacks)) return;
      if (this.handlePuppetWarpPointerDown(ev, logicalX, logicalY, w, h, insideCanvas, state, callbacks)) return;
      if (this.handleFreeTransformPointerDown(ev, logicalX, logicalY, w, h, state, callbacks)) return;

      const hasExistingSelection = !!this.document.selectionRect();
      const clickedInSelection = hasExistingSelection && callbacks.isPointInSelection(logicalX, logicalY);
      const isSelectTool = tool === 'rect-select' || tool === 'ellipse-select' || tool === 'lasso-select' || tool === 'smart-select';

      if (clickedInSelection && insideCanvas && this.moveSelectionHotkeyActive()) {
        const selectedLayer = this.document.selectedLayer();
        if (selectedLayer?.locked) return;
        this.document.beginMoveSelection('Move pixels');
        callbacks.capturePointer(ev);
        state.selectionContentMoving = true;
        state.selectionContentMoveStart = { x: logicalX, y: logicalY };
        callbacks.startSelectionContentMove();
        return;
      }

      if (clickedInSelection && insideCanvas && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && isSelectTool) {
        callbacks.capturePointer(ev);
        this.document.beginMoveSelection('Move selection');
        state.selectionMoving = true;
        state.selectionMoveStart = { x: logicalX, y: logicalY };
        return;
      }

      if (tool === 'smart-select' && insideCanvas) {
        callbacks.capturePointer(ev);
        let mode: SmartSelectMode = 'normal';
        if (ev.shiftKey) {
          mode = 'add';
        } else if (ev.altKey) {
          mode = 'subtract';
        }
        this.tools.setSmartSelectMode(mode);
        state.smartSelecting = true;
        state.smartSelectPoints = [{ x: logicalX, y: logicalY }];
        state.smartSelectMode = mode;
        this.beginSmartSelection(logicalX, logicalY, mode);
        return;
      }

      if (isSelectTool && insideCanvas && tool !== 'smart-select') {
        callbacks.capturePointer(ev);
        if (tool === 'lasso-select') {
          state.selectionStart = { x: logicalX, y: logicalY };
          state.selectionDragging = true;
          this.document.beginSelection(logicalX, logicalY, 'lasso' as any);
          this.document.addLassoPoint(logicalX, logicalY);
          return;
        }

        state.selectionStart = { x: logicalX, y: logicalY };
        state.selectionDragging = true;
        const shape = tool === 'ellipse-select' ? 'ellipse' : 'rect';
        this.document.beginSelection(logicalX, logicalY, shape as any);
        return;
      }

      if ((tool === 'line' || tool === 'circle' || tool === 'square') && insideCanvas) {
        const selectedLayer = this.document.selectedLayer();
        if (selectedLayer?.locked) return;
        callbacks.capturePointer(ev);
        if (tool === 'square' || tool === 'circle') {
          shapeConstrainUniform(ev.shiftKey);
        } else {
          shapeConstrainUniform(false);
        }
        callbacks.startShape(tool, logicalX, logicalY);
        return;
      }

      if (tool === 'pen' && insideCanvas) {
        const selectedLayer = this.document.selectedLayer();
        if (selectedLayer?.locked) return;
        callbacks.capturePointer(ev);
        callbacks.addPenPoint(logicalX, logicalY);
        return;
      }

      if (tool === 'eyedropper' && insideCanvas) {
        const color = this.document.getColorAt(logicalX, logicalY);
        if (color) {
          this.tools.setEyedropperLastPickedColor(color);
          if (this.colorPickerState.isPickingColor()) {
            this.colorPickerState.deliverColor(color);
          } else {
            this.tools.setBrushColor(color);
          }
        }
        return;
      }

      if (tool === 'fill' && insideCanvas) {
        const selectedLayer = this.document.selectedLayer();
        if (selectedLayer?.locked) return;
        const selectionActive = this.document.selectionRect();
        if (selectionActive && !callbacks.isPointInSelection(logicalX, logicalY)) return;
        this.document.saveSnapshot('Fill');
        const layerId = this.document.selectedLayerId();
        const fillMode = this.tools.fillMode();
        if (fillMode === 'gradient') {
          const gradientStartColor = this.tools.fillGradientStartColor();
          const gradientEndColor = this.tools.fillGradientEndColor();
          const gradientType = this.tools.fillGradientType();
          const gradientAngle = this.tools.fillGradientAngle();
          this.document.applyGradientFillToLayer(
            layerId,
            logicalX,
            logicalY,
            gradientStartColor,
            gradientEndColor,
            gradientType,
            gradientAngle,
          );
        } else {
          const fillColor = fillMode === 'erase' ? null : this.tools.fillColor();
          this.document.applyFillToLayer(layerId, logicalX, logicalY, fillColor);
        }
      } else if (tool === 'bone' && insideCanvas) {
        this.handleBonePointerDown(ev, logicalX, logicalY, w, h, state, callbacks);
      } else if (tool === 'brush' || tool === 'eraser') {
        this.handlePaintPointerDown(ev, logicalX, logicalY, w, h, tool, state, callbacks);
      }
    }
  }

  private handleDistortPointerDown(
    ev: PointerEvent,
    logicalX: number,
    logicalY: number,
    w: number,
    h: number,
    state: PointerState,
    callbacks: PointerCallbacks,
  ): boolean {
    const distortState = this.distort.distortState();
    if (!distortState) return false;

    const handleSize = Math.max(3, Math.round(5 / Math.max(0.001, this.viewport.scale())));
    const buttonPositions = this.renderService.computeDistortButtonPositions(
      distortState,
      this.viewport.scale(),
      w,
      h,
    );
    const btnSize = buttonPositions.btnSize;

    if (
      logicalX >= buttonPositions.commitX &&
      logicalX <= buttonPositions.commitX + btnSize &&
      logicalY >= buttonPositions.commitY &&
      logicalY <= buttonPositions.commitY + btnSize
    ) {
      this.distortHandler.commit();
      return true;
    }

    if (
      logicalX >= buttonPositions.cancelX &&
      logicalX <= buttonPositions.cancelX + btnSize &&
      logicalY >= buttonPositions.cancelY &&
      logicalY <= buttonPositions.cancelY + btnSize
    ) {
      this.distortHandler.cancel();
      return true;
    }

    const handles: DistortHandle[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    for (const handle of handles) {
      const pos = this.distort.getHandlePosition(handle);
      if (pos) {
        const dx = logicalX - pos.x;
        const dy = logicalY - pos.y;
        if (dx * dx + dy * dy <= handleSize * handleSize) {
          callbacks.capturePointer(ev);
          this.distort.startHandleDrag(handle, logicalX, logicalY);
          return true;
        }
      }
    }

    return true;
  }

  private handlePerspectivePointerDown(
    ev: PointerEvent,
    logicalX: number,
    logicalY: number,
    w: number,
    h: number,
    state: PointerState,
    callbacks: PointerCallbacks,
  ): boolean {
    const perspectiveState = this.perspective.perspectiveState();
    if (!perspectiveState) return false;

    const handleSize = Math.max(3, Math.round(5 / Math.max(0.001, this.viewport.scale())));
    const buttonPositions = this.renderService.computeDistortButtonPositions(
      perspectiveState,
      this.viewport.scale(),
      w,
      h,
    );
    const btnSize = buttonPositions.btnSize;

    if (
      logicalX >= buttonPositions.commitX &&
      logicalX <= buttonPositions.commitX + btnSize &&
      logicalY >= buttonPositions.commitY &&
      logicalY <= buttonPositions.commitY + btnSize
    ) {
      this.perspectiveHandler.commit();
      return true;
    }

    if (
      logicalX >= buttonPositions.cancelX &&
      logicalX <= buttonPositions.cancelX + btnSize &&
      logicalY >= buttonPositions.cancelY &&
      logicalY <= buttonPositions.cancelY + btnSize
    ) {
      this.perspectiveHandler.cancel();
      return true;
    }

    const handles: PerspectiveHandle[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    for (const handle of handles) {
      const pos = this.perspective.getHandlePosition(handle);
      if (pos) {
        const dx = logicalX - pos.x;
        const dy = logicalY - pos.y;
        if (dx * dx + dy * dy <= handleSize * handleSize) {
          callbacks.capturePointer(ev);
          this.perspective.startHandleDrag(handle, logicalX, logicalY);
          return true;
        }
      }
    }

    return true;
  }

  private handleWarpPointerDown(
    ev: PointerEvent,
    logicalX: number,
    logicalY: number,
    w: number,
    h: number,
    insideCanvas: boolean,
    state: PointerState,
    callbacks: PointerCallbacks,
  ): boolean {
    const warpState = this.warp.warpState();
    if (!warpState) return false;

    const handleSize = Math.max(3, Math.round(5 / Math.max(0.001, this.viewport.scale())));
    const buttonPositions = this.renderService.computeWarpButtonPositions(
      warpState,
      this.viewport.scale(),
      w,
      h,
    );
    const btnSize = buttonPositions.btnSize;

    if (
      logicalX >= buttonPositions.commitX &&
      logicalX <= buttonPositions.commitX + btnSize &&
      logicalY >= buttonPositions.commitY &&
      logicalY <= buttonPositions.commitY + btnSize
    ) {
      this.warpHandler.commit();
      return true;
    }

    if (
      logicalX >= buttonPositions.cancelX &&
      logicalX <= buttonPositions.cancelX + btnSize &&
      logicalY >= buttonPositions.cancelY &&
      logicalY <= buttonPositions.cancelY + btnSize
    ) {
      this.warpHandler.cancel();
      return true;
    }

    for (const node of warpState.nodes) {
      const dx = logicalX - node.x;
      const dy = logicalY - node.y;
      if (dx * dx + dy * dy <= handleSize * handleSize) {
        callbacks.capturePointer(ev);
        this.warp.startNodeDrag(node, logicalX, logicalY);
        return true;
      }
    }

    return true;
  }

  private handlePuppetWarpPointerDown(
    ev: PointerEvent,
    logicalX: number,
    logicalY: number,
    w: number,
    h: number,
    insideCanvas: boolean,
    state: PointerState,
    callbacks: PointerCallbacks,
  ): boolean {
    const puppetWarpState = this.puppetWarp.puppetWarpState();
    if (!puppetWarpState) return false;

    const handleSize = Math.max(3, Math.round(5 / Math.max(0.001, this.viewport.scale())));
    const buttonPositions = this.renderService.computePuppetWarpButtonPositions(
      puppetWarpState,
      this.viewport.scale(),
      w,
      h,
    );
    const btnSize = buttonPositions.btnSize;

    if (
      logicalX >= buttonPositions.commitX &&
      logicalX <= buttonPositions.commitX + btnSize &&
      logicalY >= buttonPositions.commitY &&
      logicalY <= buttonPositions.commitY + btnSize
    ) {
      this.puppetWarpHandler.commit();
      return true;
    }

    if (
      logicalX >= buttonPositions.cancelX &&
      logicalX <= buttonPositions.cancelX + btnSize &&
      logicalY >= buttonPositions.cancelY &&
      logicalY <= buttonPositions.cancelY + btnSize
    ) {
      this.puppetWarpHandler.cancel();
      return true;
    }

    const clickedPin = this.puppetWarp.findPinAtPosition(logicalX, logicalY, handleSize);
    if (clickedPin) {
      callbacks.capturePointer(ev);
      this.puppetWarp.startPinDrag(clickedPin, logicalX, logicalY);
      this.puppetWarp.selectedPin.set(clickedPin);
      return true;
    }

    if (insideCanvas) {
      this.puppetWarp.addPin(logicalX, logicalY);
      return true;
    }

    return true;
  }

  private handleFreeTransformPointerDown(
    ev: PointerEvent,
    logicalX: number,
    logicalY: number,
    w: number,
    h: number,
    state: PointerState,
    callbacks: PointerCallbacks,
  ): boolean {
    const freeTransformState = this.freeTransform.transformState();
    if (!freeTransformState) return false;

    const handleSize = Math.max(3, Math.round(5 / Math.max(0.001, this.viewport.scale())));
    const positions = this.renderService.computeTransformButtonPositions(
      freeTransformState,
      this.viewport.scale(),
      w,
      h,
    );
    const buttonSize = positions.btnSize;

    if (
      logicalX >= positions.mirrorXX &&
      logicalX <= positions.mirrorXX + buttonSize &&
      logicalY >= positions.mirrorXY &&
      logicalY <= positions.mirrorXY + buttonSize
    ) {
      this.freeTransformHandler.toggleMirrorX();
      this.freeTransformHandler.renderLivePreview();
      return true;
    }

    if (
      logicalX >= positions.mirrorYX &&
      logicalX <= positions.mirrorYX + buttonSize &&
      logicalY >= positions.mirrorYY &&
      logicalY <= positions.mirrorYY + buttonSize
    ) {
      this.freeTransformHandler.toggleMirrorY();
      this.freeTransformHandler.renderLivePreview();
      return true;
    }

    if (
      logicalX >= positions.commitX &&
      logicalX <= positions.commitX + buttonSize &&
      logicalY >= positions.commitY &&
      logicalY <= positions.commitY + buttonSize
    ) {
      this.freeTransformHandler.commit();
      return true;
    }

    if (
      logicalX >= positions.cancelX &&
      logicalX <= positions.cancelX + buttonSize &&
      logicalY >= positions.cancelY &&
      logicalY <= positions.cancelY + buttonSize
    ) {
      this.freeTransformHandler.cancel();
      return true;
    }

    const handles: TransformHandle[] = [
      'top-left', 'top-center', 'top-right',
      'middle-left', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right',
      'rotate-center',
    ];

    for (const handle of handles) {
      if (
        this.freeTransform.isPointNearHandle(
          logicalX,
          logicalY,
          handle,
          freeTransformState,
          handleSize,
        )
      ) {
        callbacks.capturePointer(ev);
        this.freeTransform.startHandleDrag(handle, logicalX, logicalY);
        return true;
      }
    }

    return true;
  }

  private handleBonePointerDown(
    ev: PointerEvent,
    logicalX: number,
    logicalY: number,
    w: number,
    h: number,
    state: PointerState,
    callbacks: PointerCallbacks,
  ): void {
    callbacks.capturePointer(ev);
    const frameId = callbacks.getCurrentFrameId();
    const clickedPoint = this.findBonePointAt(frameId, logicalX, logicalY);

    if (clickedPoint) {
      this.document.saveSnapshot('Move bone point');
      state.draggingPointId = clickedPoint.pointId;
      state.draggingPointBoneId = clickedPoint.boneId;
      state.currentBoneId = clickedPoint.boneId;
      this.boneService.selectPoint(clickedPoint.pointId);
    } else {
      this.document.saveSnapshot('Add bone point');
      if (!state.currentBoneId) {
        const newBone: Bone = {
          id: `bone-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          points: [],
          color: this.tools.boneColor(),
          thickness: this.tools.boneThickness(),
        };
        state.currentBoneId = newBone.id;
        this.boneService.addBone(frameId, newBone);
      }

      const newPoint: BonePoint = {
        id: `point-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        x: logicalX,
        y: logicalY,
        parentId: undefined,
      };

      const bones = this.boneService.getBones(frameId);
      const currentBone = bones.find((b) => b.id === state.currentBoneId);
      if (currentBone && currentBone.points.length > 0) {
        const selectedPoint = this.boneService.getSelectedPoint();
        if (selectedPoint) {
          newPoint.parentId = selectedPoint;
        } else {
          newPoint.parentId = currentBone.points[currentBone.points.length - 1].id;
        }
      }

      this.boneService.addPointToBone(frameId, state.currentBoneId, newPoint);
      this.boneService.selectPoint(newPoint.id);

      const currentAnim = this.document.getCurrentAnimation();
      if (currentAnim) {
        const currentTime = this.document.keyframeService?.getCurrentTime() || 0;
        this.boneService.updatePoint(
          frameId,
          state.currentBoneId,
          newPoint.id,
          logicalX,
          logicalY,
          currentAnim.id,
          currentTime,
        );
      }

      if (this.tools.boneAutoBindEnabled()) {
        const layerId = this.document.selectedLayerId();
        const layerBuffer = this.document.getLayerBuffer(layerId);
        if (layerBuffer) {
          const radius = this.tools.boneAutoBindRadius();
          this.boneService.autoBindPixels(
            frameId,
            layerBuffer,
            w,
            h,
            state.currentBoneId,
            newPoint.id,
            logicalX,
            logicalY,
            radius,
          );
        }
      }
    }
  }

  private handlePaintPointerDown(
    ev: PointerEvent,
    logicalX: number,
    logicalY: number,
    w: number,
    h: number,
    tool: string,
    state: PointerState,
    callbacks: PointerCallbacks,
  ): void {
    const size = tool === 'eraser' ? this.tools.eraserSize() : this.tools.brushSize();
    const bSize = Math.max(1, size);
    const half = Math.floor((bSize - 1) / 2);
    const brushMinX = logicalX - half;
    const brushMaxX = logicalX - half + bSize - 1;
    const brushMinY = logicalY - half;
    const brushMaxY = logicalY - half + bSize - 1;
    const brushOverlapsDocument =
      brushMaxX >= 0 && brushMinX < w && brushMaxY >= 0 && brushMinY < h;

    if (brushOverlapsDocument) {
      const selectedLayer = this.document.selectedLayer();
      if (selectedLayer?.locked) return;
      callbacks.capturePointer(ev);
      this.document.saveSnapshot('Paint');
      state.painting = true;
      state.lastPaintPos = { x: logicalX, y: logicalY };
      const layerId = this.document.selectedLayerId();
      const color = tool === 'eraser' ? null : this.tools.brushColor();
      this.document.applyBrushToLayer(
        layerId,
        logicalX,
        logicalY,
        size,
        color,
        tool === 'eraser' ? { eraserStrength: this.tools.eraserStrength() } : undefined,
      );
    }
  }

  private findBonePointAt(
    frameId: string,
    x: number,
    y: number,
  ): { boneId: string; pointId: string } | null {
    const bones = this.boneService.getBones(frameId);
    const hitRadius = 5;

    for (const bone of bones) {
      for (const point of bone.points) {
        const dx = point.x - x;
        const dy = point.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= hitRadius) {
          return { boneId: bone.id, pointId: point.id };
        }
      }
    }
    return null;
  }

  handlePointerUp(ev: PointerEvent, state: PointerState, callbacks: PointerCallbacks): void {
    callbacks.releasePointer(ev);
    state.panning = false;

    if (this.freeTransform.isDraggingHandle()) {
      this.freeTransform.endHandleDrag();
      return;
    }

    if (this.distort.isDraggingHandle()) {
      this.distort.endHandleDrag();
      return;
    }

    if (this.perspective.isDraggingHandle()) {
      this.perspective.endHandleDrag();
      return;
    }

    if (this.warp.isDraggingNode()) {
      this.warp.endNodeDrag();
      return;
    }

    if (this.puppetWarp.isDraggingPin()) {
      this.puppetWarp.endPinDrag();
      return;
    }

    if (state.shaping) {
      callbacks.finishShape(ev.shiftKey);
    }

    if (state.painting) {
      state.painting = false;
      state.lastPaintPos = null;
    }

    if (state.draggingPointId) {
      state.draggingPointId = null;
      state.draggingPointBoneId = null;
      return;
    }

    if (state.selectionMoving) {
      state.selectionMoving = false;
      state.selectionMoveStart = null;
      this.document.endMoveSelection('Move selection');
      return;
    }

    if (state.selectionContentMoving) {
      state.selectionContentMoving = false;
      state.selectionContentMoveStart = null;
      callbacks.endSelectionContentMove();
      this.document.endMoveSelection('Move pixels');
      return;
    }

    if (state.smartSelecting) {
      state.smartSelecting = false;
      state.smartSelectPoints = [];
      this.tools.setSmartSelectMode('normal');
      return;
    }

    if (state.selectionDragging) {
      state.selectionDragging = false;
      state.selectionStart = null;
      this.document.endSelection();
    }
  }

  private beginSmartSelection(x: number, y: number, mode: SmartSelectMode): void {
    console.log('[SmartSelect] beginSmartSelection called:', { x, y, mode });
    
    const layerId = this.document.selectedLayerId();
    if (!layerId) {
      console.log('[SmartSelect] No layer selected');
      return;
    }

    const buffer = this.document.getLayerBuffer(layerId);
    if (!buffer) {
      console.log('[SmartSelect] No buffer found');
      return;
    }
    
    console.log('[SmartSelect] Buffer length:', buffer.length, 'Non-empty pixels:', buffer.filter(c => c && c.length > 0).length);

    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const tolerance = this.tools.smartSelectTolerance();
    const smartSelectTool = this.tools.getSmartSelectToolService();

    console.log('[SmartSelect] Canvas size:', w, 'x', h, 'Tolerance:', tolerance);
    
    const existingMask =
      mode !== 'normal' ? this.selectionService.selectionMask() : null;

    const result = smartSelectTool.performSmartSelect(
      x,
      y,
      buffer,
      w,
      h,
      tolerance,
      existingMask,
      mode,
    );

    console.log('[SmartSelect] Result:', { newPixelsCount: result.newPixels.size, combinedCount: result.combined.size });

    if (result.newPixels.size === 0) {
      console.log('[SmartSelect] No new pixels found');
      return;
    }

    this.selectionService.updateSmartSelection(result.combined);
    console.log('[SmartSelect] Selection updated');
  }

  private readonly SMART_SELECT_POINTS_PER_UPDATE = 5;

  private updateSmartSelection(state: PointerState): void {
    if (!state.smartSelecting || state.smartSelectPoints.length === 0) return;

    const layerId = this.document.selectedLayerId();
    if (!layerId) return;

    const buffer = this.document.getLayerBuffer(layerId);
    if (!buffer) return;

    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const tolerance = this.tools.smartSelectTolerance();
    const smartSelectTool = this.tools.getSmartSelectToolService();
    const mode = state.smartSelectMode;

    const existingMask = this.selectionService.selectionMask();
    const newPoints = state.smartSelectPoints.slice(
      -this.SMART_SELECT_POINTS_PER_UPDATE,
    );

    const result = smartSelectTool.expandSmartSelect(
      newPoints,
      buffer,
      w,
      h,
      tolerance,
      existingMask,
      mode,
    );

    if (result.combined.size > 0 || (mode === 'subtract' && existingMask && existingMask.size > 0)) {
      this.selectionService.updateSmartSelection(result.combined);
    }
  }
}
