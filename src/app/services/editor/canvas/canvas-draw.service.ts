import { Injectable, inject, signal } from '@angular/core';
import { EditorDocumentService, isLayer } from '../../editor-document.service';
import { EditorToolsService } from '../../editor-tools.service';
import { EditorBoneService, Bone, BonePoint } from '../editor-bone.service';
import { EditorFreeTransformService, TransformHandle } from '../editor-free-transform.service';
import { EditorDistortService, DistortHandle } from '../editor-distort.service';
import { EditorPerspectiveService, PerspectiveHandle } from '../editor-perspective.service';
import { EditorWarpService } from '../editor-warp.service';
import { EditorPuppetWarpService } from '../editor-puppet-warp.service';
import { CanvasViewportService } from './canvas-viewport.service';
import { CanvasShapeService, ShapeDrawOptions } from './canvas-shape.service';
import { CanvasRenderService } from './canvas-render.service';
import { CanvasFreeTransformHandler } from './canvas-free-transform.handler';
import { UserSettingsService } from '../../user-settings.service';
import { EditorCanvasStateService } from '../editor-canvas-state.service';

export interface DrawCanvasContext {
  canvas: HTMLCanvasElement;
  container: HTMLElement | null;
  workspaceWidth: number;
  workspaceHeight: number;
  tileSize: number;
  mouseX: number | null;
  mouseY: number | null;
  activeShapeTool: 'line' | 'circle' | 'square' | null;
  shapeStart: { x: number; y: number } | null;
  shapeCurrent: { x: number; y: number } | null;
  shapeConstrainUniform: boolean;
  penDrawing: boolean;
  penPoints: { x: number; y: number }[];
  movingContentBuffer: string[] | null;
  movingContentOriginalRect: { x: number; y: number; width: number; height: number } | null;
  getCurrentFrameId: () => string;
  getCircleDrawOptions: () => ShapeDrawOptions;
  getSquareDrawOptions: () => ShapeDrawOptions;
}

@Injectable({ providedIn: 'root' })
export class CanvasDrawService {
  private static readonly BRUSH_PREVIEW_OPACITY = 0.3;
  private static readonly ERASER_X_COLOR = '#ef4444';
  private static readonly ERASER_LINE_WIDTH_MULTIPLIER = 1.5;
  private static readonly OUT_OF_BOUNDS_OPACITY = 0.5;

  private readonly document = inject(EditorDocumentService);
  private readonly tools = inject(EditorToolsService);
  private readonly boneService = inject(EditorBoneService);
  private readonly freeTransform = inject(EditorFreeTransformService);
  private readonly distort = inject(EditorDistortService);
  private readonly perspective = inject(EditorPerspectiveService);
  private readonly warp = inject(EditorWarpService);
  private readonly puppetWarp = inject(EditorPuppetWarpService);
  private readonly viewport = inject(CanvasViewportService);
  private readonly shapeService = inject(CanvasShapeService);
  private readonly renderService = inject(CanvasRenderService);
  private readonly freeTransformHandler = inject(CanvasFreeTransformHandler);
  private readonly userSettings = inject(UserSettingsService);
  private readonly canvasState = inject(EditorCanvasStateService);

  drawCanvas(ctx: DrawCanvasContext): void {
    const canvas = ctx.canvas;
    if (!canvas) return;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const scale = this.viewport.scale();
    const currentPanX = this.viewport.panX();
    const currentPanY = this.viewport.panY();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    const _workspaceW = ctx.workspaceWidth;
    const _workspaceH = ctx.workspaceHeight;
    const container = ctx.container;
    const containerWidth = container ? container.clientWidth : w * scale;
    const containerHeight = container ? container.clientHeight : h * scale;

    const pixelWidth = Math.max(1, Math.floor(containerWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(containerHeight * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    const isDark = !!root && root.classList.contains('dark');
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    canvasCtx.clearRect(0, 0, pixelWidth, pixelHeight);

    canvasCtx.fillStyle = isDark ? '#1f2937' : '#e5e7eb';
    canvasCtx.fillRect(0, 0, pixelWidth, pixelHeight);

    canvasCtx.setTransform(scale * dpr, 0, 0, scale * dpr, currentPanX * dpr, currentPanY * dpr);
    canvasCtx.imageSmoothingEnabled = false;
    const pxLineWidth = 1 / (scale * dpr);

    this.drawCheckerboard(canvasCtx, w, h, ctx.tileSize, isDark);
    this.document.layerPixelsVersion();

    const frameId = ctx.getCurrentFrameId();
    const currentAnim = this.document.getCurrentAnimation();
    const animationId = currentAnim?.id;
    const currentTime = this.document.keyframeService?.getCurrentTime();
    const isInTimelineMode = this.document.keyframeService?.isTimelineMode();
    const shouldApplyBoneTransforms = !!(
      animationId &&
      typeof currentTime === 'number' &&
      isInTimelineMode
    );

    this.drawLayers(canvasCtx, w, h, frameId, animationId, currentTime, shouldApplyBoneTransforms);
    this.drawOutOfBoundsPixels(canvasCtx, w, h);
    this.drawCanvasBoundsBorder(canvasCtx, w, h, scale, isDark, pxLineWidth);
    this.drawMovingContent(canvasCtx, ctx.movingContentBuffer, ctx.movingContentOriginalRect, w, h);
    this.drawShapePreview(canvasCtx, ctx, pxLineWidth);
    this.drawPenPreview(canvasCtx, ctx.penDrawing, ctx.penPoints, pxLineWidth);
    this.drawBrushCursor(canvasCtx, ctx.mouseX, ctx.mouseY, currentPanX, currentPanY, scale, isDark, pxLineWidth);
    this.drawBones(canvasCtx, frameId, animationId, currentTime, shouldApplyBoneTransforms, w, h, scale, isDark, pxLineWidth);
    this.drawSelection(canvasCtx, scale, isDark, pxLineWidth);
    this.drawFreeTransformOverlay(canvasCtx, w, h, scale, isDark, pxLineWidth);
    this.drawDistortOverlay(canvasCtx, w, h, scale, isDark, pxLineWidth);
    this.drawPerspectiveOverlay(canvasCtx, w, h, scale, isDark, pxLineWidth);
    this.drawWarpOverlay(canvasCtx, w, h, scale, isDark, pxLineWidth);
    this.drawPuppetWarpOverlay(canvasCtx, w, h, scale, isDark, pxLineWidth);
  }

  private drawCheckerboard(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    tile: number,
    isDark: boolean,
  ): void {
    const darkTile = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.04)';
    const lightTile = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)';
    ctx.save();
    ctx.fillStyle = isDark ? '#374151' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        const even = ((x / tile + y / tile) & 1) === 0;
        ctx.fillStyle = even ? lightTile : darkTile;
        ctx.fillRect(x, y, Math.min(tile, w - x), Math.min(tile, h - y));
      }
    }
    ctx.restore();
  }

  private drawLayers(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frameId: string,
    animationId: string | undefined,
    currentTime: number | undefined,
    shouldApplyBoneTransforms: boolean,
  ): void {
    const layers = this.document.getFlattenedLayers();
    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      if (!layer.visible) continue;
      const buf = this.document.getLayerBuffer(layer.id);
      if (!buf || buf.length !== w * h) continue;
      ctx.save();

      if (shouldApplyBoneTransforms) {
        this.drawLayerWithBoneTransforms(ctx, buf, w, h, frameId, animationId!, currentTime!);
      } else {
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) {
            const col = buf[yy * w + xx];
            if (col && col.length) {
              ctx.fillStyle = col;
              ctx.fillRect(xx, yy, 1, 1);
            }
          }
        }
      }
      ctx.restore();
    }
  }

  private drawOutOfBoundsPixels(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    if (!this.userSettings.showOutOfBoundsPixels()) return;

    const layers = this.document.getFlattenedLayers();
    ctx.save();
    ctx.globalAlpha = CanvasDrawService.OUT_OF_BOUNDS_OPACITY;

    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      if (!layer.visible) continue;

      const pixelMap = this.canvasState.getLayerPixelMap(layer.id);
      for (const [key, color] of pixelMap.entries()) {
        const coords = this.parseCoordinateKey(key);
        if (!coords) continue;
        const { x, y } = coords;
        if (x < 0 || x >= w || y < 0 || y >= h) {
          if (color && color.length) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    ctx.restore();
  }

  private parseCoordinateKey(key: string): { x: number; y: number } | null {
    const parts = key.split(',');
    if (parts.length !== 2) return null;
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    return { x, y };
  }

  private drawCanvasBoundsBorder(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    if (!this.userSettings.showOutOfBoundsPixels()) return;
    ctx.save();
    ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(37, 99, 235, 0.7)';
    ctx.lineWidth = Math.max(pxLineWidth, 2 / scale);
    ctx.strokeRect(-pxLineWidth / 2, -pxLineWidth / 2, w + pxLineWidth, h + pxLineWidth);
    ctx.restore();
  }

  private drawLayerWithBoneTransforms(
    ctx: CanvasRenderingContext2D,
    buf: string[],
    w: number,
    h: number,
    frameId: string,
    animationId: string,
    currentTime: number,
  ): void {
    const boundSourcePixels = new Set<number>();
    const destinationPixelMap = new Map<number, { color: string; sourceIdx: number }>();

    const bindings = this.document.keyframeService.getPixelBindings(frameId);
    if (bindings && bindings.length > 0) {
      const bones = this.boneService.getBones(frameId);
      const boneMap = new Map<string, Bone>();
      for (const bone of bones) {
        boneMap.set(bone.id, bone);
      }

      for (const binding of bindings) {
        const sourceX = binding.pixelX;
        const sourceY = binding.pixelY;
        const sourceIdx = sourceY * w + sourceX;
        const color = buf[sourceIdx];
        if (!color || !color.length) continue;
        boundSourcePixels.add(sourceIdx);

        const bone = boneMap.get(binding.boneId);
        if (!bone) continue;
        const point = bone.points.find((p) => p.id === binding.bonePointId);
        if (!point) continue;

        const transform = this.document.keyframeService.interpolateBoneTransform(
          animationId,
          binding.boneId,
          binding.bonePointId,
          currentTime,
        );
        if (!transform) continue;

        const dx = transform.x - point.x;
        const dy = transform.y - point.y;
        const destX = Math.round(sourceX + dx);
        const destY = Math.round(sourceY + dy);

        if (destX >= 0 && destX < w && destY >= 0 && destY < h) {
          const destIdx = destY * w + destX;
          if (!destinationPixelMap.has(destIdx)) {
            destinationPixelMap.set(destIdx, { color, sourceIdx });
          }
        }
      }
    }

    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const idx = yy * w + xx;

        if (destinationPixelMap.has(idx)) {
          const pixelData = destinationPixelMap.get(idx);
          if (pixelData) {
            ctx.fillStyle = pixelData.color;
            ctx.fillRect(xx, yy, 1, 1);
          }
        } else if (!boundSourcePixels.has(idx)) {
          const col = buf[idx];
          if (col && col.length) {
            ctx.fillStyle = col;
            ctx.fillRect(xx, yy, 1, 1);
          }
        }
      }
    }
  }

  private drawMovingContent(
    ctx: CanvasRenderingContext2D,
    movingContentBuffer: string[] | null,
    movingContentOriginalRect: { x: number; y: number; width: number; height: number } | null,
    w: number,
    h: number,
  ): void {
    if (movingContentBuffer && movingContentOriginalRect) {
      const sel = this.document.selectionRect();
      if (sel) {
        const dx = sel.x - movingContentOriginalRect.x;
        const dy = sel.y - movingContentOriginalRect.y;
        ctx.save();
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const col = movingContentBuffer[idx];
            if (col && col.length) {
              const newX = x + dx;
              const newY = y + dy;
              if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
                ctx.fillStyle = col;
                ctx.fillRect(newX, newY, 1, 1);
              }
            }
          }
        }
        ctx.restore();
      }
    }
  }

  private drawShapePreview(
    ctx: CanvasRenderingContext2D,
    drawCtx: DrawCanvasContext,
    pxLineWidth: number,
  ): void {
    const activeShape = drawCtx.activeShapeTool;
    const shapeStart = drawCtx.shapeStart;
    const shapeCurrent = drawCtx.shapeCurrent;
    if (activeShape && shapeStart && shapeCurrent) {
      ctx.save();
      if (activeShape === 'line') {
        ctx.strokeStyle = this.tools.lineColor();
        ctx.lineWidth = Math.max(pxLineWidth, this.tools.lineThickness());
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(shapeStart.x + 0.5, shapeStart.y + 0.5);
        ctx.lineTo(shapeCurrent.x + 0.5, shapeCurrent.y + 0.5);
        ctx.stroke();
      } else {
        const canvasWidth = this.document.canvasWidth();
        const canvasHeight = this.document.canvasHeight();
        if (activeShape === 'square') {
          const bounds = this.shapeService.computeRectBounds(
            shapeStart,
            shapeCurrent,
            drawCtx.shapeConstrainUniform,
            canvasWidth,
            canvasHeight,
          );
          this.renderService.renderSquarePreview(ctx, bounds, drawCtx.getSquareDrawOptions(), pxLineWidth);
        } else {
          const bounds = this.shapeService.computeRectBounds(
            shapeStart,
            shapeCurrent,
            drawCtx.shapeConstrainUniform,
            canvasWidth,
            canvasHeight,
          );
          this.renderService.renderEllipsePreview(ctx, bounds, drawCtx.getCircleDrawOptions(), pxLineWidth);
        }
      }
      ctx.restore();
    }
  }

  private drawPenPreview(
    ctx: CanvasRenderingContext2D,
    penDrawing: boolean,
    penPoints: { x: number; y: number }[],
    pxLineWidth: number,
  ): void {
    if (penDrawing && penPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = this.tools.penColor();
      ctx.lineWidth = Math.max(pxLineWidth, this.tools.penThickness());
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const lineMode = this.tools.penLineMode();
      if (lineMode === 'spline' && penPoints.length >= 3) {
        const splinePoints = this.shapeService.catmullRomSpline(penPoints, 10);
        if (splinePoints.length > 1) {
          ctx.beginPath();
          ctx.moveTo(splinePoints[0].x + 0.5, splinePoints[0].y + 0.5);
          for (let i = 1; i < splinePoints.length; i++) {
            ctx.lineTo(splinePoints[i].x + 0.5, splinePoints[i].y + 0.5);
          }
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(penPoints[0].x + 0.5, penPoints[0].y + 0.5);
        for (let i = 1; i < penPoints.length; i++) {
          ctx.lineTo(penPoints[i].x + 0.5, penPoints[i].y + 0.5);
        }
        ctx.stroke();
      }
      for (const point of penPoints) {
        ctx.fillStyle = this.tools.penColor();
        ctx.beginPath();
        ctx.arc(point.x + 0.5, point.y + 0.5, Math.max(2, this.tools.penThickness() / 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawBrushCursor(
    ctx: CanvasRenderingContext2D,
    mouseX: number | null,
    mouseY: number | null,
    currentPanX: number,
    currentPanY: number,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const tool = this.tools.currentTool();
    if (tool === 'brush' || tool === 'eraser') {
      if (mouseX !== null && mouseY !== null) {
        const logicalMouseX = (mouseX - currentPanX) / scale;
        const logicalMouseY = (mouseY - currentPanY) / scale;
        const size = tool === 'eraser' ? this.tools.eraserSize() : this.tools.brushSize();
        const bSize = Math.max(1, size);
        const half = Math.floor((bSize - 1) / 2);
        const brushX = Math.floor(logicalMouseX) - half;
        const brushY = Math.floor(logicalMouseY) - half;

        ctx.save();
        ctx.lineWidth = pxLineWidth;
        if (tool === 'eraser') {
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
          ctx.strokeRect(brushX + 0.5, brushY + 0.5, Math.max(0, bSize - 1), Math.max(0, bSize - 1));
          ctx.strokeStyle = CanvasDrawService.ERASER_X_COLOR;
          ctx.lineWidth = pxLineWidth * CanvasDrawService.ERASER_LINE_WIDTH_MULTIPLIER;
          ctx.beginPath();
          ctx.moveTo(brushX, brushY);
          ctx.lineTo(brushX + bSize, brushY + bSize);
          ctx.moveTo(brushX + bSize, brushY);
          ctx.lineTo(brushX, brushY + bSize);
          ctx.stroke();
        } else {
          const brushColor = this.tools.brushColor();
          ctx.fillStyle = brushColor;
          ctx.globalAlpha = CanvasDrawService.BRUSH_PREVIEW_OPACITY;
          ctx.fillRect(brushX, brushY, bSize, bSize);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
          ctx.strokeRect(brushX + 0.5, brushY + 0.5, Math.max(0, bSize - 1), Math.max(0, bSize - 1));
        }
        ctx.restore();
      }
    }
  }

  private drawBones(
    ctx: CanvasRenderingContext2D,
    frameId: string,
    animationId: string | undefined,
    currentTime: number | undefined,
    shouldApplyBoneTransforms: boolean,
    w: number,
    h: number,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const tool = this.tools.currentTool();
    if (tool !== 'bone') return;

    const bones = this.boneService.getBones(frameId);

    const getPointPosition = (boneId: string, point: BonePoint): { x: number; y: number } => {
      if (shouldApplyBoneTransforms && animationId && typeof currentTime === 'number') {
        const transform = this.document.keyframeService.interpolateBoneTransform(
          animationId,
          boneId,
          point.id,
          currentTime,
        );
        if (transform) {
          return { x: transform.x, y: transform.y };
        }
      }
      return { x: point.x, y: point.y };
    };

    ctx.save();
    for (const bone of bones) {
      if (bone.points.length === 0) continue;

      ctx.strokeStyle = bone.color;
      ctx.lineWidth = Math.max(pxLineWidth, bone.thickness);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const drawnConnections = new Set<string>();

      const drawConnection = (point: BonePoint) => {
        if (point.parentId) {
          const connectionKey = `${point.parentId}->${point.id}`;
          if (drawnConnections.has(connectionKey)) return;

          const parent = bone.points.find((p) => p.id === point.parentId);
          if (parent) {
            const parentPos = getPointPosition(bone.id, parent);
            const pointPos = getPointPosition(bone.id, point);
            ctx.beginPath();
            ctx.moveTo(parentPos.x + 0.5, parentPos.y + 0.5);
            ctx.lineTo(pointPos.x + 0.5, pointPos.y + 0.5);
            ctx.stroke();
            drawnConnections.add(connectionKey);
          }
        }
      };

      for (const point of bone.points) {
        drawConnection(point);
      }

      for (const point of bone.points) {
        const isSelected = this.boneService.getSelectedPoint() === point.id;
        const radius = Math.max(3 / scale, 0.5);
        const pos = getPointPosition(bone.id, point);

        ctx.fillStyle = point.color || bone.color;
        ctx.beginPath();
        ctx.arc(pos.x + 0.5, pos.y + 0.5, radius, 0, Math.PI * 2);
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(pxLineWidth * 2, 0.3);
          ctx.stroke();
        }

        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
        ctx.lineWidth = Math.max(pxLineWidth, 0.2);
        ctx.stroke();
      }
    }
    ctx.restore();

    this.drawBoneBindings(ctx, frameId, w, h, scale);
  }

  private drawBoneBindings(
    ctx: CanvasRenderingContext2D,
    frameId: string,
    w: number,
    h: number,
    scale: number,
  ): void {
    const bindings = this.document.keyframeService?.getPixelBindings(frameId);
    if (!bindings || bindings.length === 0 || !this.tools.boneAutoBindEnabled()) return;

    ctx.save();

    const getBoneDisplayColor = (boneId: string): string => {
      let hash = 0;
      for (let i = 0; i < boneId.length; i++) {
        hash = (hash << 5) - hash + boneId.charCodeAt(i);
        hash = hash & hash;
      }
      const hue = Math.abs(hash) % 360;
      const saturation = 60 + (Math.abs(hash >> 8) % 20);
      const lightness = 50 + (Math.abs(hash >> 16) % 15);
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    const boneColorCache = new Map<string, { r: number; g: number; b: number }>();
    const pixelBindingCounts = new Map<string, number>();
    for (const binding of bindings) {
      const key = `${binding.pixelX},${binding.pixelY}`;
      pixelBindingCounts.set(key, (pixelBindingCounts.get(key) || 0) + 1);
    }

    for (const binding of bindings) {
      const pixelKey = `${binding.pixelX},${binding.pixelY}`;
      const bindingCount = pixelBindingCounts.get(pixelKey) || 1;
      const isMultiBound = bindingCount > 1;

      let rgb = boneColorCache.get(binding.boneId);

      if (!rgb) {
        const hslColor = getBoneDisplayColor(binding.boneId);
        const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
        if (tempDiv) {
          tempDiv.style.color = hslColor;
          document.body.appendChild(tempDiv);
          const computed = getComputedStyle(tempDiv).color;
          document.body.removeChild(tempDiv);

          const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) {
            rgb = {
              r: parseInt(match[1]),
              g: parseInt(match[2]),
              b: parseInt(match[3]),
            };
          } else {
            rgb = { r: 255, g: 102, b: 0 };
          }
        } else {
          const hue = Math.abs(
            binding.boneId.split('').reduce((a, c) => a + c.charCodeAt(0), 0),
          ) % 360;
          const s = 0.7;
          const l = 0.6;
          const c = (1 - Math.abs(2 * l - 1)) * s;
          const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
          const m = l - c / 2;
          let r = 0, g = 0, b = 0;
          if (hue < 60) { r = c; g = x; }
          else if (hue < 120) { r = x; g = c; }
          else if (hue < 180) { g = c; b = x; }
          else if (hue < 240) { g = x; b = c; }
          else if (hue < 300) { r = x; b = c; }
          else { r = c; b = x; }
          rgb = {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255),
          };
        }
        if (rgb) {
          boneColorCache.set(binding.boneId, rgb);
        }
      }

      if (rgb) {
        if (isMultiBound) {
          ctx.fillStyle = `rgba(255, 255, 0, 0.4)`;
        } else {
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
        }
        ctx.fillRect(binding.pixelX, binding.pixelY, 1, 1);
      }
    }

    ctx.restore();
  }

  private drawSelection(
    ctx: CanvasRenderingContext2D,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const sel = this.document.selectionRect();
    const selShape = this.document.selectionShape();
    const isFreeTransformActive = this.freeTransform.isActive();
    const isDistortActive = this.distort.isActive();
    const isPerspectiveActive = this.perspective.isActive();
    const isWarpActive = this.warp.isActive();
    const isPuppetWarpActive = this.puppetWarp.isActive();
    if (
      sel &&
      sel.width > 0 &&
      sel.height > 0 &&
      !isFreeTransformActive &&
      !isDistortActive &&
      !isPerspectiveActive &&
      !isWarpActive &&
      !isPuppetWarpActive
    ) {
      ctx.save();

      const mask = this.document.selectionMask();

      if (mask) {
        this.drawMaskBasedSelection(ctx, mask, scale, isDark, pxLineWidth);
      } else {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
        if (selShape === 'ellipse') {
          const cx = sel.x + sel.width / 2 - 0.5;
          const cy = sel.y + sel.height / 2 - 0.5;
          const rx = Math.max(0.5, sel.width / 2);
          const ry = Math.max(0.5, sel.height / 2);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.setLineDash([4 / scale, 3 / scale]);
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
          ctx.lineWidth = pxLineWidth;
          ctx.stroke();
        } else if (selShape === 'lasso') {
          const poly = this.document.selectionPolygon();
          if (poly && poly.length > 0) {
            ctx.beginPath();
            ctx.moveTo(poly[0].x + 0.5, poly[0].y + 0.5);
            for (let i = 1; i < poly.length; i++) {
              ctx.lineTo(poly[i].x + 0.5, poly[i].y + 0.5);
            }
            ctx.closePath();
            ctx.fill();
            ctx.setLineDash([4 / scale, 3 / scale]);
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
            ctx.lineWidth = pxLineWidth;
            ctx.stroke();
          }
        } else {
          ctx.setLineDash([4 / scale, 3 / scale]);
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
          ctx.lineWidth = pxLineWidth;
          ctx.strokeRect(sel.x, sel.y, Math.max(0, sel.width), Math.max(0, sel.height));
        }
      }
      ctx.restore();
    }
  }

  private drawMaskBasedSelection(
    ctx: CanvasRenderingContext2D,
    mask: Set<string>,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    for (const key of mask) {
      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.setLineDash([4 / scale, 3 / scale]);
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
    ctx.lineWidth = pxLineWidth;
    ctx.beginPath();

    for (const key of mask) {
      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);

      if (!mask.has(`${x},${y - 1}`)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y);
      }
      if (!mask.has(`${x + 1},${y}`)) {
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + 1, y + 1);
      }
      if (!mask.has(`${x},${y + 1}`)) {
        ctx.moveTo(x, y + 1);
        ctx.lineTo(x + 1, y + 1);
      }
      if (!mask.has(`${x - 1},${y}`)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 1);
      }
    }

    ctx.stroke();
  }

  private drawFreeTransformOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const ftState = this.freeTransform.transformState();
    const ftHandlerState = this.freeTransformHandler.getState();
    if (ftState && this.document.selectionRect()) {
      ctx.save();
      if (
        (!ftHandlerState.previewIndices || ftHandlerState.previewIndices.length === 0) &&
        ftHandlerState.originalBuffer &&
        ftHandlerState.originalRect
      ) {
        const canvasW = this.document.canvasWidth();
        const canvasH = this.document.canvasHeight();
        const srcW = ftHandlerState.originalRect.width;
        const srcH = ftHandlerState.originalRect.height;
        const srcBuf = ftHandlerState.originalBuffer;
        const scaleX = ftState.width / srcW;
        const scaleY = ftState.height / srcH;
        const cosR = Math.cos((ftState.rotation * Math.PI) / 180);
        const sinR = Math.sin((ftState.rotation * Math.PI) / 180);
        const cX = srcW / 2;
        const cY = srcH / 2;
        for (let y = 0; y < ftState.height; y++) {
          for (let x = 0; x < ftState.width; x++) {
            const srcX = x / scaleX;
            const srcY = y / scaleY;
            const dx = srcX - cX;
            const dy = srcY - cY;
            const rotX = cX + dx * cosR + dy * sinR;
            const rotY = cY - dx * sinR + dy * cosR;
            const sx = Math.floor(rotX);
            const sy = Math.floor(rotY);
            if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
              const srcIdx = sy * srcW + sx;
              const col = srcBuf[srcIdx];
              if (col && col.length) {
                const destX = Math.floor(ftState.x + x);
                const destY = Math.floor(ftState.y + y);
                if (destX >= 0 && destX < canvasW && destY >= 0 && destY < canvasH) {
                  ctx.fillStyle = col;
                  ctx.fillRect(destX, destY, 1, 1);
                }
              }
            }
          }
        }
      }
      ctx.lineWidth = pxLineWidth;
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
      const rad = (ftState.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = ftState.x + ftState.width / 2;
      const cy = ftState.y + ftState.height / 2;
      const corners = [
        { dx: -ftState.width / 2, dy: -ftState.height / 2 },
        { dx: ftState.width / 2, dy: -ftState.height / 2 },
        { dx: ftState.width / 2, dy: ftState.height / 2 },
        { dx: -ftState.width / 2, dy: ftState.height / 2 },
      ].map((c) => ({
        x: cx + c.dx * cos - c.dy * sin,
        y: cy + c.dx * sin + c.dy * cos,
      }));
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.stroke();

      const handles: TransformHandle[] = [
        'top-left', 'top-center', 'top-right',
        'middle-left', 'middle-right',
        'bottom-left', 'bottom-center', 'bottom-right',
        'rotate-center',
      ];
      for (const handle of handles) {
        const pos = this.freeTransform.getHandlePosition(handle, ftState);
        const rOuter = Math.max(0.5, 0.8 / Math.max(0.001, scale));
        ctx.fillStyle = handle === 'rotate-center'
          ? (isDark ? '#3b82f6' : '#1d4ed8')
          : (isDark ? '#ffffff' : '#000000');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rOuter, 0, Math.PI * 2);
        ctx.fill();
        if (handle === 'rotate-center') {
          const rr = Math.max(2, 4 / Math.max(0.001, scale));
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = Math.max(pxLineWidth, 0.8 / Math.max(0.001, scale));
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, rr, -Math.PI * 0.2, Math.PI * 1.1);
          ctx.stroke();
        }
      }
      const positions = this.renderService.computeTransformButtonPositions(ftState, scale, w, h);
      this.drawFreeTransformButtons(ctx, positions, scale, isDark, pxLineWidth);
      ctx.restore();
    }
  }

  private drawFreeTransformButtons(
    ctx: CanvasRenderingContext2D,
    positions: {
      btnSize: number;
      commitX: number;
      commitY: number;
      cancelX: number;
      cancelY: number;
      mirrorXX: number;
      mirrorXY: number;
      mirrorYX: number;
      mirrorYY: number;
    },
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const { btnSize, commitX, commitY, cancelX, cancelY, mirrorXX, mirrorXY, mirrorYX, mirrorYY } = positions;

    ctx.fillStyle = this.freeTransformHandler.getMirrorY()
      ? (isDark ? '#047857' : '#059669')
      : (isDark ? '#065f46' : '#047857');
    ctx.fillRect(mirrorYX, mirrorYY, btnSize, btnSize);
    ctx.strokeStyle = isDark ? '#d1d5db' : '#f9fafb';
    ctx.lineWidth = Math.max(pxLineWidth, 0.8 / Math.max(0.001, scale));
    ctx.beginPath();
    ctx.moveTo(mirrorYX + btnSize * 0.5, mirrorYY + btnSize * 0.2);
    ctx.lineTo(mirrorYX + btnSize * 0.5, mirrorYY + btnSize * 0.8);
    ctx.moveTo(mirrorYX + btnSize * 0.5, mirrorYY + btnSize * 0.2);
    ctx.lineTo(mirrorYX + btnSize * 0.35, mirrorYY + btnSize * 0.35);
    ctx.moveTo(mirrorYX + btnSize * 0.5, mirrorYY + btnSize * 0.2);
    ctx.lineTo(mirrorYX + btnSize * 0.65, mirrorYY + btnSize * 0.35);
    ctx.moveTo(mirrorYX + btnSize * 0.5, mirrorYY + btnSize * 0.8);
    ctx.lineTo(mirrorYX + btnSize * 0.35, mirrorYY + btnSize * 0.65);
    ctx.moveTo(mirrorYX + btnSize * 0.5, mirrorYY + btnSize * 0.8);
    ctx.lineTo(mirrorYX + btnSize * 0.65, mirrorYY + btnSize * 0.65);
    ctx.stroke();

    ctx.fillStyle = this.freeTransformHandler.getMirrorX()
      ? (isDark ? '#047857' : '#059669')
      : (isDark ? '#065f46' : '#047857');
    ctx.fillRect(mirrorXX, mirrorXY, btnSize, btnSize);
    ctx.beginPath();
    ctx.moveTo(mirrorXX + btnSize * 0.2, mirrorXY + btnSize * 0.5);
    ctx.lineTo(mirrorXX + btnSize * 0.8, mirrorXY + btnSize * 0.5);
    ctx.moveTo(mirrorXX + btnSize * 0.2, mirrorXY + btnSize * 0.5);
    ctx.lineTo(mirrorXX + btnSize * 0.35, mirrorXY + btnSize * 0.35);
    ctx.moveTo(mirrorXX + btnSize * 0.2, mirrorXY + btnSize * 0.5);
    ctx.lineTo(mirrorXX + btnSize * 0.35, mirrorXY + btnSize * 0.65);
    ctx.moveTo(mirrorXX + btnSize * 0.8, mirrorXY + btnSize * 0.5);
    ctx.lineTo(mirrorXX + btnSize * 0.65, mirrorXY + btnSize * 0.35);
    ctx.moveTo(mirrorXX + btnSize * 0.8, mirrorXY + btnSize * 0.5);
    ctx.lineTo(mirrorXX + btnSize * 0.65, mirrorXY + btnSize * 0.65);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#1e40af' : '#1d4ed8';
    ctx.fillRect(commitX, commitY, btnSize, btnSize);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = Math.max(pxLineWidth, 0.8 / Math.max(0.001, scale));
    ctx.beginPath();
    ctx.moveTo(commitX + btnSize * 0.2, commitY + btnSize * 0.5);
    ctx.lineTo(commitX + btnSize * 0.4, commitY + btnSize * 0.7);
    ctx.lineTo(commitX + btnSize * 0.8, commitY + btnSize * 0.25);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#991b1b' : '#b91c1c';
    ctx.fillRect(cancelX, cancelY, btnSize, btnSize);
    ctx.strokeStyle = '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(cancelX + btnSize * 0.28, cancelY + btnSize * 0.28);
    ctx.lineTo(cancelX + btnSize * 0.72, cancelY + btnSize * 0.72);
    ctx.moveTo(cancelX + btnSize * 0.72, cancelY + btnSize * 0.28);
    ctx.lineTo(cancelX + btnSize * 0.28, cancelY + btnSize * 0.72);
    ctx.stroke();
  }

  private drawDistortOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const distortState = this.distort.distortState();
    if (distortState) {
      ctx.save();
      ctx.lineWidth = pxLineWidth;
      ctx.strokeStyle = isDark ? 'rgba(59,130,246,0.9)' : 'rgba(37,99,235,0.9)';

      const corners = distortState.corners;
      ctx.beginPath();
      ctx.moveTo(corners.topLeft.x, corners.topLeft.y);
      ctx.lineTo(corners.topRight.x, corners.topRight.y);
      ctx.lineTo(corners.bottomRight.x, corners.bottomRight.y);
      ctx.lineTo(corners.bottomLeft.x, corners.bottomLeft.y);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = isDark ? 'rgba(59,130,246,0.5)' : 'rgba(37,99,235,0.5)';
      this.drawDistortGrid(ctx, corners, 3);

      const handles: DistortHandle[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
      for (const handle of handles) {
        const pos = this.distort.getHandlePosition(handle);
        if (pos) {
          const rOuter = Math.max(1.2, 1.5 / Math.max(0.001, scale));
          ctx.fillStyle = isDark ? '#3b82f6' : '#2563eb';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, rOuter, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
          ctx.lineWidth = Math.max(pxLineWidth, 0.5 / Math.max(0.001, scale));
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, rOuter, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const buttonPositions = this.renderService.computeDistortButtonPositions(distortState, scale, w, h);
      this.drawTransformButtons(ctx, buttonPositions, scale, isDark, pxLineWidth);
      ctx.restore();
    }
  }

  private drawDistortGrid(
    ctx: CanvasRenderingContext2D,
    corners: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
      bottomRight: { x: number; y: number };
    },
    gridSteps: number,
  ): void {
    for (let i = 1; i < gridSteps; i++) {
      const t = i / gridSteps;
      const topX = corners.topLeft.x + (corners.topRight.x - corners.topLeft.x) * t;
      const topY = corners.topLeft.y + (corners.topRight.y - corners.topLeft.y) * t;
      const bottomX = corners.bottomLeft.x + (corners.bottomRight.x - corners.bottomLeft.x) * t;
      const bottomY = corners.bottomLeft.y + (corners.bottomRight.y - corners.bottomLeft.y) * t;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(bottomX, bottomY);
      ctx.stroke();

      const leftX = corners.topLeft.x + (corners.bottomLeft.x - corners.topLeft.x) * t;
      const leftY = corners.topLeft.y + (corners.bottomLeft.y - corners.topLeft.y) * t;
      const rightX = corners.topRight.x + (corners.bottomRight.x - corners.topRight.x) * t;
      const rightY = corners.topRight.y + (corners.bottomRight.y - corners.topRight.y) * t;
      ctx.beginPath();
      ctx.moveTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.stroke();
    }
  }

  private drawPerspectiveOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const perspectiveState = this.perspective.perspectiveState();
    if (perspectiveState) {
      ctx.save();
      ctx.lineWidth = pxLineWidth;
      ctx.setLineDash([4 / Math.max(0.001, scale), 4 / Math.max(0.001, scale)]);
      ctx.strokeStyle = isDark ? 'rgba(147,51,234,0.9)' : 'rgba(126,34,206,0.9)';

      const corners = perspectiveState.corners;
      ctx.beginPath();
      ctx.moveTo(corners.topLeft.x, corners.topLeft.y);
      ctx.lineTo(corners.topRight.x, corners.topRight.y);
      ctx.lineTo(corners.bottomRight.x, corners.bottomRight.y);
      ctx.lineTo(corners.bottomLeft.x, corners.bottomLeft.y);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = isDark ? 'rgba(147,51,234,0.5)' : 'rgba(126,34,206,0.5)';
      this.drawDistortGrid(ctx, corners, 3);

      ctx.setLineDash([]);

      const handles: PerspectiveHandle[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
      for (const handle of handles) {
        const pos = this.perspective.getHandlePosition(handle);
        if (pos) {
          const rOuter = Math.max(1.2, 1.5 / Math.max(0.001, scale));
          ctx.fillStyle = isDark ? '#9333ea' : '#7e22ce';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, rOuter, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
          ctx.lineWidth = Math.max(pxLineWidth, 0.5 / Math.max(0.001, scale));
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, rOuter, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const buttonPositions = this.renderService.computeDistortButtonPositions(perspectiveState, scale, w, h);
      this.drawTransformButtons(ctx, buttonPositions, scale, isDark, pxLineWidth);
      ctx.restore();
    }
  }

  private drawWarpOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const warpState = this.warp.warpState();
    if (warpState) {
      ctx.save();
      ctx.lineWidth = pxLineWidth;
      ctx.strokeStyle = isDark ? 'rgba(34,197,94,0.9)' : 'rgba(22,163,74,0.9)';

      const dims = this.warp.getGridDimensions();
      if (dims) {
        const { rows, cols } = dims;

        for (let row = 0; row <= rows; row++) {
          for (let col = 0; col <= cols; col++) {
            const node = this.warp.getNode(row, col);
            if (!node) continue;

            if (col < cols) {
              const nextNode = this.warp.getNode(row, col + 1);
              if (nextNode) {
                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(nextNode.x, nextNode.y);
                ctx.stroke();
              }
            }

            if (row < rows) {
              const nextNode = this.warp.getNode(row + 1, col);
              if (nextNode) {
                ctx.beginPath();
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(nextNode.x, nextNode.y);
                ctx.stroke();
              }
            }
          }
        }

        for (const node of warpState.nodes) {
          const rOuter = Math.max(1.2, 1.5 / Math.max(0.001, scale));
          ctx.fillStyle = isDark ? '#22c55e' : '#16a34a';
          ctx.beginPath();
          ctx.arc(node.x, node.y, rOuter, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
          ctx.lineWidth = Math.max(pxLineWidth, 0.5 / Math.max(0.001, scale));
          ctx.beginPath();
          ctx.arc(node.x, node.y, rOuter, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const buttonPositions = this.renderService.computeWarpButtonPositions(warpState, scale, w, h);
      this.drawTransformButtons(ctx, buttonPositions, scale, isDark, pxLineWidth);
      ctx.restore();
    }
  }

  private drawPuppetWarpOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const puppetWarpState = this.puppetWarp.puppetWarpState();
    if (puppetWarpState) {
      ctx.save();

      for (const pin of puppetWarpState.pins) {
        ctx.fillStyle = isDark ? 'rgba(236,72,153,0.2)' : 'rgba(219,39,119,0.2)';
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(236,72,153,0.4)' : 'rgba(219,39,119,0.4)';
        ctx.lineWidth = pxLineWidth;
        ctx.setLineDash([4 / Math.max(0.001, scale), 4 / Math.max(0.001, scale)]);
        ctx.stroke();
        ctx.setLineDash([]);

        const rOuter = Math.max(1.5, 2 / Math.max(0.001, scale));
        ctx.fillStyle = pin.locked
          ? (isDark ? '#ef4444' : '#dc2626')
          : (isDark ? '#ec4899' : '#db2777');
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, rOuter, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
        ctx.lineWidth = Math.max(pxLineWidth, 0.5 / Math.max(0.001, scale));
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, rOuter, 0, Math.PI * 2);
        ctx.stroke();

        if (pin.locked) {
          const lockSize = rOuter * 0.8;
          ctx.fillStyle = isDark ? '#ffffff' : '#000000';
          ctx.fillRect(
            pin.x - lockSize * 0.3,
            pin.y - lockSize * 0.5,
            lockSize * 0.6,
            lockSize,
          );
        }
      }

      const buttonPositions = this.renderService.computePuppetWarpButtonPositions(puppetWarpState, scale, w, h);
      this.drawTransformButtons(ctx, buttonPositions, scale, isDark, pxLineWidth);
      ctx.restore();
    }
  }

  private drawTransformButtons(
    ctx: CanvasRenderingContext2D,
    positions: {
      btnSize: number;
      commitX: number;
      commitY: number;
      cancelX: number;
      cancelY: number;
    },
    scale: number,
    isDark: boolean,
    pxLineWidth: number,
  ): void {
    const { btnSize, commitX, commitY, cancelX, cancelY } = positions;

    ctx.fillStyle = isDark ? '#059669' : '#047857';
    ctx.fillRect(commitX, commitY, btnSize, btnSize);
    ctx.strokeStyle = isDark ? '#d1d5db' : '#f9fafb';
    ctx.lineWidth = Math.max(pxLineWidth, 0.8 / Math.max(0.001, scale));
    ctx.beginPath();
    ctx.moveTo(commitX + btnSize * 0.2, commitY + btnSize * 0.5);
    ctx.lineTo(commitX + btnSize * 0.4, commitY + btnSize * 0.7);
    ctx.lineTo(commitX + btnSize * 0.8, commitY + btnSize * 0.25);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#dc2626' : '#991b1b';
    ctx.fillRect(cancelX, cancelY, btnSize, btnSize);
    ctx.beginPath();
    ctx.moveTo(cancelX + btnSize * 0.28, cancelY + btnSize * 0.28);
    ctx.lineTo(cancelX + btnSize * 0.72, cancelY + btnSize * 0.72);
    ctx.moveTo(cancelX + btnSize * 0.72, cancelY + btnSize * 0.28);
    ctx.lineTo(cancelX + btnSize * 0.28, cancelY + btnSize * 0.72);
    ctx.stroke();
  }
}
