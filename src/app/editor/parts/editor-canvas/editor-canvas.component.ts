import {
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
  effect,
  EffectRef,
  EnvironmentInjector,
  OnDestroy,
} from '@angular/core';
import {
  EditorDocumentService,
  isLayer,
} from '../../../services/editor-document.service';
import { EditorToolsService } from '../../../services/editor-tools.service';
import {
  GradientType,
  ShapeFillMode,
} from '../../../services/tools/tool.types';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { CommonModule } from '@angular/common';
import {
  EditorBoneService,
  Bone,
  BonePoint,
} from '../../../services/editor/editor-bone.service';
import { HotkeysService } from '../../../services/hotkeys.service';
import {
  PixelGenerationDialog,
  GeneratePixelArtRequest,
} from '../../../shared/pixel-generation-dialog/pixel-generation-dialog';
import { PixelGenerationEngineService } from '../../../services/pixel-generation';
import { EditorFreeTransformService, TransformHandle } from '../../../services/editor/editor-free-transform.service';
interface ShapeDrawOptions {
  strokeThickness: number;
  strokeColor: string;
  fillMode: ShapeFillMode;
  fillColor: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientType: GradientType;
  gradientAngle: number;
}

type ContextMenuActionId =
  | 'deselect'
  | 'invertSelection'
  | 'growSelection'
  | 'growBy1px'
  | 'growBy2px'
  | 'growBy5px'
  | 'growCustom'
  | 'makeCopyLayer'
  | 'mergeVisibleToNewLayer'
  | 'generate'
  | 'generateFromLayer'
  | 'generateFromVisible';

interface ContextMenuAction {
  id: ContextMenuActionId;
  labelKey: string;
  icon: string;
  disabled?: boolean;
  submenu?: ContextMenuAction[];
}

@Component({
  selector: 'pa-editor-canvas',
  templateUrl: './editor-canvas.component.html',
  styleUrls: ['./editor-canvas.component.css'],
  imports: [CommonModule, TranslocoPipe, NgIcon, PixelGenerationDialog],
  host: {
    class: 'block h-full w-full',
    '(wheel)': 'onWheel($event)',
  },
})
export class EditorCanvas implements OnDestroy {
  @ViewChild('canvasEl', { static: true })
  canvasEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer', { static: true })
  canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('canvasWrapper', { static: true })
  canvasWrapper!: ElementRef<HTMLDivElement>;
  @ViewChild(PixelGenerationDialog, { static: false })
  pixelGenerationDialog!: PixelGenerationDialog;
  readonly document = inject(EditorDocumentService);
  readonly documentSvc: EditorDocumentService = this.document;
  readonly tools = inject(EditorToolsService);
  readonly boneService = inject(EditorBoneService);
  readonly hotkeys = inject(HotkeysService);
  readonly pixelGenEngine = inject(PixelGenerationEngineService);
  readonly freeTransform = inject(EditorFreeTransformService);

  readonly mouseX = signal<number | null>(null);
  readonly mouseY = signal<number | null>(null);
  readonly hoverX = signal<number | null>(null);
  readonly hoverY = signal<number | null>(null);

  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly scale = signal(1);
  // rotation feature disabled temporarily
  readonly rotation = signal(0);
  readonly minScale = 0.05;
  private readonly injector = inject(EnvironmentInjector);
  private readonly viewReady = signal(false);
  private readonly shapeStart = signal<{ x: number; y: number } | null>(null);
  private readonly shapeCurrent = signal<{ x: number; y: number } | null>(null);
  private readonly activeShapeTool = signal<
    'line' | 'circle' | 'square' | null
  >(null);
  private readonly shapeConstrainUniform = signal(false);

  private panning = false;
  private painting = false;
  private lastPaintPos: { x: number; y: number } | null = null;
  private selectionStart: { x: number; y: number } | null = null;
  private selectionDragging = false;
  private selectionMoving = false;
  private selectionMoveStart: { x: number; y: number } | null = null;
  private generationCheckInterval: number | null = null;
  private vKeyPressed = false;
  private selectionContentMoving = false;
  private selectionContentMoveStart: { x: number; y: number } | null = null;
  private movingContentBuffer: string[] | null = null;
  private movingContentOriginalRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  private originalLayerId: string | null = null;
  private freeTransformOriginalBuffer: string[] | null = null;
  private freeTransformOriginalRect: { x: number; y: number; width: number; height: number } | null = null;
  private freeTransformLayerId: string | null = null;
  private freeTransformPreviewIndices: number[] | null = null;
  private freeTransformDuplicate = false;
  private freeTransformMirrorX = false;
  private freeTransformMirrorY = false;
  private shiftPressed = false;
  private lastPointer = { x: 0, y: 0 };
  private shaping = false;
  private stopRenderEffect: EffectRef | null = null;
  private currentBoneId: string | null = null;
  private draggingPointId: string | null = null;
  private draggingPointBoneId: string | null = null;
  readonly tileSize = signal(1);
  readonly contextMenuVisible = signal(false);
  readonly contextMenuPosition = signal<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  readonly contextMenuActions = signal<ContextMenuAction[]>([]);
  readonly submenuVisible = signal(false);
  readonly submenuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly submenuActions = signal<ContextMenuAction[]>([]);
  readonly inputDialogVisible = signal(false);
  readonly inputDialogPosition = signal<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  readonly inputDialogValue = signal('10');
  readonly inputDialogTitle = signal('');
  readonly inputDialogCallback = signal<((value: string) => void) | null>(null);
  private resizeListener: (() => void) | null = null;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private readonly defaultCursor = `url('/cursors/link.png') 12 12, link`;
  private readonly brushCursor = `url('/cursors/handwriting.png') 12 12, crosshair`;
  private readonly eraserCursor = `url('/cursors/unavailable.png') 12 12, cell`;
  private readonly handGrabbingCursor = `url('/cursors/grab.png') 12 12, grab`;
  private readonly bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  private readonly gradientSteps = 8;

  private capturePointer(ev: PointerEvent): void {
    const target = ev.currentTarget as HTMLElement;
    if (target?.setPointerCapture) {
      target.setPointerCapture(ev.pointerId);
    }
  }

  private releasePointer(ev: PointerEvent): void {
    const target = ev.currentTarget as HTMLElement;
    if (target?.releasePointerCapture) {
      try {
        if (target.hasPointerCapture(ev.pointerId)) {
          target.releasePointerCapture(ev.pointerId);
        }
      } catch {}
    }
  }

  constructor() {
    this.stopRenderEffect = effect(() => {
      this.drawCanvas();
      return null as any;
    });

    // If selection is cleared while free transform is active, cancel and clean state.
    effect(() => {
      const sel = this.document.selectionRect();
      const active = this.freeTransform.isActive();
      if (active && (!sel || sel.width <= 0 || sel.height <= 0)) {
        this.cancelFreeTransform();
      }
    });

    effect(() => {
      const tool = this.tools.currentTool();
      if (tool !== 'bone' && this.currentBoneId) {
        this.currentBoneId = null;
      }
    });

    this.registerCanvasHotkeys();
  }

  private registerCanvasHotkeys() {
    this.hotkeys.register({
      id: 'edit.deselect',
      category: 'edit',
      defaultKey: 'ctrl+shift+d',
      handler: () => this.document.clearSelection(),
    });

    this.hotkeys.register({
      id: 'edit.invertSelection',
      category: 'edit',
      defaultKey: 'ctrl+shift+i',
      handler: () => this.document.invertSelection(),
    });

    this.hotkeys.register({
      id: 'edit.growBy1px',
      category: 'edit',
      defaultKey: 'ctrl+shift+1',
      handler: () => this.document.growSelection(1),
    });

    this.hotkeys.register({
      id: 'edit.growBy2px',
      category: 'edit',
      defaultKey: 'ctrl+shift+2',
      handler: () => this.document.growSelection(2),
    });

    this.hotkeys.register({
      id: 'edit.growBy5px',
      category: 'edit',
      defaultKey: 'ctrl+shift+5',
      handler: () => this.document.growSelection(5),
    });

    this.hotkeys.register({
      id: 'edit.makeCopyLayer',
      category: 'edit',
      defaultKey: 'ctrl+j',
      handler: () => this.document.makeCopyLayer(),
    });

    this.hotkeys.register({
      id: 'edit.mergeVisibleToNewLayer',
      category: 'edit',
      defaultKey: 'ctrl+shift+m',
      handler: () => this.document.mergeVisibleToNewLayer(),
    });

    this.hotkeys.register({
      id: 'tool.freeTransform',
      category: 'tool',
      defaultKey: 'shift+t',
      handler: () => this.activateFreeTransform(),
    });
  }

  private readonly layoutEffect = effect(
    () => {
      if (!this.viewReady()) return;
      this.document.canvasWidth();
      this.document.canvasHeight();
      const scheduler =
        typeof queueMicrotask === 'function'
          ? queueMicrotask
          : (cb: () => void) => Promise.resolve().then(cb);
      scheduler(() => this.centerAndFitCanvas());
    },
    { injector: this.injector },
  );

  // compute the CSS cursor for the canvas based on current tool and state
  cursor(): string {
    if (this.panning) return this.handGrabbingCursor;
    const tool = this.tools.currentTool();
    if (
      tool === 'rect-select' ||
      tool === 'ellipse-select' ||
      tool === 'lasso-select'
    )
      return `crosshair`;
    if (tool === 'brush') return this.brushCursor;
    if (tool === 'eraser') return this.eraserCursor;
    if (tool === 'line' || tool === 'circle' || tool === 'square')
      return `crosshair`;
    if (tool === 'bone') return `crosshair`;
    return this.defaultCursor;
  }

  ngAfterViewInit(): void {
    // Auto-scale to fit the viewport and center the canvas.
    this.centerAndFitCanvas();
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      window.requestAnimationFrame(() => this.centerAndFitCanvas());
    }
    this.updateTileSize(this.tools.brushSize());

    const flatLayers = this.document.getFlattenedLayers();
    for (const l of flatLayers) {
      this.document.ensureLayerBuffer(
        l.id,
        this.document.canvasWidth(),
        this.document.canvasHeight(),
      );
    }

    // Recenter on window resize
    this.resizeListener = () => this.centerAndFitCanvas();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeListener as EventListener);
      // listen for Escape to cancel in-progress lasso selections
      this.keyListener = (ev: KeyboardEvent) => {
        const target = ev.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName.toLowerCase();
          if (
            tag === 'input' ||
            tag === 'textarea' ||
            target.isContentEditable
          ) {
            return;
          }
        }
        if (ev.key === 'Escape') {
          if (this.freeTransform.isActive()) {
            this.cancelFreeTransform();
            return;
          }
          if (this.contextMenuVisible()) {
            this.closeContextMenu();
            return;
          }
          const tool = this.tools.currentTool();
          if (tool === 'bone') {
            this.currentBoneId = null;
            this.boneService.clearSelection();
            return;
          }
          if (tool === 'lasso-select') {
            this.document.selectionPolygon.set(null as any);
            this.document.selectionRect.set(null as any);
            this.document.selectionShape.set('rect');
            this.selectionDragging = false;
            this.selectionStart = null;
          }
          return;
        }
        if (ev.key === 'Enter') {
          if (this.freeTransform.isActive()) {
            this.commitFreeTransform();
            return;
          }
        }
        const key = ev.key?.toLowerCase?.() ?? ev.key;
        if (key === 'v' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          this.vKeyPressed = true;
          return;
        }
        if (ev.ctrlKey && ev.shiftKey && key === 'd') {
          ev.preventDefault();
          this.document.clearSelection();
          return;
        }
        if (ev.ctrlKey && key === 'd') {
          ev.preventDefault();
          this.document.duplicateLayer();
          return;
        }
        if (ev.ctrlKey && key === 'l') {
          ev.preventDefault();
          const selectedId = this.document.selectedLayerId();
          if (selectedId) {
            this.document.toggleLayerLock(selectedId);
          }
          return;
        }
        if (ev.key === 'Delete') {
          ev.preventDefault();
          const selectedIds = Array.from(this.document.selectedLayerIds());
          for (const id of selectedIds) {
            this.document.removeLayer(id);
          }
          return;
        }
        if (ev.ctrlKey && ev.shiftKey && key === 'g') {
          ev.preventDefault();
          const selectedIds = Array.from(this.document.selectedLayerIds());
          if (selectedIds.length >= 2) {
            this.document.ungroupLayers(selectedIds[0]);
          }
          return;
        }
        // Ctrl+T is browser-reserved (new tab) and cannot be reliably overridden.
        // Free Transform is bound to Shift+T via HotkeysService.
        if (ev.ctrlKey && key === 'g') {
          ev.preventDefault();
          const selectedIds = Array.from(this.document.selectedLayerIds());
          if (selectedIds.length >= 2) {
            this.document.groupLayers(selectedIds);
          }
          return;
        }
      };
      window.addEventListener('keydown', this.keyListener as EventListener);
      window.addEventListener('keyup', (ev: KeyboardEvent) => {
        const key = ev.key?.toLowerCase?.() ?? ev.key;
        if (key === 'v') {
          this.vKeyPressed = false;
        }
        if (ev.key === 'Shift') {
          this.shiftPressed = false;
          this.freeTransform.setSnapRotation(false);
          this.freeTransform.setConstrainProportions(false);
        }
      });
    }

    this.viewReady.set(true);
  }

  get maxScale(): number {
    const maxDim = Math.max(
      1,
      Math.max(this.document.canvasWidth(), this.document.canvasHeight()),
    );
    const targetPx = 512;
    const computed = Math.ceil(targetPx / maxDim);
    return Math.min(Math.max(8, computed), 256);
  }

  updateTileSize(brushSize = 1, desiredScreenTilePx = 24) {
    const s = Math.max(0.001, this.scale());
    const tile = Math.max(
      1,
      Math.round(desiredScreenTilePx / (s * Math.max(1, brushSize))),
    );
    this.tileSize.set(tile);
  }

  onPointerMove(ev: PointerEvent) {
    const rect = this.canvasEl.nativeElement.getBoundingClientRect();

    const visX = ev.clientX - rect.left;
    const visY = ev.clientY - rect.top;
    this.mouseX.set(Math.round(visX));
    this.mouseY.set(Math.round(visY));

    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const ratioX = w / Math.max(1, rect.width);
    const ratioY = h / Math.max(1, rect.height);
    const logicalX = Math.floor(visX * ratioX);
    const logicalY = Math.floor(visY * ratioY);

    if (logicalX >= 0 && logicalX < w && logicalY >= 0 && logicalY < h) {
      this.hoverX.set(logicalX);
      this.hoverY.set(logicalY);
    } else {
      this.hoverX.set(null);
      this.hoverY.set(null);
    }

    if (this.panning) {
      const dx = ev.clientX - this.lastPointer.x;
      const dy = ev.clientY - this.lastPointer.y;
      this.panX.set(this.panX() + dx);
      this.panY.set(this.panY() + dy);
      this.lastPointer.x = ev.clientX;
      this.lastPointer.y = ev.clientY;
    }

    if (this.freeTransform.isDraggingHandle()) {
      const handle = this.freeTransform.isDraggingHandle();
      if (handle === 'rotate-center') {
        this.freeTransform.setSnapRotation(ev.shiftKey || this.shiftPressed);
        this.freeTransform.setConstrainProportions(false);
      } else {
        this.freeTransform.setConstrainProportions(ev.shiftKey || this.shiftPressed);
        this.freeTransform.setSnapRotation(false);
      }
      this.freeTransform.updateHandleDrag(logicalX, logicalY);
      this.renderLiveFreeTransformPreview();
      return;
    }

    if (this.selectionMoving && this.selectionMoveStart) {
      if (logicalX < 0 || logicalX >= w || logicalY < 0 || logicalY >= h) {
        return;
      }
      const dx = logicalX - this.selectionMoveStart.x;
      const dy = logicalY - this.selectionMoveStart.y;
      if (dx !== 0 || dy !== 0) {
        this.document.moveSelection(dx, dy);
        this.selectionMoveStart = { x: logicalX, y: logicalY };
      }
      return;
    }

    if (this.selectionContentMoving && this.selectionContentMoveStart) {
      if (logicalX < 0 || logicalX >= w || logicalY < 0 || logicalY >= h) {
        return;
      }
      const dx = logicalX - this.selectionContentMoveStart.x;
      const dy = logicalY - this.selectionContentMoveStart.y;
      if (dx !== 0 || dy !== 0) {
        this.moveSelectionContent(dx, dy);
        this.selectionContentMoveStart = { x: logicalX, y: logicalY };
      }
      return;
    }

    if (this.selectionDragging) {
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      const tool = this.tools.currentTool();
      if (tool === 'lasso-select') {
        this.document.addLassoPoint(clampedX, clampedY);
      } else {
        let endX = clampedX;
        let endY = clampedY;
        if (ev.shiftKey && this.selectionStart) {
          const dx = clampedX - this.selectionStart.x;
          const dy = clampedY - this.selectionStart.y;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          const max = Math.max(absDx, absDy);
          const sx = dx >= 0 ? 1 : -1;
          const sy = dy >= 0 ? 1 : -1;
          endX = this.selectionStart.x + sx * max;
          endY = this.selectionStart.y + sy * max;
          endX = Math.max(0, Math.min(endX, w - 1));
          endY = Math.max(0, Math.min(endY, h - 1));
        }
        this.document.updateSelection(endX, endY);
      }
      return;
    }

    if (this.shaping) {
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      const active = this.activeShapeTool();
      if (active === 'square' || active === 'circle') {
        this.shapeConstrainUniform.set(ev.shiftKey);
      } else {
        this.shapeConstrainUniform.set(false);
      }
      this.shapeCurrent.set({ x: clampedX, y: clampedY });
    }

    if (this.draggingPointId && this.draggingPointBoneId) {
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      const frameId = this.getCurrentFrameId();
      const currentAnim = this.document.getCurrentAnimation();
      const animationId = currentAnim?.id;
      const currentTime = this.document.keyframeService?.getCurrentTime();
      this.boneService.updatePoint(
        frameId,
        this.draggingPointBoneId,
        this.draggingPointId,
        clampedX,
        clampedY,
        animationId,
        currentTime,
      );
      return;
    }

    if (this.painting) {
      const selectedLayer = this.document.selectedLayer();
      if (selectedLayer?.locked) {
        return;
      }
      const clampedX = Math.max(0, Math.min(w - 1, logicalX));
      const clampedY = Math.max(0, Math.min(h - 1, logicalY));
      const layerId = this.document.selectedLayerId();
      const tool = this.tools.currentTool();
      const color = tool === 'eraser' ? null : this.tools.brushColor();
      const size =
        tool === 'eraser' ? this.tools.eraserSize() : this.tools.brushSize();
      if (this.lastPaintPos) {
        this.drawLinePaint(
          layerId,
          this.lastPaintPos.x,
          this.lastPaintPos.y,
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
          tool === 'eraser'
            ? { eraserStrength: this.tools.eraserStrength() }
            : undefined,
        );
      }
      this.lastPaintPos = { x: clampedX, y: clampedY };
    }
  }

  onPointerLeave() {
    this.hoverX.set(null);
    this.hoverY.set(null);
  }

  onWheel(ev: WheelEvent) {
    const container = this.canvasContainer?.nativeElement;
    if (!container) return;

    const target = ev.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target.isContentEditable)
        return;
    }

    const rect = container.getBoundingClientRect();
    if (
      ev.clientX < rect.left ||
      ev.clientX > rect.right ||
      ev.clientY < rect.top ||
      ev.clientY > rect.bottom
    ) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();

    let delta = ev.deltaY;
    if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      delta *= 16;
    } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      delta *= rect.height;
    }

    const zoomIntensity = 0.002;
    const factor = Math.exp(-delta * zoomIntensity);
    const next = this.scale() * factor;
    this.applyZoom(next, { clientX: ev.clientX, clientY: ev.clientY });
  }

  onPointerDown(ev: PointerEvent) {
    if (this.contextMenuVisible()) {
      this.closeContextMenu();
    }
    if (ev.button === 1 || ev.ctrlKey) {
      this.panning = true;
      this.lastPointer.x = ev.clientX;
      this.lastPointer.y = ev.clientY;
      this.capturePointer(ev);
    }

    const rect = this.canvasEl.nativeElement.getBoundingClientRect();
    const visX = ev.clientX - rect.left;
    const visY = ev.clientY - rect.top;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const ratioX = w / Math.max(1, rect.width);
    const ratioY = h / Math.max(1, rect.height);
    const logicalX = Math.floor(visX * ratioX);
    const logicalY = Math.floor(visY * ratioY);
    const tool = this.tools.currentTool();
    const insideCanvas =
      logicalX >= 0 && logicalX < w && logicalY >= 0 && logicalY < h;

    if (ev.button === 2) {
      return;
    }

    if (ev.button === 0) {
      const freeTransformState = this.freeTransform.transformState();
      if (freeTransformState) {
        const handleSize = Math.max(3, Math.round(5 / Math.max(0.001, this.scale())));
        const buttonSize = Math.max(6, Math.round(8 / Math.max(0.001, this.scale())));
        const buttonMargin = Math.max(2, Math.round(5 / Math.max(0.001, this.scale())));
        const canvasW = this.document.canvasWidth();
        const canvasH = this.document.canvasHeight();
        // place inside top-right and clamp to canvas bounds
        let commitButtonX = freeTransformState.x + freeTransformState.width - buttonSize - buttonMargin;
        let commitButtonY = freeTransformState.y + buttonMargin;
        let cancelButtonX = commitButtonX - buttonSize - buttonMargin;
        let cancelButtonY = commitButtonY;
  let duplicateButtonX = cancelButtonX - buttonSize - buttonMargin;
  let duplicateButtonY = commitButtonY;
  let mirrorXButtonX = duplicateButtonX - buttonSize - buttonMargin;
  let mirrorXButtonY = commitButtonY;
  let mirrorYButtonX = mirrorXButtonX - buttonSize - buttonMargin;
  let mirrorYButtonY = commitButtonY;
        const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
        commitButtonX = clamp(commitButtonX, 0, canvasW - buttonSize);
        commitButtonY = clamp(commitButtonY, 0, canvasH - buttonSize);
        cancelButtonX = clamp(cancelButtonX, 0, canvasW - buttonSize);
        cancelButtonY = clamp(cancelButtonY, 0, canvasH - buttonSize);
        duplicateButtonX = clamp(duplicateButtonX, 0, canvasW - buttonSize);
        duplicateButtonY = clamp(duplicateButtonY, 0, canvasH - buttonSize);
        mirrorXButtonX = clamp(mirrorXButtonX, 0, canvasW - buttonSize);
        mirrorXButtonY = clamp(mirrorXButtonY, 0, canvasH - buttonSize);
        mirrorYButtonX = clamp(mirrorYButtonX, 0, canvasW - buttonSize);
        mirrorYButtonY = clamp(mirrorYButtonY, 0, canvasH - buttonSize);

        if (logicalX >= mirrorXButtonX && logicalX <= mirrorXButtonX + buttonSize &&
            logicalY >= mirrorXButtonY && logicalY <= mirrorXButtonY + buttonSize) {
          this.freeTransformMirrorX = !this.freeTransformMirrorX;
          this.renderLiveFreeTransformPreview();
          return;
        }

        if (logicalX >= mirrorYButtonX && logicalX <= mirrorYButtonX + buttonSize &&
            logicalY >= mirrorYButtonY && logicalY <= mirrorYButtonY + buttonSize) {
          this.freeTransformMirrorY = !this.freeTransformMirrorY;
          this.renderLiveFreeTransformPreview();
          return;
        }

        if (logicalX >= duplicateButtonX && logicalX <= duplicateButtonX + buttonSize &&
            logicalY >= duplicateButtonY && logicalY <= duplicateButtonY + buttonSize) {
          this.freeTransformDuplicate = !this.freeTransformDuplicate;
          return;
        }

        if (logicalX >= commitButtonX && logicalX <= commitButtonX + buttonSize &&
            logicalY >= commitButtonY && logicalY <= commitButtonY + buttonSize) {
          this.commitFreeTransform();
          return;
        }
        
        if (logicalX >= cancelButtonX && logicalX <= cancelButtonX + buttonSize &&
            logicalY >= cancelButtonY && logicalY <= cancelButtonY + buttonSize) {
          this.cancelFreeTransform();
          return;
        }
        
        const handles: TransformHandle[] = [
          'top-left', 'top-center', 'top-right',
          'middle-left', 'middle-right',
          'bottom-left', 'bottom-center', 'bottom-right',
          'rotate-center'
        ];
        
        for (const handle of handles) {
          if (this.freeTransform.isPointNearHandle(logicalX, logicalY, handle, freeTransformState, handleSize)) {
            this.capturePointer(ev);
            this.freeTransform.startHandleDrag(handle, logicalX, logicalY);
            return;
          }
        }
        
        return;
      }

      const hasExistingSelection = !!this.document.selectionRect();
      const clickedInSelection =
        hasExistingSelection && this.isPointInSelection(logicalX, logicalY);
      const isSelectTool =
        tool === 'rect-select' ||
        tool === 'ellipse-select' ||
        tool === 'lasso-select';
      if (
        clickedInSelection &&
        insideCanvas &&
        !ev.shiftKey &&
        !ev.ctrlKey &&
        this.vKeyPressed
      ) {
        const selectedLayer = this.document.selectedLayer();
        if (selectedLayer?.locked) {
          return;
        }
        this.document.beginMoveSelection('Move pixels');
        this.capturePointer(ev);
        this.selectionContentMoving = true;
        this.selectionContentMoveStart = { x: logicalX, y: logicalY };
        this.startSelectionContentMove();
        return;
      }
      if (
        clickedInSelection &&
        insideCanvas &&
        !ev.shiftKey &&
        !ev.ctrlKey &&
        isSelectTool
      ) {
        this.capturePointer(ev);
        this.document.beginMoveSelection('Move selection');
        this.selectionMoving = true;
        this.selectionMoveStart = { x: logicalX, y: logicalY };
        return;
      }
      if (isSelectTool && insideCanvas) {
        this.capturePointer(ev);
        if (tool === 'lasso-select') {
          this.selectionStart = { x: logicalX, y: logicalY };
          this.selectionDragging = true;
          this.document.beginSelection(logicalX, logicalY, 'lasso' as any);
          this.document.addLassoPoint(logicalX, logicalY);
          return;
        }

        this.selectionStart = { x: logicalX, y: logicalY };
        this.selectionDragging = true;
        const shape = tool === 'ellipse-select' ? 'ellipse' : 'rect';
        this.document.beginSelection(logicalX, logicalY, shape as any);
        return;
      }
      if (
        (tool === 'line' || tool === 'circle' || tool === 'square') &&
        insideCanvas
      ) {
        const selectedLayer = this.document.selectedLayer();
        if (selectedLayer?.locked) {
          return;
        }
        this.capturePointer(ev);
        if (tool === 'square' || tool === 'circle') {
          this.shapeConstrainUniform.set(ev.shiftKey);
        } else {
          this.shapeConstrainUniform.set(false);
        }
        this.startShape(tool, logicalX, logicalY);
        return;
      }
      if (tool === 'fill' && insideCanvas) {
        const selectedLayer = this.document.selectedLayer();
        if (selectedLayer?.locked) {
          return;
        }
        const selectionActive = this.document.selectionRect();
        if (selectionActive && !this.isPointInSelection(logicalX, logicalY)) {
          return;
        }
        this.document.saveSnapshot('Fill');
        const layerId = this.document.selectedLayerId();
        const fillMode = this.tools.fillMode();
        const fillColor = fillMode === 'erase' ? null : this.tools.fillColor();
        this.document.applyFillToLayer(layerId, logicalX, logicalY, fillColor);
      } else if (tool === 'bone' && insideCanvas) {
        this.capturePointer(ev);
        const frameId = this.getCurrentFrameId();
        const clickedPoint = this.findBonePointAt(frameId, logicalX, logicalY);

        if (clickedPoint) {
          this.document.saveSnapshot('Move bone point');
          this.draggingPointId = clickedPoint.pointId;
          this.draggingPointBoneId = clickedPoint.boneId;
          this.currentBoneId = clickedPoint.boneId;
          this.boneService.selectPoint(clickedPoint.pointId);
        } else {
          this.document.saveSnapshot('Add bone point');
          if (!this.currentBoneId) {
            const newBone: Bone = {
              id: `bone-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              points: [],
              color: this.tools.boneColor(),
              thickness: this.tools.boneThickness(),
            };
            this.currentBoneId = newBone.id;
            this.boneService.addBone(frameId, newBone);
          }

          const newPoint: BonePoint = {
            id: `point-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            x: logicalX,
            y: logicalY,
            parentId: undefined,
          };

          const bones = this.boneService.getBones(frameId);
          const currentBone = bones.find((b) => b.id === this.currentBoneId);
          if (currentBone && currentBone.points.length > 0) {
            const selectedPoint = this.boneService.getSelectedPoint();
            if (selectedPoint) {
              newPoint.parentId = selectedPoint;
            } else {
              newPoint.parentId =
                currentBone.points[currentBone.points.length - 1].id;
            }
          }

          this.boneService.addPointToBone(
            frameId,
            this.currentBoneId,
            newPoint,
          );
          this.boneService.selectPoint(newPoint.id);

          const currentAnim = this.document.getCurrentAnimation();
          if (currentAnim) {
            const currentTime =
              this.document.keyframeService?.getCurrentTime() || 0;
            this.boneService.updatePoint(
              frameId,
              this.currentBoneId,
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
                this.currentBoneId,
                newPoint.id,
                logicalX,
                logicalY,
                radius,
              );
            }
          }
        }
      } else if ((tool === 'brush' || tool === 'eraser') && insideCanvas) {
        const selectedLayer = this.document.selectedLayer();
        if (selectedLayer?.locked) {
          return;
        }
        this.capturePointer(ev);
        this.document.saveSnapshot('Paint');
        this.painting = true;
        this.lastPaintPos = { x: logicalX, y: logicalY };
        const layerId = this.document.selectedLayerId();
        const color = tool === 'eraser' ? null : this.tools.brushColor();
        const size =
          tool === 'eraser' ? this.tools.eraserSize() : this.tools.brushSize();
        this.document.applyBrushToLayer(
          layerId,
          logicalX,
          logicalY,
          size,
          color,
          tool === 'eraser'
            ? { eraserStrength: this.tools.eraserStrength() }
            : undefined,
        );
      }
    }
  }

  onCanvasContextMenu(ev: MouseEvent) {
    ev.preventDefault();
    const canvasRect = this.canvasEl.nativeElement.getBoundingClientRect();
    const visX = ev.clientX - canvasRect.left;
    const visY = ev.clientY - canvasRect.top;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const ratioX = w / Math.max(1, canvasRect.width);
    const ratioY = h / Math.max(1, canvasRect.height);
    const logicalX = Math.floor(visX * ratioX);
    const logicalY = Math.floor(visY * ratioY);
    const insideCanvas =
      logicalX >= 0 && logicalX < w && logicalY >= 0 && logicalY < h;
    if (!insideCanvas) {
      this.closeContextMenu();
      return;
    }
    const actions: ContextMenuAction[] = [];
    const hasSelection = !!this.document.selectionRect();
    const hasNonEmptySelection = this.hasNonEmptySelection();
    if (hasSelection) {
      actions.push({
        id: 'generate',
        labelKey: 'editor.canvas.menu.generate',
        icon: 'heroIconsSparklesMini',
        disabled: !hasNonEmptySelection,
        submenu: [
          {
            id: 'generateFromLayer',
            labelKey: 'pixelGeneration.generateFromLayer',
            icon: 'heroIconsSquare2StackMini',
          },
          {
            id: 'generateFromVisible',
            labelKey: 'pixelGeneration.generateFromVisible',
            icon: 'heroIconsEyeMini',
          },
        ],
      });
      actions.push({
        id: 'invertSelection',
        labelKey: 'editor.canvas.menu.invertSelection',
        icon: 'heroIconsBarsArrowUpMini',
        disabled: false,
      });
      actions.push({
        id: 'growSelection',
        labelKey: 'editor.canvas.menu.growSelection',
        icon: 'heroIconsArrowsPointingOutMini',
        disabled: false,
        submenu: [
          {
            id: 'growBy1px',
            labelKey: 'editor.canvas.menu.growBy1px',
            icon: 'heroIconsPlusSmallMini',
          },
          {
            id: 'growBy2px',
            labelKey: 'editor.canvas.menu.growBy2px',
            icon: 'heroIconsPlusSmallMini',
          },
          {
            id: 'growBy5px',
            labelKey: 'editor.canvas.menu.growBy5px',
            icon: 'heroIconsPlusSmallMini',
          },
          {
            id: 'growCustom',
            labelKey: 'editor.canvas.menu.growCustom',
            icon: 'heroIconsEllipsisHorizontalMini',
          },
        ],
      });
      actions.push({
        id: 'makeCopyLayer',
        labelKey: 'editor.canvas.menu.makeCopyLayer',
        icon: 'heroIconsDocumentDuplicateMini',
        disabled: !hasNonEmptySelection,
      });
      actions.push({
        id: 'mergeVisibleToNewLayer',
        labelKey: 'editor.canvas.menu.mergeVisibleToNewLayer',
        icon: 'heroIconsRectangleStackMini',
        disabled: false,
      });
      actions.push({
        id: 'deselect',
        labelKey: 'editor.canvas.menu.deselect',
        icon: 'bootstrapBoundingBox',
      });
    }
    if (!actions.length) {
      this.closeContextMenu();
      return;
    }
    const containerRect =
      this.canvasContainer.nativeElement.getBoundingClientRect();
    const offsetX = ev.clientX - containerRect.left;
    const offsetY = ev.clientY - containerRect.top;
    const estimatedWidth = 200;
    const estimatedHeight = Math.max(40, actions.length * 36);
    const maxX = Math.max(0, containerRect.width - estimatedWidth);
    const maxY = Math.max(0, containerRect.height - estimatedHeight);
    const clampedX = Math.max(0, Math.min(offsetX, maxX));
    const clampedY = Math.max(0, Math.min(offsetY, maxY));
    this.contextMenuPosition.set({ x: clampedX, y: clampedY });
    this.contextMenuActions.set(actions);
    this.contextMenuVisible.set(true);
  }

  private hasNonEmptySelection(): boolean {
    const sel = this.document.selectionRect();
    if (!sel) return false;
    const shape = this.document.selectionShape();
    const poly = this.document.selectionPolygon();
    const layerId = this.document.selectedLayerId();
    const buf = this.document.getLayerBuffer(layerId);
    if (!buf) return false;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    for (let y = sel.y; y < sel.y + sel.height && y < h; y++) {
      for (let x = sel.x; x < sel.x + sel.width && x < w; x++) {
        if (
          this.isPointInSelection(x, y) &&
          buf[y * w + x] &&
          buf[y * w + x].length > 0
        ) {
          return true;
        }
      }
    }
    return false;
  }

  closeContextMenu() {
    this.contextMenuVisible.set(false);
    this.contextMenuActions.set([]);
    this.submenuVisible.set(false);
    this.submenuActions.set([]);
  }

  onSubmenuTrigger(
    action: ContextMenuAction,
    event: MouseEvent,
    buttonElement: HTMLElement,
  ) {
    if (!action.submenu || action.submenu.length === 0) return;
    event.stopPropagation();
    const rect = buttonElement.getBoundingClientRect();
    const containerRect =
      this.canvasContainer.nativeElement.getBoundingClientRect();
    const submenuX = rect.right - containerRect.left + 4;
    const submenuY = rect.top - containerRect.top;
    this.submenuPosition.set({ x: submenuX, y: submenuY });
    this.submenuActions.set(action.submenu);
    this.submenuVisible.set(true);
  }

  onContextMenuAction(actionId: ContextMenuActionId, event?: MouseEvent) {
    if (actionId === 'generateFromLayer') {
      this.handleGenerateFromSelection('layer');
    } else if (actionId === 'generateFromVisible') {
      this.handleGenerateFromSelection('visible');
    } else if (actionId === 'deselect') {
      this.document.clearSelection();
    } else if (actionId === 'invertSelection') {
      this.document.invertSelection();
    } else if (actionId === 'growBy1px') {
      this.document.growSelection(1);
    } else if (actionId === 'growBy2px') {
      this.document.growSelection(2);
    } else if (actionId === 'growBy5px') {
      this.document.growSelection(5);
    } else if (actionId === 'growCustom') {
      if (event) {
        const containerRect =
          this.canvasContainer.nativeElement.getBoundingClientRect();
        const offsetX = event.clientX - containerRect.left;
        const offsetY = event.clientY - containerRect.top;
        this.inputDialogPosition.set({ x: offsetX + 10, y: offsetY });
        this.inputDialogTitle.set('Enter growth amount (pixels):');
        this.inputDialogValue.set('10');
        this.inputDialogCallback.set((value: string) => {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && parsed > 0) {
            this.document.growSelection(parsed);
          }
          this.closeInputDialog();
        });
        this.inputDialogVisible.set(true);
        return;
      }
    } else if (actionId === 'makeCopyLayer') {
      this.document.makeCopyLayer();
    } else if (actionId === 'mergeVisibleToNewLayer') {
      this.document.mergeVisibleToNewLayer();
    }
    this.closeContextMenu();
  }

  closeInputDialog() {
    this.inputDialogVisible.set(false);
    this.inputDialogCallback.set(null);
  }

  getShortcutForAction(actionId: ContextMenuActionId): string | null {
    const hotkeyMap: Record<ContextMenuActionId, string | null> = {
      deselect: 'edit.deselect',
      invertSelection: 'edit.invertSelection',
      growSelection: null,
      growBy1px: 'edit.growBy1px',
      growBy2px: 'edit.growBy2px',
      growBy5px: 'edit.growBy5px',
      growCustom: null,
      makeCopyLayer: 'edit.makeCopyLayer',
      mergeVisibleToNewLayer: 'edit.mergeVisibleToNewLayer',
      generate: null,
      generateFromLayer: null,
      generateFromVisible: null,
    };
    const hotkeyId = hotkeyMap[actionId];
    if (!hotkeyId) return null;
    const binding = this.hotkeys.getBinding(hotkeyId);
    return binding ? this.hotkeys.keyStringToDisplay(binding) : null;
  }

  onInputDialogSubmit() {
    const callback = this.inputDialogCallback();
    if (callback) {
      callback(this.inputDialogValue());
    }
  }

  onInputDialogCancel() {
    this.closeInputDialog();
  }

  onPointerUp(ev: PointerEvent) {
    this.releasePointer(ev);
    this.panning = false;

    if (this.freeTransform.isDraggingHandle()) {
      this.freeTransform.endHandleDrag();
      return;
    }

    if (this.shaping) {
      this.finishShape(ev.shiftKey);
    }
    if (this.painting) {
      this.painting = false;
      this.lastPaintPos = null;
    }

    if (this.draggingPointId) {
      this.draggingPointId = null;
      this.draggingPointBoneId = null;
      return;
    }

    if (this.selectionMoving) {
      this.selectionMoving = false;
      this.selectionMoveStart = null;
      this.document.endMoveSelection('Move selection');
      return;
    }

    if (this.selectionContentMoving) {
      this.selectionContentMoving = false;
      this.selectionContentMoveStart = null;
      this.endSelectionContentMove();
      this.document.endMoveSelection('Move pixels');
      return;
    }

    if (this.selectionDragging) {
      this.selectionDragging = false;
      this.selectionStart = null;
      this.document.endSelection();
    }
  }

  infoVisible = signal(true);

  startSelectionContentMove() {
    const sel = this.document.selectionRect();
    if (!sel) return;
    const layerId = this.document.selectedLayerId();
    const sourceBuf = this.document.getLayerBuffer(layerId);
    if (!sourceBuf) return;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    this.originalLayerId = layerId;
    this.movingContentOriginalRect = {
      x: sel.x,
      y: sel.y,
      width: sel.width,
      height: sel.height,
    };
    this.movingContentBuffer = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (this.isPointInSelection(x, y)) {
          this.movingContentBuffer[idx] = sourceBuf[idx] || '';
          sourceBuf[idx] = '';
        } else {
          this.movingContentBuffer[idx] = '';
        }
      }
    }
    this.document.layerPixelsVersion.update((v) => v + 1);
  }

  moveSelectionContent(dx: number, dy: number) {
    this.document.moveSelection(dx, dy);
  }

  endSelectionContentMove() {
    if (
      !this.movingContentBuffer ||
      !this.originalLayerId ||
      !this.movingContentOriginalRect
    )
      return;
    const originalBuf = this.document.getLayerBuffer(this.originalLayerId);
    if (!originalBuf) return;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const sel = this.document.selectionRect();
    if (!sel) return;
    const dx = sel.x - this.movingContentOriginalRect.x;
    const dy = sel.y - this.movingContentOriginalRect.y;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (this.movingContentBuffer[idx]) {
          const newX = x + dx;
          const newY = y + dy;
          if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
            const newIdx = newY * w + newX;
            originalBuf[newIdx] = this.movingContentBuffer[idx];
          }
        }
      }
    }
    this.document.layerPixelsVersion.update((v) => v + 1);
    this.movingContentBuffer = null;
    this.movingContentOriginalRect = null;
    this.originalLayerId = null;
  }

  setCanvasWidth(event: Event) {
    const target = event.target as HTMLInputElement;
    const width = parseInt(target.value, 10);
    if (width > 0) {
      this.document.setCanvasSize(width, this.document.canvasHeight());
      const flatLayers = this.document.getFlattenedLayers();
      for (const l of flatLayers) {
        this.document.ensureLayerBuffer(
          l.id,
          width,
          this.document.canvasHeight(),
        );
      }
    }
  }

  setCanvasHeight(event: Event) {
    const target = event.target as HTMLInputElement;
    const height = parseInt(target.value, 10);
    if (height > 0) {
      this.document.setCanvasSize(this.document.canvasWidth(), height);
      const flatLayers = this.document.getFlattenedLayers();
      for (const l of flatLayers) {
        this.document.ensureLayerBuffer(
          l.id,
          this.document.canvasWidth(),
          height,
        );
      }
    }
  }

  // Note: per-layer pixel buffers are stored in EditorStateService; ensureLayerBuffer
  // calls that service method when needed.

  // applyBrush removed: logic delegated to EditorDocumentService.applyBrushToLayer

  // Draw a straight line between two logical pixel coordinates and apply the
  // brush/eraser at each step so fast pointer movement produces continuous
  // strokes. Uses Bresenham's line algorithm for integer rasterization.
  private drawLinePaint(
    layerId: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    brushSize: number,
    color: string | null,
  ) {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    const eraserOptions =
      color === null
        ? { eraserStrength: this.tools.eraserStrength() }
        : undefined;
    while (true) {
      this.document.applyBrushToLayer(
        layerId,
        x,
        y,
        brushSize,
        color,
        eraserOptions,
      );
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  onScaleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    let v = parseFloat(target.value);
    if (Number.isNaN(v)) return;
    this.applyZoom(v);
  }

  resetRotation() {
    this.rotation.set(0);
  }

  increaseZoom(step = 0.1) {
    const factor = 1 + Math.max(0, step);
    this.applyZoom(this.scale() * factor);
  }

  decreaseZoom(step = 0.1) {
    const factor = 1 + Math.max(0, step);
    this.applyZoom(this.scale() / factor);
  }

  private activateFreeTransform(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      return;
    }
    this.freeTransformDuplicate = false;
    this.freeTransformPreviewIndices = null;
    // Pre-change snapshot so a single undo reverts the whole transform session.
    this.document.saveSnapshot('Free Transform');
    const layer = this.document.selectedLayer();
    if (!layer || !isLayer(layer)) return;
    const layerBuf = this.document.getLayerBuffer(layer.id);
    if (!layerBuf) return;
    const canvasW = this.document.canvasWidth();
    const canvasH = this.document.canvasHeight();
    const original: string[] = new Array<string>(sel.width * sel.height).fill('');
    for (let y = 0; y < sel.height; y++) {
      for (let x = 0; x < sel.width; x++) {
        const srcX = sel.x + x;
        const srcY = sel.y + y;
        if (srcX >= 0 && srcX < canvasW && srcY >= 0 && srcY < canvasH) {
          const srcIdx = srcY * canvasW + srcX;
          const dstIdx = y * sel.width + x;
          original[dstIdx] = layerBuf[srcIdx] || '';
          layerBuf[srcIdx] = '';
        }
      }
    }
    this.document.layerPixelsVersion.update(v => v + 1);
    this.freeTransformOriginalBuffer = original;
    this.freeTransformOriginalRect = { x: sel.x, y: sel.y, width: sel.width, height: sel.height };
    this.freeTransformLayerId = layer.id;
    this.freeTransform.startTransform(sel.x, sel.y, sel.width, sel.height);
    // Render initial preview into layer so user sees live pixels immediately
    this.renderLiveFreeTransformPreview();
  }

  private commitFreeTransform(): void {
    const state = this.freeTransform.commitTransform();
    if (!state) return;
    const sel = this.document.selectionRect();
    if (!sel) return;

    const scaleX = state.width / sel.width;
    const scaleY = state.height / sel.height;
    const doScale = Math.abs(scaleX - 1) > 0.0001 || Math.abs(scaleY - 1) > 0.0001;
    const doRotate = Math.abs(state.rotation) > 0.0001;

    // Clear live preview pixels first to avoid duplicates
    if (this.freeTransformPreviewIndices && this.freeTransformPreviewIndices.length && this.freeTransformLayerId) {
      const layerBuffer = this.document.getLayerBuffer(this.freeTransformLayerId);
      if (layerBuffer) {
        for (const idx of this.freeTransformPreviewIndices) {
          if (idx >= 0 && idx < layerBuffer.length) layerBuffer[idx] = '';
        }
      }
    }
    if (this.freeTransformDuplicate && this.freeTransformOriginalBuffer && this.freeTransformOriginalRect && this.freeTransformLayerId) {
      this.restoreOriginalTransformPixels();
      this.applyTransformToSelection(state, scaleX, scaleY, this.freeTransformOriginalBuffer, this.freeTransformOriginalRect);
    } else {
      if (doScale || doRotate) {
        if (this.freeTransformOriginalBuffer && this.freeTransformOriginalRect && this.freeTransformLayerId) {
          this.applyTransformToSelection(state, scaleX, scaleY, this.freeTransformOriginalBuffer, this.freeTransformOriginalRect);
        }
      } else {
        this.restoreOriginalTransformPixels();
      }
    }

    this.document.updateSelectionBounds(
      Math.floor(state.x),
      Math.floor(state.y),
      Math.floor(state.width),
      Math.floor(state.height),
    );
    // Mark canvas dirty after transform
    this.document.setCanvasSaved(false);
    this.freeTransformOriginalBuffer = null;
    this.freeTransformOriginalRect = null;
    this.freeTransformLayerId = null;
    this.freeTransformDuplicate = false;
    this.freeTransformPreviewIndices = null;
  }

  private cancelFreeTransform(): void {
    // Clear preview pixels before restoring original
    if (this.freeTransformPreviewIndices && this.freeTransformLayerId) {
      const buf = this.document.getLayerBuffer(this.freeTransformLayerId);
      if (buf) {
        for (const idx of this.freeTransformPreviewIndices) {
          if (idx >= 0 && idx < buf.length) buf[idx] = '';
        }
        this.document.layerPixelsVersion.update(v => v + 1);
      }
    }
    this.restoreOriginalTransformPixels();
    this.freeTransform.cancelTransform();
    this.freeTransformOriginalBuffer = null;
    this.freeTransformOriginalRect = null;
    this.freeTransformLayerId = null;
    this.freeTransformDuplicate = false;
    this.freeTransformPreviewIndices = null;
  }

  private applyTransformToSelection(
    state: any,
    scaleX: number,
    scaleY: number,
    originalBuffer: string[],
    originalRect: { x: number; y: number; width: number; height: number },
  ): void {
    const layerId = this.freeTransformLayerId;
    if (!layerId) return;
    const layerBuffer = this.document.getLayerBuffer(layerId);
    if (!layerBuffer) return;
    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();

    const cos = Math.cos((state.rotation * Math.PI) / 180);
    const sin = Math.sin((state.rotation * Math.PI) / 180);
    const centerX = originalRect.width / 2;
    const centerY = originalRect.height / 2;

    const targetW = Math.max(1, Math.round(state.width));
    const targetH = Math.max(1, Math.round(state.height));
    const targetX = Math.floor(state.x);
    const targetY = Math.floor(state.y);

    const transformedBuffer = new Array<string>(targetW * targetH).fill('');
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const srcX = x / scaleX;
        const srcY = y / scaleY;
        const dx = srcX - centerX;
        const dy = srcY - centerY;
        const rotX = centerX + dx * cos + dy * sin;
        const rotY = centerY - dx * sin + dy * cos;
        let sx = Math.floor(rotX);
        let sy = Math.floor(rotY);
        if (this.freeTransformMirrorX) sx = originalRect.width - 1 - sx;
        if (this.freeTransformMirrorY) sy = originalRect.height - 1 - sy;
        if (sx >= 0 && sx < originalRect.width && sy >= 0 && sy < originalRect.height) {
          const srcIdx = sy * originalRect.width + sx;
          const destIdx = y * targetW + x;
          transformedBuffer[destIdx] = originalBuffer[srcIdx] || '';
        }
      }
    }
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const destX = targetX + x;
        const destY = targetY + y;
        if (destX >= 0 && destX < canvasWidth && destY >= 0 && destY < canvasHeight) {
          const srcIdx = y * targetW + x;
          const destIdx = destY * canvasWidth + destX;
          const col = transformedBuffer[srcIdx];
          if (col) layerBuffer[destIdx] = col;
        }
      }
    }
    this.document.layerPixelsVersion.update(v => v + 1);
  }

  private restoreOriginalTransformPixels(): void {
    if (!this.freeTransformOriginalBuffer || !this.freeTransformOriginalRect || !this.freeTransformLayerId) return;
    const layerBuffer = this.document.getLayerBuffer(this.freeTransformLayerId);
    if (!layerBuffer) return;
    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();
    const rect = this.freeTransformOriginalRect;
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const srcIdx = y * rect.width + x;
        const destX = rect.x + x;
        const destY = rect.y + y;
        if (destX >= 0 && destX < canvasWidth && destY >= 0 && destY < canvasHeight) {
          const destIdx = destY * canvasWidth + destX;
          const col = this.freeTransformOriginalBuffer[srcIdx];
          if (col) layerBuffer[destIdx] = col;
        }
      }
    }
    this.document.layerPixelsVersion.update(v => v + 1);
  }

  // Live preview: apply transformed pixels directly to layer buffer while dragging,
  // restoring previous preview first to avoid accumulation.
  private renderLiveFreeTransformPreview(): void {
    const state = this.freeTransform.transformState();
    if (!state || !this.freeTransformOriginalBuffer || !this.freeTransformOriginalRect || !this.freeTransformLayerId) return;
    const layerBuffer = this.document.getLayerBuffer(this.freeTransformLayerId);
    if (!layerBuffer) return;
    const canvasW = this.document.canvasWidth();
    const canvasH = this.document.canvasHeight();

    // Clear previous preview pixels if tracked.
    if (this.freeTransformPreviewIndices && this.freeTransformPreviewIndices.length) {
      for (const idx of this.freeTransformPreviewIndices) {
        if (idx >= 0 && idx < layerBuffer.length) {
          layerBuffer[idx] = ''; // revert to empty; original pixels are stored separately already
        }
      }
    }
    this.freeTransformPreviewIndices = [];

    const srcW = this.freeTransformOriginalRect.width;
    const srcH = this.freeTransformOriginalRect.height;
    const scaleX = state.width / srcW;
    const scaleY = state.height / srcH;
    const rad = (state.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cX = srcW / 2;
    const cY = srcH / 2;
    const tgtW = Math.max(1, Math.round(state.width));
    const tgtH = Math.max(1, Math.round(state.height));
    const baseX = Math.floor(state.x);
    const baseY = Math.floor(state.y);

    for (let y = 0; y < tgtH; y++) {
      for (let x = 0; x < tgtW; x++) {
        const srcX = x / scaleX;
        const srcY = y / scaleY;
        const dx = srcX - cX;
        const dy = srcY - cY;
        const rotX = cX + dx * cos + dy * sin;
        const rotY = cY - dx * sin + dy * cos;
        let sx = Math.floor(rotX);
        let sy = Math.floor(rotY);
        if (this.freeTransformMirrorX) sx = srcW - 1 - sx;
        if (this.freeTransformMirrorY) sy = srcH - 1 - sy;
        if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
          const srcIdx = sy * srcW + sx;
          const col = this.freeTransformOriginalBuffer[srcIdx];
          if (col && col.length) {
            const destX = baseX + x;
            const destY = baseY + y;
            if (destX >= 0 && destX < canvasW && destY >= 0 && destY < canvasH) {
              const destIdx = destY * canvasW + destX;
              layerBuffer[destIdx] = col;
              this.freeTransformPreviewIndices.push(destIdx);
            }
          }
        }
      }
    }
    this.document.layerPixelsVersion.update(v => v + 1);
  }

  private isPixelInSelection(x: number, y: number): boolean {
    const sel = this.document.selectionRect();
    const shape = this.document.selectionShape();
    const poly = this.document.selectionPolygon();
    return this.document.isPixelWithinSelection(x, y, sel, shape, poly);
  }

  ngOnDestroy(): void {
    this.viewReady.set(false);
    this.closeContextMenu();
    if (this.stopRenderEffect) {
      try {
        if ((this.stopRenderEffect as any).destroy) {
          (this.stopRenderEffect as any).destroy();
        } else if (typeof (this.stopRenderEffect as any) === 'function') {
          (this.stopRenderEffect as any)();
        }
      } catch {}
      this.stopRenderEffect = null;
    }

    if (this.resizeListener && typeof window !== 'undefined') {
      try {
        window.removeEventListener(
          'resize',
          this.resizeListener as EventListener,
        );
      } catch {}
      this.resizeListener = null;
    }
    if (this.keyListener && typeof window !== 'undefined') {
      try {
        window.removeEventListener(
          'keydown',
          this.keyListener as EventListener,
        );
      } catch {}
      this.keyListener = null;
    }
    if (this.generationCheckInterval !== null) {
      clearInterval(this.generationCheckInterval);
      this.generationCheckInterval = null;
    }
  }

  private centerAndFitCanvas() {
    try {
      const canvas = this.canvasEl?.nativeElement;
      if (!canvas) return;
      const w = Math.max(1, this.document.canvasWidth());
      const h = Math.max(1, this.document.canvasHeight());

      const { contentWidth, contentHeight, paddingLeft, paddingTop } =
        this.measureContainer();
      if (contentWidth <= 0 || contentHeight <= 0) return;

      const fitScale = Math.max(
        this.minScale,
        Math.min(contentWidth / w, contentHeight / h),
      );
      const initialScale = Math.min(this.maxScale, fitScale);
      this.scale.set(initialScale);

      const displayWidth = w * initialScale;
      const displayHeight = h * initialScale;
      const offsetX = paddingLeft + (contentWidth - displayWidth) / 2;
      const offsetY = paddingTop + (contentHeight - displayHeight) / 2;
      this.panX.set(offsetX);
      this.panY.set(offsetY);
      this.updateTileSize(this.tools.brushSize());
    } catch (e) {
      // best-effort: ignore errors
    }
  }

  private applyZoom(
    nextScale: number,
    anchor?: { clientX: number; clientY: number },
  ) {
    const clamped = Math.min(this.maxScale, Math.max(this.minScale, nextScale));
    const prev = this.scale();
    if (!this.canvasEl?.nativeElement) {
      this.scale.set(clamped);
      this.updateTileSize(this.tools.brushSize());
      return;
    }
    if (Math.abs(clamped - prev) < 0.0001) {
      return;
    }

    const container = this.canvasContainer?.nativeElement;
    const containerRect = container ? container.getBoundingClientRect() : null;
    const prevPanX = this.panX();
    const prevPanY = this.panY();

    const pivotX =
      anchor?.clientX ??
      (containerRect ? containerRect.left + containerRect.width / 2 : 0);
    const pivotY =
      anchor?.clientY ??
      (containerRect ? containerRect.top + containerRect.height / 2 : 0);
    const containerOffsetX = containerRect ? pivotX - containerRect.left : 0;
    const containerOffsetY = containerRect ? pivotY - containerRect.top : 0;
    const worldX = containerRect ? (containerOffsetX - prevPanX) / prev : 0;
    const worldY = containerRect ? (containerOffsetY - prevPanY) / prev : 0;

    this.scale.set(clamped);

    if (containerRect) {
      const newOffsetX = worldX * clamped;
      const newOffsetY = worldY * clamped;
      this.panX.set(containerOffsetX - newOffsetX);
      this.panY.set(containerOffsetY - newOffsetY);
    }

    this.updateTileSize(this.tools.brushSize());
  }

  private drawCanvas() {
    const canvas = this.canvasEl?.nativeElement;
    if (!canvas) return;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const scale = this.scale();
    const dpr =
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const displayWidth = Math.max(1, w * scale);
    const displayHeight = Math.max(1, h * scale);
    const pixelWidth = Math.max(1, Math.floor(displayWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(displayHeight * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const root =
      typeof document !== 'undefined' ? document.documentElement : null;
    const isDark = !!root && root.classList.contains('dark');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const pxLineWidth = 1 / (scale * dpr);

    const tile = this.tileSize();
    const darkTile = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.04)';
    const lightTile = isDark
      ? 'rgba(255,255,255,0.03)'
      : 'rgba(255,255,255,0.02)';
    ctx.save();
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        const even = ((x / tile + y / tile) & 1) === 0;
        ctx.fillStyle = even ? lightTile : darkTile;
        ctx.fillRect(x, y, Math.min(tile, w - x), Math.min(tile, h - y));
      }
    }
    ctx.restore();

    // depend on layer pixel version so effect reruns when any layer buffer changes
    this.document.layerPixelsVersion();

    const frameId = this.getCurrentFrameId();
    const currentAnim = this.document.getCurrentAnimation();
    const animationId = currentAnim?.id;
    const currentTime = this.document.keyframeService?.getCurrentTime();
    const isInTimelineMode = this.document.keyframeService?.isTimelineMode();
    const shouldApplyBoneTransforms = !!(
      animationId &&
      typeof currentTime === 'number' &&
      isInTimelineMode
    );

    const layers = this.document.getFlattenedLayers();
    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      if (!layer.visible) continue;
      const buf = this.document.getLayerBuffer(layer.id);
      if (!buf || buf.length !== w * h) continue;
      ctx.save();

      if (shouldApplyBoneTransforms) {
        const boundSourcePixels = new Set<number>();
        const destinationPixelMap = new Map<
          number,
          { color: string; priority: number }
        >();
        const bindings =
          this.document.keyframeService.getPixelBindings(frameId);

        const transformCache = new Map<string, any>();
        const pixelBindingsMap = new Map<number, typeof bindings>();

        for (const binding of bindings) {
          const sourceIdx = binding.pixelY * w + binding.pixelX;
          const existingBindings = pixelBindingsMap.get(sourceIdx) || [];
          existingBindings.push(binding);
          pixelBindingsMap.set(sourceIdx, existingBindings);
        }

        for (const [sourceIdx, pixelBindings] of pixelBindingsMap.entries()) {
          const col = buf[sourceIdx];
          if (!col || !col.length) continue;

          const dominantBinding = pixelBindings.reduce((prev, current) =>
            current.weight > prev.weight ? current : prev,
          );

          const cacheKey = `${dominantBinding.boneId}:${dominantBinding.bonePointId}`;
          let transform = transformCache.get(cacheKey);

          if (!transform) {
            transform = this.document.keyframeService.interpolateBoneTransform(
              animationId,
              dominantBinding.boneId,
              dominantBinding.bonePointId,
              currentTime,
            );
            transformCache.set(cacheKey, transform);
          }

          if (transform) {
            const transformedX = Math.round(
              transform.x + dominantBinding.offsetX,
            );
            const transformedY = Math.round(
              transform.y + dominantBinding.offsetY,
            );

            if (
              transformedX >= 0 &&
              transformedX < w &&
              transformedY >= 0 &&
              transformedY < h
            ) {
              const destIdx = transformedY * w + transformedX;
              const distSq =
                dominantBinding.offsetX * dominantBinding.offsetX +
                dominantBinding.offsetY * dominantBinding.offsetY;
              const priority = -distSq;

              const existing = destinationPixelMap.get(destIdx);
              if (!existing || priority > existing.priority) {
                destinationPixelMap.set(destIdx, { color: col, priority });
              }
              boundSourcePixels.add(sourceIdx);
            }
          } else {
            const pixelY = Math.floor(sourceIdx / w);
            const pixelX = sourceIdx % w;
            const destIdx = pixelY * w + pixelX;
            destinationPixelMap.set(destIdx, { color: col, priority: 0 });
            boundSourcePixels.add(sourceIdx);
          }
        }

        const bones = this.boneService.getBones(frameId);
        for (const bone of bones) {
          for (const point of bone.points) {
            if (!point.parentId) continue;

            const parent = bone.points.find((p) => p.id === point.parentId);
            if (!parent) continue;

            const pointTransform =
              this.document.keyframeService.interpolateBoneTransform(
                animationId,
                bone.id,
                point.id,
                currentTime,
              );
            const parentTransform =
              this.document.keyframeService.interpolateBoneTransform(
                animationId,
                bone.id,
                parent.id,
                currentTime,
              );

            const p1x = pointTransform ? pointTransform.x : point.x;
            const p1y = pointTransform ? pointTransform.y : point.y;
            const p2x = parentTransform ? parentTransform.x : parent.x;
            const p2y = parentTransform ? parentTransform.y : parent.y;

            const dx = p2x - p1x;
            const dy = p2y - p1y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.ceil(dist);

            for (let i = 0; i <= steps; i++) {
              const t = steps > 0 ? i / steps : 0;
              const interpX = Math.round(p1x + dx * t);
              const interpY = Math.round(p1y + dy * t);

              if (interpX >= 0 && interpX < w && interpY >= 0 && interpY < h) {
                const interpIdx = interpY * w + interpX;
                const sourcePixelX = Math.round(
                  point.x + (parent.x - point.x) * t,
                );
                const sourcePixelY = Math.round(
                  point.y + (parent.y - point.y) * t,
                );

                if (
                  sourcePixelX >= 0 &&
                  sourcePixelX < w &&
                  sourcePixelY >= 0 &&
                  sourcePixelY < h
                ) {
                  const sourceIdx = sourcePixelY * w + sourcePixelX;
                  const sourceColor = buf[sourceIdx];

                  if (
                    sourceColor &&
                    sourceColor.length &&
                    !destinationPixelMap.has(interpIdx)
                  ) {
                    destinationPixelMap.set(interpIdx, {
                      color: sourceColor,
                      priority: -1000,
                    });
                  }
                }
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

    if (this.movingContentBuffer && this.movingContentOriginalRect) {
      const sel = this.document.selectionRect();
      if (sel) {
        const dx = sel.x - this.movingContentOriginalRect.x;
        const dy = sel.y - this.movingContentOriginalRect.y;
        ctx.save();
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const col = this.movingContentBuffer[idx];
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

    const activeShape = this.activeShapeTool();
    const shapeStart = this.shapeStart();
    const shapeCurrent = this.shapeCurrent();
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
        if (activeShape === 'square') {
          const bounds = this.computeRectBounds(
            shapeStart,
            shapeCurrent,
            this.shapeConstrainUniform(),
          );
          this.renderSquarePreview(
            ctx,
            bounds,
            this.getSquareDrawOptions(),
            pxLineWidth,
          );
        } else {
          const bounds = this.computeRectBounds(
            shapeStart,
            shapeCurrent,
            this.shapeConstrainUniform(),
          );
          this.renderEllipsePreview(
            ctx,
            bounds,
            this.getCircleDrawOptions(),
            pxLineWidth,
          );
        }
      }
      ctx.restore();
    }

    const hx = this.hoverX();
    const hy = this.hoverY();
    // Only show brush/eraser highlight when using the brush or eraser tool.
    if (hx !== null && hy !== null) {
      const tool = this.tools.currentTool();
      if (tool === 'brush' || tool === 'eraser') {
        ctx.save();
        const size =
          tool === 'eraser' ? this.tools.eraserSize() : this.tools.brushSize();
        const bSize = Math.max(1, size);

        // center the brush highlight on the hovered pixel
        const half = Math.floor((bSize - 1) / 2);
        const x0 = Math.max(0, hx - half);
        const y0 = Math.max(0, hy - half);
        const wRect = Math.min(bSize, w - x0);
        const hRect = Math.min(bSize, h - y0);

        ctx.lineWidth = pxLineWidth;
        if (tool === 'eraser') {
          // Eraser: light overlay + visible border depending on theme
          ctx.fillStyle = isDark
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(0,0,0,0.10)';
          ctx.fillRect(x0, y0, wRect, hRect);
          ctx.strokeStyle = isDark
            ? 'rgba(255,255,255,0.5)'
            : 'rgba(0,0,0,0.5)';
          ctx.strokeRect(
            x0 + 0.5,
            y0 + 0.5,
            Math.max(0, wRect - 1),
            Math.max(0, hRect - 1),
          );
        } else {
          // Brush: use current brush color with translucency and border
          ctx.fillStyle = this.tools.brushColor();
          ctx.globalAlpha = 0.9;
          ctx.fillRect(x0, y0, wRect, hRect);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = isDark
            ? 'rgba(255,255,255,0.6)'
            : 'rgba(0,0,0,0.6)';
          ctx.strokeRect(
            x0 + 0.5,
            y0 + 0.5,
            Math.max(0, wRect - 1),
            Math.max(0, hRect - 1),
          );
        }
        ctx.restore();
      }
    }

    const tool = this.tools.currentTool();
    if (tool === 'bone') {
      const bones = this.boneService.getBones(frameId);

      const getPointPosition = (
        boneId: string,
        point: BonePoint,
      ): { x: number; y: number } => {
        if (shouldApplyBoneTransforms) {
          const transform =
            this.document.keyframeService.interpolateBoneTransform(
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

          ctx.strokeStyle = isDark
            ? 'rgba(255,255,255,0.8)'
            : 'rgba(0,0,0,0.8)';
          ctx.lineWidth = Math.max(pxLineWidth, 0.2);
          ctx.stroke();
        }
      }
      ctx.restore();

      const bindings = this.document.keyframeService?.getPixelBindings(frameId);
      if (bindings && bindings.length > 0 && this.tools.boneAutoBindEnabled()) {
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

        const boneColorCache = new Map<
          string,
          { r: number; g: number; b: number }
        >();

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
            const tempDiv =
              typeof document !== 'undefined'
                ? document.createElement('div')
                : null;
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
              const hue =
                Math.abs(
                  binding.boneId
                    .split('')
                    .reduce((a, c) => a + c.charCodeAt(0), 0),
                ) % 360;
              const s = 0.7;
              const l = 0.6;
              const c = (1 - Math.abs(2 * l - 1)) * s;
              const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
              const m = l - c / 2;
              let r = 0,
                g = 0,
                b = 0;
              if (hue < 60) {
                r = c;
                g = x;
              } else if (hue < 120) {
                r = x;
                g = c;
              } else if (hue < 180) {
                g = c;
                b = x;
              } else if (hue < 240) {
                g = x;
                b = c;
              } else if (hue < 300) {
                r = x;
                b = c;
              } else {
                r = c;
                b = x;
              }
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
    }

    // Draw active selection if present
    const sel = this.document.selectionRect();
    const selShape = this.document.selectionShape();
    if (sel && sel.width > 0 && sel.height > 0) {
      ctx.save();

      // Check if we have a mask-based selection
      const mask = this.document.selectionMask();

      if (mask) {
        // Draw mask-based selection by rendering individual pixels
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
        for (const key of mask) {
          const [xStr, yStr] = key.split(',');
          const x = parseInt(xStr, 10);
          const y = parseInt(yStr, 10);
          ctx.fillRect(x, y, 1, 1);
        }

        // Draw marching ants border by detecting edges
        // An edge exists where a selected pixel borders an unselected pixel
        ctx.setLineDash([4 / scale, 3 / scale]);
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
        ctx.lineWidth = pxLineWidth;
        ctx.beginPath();

        for (const key of mask) {
          const [xStr, yStr] = key.split(',');
          const x = parseInt(xStr, 10);
          const y = parseInt(yStr, 10);

          // Check all 4 neighbors to see if we need to draw an edge
          // Top edge
          if (!mask.has(`${x},${y - 1}`)) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + 1, y);
          }
          // Right edge
          if (!mask.has(`${x + 1},${y}`)) {
            ctx.moveTo(x + 1, y);
            ctx.lineTo(x + 1, y + 1);
          }
          // Bottom edge
          if (!mask.has(`${x},${y + 1}`)) {
            ctx.moveTo(x, y + 1);
            ctx.lineTo(x + 1, y + 1);
          }
          // Left edge
          if (!mask.has(`${x - 1},${y}`)) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 1);
          }
        }

        ctx.stroke();
      } else {
        // translucent fill
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
        if (selShape === 'ellipse') {
          const cx = sel.x + sel.width / 2 - 0.5;
          const cy = sel.y + sel.height / 2 - 0.5;
          const rx = Math.max(0.5, sel.width / 2);
          const ry = Math.max(0.5, sel.height / 2);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          // dashed stroke
          ctx.setLineDash([4 / scale, 3 / scale]);
          ctx.strokeStyle = isDark
            ? 'rgba(255,255,255,0.8)'
            : 'rgba(0,0,0,0.8)';
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
            // Optionally close the path for visual completeness
            ctx.closePath();
            ctx.fill();
            ctx.setLineDash([4 / scale, 3 / scale]);
            ctx.strokeStyle = isDark
              ? 'rgba(255,255,255,0.8)'
              : 'rgba(0,0,0,0.8)';
            ctx.lineWidth = pxLineWidth;
            ctx.stroke();
          }
        } else {
          // ctx.fillRect(sel.x, sel.y, sel.width, sel.height);
          // dashed stroke
          ctx.setLineDash([4 / scale, 3 / scale]);
          ctx.strokeStyle = isDark
            ? 'rgba(255,255,255,0.8)'
            : 'rgba(0,0,0,0.8)';
          ctx.lineWidth = pxLineWidth;
          ctx.strokeRect(
            sel.x,
            sel.y,
            Math.max(0, sel.width),
            Math.max(0, sel.height),
          );
        }
      }
      ctx.restore();
    }

    const freeTransformState = this.freeTransform.transformState();
    if (freeTransformState) {
      // removed duplicate overlay drawing; handled in the dedicated overlay section below
    }

    // Free transform overlay (selection live preview)
    const ftState = this.freeTransform.transformState();
    if (ftState && this.document.selectionRect()) {
      ctx.save();
  // Draw transformed preview only if we are NOT applying live preview to the layer
  if ((!this.freeTransformPreviewIndices || this.freeTransformPreviewIndices.length === 0) && this.freeTransformOriginalBuffer && this.freeTransformOriginalRect) {
        const canvasW = this.document.canvasWidth();
        const canvasH = this.document.canvasHeight();
        const srcW = this.freeTransformOriginalRect.width;
        const srcH = this.freeTransformOriginalRect.height;
        const srcBuf = this.freeTransformOriginalBuffer;
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
      // Draw rotated bounding box
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
      ].map(c => ({ x: cx + c.dx * cos - c.dy * sin, y: cy + c.dx * sin + c.dy * cos }));
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.stroke();

      // Handles (smaller)
      const handles: TransformHandle[] = [
        'top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right','rotate-center'
      ];
      for (const h of handles) {
        const pos = this.freeTransform.getHandlePosition(h, ftState);
        const rOuter = Math.max(0.5, 0.8 / Math.max(0.001, scale));
        ctx.fillStyle = h === 'rotate-center' ? (isDark ? '#3b82f6' : '#1d4ed8') : (isDark ? '#ffffff' : '#000000');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, rOuter, 0, Math.PI * 2);
        ctx.fill();
        if (h === 'rotate-center') {
          const rr = Math.max(2, 4 / Math.max(0.001, scale));
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = Math.max(pxLineWidth, 0.8 / Math.max(0.001, scale));
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, rr, -Math.PI * 0.2, Math.PI * 1.1);
          ctx.stroke();
        }
      }
  // Draw duplicate/commit/cancel buttons (smaller)
  const btnSize = Math.max(6, Math.round(8 / Math.max(0.001, scale)));
  const margin = Math.max(2, Math.round(5 / Math.max(0.001, scale)));
  const canvasW = this.document.canvasWidth();
  const canvasH = this.document.canvasHeight();
  let commitX = ftState.x + ftState.width - btnSize - margin;
  let commitY = ftState.y + margin;
  let cancelX = commitX - btnSize - margin;
  let cancelY = commitY;
  let duplicateX = cancelX - btnSize - margin;
  let duplicateY = commitY;
  let mirrorXX = duplicateX - btnSize - margin;
  let mirrorXY = commitY;
  let mirrorYX = mirrorXX - btnSize - margin;
  let mirrorYY = commitY;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
  commitX = clamp(commitX, 0, canvasW - btnSize - 1);
  commitY = clamp(commitY, 0, canvasH - btnSize - 1);
  cancelX = clamp(cancelX, 0, canvasW - btnSize - 1);
  cancelY = clamp(cancelY, 0, canvasH - btnSize - 1);
  duplicateX = clamp(duplicateX, 0, canvasW - btnSize - 1);
  duplicateY = clamp(duplicateY, 0, canvasH - btnSize - 1);
  mirrorXX = clamp(mirrorXX, 0, canvasW - btnSize - 1);
  mirrorXY = clamp(mirrorXY, 0, canvasH - btnSize - 1);
  mirrorYX = clamp(mirrorYX, 0, canvasW - btnSize - 1);
  mirrorYY = clamp(mirrorYY, 0, canvasH - btnSize - 1);
  // mirror Y button (vertical arrows)
  ctx.fillStyle = this.freeTransformMirrorY ? (isDark ? '#15803d' : '#15803d') : (isDark ? '#16a34a' : '#16a34a');
  ctx.fillRect(mirrorYX + 0.5, mirrorYY + 0.5, btnSize - 1, btnSize - 1);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(pxLineWidth, 1 / Math.max(0.001, scale));
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

  // mirror X button (horizontal arrows)
  ctx.fillStyle = this.freeTransformMirrorX ? (isDark ? '#15803d' : '#15803d') : (isDark ? '#16a34a' : '#16a34a');
  ctx.fillRect(mirrorXX + 0.5, mirrorXY + 0.5, btnSize - 1, btnSize - 1);
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

  // duplicate button (two squares)
      ctx.fillStyle = this.freeTransformDuplicate ? (isDark ? '#16a34a' : '#16a34a') : (isDark ? '#22c55e' : '#22c55e');
      ctx.fillRect(duplicateX + 0.5, duplicateY + 0.5, btnSize - 1, btnSize - 1);
      ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
      ctx.strokeRect(duplicateX + 0.5, duplicateY + 0.5, btnSize - 1, btnSize - 1);
      const s = btnSize * 0.35;
      const ox = duplicateX + btnSize * 0.25;
      const oy = duplicateY + btnSize * 0.25;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(pxLineWidth, 1.2 / Math.max(0.001, scale));
      ctx.strokeRect(ox, oy, s, s);
      ctx.strokeRect(ox + s * 0.35, oy - s * 0.35, s, s);
      // commit button (check)
      ctx.fillStyle = isDark ? '#2563eb' : '#1d4ed8';
      ctx.fillRect(commitX + 0.5, commitY + 0.5, btnSize - 1, btnSize - 1);
      // check icon
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(pxLineWidth, 1.2 / Math.max(0.001, scale));
      ctx.beginPath();
      ctx.moveTo(commitX + btnSize * 0.25, commitY + btnSize * 0.55);
      ctx.lineTo(commitX + btnSize * 0.45, commitY + btnSize * 0.75);
      ctx.lineTo(commitX + btnSize * 0.78, commitY + btnSize * 0.30);
      ctx.stroke();
      // cancel button (X)
      ctx.fillStyle = isDark ? '#dc2626' : '#b91c1c';
      ctx.fillRect(cancelX + 0.5, cancelY + 0.5, btnSize - 1, btnSize - 1);
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cancelX + btnSize * 0.28, cancelY + btnSize * 0.28);
      ctx.lineTo(cancelX + btnSize * 0.72, cancelY + btnSize * 0.72);
      ctx.moveTo(cancelX + btnSize * 0.72, cancelY + btnSize * 0.28);
      ctx.lineTo(cancelX + btnSize * 0.28, cancelY + btnSize * 0.72);
      ctx.stroke();
      ctx.restore();
    }
  }

  private startShape(mode: 'line' | 'circle' | 'square', x: number, y: number) {
    const width = Math.max(1, this.document.canvasWidth());
    const height = Math.max(1, this.document.canvasHeight());
    const point = {
      x: this.clampCoord(x, width),
      y: this.clampCoord(y, height),
    };
    this.document.saveSnapshot(mode);
    this.shaping = true;
    this.activeShapeTool.set(mode);
    this.shapeStart.set(point);
    this.shapeCurrent.set(point);
  }

  private finishShape(constrainOverride?: boolean) {
    if (!this.shaping) return;
    const mode = this.activeShapeTool();
    const start = this.shapeStart();
    const current = this.shapeCurrent();
    if (!mode || !start || !current) {
      this.clearShapeState();
      return;
    }
    const layerId = this.document.selectedLayerId();
    if (!layerId) {
      this.clearShapeState();
      return;
    }
    if (mode === 'line') {
      const thickness = this.tools.lineThickness();
      const color = this.tools.lineColor();
      this.document.applyLineToLayer(
        layerId,
        start.x,
        start.y,
        current.x,
        current.y,
        color,
        thickness,
      );
    } else if (mode === 'circle') {
      this.document.applyCircleToLayer(
        layerId,
        start.x,
        start.y,
        current.x,
        current.y,
        this.getCircleDrawOptions(),
        typeof constrainOverride === 'boolean'
          ? constrainOverride
          : this.shapeConstrainUniform(),
      );
    } else {
      const constrainSquare =
        typeof constrainOverride === 'boolean'
          ? constrainOverride
          : this.shapeConstrainUniform();
      this.document.applySquareToLayer(
        layerId,
        start.x,
        start.y,
        current.x,
        current.y,
        this.getSquareDrawOptions(),
        constrainSquare,
      );
    }
    this.clearShapeState();
  }

  private cancelShape() {
    if (!this.shaping) return;
    this.clearShapeState();
  }

  private clearShapeState() {
    this.shaping = false;
    this.activeShapeTool.set(null);
    this.shapeStart.set(null);
    this.shapeCurrent.set(null);
    this.shapeConstrainUniform.set(false);
  }

  private isPointInSelection(x: number, y: number): boolean {
    const rect = this.document.selectionRect();
    if (!rect) return false;
    const shape = this.document.selectionShape();
    if (shape === 'lasso') {
      const polygon = this.document.selectionPolygon();
      if (!polygon || polygon.length < 3) return false;
      return this.pointInPolygon(x, y, polygon);
    }
    const maxX = rect.x + Math.max(0, rect.width - 1);
    const maxY = rect.y + Math.max(0, rect.height - 1);
    const withinRect = x >= rect.x && x <= maxX && y >= rect.y && y <= maxY;
    if (!withinRect) return false;
    if (shape === 'ellipse') {
      const rx = rect.width / 2;
      const ry = rect.height / 2;
      if (rx <= 0 || ry <= 0) return false;
      const cx = rect.x + (rect.width - 1) / 2;
      const cy = rect.y + (rect.height - 1) / 2;
      const normX = x - cx;
      const normY = y - cy;
      const ellipseTest =
        (normX * normX) / (rx * rx) + (normY * normY) / (ry * ry);
      return ellipseTest <= 1;
    }
    return withinRect;
  }

  private pointInPolygon(
    x: number,
    y: number,
    polygon: { x: number; y: number }[],
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects =
        yi > y !== yj > y &&
        x <= ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  private clampCoord(value: number, max: number) {
    return Math.max(0, Math.min(Math.floor(value), max - 1));
  }

  private computeRectBounds(
    start: { x: number; y: number },
    current: { x: number; y: number },
    constrainToSquare: boolean,
  ) {
    const width = Math.max(1, this.document.canvasWidth());
    const height = Math.max(1, this.document.canvasHeight());
    const sx = this.clampCoord(start.x, width);
    const sy = this.clampCoord(start.y, height);
    const cx = this.clampCoord(current.x, width);
    const cy = this.clampCoord(current.y, height);
    const dx = cx - sx;
    const dy = cy - sy;
    let ex = cx;
    let ey = cy;
    if (constrainToSquare) {
      const stepX = dx >= 0 ? 1 : -1;
      const stepY = dy >= 0 ? 1 : -1;
      const span = Math.max(Math.abs(dx), Math.abs(dy));
      ex = this.clampCoord(sx + stepX * span, width);
      ey = this.clampCoord(sy + stepY * span, height);
    }
    const minX = Math.max(0, Math.min(sx, ex));
    const maxX = Math.min(width - 1, Math.max(sx, ex));
    const minY = Math.max(0, Math.min(sy, ey));
    const maxY = Math.min(height - 1, Math.max(sy, ey));
    return { minX, minY, maxX, maxY };
  }

  private getCircleDrawOptions(): ShapeDrawOptions {
    return {
      strokeThickness: Math.max(
        0,
        Math.floor(this.tools.circleStrokeThickness()),
      ),
      strokeColor: this.tools.circleStrokeColor(),
      fillMode: this.tools.circleFillMode(),
      fillColor: this.tools.circleFillColor(),
      gradientStartColor: this.tools.circleGradientStartColor(),
      gradientEndColor: this.tools.circleGradientEndColor(),
      gradientType: this.tools.circleGradientType(),
      gradientAngle: this.tools.circleGradientAngle(),
    };
  }

  private getSquareDrawOptions(): ShapeDrawOptions {
    return {
      strokeThickness: Math.max(
        0,
        Math.floor(this.tools.squareStrokeThickness()),
      ),
      strokeColor: this.tools.squareStrokeColor(),
      fillMode: this.tools.squareFillMode(),
      fillColor: this.tools.squareFillColor(),
      gradientStartColor: this.tools.squareGradientStartColor(),
      gradientEndColor: this.tools.squareGradientEndColor(),
      gradientType: this.tools.squareGradientType(),
      gradientAngle: this.tools.squareGradientAngle(),
    };
  }

  private renderSquarePreview(
    ctx: CanvasRenderingContext2D,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: ShapeDrawOptions,
    pxLineWidth: number,
  ) {
    const widthRect = Math.max(1, bounds.maxX - bounds.minX + 1);
    const heightRect = Math.max(1, bounds.maxY - bounds.minY + 1);
    if (options.fillMode === 'gradient') {
      this.fillSquareGradientPreview(ctx, bounds, options);
    } else if (options.fillColor) {
      ctx.fillStyle = options.fillColor;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(bounds.minX, bounds.minY, widthRect, heightRect);
      ctx.globalAlpha = 1;
    }
    if (options.strokeThickness > 0 && options.strokeColor) {
      ctx.lineWidth = Math.max(pxLineWidth, options.strokeThickness);
      ctx.strokeStyle = options.strokeColor;
      ctx.strokeRect(bounds.minX, bounds.minY, widthRect, heightRect);
    }
  }

  private renderEllipsePreview(
    ctx: CanvasRenderingContext2D,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: ShapeDrawOptions,
    pxLineWidth: number,
  ) {
    const widthRect = Math.max(1, bounds.maxX - bounds.minX + 1);
    const heightRect = Math.max(1, bounds.maxY - bounds.minY + 1);
    const cx = bounds.minX + widthRect / 2;
    const cy = bounds.minY + heightRect / 2;
    const rx = widthRect / 2;
    const ry = heightRect / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (options.fillMode === 'gradient' && rx > 0 && ry > 0) {
      this.fillEllipseGradientPreview(ctx, bounds, options, cx, cy, rx, ry);
    } else if (options.fillColor) {
      ctx.fillStyle = options.fillColor;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (options.strokeThickness > 0 && options.strokeColor) {
      ctx.lineWidth = Math.max(pxLineWidth, options.strokeThickness);
      ctx.strokeStyle = options.strokeColor;
      ctx.stroke();
    }
  }

  private fillSquareGradientPreview(
    ctx: CanvasRenderingContext2D,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: ShapeDrawOptions,
  ) {
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = bounds.maxX;
    const maxY = bounds.maxY;
    const widthRect = Math.max(1, maxX - minX + 1);
    const heightRect = Math.max(1, maxY - minY + 1);
    const fillColor = options.fillColor;
    const startColor = options.gradientStartColor || fillColor;
    const endColor = options.gradientEndColor || startColor;
    const fallbackStart = startColor || endColor;
    const fallbackEnd = endColor || startColor;
    if (!fallbackStart && !fallbackEnd) return;
    const parsedStart = this.parseHexColor(startColor);
    const parsedEnd = this.parseHexColor(endColor);
    const gradientType: GradientType =
      options.gradientType === 'radial' ? 'radial' : 'linear';
    const gradientAngle =
      typeof options.gradientAngle === 'number' ? options.gradientAngle : 0;
    const angleRad = (gradientAngle * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    const centerX = minX + widthRect / 2;
    const centerY = minY + heightRect / 2;
    let minProj = 0;
    let maxProj = 1;
    if (gradientType === 'linear') {
      let minVal = Number.POSITIVE_INFINITY;
      let maxVal = Number.NEGATIVE_INFINITY;
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
      ];
      for (const corner of corners) {
        const proj = (corner.x + 0.5) * dirX + (corner.y + 0.5) * dirY;
        if (proj < minVal) minVal = proj;
        if (proj > maxVal) maxVal = proj;
      }
      if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
        if (minVal === maxVal) maxVal = minVal + 1;
        minProj = minVal;
        maxProj = maxVal;
      }
    }
    const radius = Math.max(widthRect, heightRect) / 2;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.35;
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        let ratio = 0;
        if (gradientType === 'radial') {
          const dx = xx + 0.5 - centerX;
          const dy = yy + 0.5 - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          ratio = radius > 0 ? dist / radius : 0;
        } else {
          const proj = (xx + 0.5) * dirX + (yy + 0.5) * dirY;
          const span = maxProj - minProj;
          ratio = span !== 0 ? (proj - minProj) / span : 0;
        }
        const dither = this.computeDitheredRatio(ratio, xx, yy);
        const startFallback = fallbackStart || fallbackEnd;
        const endFallback = fallbackEnd || fallbackStart;
        if (!startFallback || !endFallback) continue;
        const color = this.mixParsedColors(
          parsedStart,
          parsedEnd,
          dither,
          startFallback,
          endFallback,
        );
        ctx.fillStyle = color;
        ctx.fillRect(xx, yy, 1, 1);
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  private fillEllipseGradientPreview(
    ctx: CanvasRenderingContext2D,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: ShapeDrawOptions,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
  ) {
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = bounds.maxX;
    const maxY = bounds.maxY;
    const fillColor = options.fillColor;
    const startColor = options.gradientStartColor || fillColor;
    const endColor = options.gradientEndColor || startColor;
    const fallbackStart = startColor || endColor;
    const fallbackEnd = endColor || startColor;
    if (!fallbackStart && !fallbackEnd) return;
    const parsedStart = this.parseHexColor(startColor);
    const parsedEnd = this.parseHexColor(endColor);
    const gradientType: GradientType =
      options.gradientType === 'linear' ? 'linear' : 'radial';
    const gradientAngle =
      typeof options.gradientAngle === 'number' ? options.gradientAngle : 0;
    const angleRad = (gradientAngle * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);
    let minProj = 0;
    let maxProj = 1;
    if (gradientType === 'linear') {
      let minVal = Number.POSITIVE_INFINITY;
      let maxVal = Number.NEGATIVE_INFINITY;
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
      ];
      for (const corner of corners) {
        const proj = (corner.x + 0.5) * dirX + (corner.y + 0.5) * dirY;
        if (proj < minVal) minVal = proj;
        if (proj > maxVal) maxVal = proj;
      }
      if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
        if (minVal === maxVal) maxVal = minVal + 1;
        minProj = minVal;
        maxProj = maxVal;
      }
    }
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.35;
    const invRx = rx > 0 ? 1 / rx : 0;
    const invRy = ry > 0 ? 1 / ry : 0;
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const dx = xx + 0.5 - cx;
        const dy = yy + 0.5 - cy;
        const norm =
          invRx > 0 && invRy > 0
            ? dx * dx * invRx * invRx + dy * dy * invRy * invRy
            : 0;
        if (norm > 1) continue;
        let ratio = 0;
        if (gradientType === 'radial') {
          ratio = Math.sqrt(norm);
        } else {
          const proj = (xx + 0.5) * dirX + (yy + 0.5) * dirY;
          const span = maxProj - minProj;
          ratio = span !== 0 ? (proj - minProj) / span : 0;
        }
        const dither = this.computeDitheredRatio(ratio, xx, yy);
        const startFallback = fallbackStart || fallbackEnd;
        const endFallback = fallbackEnd || fallbackStart;
        if (!startFallback || !endFallback) continue;
        const color = this.mixParsedColors(
          parsedStart,
          parsedEnd,
          dither,
          startFallback,
          endFallback,
        );
        ctx.fillStyle = color;
        ctx.fillRect(xx, yy, 1, 1);
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  private computeDitheredRatio(ratio: number, x: number, y: number) {
    const clamped = Math.min(1, Math.max(0, ratio));
    const steps = this.gradientSteps;
    if (steps <= 0) return clamped;
    const scaled = clamped * steps;
    const base = Math.floor(scaled);
    const fraction = scaled - base;
    const matrix = this.bayer4;
    const size = matrix.length;
    const xi = x % size;
    const yi = y % size;
    const threshold = (matrix[yi][xi] + 0.5) / (size * size);
    const offset = fraction > threshold ? 1 : 0;
    const index = Math.min(steps, Math.max(0, base + offset));
    return index / steps;
  }

  private parseHexColor(value: string | undefined) {
    if (!value || typeof value !== 'string') return null;
    const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
    if (!match) return null;
    const raw = match[1];
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }

  private componentToHex(value: number) {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  }

  private composeHexColor(r: number, g: number, b: number) {
    return `#${this.componentToHex(r)}${this.componentToHex(g)}${this.componentToHex(b)}`;
  }

  private mixParsedColors(
    start: { r: number; g: number; b: number } | null,
    end: { r: number; g: number; b: number } | null,
    ratio: number,
    fallbackStart: string,
    fallbackEnd: string,
  ) {
    const t = Math.min(1, Math.max(0, ratio));
    if (start && end) {
      const r = start.r + (end.r - start.r) * t;
      const g = start.g + (end.g - start.g) * t;
      const b = start.b + (end.b - start.b) * t;
      return this.composeHexColor(r, g, b);
    }
    const startValue = fallbackStart || fallbackEnd || '#000000';
    const endValue = fallbackEnd || fallbackStart || '#000000';
    return t <= 0.5 ? startValue : endValue;
  }

  private measureContainer() {
    const container = this.canvasContainer?.nativeElement;
    if (!container) {
      return {
        contentWidth: this.document.canvasWidth(),
        contentHeight: this.document.canvasHeight(),
        paddingLeft: 0,
        paddingTop: 0,
      };
    }
    const styles =
      typeof window !== 'undefined' ? window.getComputedStyle(container) : null;
    const paddingLeft = styles ? parseFloat(styles.paddingLeft) || 0 : 0;
    const paddingRight = styles ? parseFloat(styles.paddingRight) || 0 : 0;
    const paddingTop = styles ? parseFloat(styles.paddingTop) || 0 : 0;
    const paddingBottom = styles ? parseFloat(styles.paddingBottom) || 0 : 0;
    const contentWidth = Math.max(
      1,
      container.clientWidth - paddingLeft - paddingRight,
    );
    const contentHeight = Math.max(
      1,
      container.clientHeight - paddingTop - paddingBottom,
    );
    return { contentWidth, contentHeight, paddingLeft, paddingTop };
  }

  private getCurrentFrameId(): string {
    const frames = this.document.frames();
    const currentIndex = this.document.currentFrameIndex();
    const frame = frames[currentIndex];
    return frame?.id || '';
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

  private handleGenerateFromSelection(sourceType: 'layer' | 'visible'): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      return;
    }

    const sketchDataUrl = this.extractSketchFromSelection(sourceType);
    if (!sketchDataUrl) {
      return;
    }

    this.pixelGenerationDialog?.show(
      sketchDataUrl,
      sel.width,
      sel.height,
      'selection',
    );
  }

  private extractSketchFromSelection(
    sourceType: 'layer' | 'visible',
  ): string | null {
    const sel = this.document.selectionRect();
    if (!sel) return null;

    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const canvas = document.createElement('canvas');
    canvas.width = sel.width;
    canvas.height = sel.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (sourceType === 'layer') {
      const layerId = this.document.selectedLayerId();
      const buf = this.document.getLayerBuffer(layerId);
      if (!buf) return null;

      for (let y = 0; y < sel.height; y++) {
        for (let x = 0; x < sel.width; x++) {
          const srcX = sel.x + x;
          const srcY = sel.y + y;
          if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
            if (this.isPointInSelection(srcX, srcY)) {
              const col = buf[srcY * w + srcX];
              if (col && col.length) {
                ctx.fillStyle = col;
                ctx.fillRect(x, y, 1, 1);
              }
            }
          }
        }
      }
    } else {
      const layers = this.document.getFlattenedLayers();
      for (let li = layers.length - 1; li >= 0; li--) {
        const layer = layers[li];
        if (!layer.visible) continue;
        const buf = this.document.getLayerBuffer(layer.id);
        if (!buf) continue;

        for (let y = 0; y < sel.height; y++) {
          for (let x = 0; x < sel.width; x++) {
            const srcX = sel.x + x;
            const srcY = sel.y + y;
            if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
              if (this.isPointInSelection(srcX, srcY)) {
                const col = buf[srcY * w + srcX];
                if (col && col.length) {
                  ctx.fillStyle = col;
                  ctx.fillRect(x, y, 1, 1);
                }
              }
            }
          }
        }
      }
    }

    return canvas.toDataURL('image/png');
  }

  handleGenerate(request: GeneratePixelArtRequest): void {
    const canvas = document.createElement('canvas');
    canvas.width = request.width;
    canvas.height = request.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.pixelGenerationDialog?.hide();
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, request.width, request.height);
      const imageData = ctx.getImageData(0, 0, request.width, request.height);

      this.pixelGenEngine
        .generatePixelArt(
          imageData,
          request.prompt,
          request.width,
          request.height,
          'pixel-modern',
        )
        .subscribe({
          next: (jobId) => {
            if (this.generationCheckInterval !== null) {
              clearInterval(this.generationCheckInterval);
            }
            this.generationCheckInterval = setInterval(() => {
              const job = this.pixelGenEngine.getJob(jobId);
              if (!job || job.response.status === 'processing') {
                return;
              }

              if (this.generationCheckInterval !== null) {
                clearInterval(this.generationCheckInterval);
                this.generationCheckInterval = null;
              }

              if (
                job.response.status === 'completed' &&
                job.response.resultImageData
              ) {
                const newLayer = this.document.addLayer('Generated');
                const buf = this.document.getLayerBuffer(newLayer.id);
                if (!buf) {
                  this.pixelGenerationDialog?.hide();
                  return;
                }

                const resultData = job.response.resultImageData;
                const w = this.document.canvasWidth();
                const h = this.document.canvasHeight();

                for (let y = 0; y < Math.min(request.height, h); y++) {
                  for (let x = 0; x < Math.min(request.width, w); x++) {
                    const srcIdx = (y * request.width + x) * 4;
                    const r = resultData.data[srcIdx];
                    const g = resultData.data[srcIdx + 1];
                    const b = resultData.data[srcIdx + 2];
                    const a = resultData.data[srcIdx + 3];

                    if (a > 0) {
                      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
                      buf[y * w + x] = hex;
                    }
                  }
                }

                this.document.layerPixelsVersion.update((v) => v + 1);
                this.pixelGenerationDialog?.hide();
              } else {
                console.error('Generation failed:', job.response.error);
                this.pixelGenerationDialog?.hide();
              }
            }, 500) as unknown as number;
          },
          error: (error) => {
            console.error('Generation failed:', error);
            this.pixelGenerationDialog?.hide();
          },
        });
    };
    img.onerror = () => {
      console.error('Failed to load sketch image');
      this.pixelGenerationDialog?.hide();
    };
    img.src = request.sketchDataUrl;
  }
}
