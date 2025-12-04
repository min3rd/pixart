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
  ChangeDetectionStrategy,
} from '@angular/core';
import { EditorDocumentService } from '../../../services/editor-document.service';
import { EditorToolsService } from '../../../services/editor-tools.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { CommonModule } from '@angular/common';
import { EditorBoneService } from '../../../services/editor/editor-bone.service';
import { HotkeysService } from '../../../services/hotkeys.service';
import {
  PixelGenerationDialog,
  GeneratePixelArtRequest,
} from '../../../shared/pixel-generation-dialog/pixel-generation-dialog';
import { EditorFreeTransformService } from '../../../services/editor/editor-free-transform.service';
import { EditorDistortService } from '../../../services/editor/editor-distort.service';
import { EditorPerspectiveService } from '../../../services/editor/editor-perspective.service';
import { EditorWarpService } from '../../../services/editor/editor-warp.service';
import { EditorPuppetWarpService } from '../../../services/editor/editor-puppet-warp.service';
import { FillSelectionDialog } from '../../../shared/components/fill-selection-dialog/fill-selection-dialog.component';
import { FillSelectionService } from '../../../services/editor/fill-selection.service';
import { ColorPickerStateService } from '../../../services/color-picker-state.service';
import {
  CanvasViewportService,
  CanvasShapeService,
  CanvasGenerationService,
  ShapeDrawOptions,
  CanvasFreeTransformHandler,
  CanvasDistortHandler,
  CanvasPerspectiveHandler,
  CanvasWarpHandler,
  CanvasPuppetWarpHandler,
  CanvasContextMenuService,
  ContextMenuActionId,
  ContextMenuAction,
  CanvasDrawService,
  CanvasPointerService,
  PointerState,
} from '../../../services/editor/canvas';

@Component({
  selector: 'pa-editor-canvas',
  templateUrl: './editor-canvas.component.html',
  styleUrls: ['./editor-canvas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoPipe,
    NgIcon,
    PixelGenerationDialog,
    FillSelectionDialog,
  ],
  host: {
    class: 'block h-full w-full',
    '(wheel)': 'onWheel($event)',
  },
})
export class EditorCanvas implements OnDestroy {
  private static readonly DEFAULT_WORKSPACE_WIDTH = 800;
  private static readonly DEFAULT_WORKSPACE_HEIGHT = 600;

  @ViewChild('canvasEl', { static: true })
  canvasEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer', { static: true })
  canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild(PixelGenerationDialog, { static: false })
  pixelGenerationDialog!: PixelGenerationDialog;
  @ViewChild(FillSelectionDialog, { static: false })
  fillSelectionDialog!: FillSelectionDialog;

  private resizeObserver: ResizeObserver | null = null;
  private workspaceWidth = signal(0);
  private workspaceHeight = signal(0);

  readonly document = inject(EditorDocumentService);
  readonly documentSvc: EditorDocumentService = this.document;
  readonly tools = inject(EditorToolsService);
  readonly boneService = inject(EditorBoneService);
  readonly hotkeys = inject(HotkeysService);
  readonly freeTransform = inject(EditorFreeTransformService);
  readonly distort = inject(EditorDistortService);
  readonly perspective = inject(EditorPerspectiveService);
  readonly warp = inject(EditorWarpService);
  readonly puppetWarp = inject(EditorPuppetWarpService);
  readonly fillSelectionService = inject(FillSelectionService);
  readonly colorPickerState = inject(ColorPickerStateService);
  readonly viewport = inject(CanvasViewportService);
  readonly shapeService = inject(CanvasShapeService);
  readonly generationService = inject(CanvasGenerationService);
  readonly freeTransformHandler = inject(CanvasFreeTransformHandler);
  readonly distortHandler = inject(CanvasDistortHandler);
  readonly perspectiveHandler = inject(CanvasPerspectiveHandler);
  readonly warpHandler = inject(CanvasWarpHandler);
  readonly puppetWarpHandler = inject(CanvasPuppetWarpHandler);
  readonly contextMenu = inject(CanvasContextMenuService);
  readonly drawService = inject(CanvasDrawService);
  readonly pointerService = inject(CanvasPointerService);

  readonly mouseX = signal<number | null>(null);
  readonly mouseY = signal<number | null>(null);
  readonly hoverX = signal<number | null>(null);
  readonly hoverY = signal<number | null>(null);

  get panX() { return this.viewport.panX; }
  get panY() { return this.viewport.panY; }
  get scale() { return this.viewport.scale; }
  get rotation() { return this.viewport.rotation; }
  get minScale() { return this.viewport.minScale; }
  get maxScale() { return this.viewport.maxScale; }

  isAtMinZoom(): boolean { return this.viewport.isAtMinZoom(); }
  isAtMaxZoom(): boolean { return this.viewport.isAtMaxZoom(); }

  get contextMenuVisible() { return this.contextMenu.visible; }
  get contextMenuPosition() { return this.contextMenu.position; }
  get contextMenuActions() { return this.contextMenu.actions; }
  get submenuVisible() { return this.contextMenu.submenuVisible; }
  get submenuPosition() { return this.contextMenu.submenuPosition; }
  get submenuActions() { return this.contextMenu.submenuActions; }
  get inputDialogVisible() { return this.contextMenu.inputDialogVisible; }
  get inputDialogPosition() { return this.contextMenu.inputDialogPosition; }
  get inputDialogValue() { return this.contextMenu.inputDialogValue; }
  get inputDialogTitle() { return this.contextMenu.inputDialogTitle; }
  get inputDialogCallback() { return this.contextMenu.inputDialogCallback; }

  private readonly injector = inject(EnvironmentInjector);
  private readonly viewReady = signal(false);
  private readonly shapeStart = signal<{ x: number; y: number } | null>(null);
  private readonly shapeCurrent = signal<{ x: number; y: number } | null>(null);
  private readonly activeShapeTool = signal<'line' | 'circle' | 'square' | null>(null);
  private readonly shapeConstrainUniform = signal(false);
  private readonly penPoints = signal<{ x: number; y: number }[]>([]);
  private readonly penDrawing = signal(false);

  private pointerState: PointerState = {
    panning: false,
    painting: false,
    lastPaintPos: null,
    selectionStart: null,
    selectionDragging: false,
    selectionMoving: false,
    selectionMoveStart: null,
    selectionContentMoving: false,
    selectionContentMoveStart: null,
    shiftPressed: false,
    lastPointer: { x: 0, y: 0 },
    shaping: false,
    currentBoneId: null,
    draggingPointId: null,
    draggingPointBoneId: null,
    smartSelecting: false,
    smartSelectPoints: [],
    smartSelectMode: 'normal',
  };

  private movingContentBuffer: string[] | null = null;
  private movingContentOriginalRect: { x: number; y: number; width: number; height: number } | null = null;
  private originalLayerId: string | null = null;
  private stopRenderEffect: EffectRef | null = null;
  readonly tileSize = signal(1);
  private resizeListener: (() => void) | null = null;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private readonly defaultCursor = `url('/cursors/link.png') 12 12, link`;
  private readonly brushCursor = `url('/cursors/handwriting.png') 12 12, crosshair`;
  private readonly eraserCursor = `url('/cursors/unavailable.png') 12 12, cell`;
  private readonly handGrabbingCursor = `url('/cursors/grab.png') 12 12, grab`;
  infoVisible = signal(true);

  constructor() {
    this.stopRenderEffect = effect(() => {
      this.drawCanvas();
      return null as any;
    });

    effect(() => {
      const sel = this.document.selectionRect();
      const active = this.freeTransform.isActive();
      if (active && (!sel || sel.width <= 0 || sel.height <= 0)) {
        this.freeTransformHandler.cancel();
      }
    });

    effect(() => {
      const tool = this.tools.currentTool();
      if (tool !== 'bone' && this.pointerState.currentBoneId) {
        this.pointerState.currentBoneId = null;
      }
    });

    effect(() => {
      const active = this.freeTransform.isActive();
      if (active && !this.freeTransformHandler.hasOriginalBuffer()) {
        this.freeTransformHandler.activate();
      }
    });

    effect(() => {
      const active = this.distort.isActive();
      if (active && !this.distortHandler.hasOriginalBuffer()) {
        this.distortHandler.activate();
      }
    });

    effect(() => {
      const sel = this.document.selectionRect();
      const active = this.distort.isActive();
      if (active && (!sel || sel.width <= 0 || sel.height <= 0)) {
        this.distortHandler.cancel();
      }
    });

    effect(() => {
      const active = this.perspective.isActive();
      if (active && !this.perspectiveHandler.hasOriginalBuffer()) {
        this.perspectiveHandler.activate();
      }
    });

    effect(() => {
      const sel = this.document.selectionRect();
      const active = this.perspective.isActive();
      if (active && (!sel || sel.width <= 0 || sel.height <= 0)) {
        this.perspectiveHandler.cancel();
      }
    });

    effect(() => {
      const active = this.warp.isActive();
      if (active && !this.warpHandler.hasOriginalBuffer()) {
        this.warpHandler.activate();
      }
    });

    effect(() => {
      const sel = this.document.selectionRect();
      const active = this.warp.isActive();
      if (active && (!sel || sel.width <= 0 || sel.height <= 0)) {
        this.warpHandler.cancel();
      }
    });

    effect(() => {
      const active = this.puppetWarp.isActive();
      if (active && !this.puppetWarpHandler.hasOriginalBuffer()) {
        this.puppetWarpHandler.activate();
      }
    });

    effect(() => {
      const sel = this.document.selectionRect();
      const active = this.puppetWarp.isActive();
      if (active && (!sel || sel.width <= 0 || sel.height <= 0)) {
        this.puppetWarpHandler.cancel();
      }
    });

    this.registerCanvasHotkeys();
  }

  private registerCanvasHotkeys() {
    this.hotkeys.register({
      id: 'edit.deselect',
      category: 'edit',
      defaultKey: 'ctrl+shift+a',
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
      id: 'edit.moveSelectionPixels',
      category: 'edit',
      defaultKey: 'shift+v',
      handler: () => this.activateMoveSelectionHotkey(),
    });

    this.hotkeys.register({
      id: 'tool.freeTransform',
      category: 'tool',
      defaultKey: 'shift+t',
      handler: () => {
        const sel = this.document.selectionRect();
        if (!sel || sel.width <= 0 || sel.height <= 0) return;
        this.freeTransform.startTransform(sel.x, sel.y, sel.width, sel.height);
      },
    });

    this.hotkeys.register({
      id: 'edit.fillSelection',
      category: 'edit',
      defaultKey: 'shift+f5',
      handler: () => this.openFillSelectionDialog(),
    });
  }

  async openFillSelectionDialog() {
    const selectionRect = this.document.selectionRect();
    if (!selectionRect || selectionRect.width <= 0 || selectionRect.height <= 0) return;

    const result = await this.fillSelectionDialog?.open();
    if (!result) return;

    const success = this.fillSelectionService.fillSelection({
      mode: result.mode,
      color: result.color,
      patternId: result.patternId,
      gradientStartColor: result.gradientStartColor,
      gradientEndColor: result.gradientEndColor,
      gradientType: result.gradientType,
      gradientAngle: result.gradientAngle,
    });

    if (success) {
      this.tools.setFillMode(result.mode);
      if (result.color) this.tools.setFillColor(result.color);
      if (result.patternId) this.tools.setFillPatternId(result.patternId);
      if (result.gradientStartColor) this.tools.setFillGradientStartColor(result.gradientStartColor);
      if (result.gradientEndColor) this.tools.setFillGradientEndColor(result.gradientEndColor);
      if (result.gradientType) this.tools.setFillGradientType(result.gradientType);
      if (result.gradientAngle !== undefined) this.tools.setFillGradientAngle(result.gradientAngle);
    }
  }

  private activateMoveSelectionHotkey() {
    const binding = this.hotkeys.getBinding('edit.moveSelectionPixels');
    if (!binding) return;
    this.pointerService.activateMoveSelectionHotkey(binding);
  }

  private readonly layoutEffect = effect(
    () => {
      if (!this.viewReady()) return;
      const w = this.document.canvasWidth();
      const h = this.document.canvasHeight();
      this.viewport.updateScaleLimits(w, h);
      const scheduler = typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (cb: () => void) => Promise.resolve().then(cb);
      scheduler(() => this.centerAndFitCanvas());
    },
    { injector: this.injector },
  );

  cursor(): string {
    if (this.pointerState.panning) return this.handGrabbingCursor;
    const tool = this.tools.currentTool();
    if (tool === 'rect-select' || tool === 'ellipse-select' || tool === 'lasso-select') return `crosshair`;
    if (tool === 'brush') return 'none';
    if (tool === 'eraser') return 'none';
    if (tool === 'line' || tool === 'circle' || tool === 'square' || tool === 'pen') return `crosshair`;
    if (tool === 'bone') return `crosshair`;
    return this.defaultCursor;
  }

  ngAfterViewInit(): void {
    const container = this.canvasContainer?.nativeElement;
    if (container && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.workspaceWidth.set(Math.floor(width));
            this.workspaceHeight.set(Math.floor(height));
          }
        }
      });
      this.resizeObserver.observe(container);
      const rect = container.getBoundingClientRect();
      this.workspaceWidth.set(Math.floor(rect.width) || EditorCanvas.DEFAULT_WORKSPACE_WIDTH);
      this.workspaceHeight.set(Math.floor(rect.height) || EditorCanvas.DEFAULT_WORKSPACE_HEIGHT);
    }

    this.centerAndFitCanvas();
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => this.centerAndFitCanvas());
    }
    this.updateTileSize(this.tools.brushSize());

    const flatLayers = this.document.getFlattenedLayers();
    for (const l of flatLayers) {
      this.document.ensureLayerBuffer(l.id, this.document.canvasWidth(), this.document.canvasHeight());
    }

    this.resizeListener = () => this.centerAndFitCanvas();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeListener as EventListener);
      this.keyListener = (ev: KeyboardEvent) => this.handleKeyDown(ev);
      window.addEventListener('keydown', this.keyListener as EventListener);
      window.addEventListener('keyup', (ev: KeyboardEvent) => {
        this.pointerService.handleMoveSelectionHotkeyRelease(ev);
        if (ev.key === 'Shift') {
          this.pointerState.shiftPressed = false;
          this.freeTransform.setSnapRotation(false);
          this.freeTransform.setConstrainProportions(false);
        }
      });
    }

    this.viewReady.set(true);
  }

  private handleKeyDown(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
    }

    if (ev.key === 'Escape') {
      if (this.freeTransform.isActive()) { this.freeTransformHandler.cancel(); return; }
      if (this.distort.isActive()) { this.distortHandler.cancel(); return; }
      if (this.perspective.isActive()) { this.perspectiveHandler.cancel(); return; }
      if (this.contextMenuVisible()) { this.closeContextMenu(); return; }
      const tool = this.tools.currentTool();
      if (tool === 'pen' && this.penDrawing()) { this.cancelPenPath(); return; }
      if (tool === 'bone') {
        this.pointerState.currentBoneId = null;
        this.boneService.clearSelection();
        return;
      }
      if (tool === 'lasso-select') {
        this.document.selectionPolygon.set(null as any);
        this.document.selectionRect.set(null as any);
        this.document.selectionShape.set('rect');
        this.pointerState.selectionDragging = false;
        this.pointerState.selectionStart = null;
      }
      return;
    }

    if (ev.key === 'Enter') {
      if (this.freeTransform.isActive()) { this.freeTransformHandler.commit(); return; }
      if (this.distort.isActive()) { this.distortHandler.commit(); return; }
      if (this.perspective.isActive()) { this.perspectiveHandler.commit(); return; }
      const tool = this.tools.currentTool();
      if (tool === 'pen' && this.penDrawing()) { this.finishPenPath(); return; }
    }

    const key = ev.key?.toLowerCase?.() ?? ev.key;
    if (ev.ctrlKey && ev.shiftKey && key === 'a') { ev.preventDefault(); this.document.clearSelection(); return; }
    if (ev.ctrlKey && key === 'd') { ev.preventDefault(); this.document.duplicateLayer(); return; }
    if (ev.ctrlKey && key === 'l') {
      ev.preventDefault();
      const selectedId = this.document.selectedLayerId();
      if (selectedId) this.document.toggleLayerLock(selectedId);
      return;
    }
    if (ev.key === 'Delete') {
      ev.preventDefault();
      const selectedIds = Array.from(this.document.selectedLayerIds());
      for (const id of selectedIds) this.document.removeLayer(id);
      return;
    }
    if (ev.ctrlKey && ev.shiftKey && key === 'g') {
      ev.preventDefault();
      const selectedIds = Array.from(this.document.selectedLayerIds());
      if (selectedIds.length >= 2) this.document.ungroupLayers(selectedIds[0]);
      return;
    }
    if (ev.ctrlKey && key === 'g') {
      ev.preventDefault();
      const selectedIds = Array.from(this.document.selectedLayerIds());
      if (selectedIds.length >= 2) this.document.groupLayers(selectedIds);
      return;
    }
  }

  updateTileSize(brushSize = 1, desiredScreenTilePx = 24) {
    const s = Math.max(0.001, this.scale());
    const tile = Math.max(1, Math.round(desiredScreenTilePx / (s * Math.max(1, brushSize))));
    this.tileSize.set(tile);
  }

  onPointerMove(ev: PointerEvent) {
    const rect = this.canvasEl.nativeElement.getBoundingClientRect();
    const callbacks = this.createPointerCallbacks();
    const result = this.pointerService.handlePointerMove(ev, rect, this.pointerState, callbacks);
    this.mouseX.set(result.mouseX);
    this.mouseY.set(result.mouseY);
    this.hoverX.set(result.hoverX);
    this.hoverY.set(result.hoverY);

    if (this.pointerState.shaping) {
      const w = this.document.canvasWidth();
      const h = this.document.canvasHeight();
      const currentScale = this.scale();
      const currentPanX = this.panX();
      const currentPanY = this.panY();
      const visX = ev.clientX - rect.left;
      const visY = ev.clientY - rect.top;
      const logicalX = Math.floor((visX - currentPanX) / currentScale);
      const logicalY = Math.floor((visY - currentPanY) / currentScale);
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
      if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
    }

    const rect = container.getBoundingClientRect();
    if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;

    ev.preventDefault();
    ev.stopPropagation();

    let delta = ev.deltaY;
    if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= rect.height;

    const zoomIntensity = 0.002;
    const factor = Math.exp(-delta * zoomIntensity);
    const next = this.scale() * factor;
    this.applyZoom(next, { clientX: ev.clientX, clientY: ev.clientY });
  }

  onPointerDown(ev: PointerEvent) {
    if (this.contextMenuVisible()) this.closeContextMenu();
    const rect = this.canvasEl.nativeElement.getBoundingClientRect();
    const callbacks = this.createPointerCallbacks();
    this.pointerService.handlePointerDown(
      ev,
      rect,
      this.pointerState,
      callbacks,
      (val) => this.shapeConstrainUniform.set(val),
    );
  }

  onPointerUp(ev: PointerEvent) {
    const callbacks = this.createPointerCallbacks();
    this.pointerService.handlePointerUp(ev, this.pointerState, callbacks);
  }

  private createPointerCallbacks() {
    return {
      capturePointer: (ev: PointerEvent) => this.capturePointer(ev),
      releasePointer: (ev: PointerEvent) => this.releasePointer(ev),
      startShape: (mode: 'line' | 'circle' | 'square', x: number, y: number) => this.startShape(mode, x, y),
      finishShape: (shiftKey: boolean) => this.finishShape(shiftKey),
      addPenPoint: (x: number, y: number) => this.addPenPoint(x, y),
      getCurrentFrameId: () => this.getCurrentFrameId(),
      startSelectionContentMove: () => this.startSelectionContentMove(),
      moveSelectionContent: (dx: number, dy: number) => this.moveSelectionContent(dx, dy),
      endSelectionContentMove: () => this.endSelectionContentMove(),
      isPointInSelection: (x: number, y: number) => this.isPointInSelection(x, y),
      drawLinePaint: (layerId: string, x0: number, y0: number, x1: number, y1: number, brushSize: number, color: string | null) =>
        this.drawLinePaint(layerId, x0, y0, x1, y1, brushSize, color),
    };
  }

  private capturePointer(ev: PointerEvent): void {
    const target = ev.currentTarget as HTMLElement;
    if (target?.setPointerCapture) target.setPointerCapture(ev.pointerId);
  }

  private releasePointer(ev: PointerEvent): void {
    const target = ev.currentTarget as HTMLElement;
    if (target?.releasePointerCapture) {
      try { if (target.hasPointerCapture(ev.pointerId)) target.releasePointerCapture(ev.pointerId); } catch {}
    }
  }

  onCanvasContextMenu(ev: MouseEvent) {
    ev.preventDefault();
    const canvasRect = this.canvasEl.nativeElement.getBoundingClientRect();
    const visX = ev.clientX - canvasRect.left;
    const visY = ev.clientY - canvasRect.top;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const currentScale = this.scale();
    const currentPanX = this.panX();
    const currentPanY = this.panY();
    const logicalX = Math.floor((visX - currentPanX) / currentScale);
    const logicalY = Math.floor((visY - currentPanY) / currentScale);
    const insideCanvas = logicalX >= 0 && logicalX < w && logicalY >= 0 && logicalY < h;
    if (!insideCanvas) { this.closeContextMenu(); return; }
    const containerRect = this.canvasContainer.nativeElement.getBoundingClientRect();
    this.contextMenu.show(ev.clientX, ev.clientY, containerRect, this.hasNonEmptySelection());
  }

  private hasNonEmptySelection(): boolean {
    const sel = this.document.selectionRect();
    if (!sel) return false;
    const layerId = this.document.selectedLayerId();
    const buf = this.document.getLayerBuffer(layerId);
    if (!buf) return false;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    for (let y = sel.y; y < sel.y + sel.height && y < h; y++) {
      for (let x = sel.x; x < sel.x + sel.width && x < w; x++) {
        if (this.isPointInSelection(x, y) && buf[y * w + x] && buf[y * w + x].length > 0) return true;
      }
    }
    return false;
  }

  closeContextMenu() { this.contextMenu.close(); }

  onSubmenuTrigger(action: ContextMenuAction, event: MouseEvent, buttonElement: HTMLElement) {
    if (!action.submenu || action.submenu.length === 0) return;
    event.stopPropagation();
    const rect = buttonElement.getBoundingClientRect();
    const containerRect = this.canvasContainer.nativeElement.getBoundingClientRect();
    this.contextMenu.showSubmenu(action, rect, containerRect);
  }

  onContextMenuAction(actionId: ContextMenuActionId, event?: MouseEvent) {
    const containerRect = this.canvasContainer.nativeElement.getBoundingClientRect();
    this.contextMenu.executeAction(
      actionId,
      event,
      containerRect,
      () => this.handleGenerateFromSelection('layer'),
      () => this.handleGenerateFromSelection('visible'),
    );
  }

  closeInputDialog() { this.contextMenu.closeInputDialog(); }
  getShortcutForAction(actionId: ContextMenuActionId): string | null { return this.contextMenu.getShortcutForAction(actionId); }
  onInputDialogSubmit() { this.contextMenu.submitInputDialog(); }
  onInputDialogCancel() { this.closeInputDialog(); }

  startSelectionContentMove() {
    const sel = this.document.selectionRect();
    if (!sel) return;
    const layerId = this.document.selectedLayerId();
    const sourceBuf = this.document.getLayerBuffer(layerId);
    if (!sourceBuf) return;
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    this.originalLayerId = layerId;
    this.movingContentOriginalRect = { x: sel.x, y: sel.y, width: sel.width, height: sel.height };
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

  moveSelectionContent(dx: number, dy: number) { this.document.moveSelection(dx, dy); }

  endSelectionContentMove() {
    if (!this.movingContentBuffer || !this.originalLayerId || !this.movingContentOriginalRect) return;
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
      for (const l of flatLayers) this.document.ensureLayerBuffer(l.id, width, this.document.canvasHeight());
    }
  }

  setCanvasHeight(event: Event) {
    const target = event.target as HTMLInputElement;
    const height = parseInt(target.value, 10);
    if (height > 0) {
      this.document.setCanvasSize(this.document.canvasWidth(), height);
      const flatLayers = this.document.getFlattenedLayers();
      for (const l of flatLayers) this.document.ensureLayerBuffer(l.id, this.document.canvasWidth(), height);
    }
  }

  private drawLinePaint(layerId: string, x0: number, y0: number, x1: number, y1: number, brushSize: number, color: string | null) {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    const eraserOptions = color === null ? { eraserStrength: this.tools.eraserStrength() } : undefined;
    while (true) {
      this.document.applyBrushToLayer(layerId, x, y, brushSize, color, eraserOptions);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  onScaleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    let v = parseFloat(target.value);
    if (Number.isNaN(v)) return;
    this.applyZoom(v);
  }

  resetRotation() { this.rotation.set(0); }
  increaseZoom(step = 0.1) { const factor = 1 + Math.max(0, step); this.applyZoom(this.scale() * factor); }
  decreaseZoom(step = 0.1) { const factor = 1 + Math.max(0, step); this.applyZoom(this.scale() / factor); }

  ngOnDestroy(): void {
    this.viewReady.set(false);
    this.closeContextMenu();
    if (this.resizeObserver) { try { this.resizeObserver.disconnect(); } catch {} this.resizeObserver = null; }
    if (this.stopRenderEffect) {
      try {
        if ((this.stopRenderEffect as any).destroy) (this.stopRenderEffect as any).destroy();
        else if (typeof (this.stopRenderEffect as any) === 'function') (this.stopRenderEffect as any)();
      } catch {}
      this.stopRenderEffect = null;
    }
    if (this.resizeListener && typeof window !== 'undefined') {
      try { window.removeEventListener('resize', this.resizeListener as EventListener); } catch {}
      this.resizeListener = null;
    }
    if (this.keyListener && typeof window !== 'undefined') {
      try { window.removeEventListener('keydown', this.keyListener as EventListener); } catch {}
      this.keyListener = null;
    }
    this.generationService.clearGenerationInterval();
  }

  private centerAndFitCanvas() {
    try {
      const canvas = this.canvasEl?.nativeElement;
      if (!canvas) return;
      const w = Math.max(1, this.document.canvasWidth());
      const h = Math.max(1, this.document.canvasHeight());
      const { contentWidth, contentHeight, paddingLeft, paddingTop } = this.measureContainer();
      if (contentWidth <= 0 || contentHeight <= 0) return;
      const fitScale = Math.max(this.minScale, Math.min(contentWidth / w, contentHeight / h));
      const initialScale = Math.min(this.maxScale, fitScale);
      this.scale.set(initialScale);
      const displayWidth = w * initialScale;
      const displayHeight = h * initialScale;
      const offsetX = paddingLeft + (contentWidth - displayWidth) / 2;
      const offsetY = paddingTop + (contentHeight - displayHeight) / 2;
      this.panX.set(offsetX);
      this.panY.set(offsetY);
      this.updateTileSize(this.tools.brushSize());
    } catch (e) {}
  }

  private applyZoom(nextScale: number, anchor?: { clientX: number; clientY: number }) {
    const clamped = Math.min(this.maxScale, Math.max(this.minScale, nextScale));
    const prev = this.scale();
    if (!this.canvasEl?.nativeElement) { this.scale.set(clamped); this.updateTileSize(this.tools.brushSize()); return; }
    if (Math.abs(clamped - prev) < 0.0001) return;
    const container = this.canvasContainer?.nativeElement;
    const containerRect = container ? container.getBoundingClientRect() : null;
    const prevPanX = this.panX();
    const prevPanY = this.panY();
    const pivotX = anchor?.clientX ?? (containerRect ? containerRect.left + containerRect.width / 2 : 0);
    const pivotY = anchor?.clientY ?? (containerRect ? containerRect.top + containerRect.height / 2 : 0);
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
    this.drawService.drawCanvas({
      canvas,
      container: this.canvasContainer?.nativeElement,
      workspaceWidth: this.workspaceWidth(),
      workspaceHeight: this.workspaceHeight(),
      tileSize: this.tileSize(),
      mouseX: this.mouseX(),
      mouseY: this.mouseY(),
      activeShapeTool: this.activeShapeTool(),
      shapeStart: this.shapeStart(),
      shapeCurrent: this.shapeCurrent(),
      shapeConstrainUniform: this.shapeConstrainUniform(),
      penDrawing: this.penDrawing(),
      penPoints: this.penPoints(),
      movingContentBuffer: this.movingContentBuffer,
      movingContentOriginalRect: this.movingContentOriginalRect,
      getCurrentFrameId: () => this.getCurrentFrameId(),
      getCircleDrawOptions: () => this.getCircleDrawOptions(),
      getSquareDrawOptions: () => this.getSquareDrawOptions(),
    });
  }

  private startShape(mode: 'line' | 'circle' | 'square', x: number, y: number) {
    const width = Math.max(1, this.document.canvasWidth());
    const height = Math.max(1, this.document.canvasHeight());
    const point = { x: this.clampCoord(x, width), y: this.clampCoord(y, height) };
    this.document.saveSnapshot(mode);
    this.pointerState.shaping = true;
    this.activeShapeTool.set(mode);
    this.shapeStart.set(point);
    this.shapeCurrent.set(point);
  }

  private finishShape(constrainOverride?: boolean) {
    if (!this.pointerState.shaping) return;
    const mode = this.activeShapeTool();
    const start = this.shapeStart();
    const current = this.shapeCurrent();
    if (!mode || !start || !current) { this.clearShapeState(); return; }
    const layerId = this.document.selectedLayerId();
    if (!layerId) { this.clearShapeState(); return; }
    if (mode === 'line') {
      const thickness = this.tools.lineThickness();
      const color = this.tools.lineColor();
      this.document.applyLineToLayer(layerId, start.x, start.y, current.x, current.y, color, thickness);
    } else if (mode === 'circle') {
      this.document.applyCircleToLayer(layerId, start.x, start.y, current.x, current.y, this.getCircleDrawOptions(),
        typeof constrainOverride === 'boolean' ? constrainOverride : this.shapeConstrainUniform());
    } else {
      const constrainSquare = typeof constrainOverride === 'boolean' ? constrainOverride : this.shapeConstrainUniform();
      this.document.applySquareToLayer(layerId, start.x, start.y, current.x, current.y, this.getSquareDrawOptions(), constrainSquare);
    }
    this.clearShapeState();
  }

  private clearShapeState() {
    this.pointerState.shaping = false;
    this.activeShapeTool.set(null);
    this.shapeStart.set(null);
    this.shapeCurrent.set(null);
    this.shapeConstrainUniform.set(false);
  }

  onDoubleClick(ev: MouseEvent) {
    const tool = this.tools.currentTool();
    if (tool === 'pen' && this.penDrawing()) this.finishPenPath();
  }

  private addPenPoint(x: number, y: number) {
    const w = this.document.canvasWidth();
    const h = this.document.canvasHeight();
    const clampedX = Math.max(0, Math.min(w - 1, x));
    const clampedY = Math.max(0, Math.min(h - 1, y));
    const points = this.penPoints();
    if (!this.penDrawing()) { this.document.saveSnapshot('Pen path'); this.penDrawing.set(true); }
    this.penPoints.set([...points, { x: clampedX, y: clampedY }]);
  }

  private finishPenPath() {
    const points = this.penPoints();
    if (points.length < 2) { this.cancelPenPath(); return; }
    const layerId = this.document.selectedLayerId();
    if (!layerId) { this.cancelPenPath(); return; }
    const thickness = this.tools.penThickness();
    const color = this.tools.penColor();
    const lineMode = this.tools.penLineMode();
    if (lineMode === 'spline') this.applySplinePath(layerId, points, color, thickness);
    else this.applyPolylinePath(layerId, points, color, thickness);
    this.clearPenState();
  }

  private cancelPenPath() {
    if (this.penDrawing()) this.document.undo();
    this.clearPenState();
  }

  private clearPenState() { this.penDrawing.set(false); this.penPoints.set([]); }

  private applyPolylinePath(layerId: string, points: { x: number; y: number }[], color: string, thickness: number) {
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      this.document.applyLineToLayer(layerId, start.x, start.y, end.x, end.y, color, thickness);
    }
  }

  private applySplinePath(layerId: string, points: { x: number; y: number }[], color: string, thickness: number) {
    if (points.length < 2) return;
    if (points.length === 2) {
      this.document.applyLineToLayer(layerId, points[0].x, points[0].y, points[1].x, points[1].y, color, thickness);
      return;
    }
    const splinePoints = this.shapeService.catmullRomSpline(points, 10);
    for (let i = 0; i < splinePoints.length - 1; i++) {
      const start = splinePoints[i];
      const end = splinePoints[i + 1];
      this.document.applyLineToLayer(layerId, Math.round(start.x), Math.round(start.y), Math.round(end.x), Math.round(end.y), color, thickness);
    }
  }

  private isPointInSelection(x: number, y: number): boolean {
    const rect = this.document.selectionRect();
    if (!rect) return false;
    const shape = this.document.selectionShape();
    if (shape === 'lasso') {
      const mask = this.document.selectionMask();
      if (mask && mask.size > 0) {
        return mask.has(`${x},${y}`);
      }
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
      const ellipseTest = (normX * normX) / (rx * rx) + (normY * normY) / (ry * ry);
      return ellipseTest <= 1;
    }
    return withinRect;
  }

  private pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersects = yi > y !== yj > y && x <= ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  private clampCoord(value: number, max: number) { return Math.max(0, Math.min(Math.floor(value), max - 1)); }

  private getCircleDrawOptions(): ShapeDrawOptions {
    return {
      strokeThickness: Math.max(0, Math.floor(this.tools.circleStrokeThickness())),
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
      strokeThickness: Math.max(0, Math.floor(this.tools.squareStrokeThickness())),
      strokeColor: this.tools.squareStrokeColor(),
      fillMode: this.tools.squareFillMode(),
      fillColor: this.tools.squareFillColor(),
      gradientStartColor: this.tools.squareGradientStartColor(),
      gradientEndColor: this.tools.squareGradientEndColor(),
      gradientType: this.tools.squareGradientType(),
      gradientAngle: this.tools.squareGradientAngle(),
    };
  }

  private measureContainer() {
    const container = this.canvasContainer?.nativeElement;
    return this.viewport.measureContainer(container);
  }

  private getCurrentFrameId(): string {
    const frames = this.document.frames();
    const currentIndex = this.document.currentFrameIndex();
    const frame = frames[currentIndex];
    return frame?.id || '';
  }

  private handleGenerateFromSelection(sourceType: 'layer' | 'visible'): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) return;
    const sketchDataUrl = this.generationService.extractSketchFromSelection(
      sourceType,
      sel,
      (px, py) => this.isPointInSelection(px, py),
    );
    if (!sketchDataUrl) return;
    this.pixelGenerationDialog?.show(sketchDataUrl, sel.width, sel.height, 'selection');
  }

  handleGenerate(request: GeneratePixelArtRequest): void {
    this.generationService.handleGenerate(
      request,
      () => this.pixelGenerationDialog?.hide(),
      () => this.pixelGenerationDialog?.hide(),
    );
  }
}
