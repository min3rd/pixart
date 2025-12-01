import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { EditorHeader } from './parts/editor-header/editor-header.component';
import { ToolPalette } from './parts/tool-palette/tool-palette.component';
import { LayersPanel } from './parts/layers-panel/layers-panel.component';
import { TimelinePanel } from './parts/timeline-panel/timeline-panel.component';
import { BonesPanel } from './parts/bones-panel/bones-panel.component';
import { AnimationCreatorPanel } from './parts/animation-creator-panel/animation-creator-panel.component';
import { EditorCanvas } from './parts/editor-canvas/editor-canvas.component';
import { ContentAwareFillPanelComponent } from './parts/content-aware-fill-panel/content-aware-fill-panel.component';
import { DefinePatternPanelComponent } from './parts/define-pattern-panel/define-pattern-panel.component';
import { UserSettingsService } from '../services/user-settings.service';
import { ContentAwareFillStateService } from '../services/editor/content-aware-fill-state.service';
import { DefinePatternService } from '../services/editor/define-pattern.service';
import { EditorDocumentService } from '../services/editor-document.service';
import { ContentAwareFillService } from '../services/content-aware-fill.service';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { TooltipDirective } from '../shared/directives/tooltip.directive';

@Component({
  selector: 'pa-editor-page',
  templateUrl: './editor.page.html',
  styleUrl: './editor.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslocoPipe,
    EditorHeader,
    ToolPalette,
    LayersPanel,
    TimelinePanel,
    BonesPanel,
    AnimationCreatorPanel,
    EditorCanvas,
    ContentAwareFillPanelComponent,
    DefinePatternPanelComponent,
    TooltipDirective,
  ],
  host: {
    class: 'block h-dvh w-dvw',
    '(window:pointermove)': 'onWindowMove($event)',
    '(window:pointerup)': 'onWindowUp()',
  },
})
export class EditorPage {
  private readonly settings = inject(UserSettingsService);
  readonly contentAwareFillState = inject(ContentAwareFillStateService);
  readonly definePatternState = inject(DefinePatternService);
  private readonly document = inject(EditorDocumentService);
  private readonly contentAwareFillService = inject(ContentAwareFillService);

  readonly rightPanelTab = signal<'layers' | 'bones' | 'contentAwareFill' | 'definePattern'>('layers');
  readonly bottomPanelTab = signal<'timeline' | 'animationCreator'>('timeline');

  readonly leftWidth = signal(this.settings.settings.panels.left);
  readonly rightWidth = signal(this.settings.settings.panels.right);
  readonly bottomHeight = signal(this.settings.settings.panels.bottom);

  readonly gridCols = computed(
    () => `${this.leftWidth()}px 4px 1fr 4px ${this.rightWidth()}px`,
  );
  readonly gridRows = computed(() => `auto 1fr 4px ${this.bottomHeight()}px`);

  private dragging: null | {
    kind: 'left' | 'right' | 'bottom';
    startX: number;
    startY: number;
    startLeft: number;
    startRight: number;
    startBottom: number;
  } = null;

  onGripDown(kind: 'left' | 'right' | 'bottom', ev: PointerEvent) {
    ev.preventDefault();
    const t = ev.currentTarget as HTMLElement;
    t.setPointerCapture?.(ev.pointerId);
    this.dragging = {
      kind,
      startX: ev.clientX,
      startY: ev.clientY,
      startLeft: this.leftWidth(),
      startRight: this.rightWidth(),
      startBottom: this.bottomHeight(),
    };
  }

  onWindowMove(ev: PointerEvent) {
    if (!this.dragging) return;
    const dx = ev.clientX - this.dragging.startX;
    const dy = ev.clientY - this.dragging.startY;
    if (this.dragging.kind === 'left') {
      this.leftWidth.set(this.clamp(this.dragging.startLeft + dx, 120, 480));
    } else if (this.dragging.kind === 'right') {
      this.rightWidth.set(this.clamp(this.dragging.startRight - dx, 160, 520));
    } else if (this.dragging.kind === 'bottom') {
      this.bottomHeight.set(
        this.clamp(this.dragging.startBottom - dy, 96, 360),
      );
    }
  }

  onWindowUp() {
    this.dragging = null;
    this.settings.setPanelSizes({
      left: this.leftWidth(),
      right: this.rightWidth(),
      bottom: this.bottomHeight(),
    });
  }

  private clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v | 0));
  }

  onContentAwareFillToggle(): void {
    this.rightPanelTab.set('contentAwareFill');
  }

  onContentAwareFillApply(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      this.contentAwareFillState.deactivate();
      this.rightPanelTab.set('layers');
      return;
    }

    const currentLayer = this.document.selectedLayer();
    if (!currentLayer || currentLayer.type !== 'layer') {
      this.contentAwareFillState.deactivate();
      this.rightPanelTab.set('layers');
      return;
    }

    const { x, y, width, height } = sel;
    const canvasWidth = this.document.canvasWidth();
    const canvasHeight = this.document.canvasHeight();
    const selectionShape = this.document.selectionShape();
    const selectionPolygon = this.document.selectionPolygon();
    const selectionMask = this.document.selectionMask();

    const layerBuffer = this.document.getLayerBuffer(currentLayer.id);
    if (!layerBuffer || layerBuffer.length === 0) {
      this.contentAwareFillState.deactivate();
      this.rightPanelTab.set('layers');
      return;
    }

    this.document.saveSnapshot('Content-Aware Fill');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      this.contentAwareFillState.deactivate();
      this.rightPanelTab.set('layers');
      return;
    }

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const srcX = x + px;
        const srcY = y + py;
        if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
          const srcIdx = srcY * canvasWidth + srcX;
          const hex = layerBuffer[srcIdx];
          if (hex) {
            const rgba = this.hexToRgba(hex);
            const destIdx = (py * width + px) * 4;
            data[destIdx] = rgba[0];
            data[destIdx + 1] = rgba[1];
            data[destIdx + 2] = rgba[2];
            data[destIdx + 3] = rgba[3];
          }
        }
      }
    }

    const maskData = this.buildMaskData(
      x, y, width, height,
      selectionShape,
      selectionMask,
      selectionPolygon
    );

    const filledImageData = this.contentAwareFillState.applyFill(
      imageData, maskData, width, height
    );

    const hiddenLayerName = `${currentLayer.name} (original)`;
    const hiddenLayer = this.document.addLayer(hiddenLayerName);
    const hiddenLayerTreeItem = this.document.findItemById(
      this.document.layers(), hiddenLayer.id
    );
    if (hiddenLayerTreeItem) {
      hiddenLayerTreeItem.visible = false;
    }

    const hiddenBuffer = this.document.getLayerBuffer(hiddenLayer.id);
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px;
        if (maskData[idx] > 0) {
          const srcX = x + px;
          const srcY = y + py;
          if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
            const layerIdx = srcY * canvasWidth + srcX;
            hiddenBuffer[layerIdx] = layerBuffer[layerIdx] || '';
          }
        }
      }
    }

    const newLayerName = `${currentLayer.name} (filled)`;
    const newLayer = this.document.addLayer(newLayerName);
    const newBuffer = this.document.getLayerBuffer(newLayer.id);
    const filledData = filledImageData.data;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px;
        if (maskData[idx] > 0) {
          const srcX = x + px;
          const srcY = y + py;
          if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
            const dataIdx = idx * 4;
            const r = filledData[dataIdx];
            const g = filledData[dataIdx + 1];
            const b = filledData[dataIdx + 2];
            const a = filledData[dataIdx + 3];
            if (a > 0) {
              const layerIdx = srcY * canvasWidth + srcX;
              newBuffer[layerIdx] = this.rgbaToHex(r, g, b, a);
            }
          }
        }
      }
    }

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px;
        if (maskData[idx] > 0) {
          const srcX = x + px;
          const srcY = y + py;
          if (srcX >= 0 && srcX < canvasWidth && srcY >= 0 && srcY < canvasHeight) {
            const layerIdx = srcY * canvasWidth + srcX;
            layerBuffer[layerIdx] = '';
          }
        }
      }
    }

    this.contentAwareFillState.deactivate();
    this.rightPanelTab.set('layers');
  }

  onContentAwareFillCancel(): void {
    this.contentAwareFillState.deactivate();
    this.rightPanelTab.set('layers');
  }

  private hexToRgba(hex: string): [number, number, number, number] {
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      return [
        parseInt(clean.substring(0, 2), 16),
        parseInt(clean.substring(2, 4), 16),
        parseInt(clean.substring(4, 6), 16),
        255,
      ];
    } else if (clean.length === 8) {
      return [
        parseInt(clean.substring(0, 2), 16),
        parseInt(clean.substring(2, 4), 16),
        parseInt(clean.substring(4, 6), 16),
        parseInt(clean.substring(6, 8), 16),
      ];
    }
    return [0, 0, 0, 255];
  }

  private rgbaToHex(r: number, g: number, b: number, a: number): string {
    if (a === 0) return '';
    const rh = r.toString(16).padStart(2, '0');
    const gh = g.toString(16).padStart(2, '0');
    const bh = b.toString(16).padStart(2, '0');
    const ah = a.toString(16).padStart(2, '0');
    return `#${rh}${gh}${bh}${ah}`;
  }

  private buildMaskData(
    x: number,
    y: number,
    width: number,
    height: number,
    shape: 'rect' | 'ellipse' | 'lasso',
    mask: Set<string> | null,
    polygon: { x: number; y: number }[] | null
  ): Uint8Array {
    const maskData = new Uint8Array(width * height);

    if (mask) {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const key = `${x + px},${y + py}`;
          maskData[py * width + px] = mask.has(key) ? 255 : 0;
        }
      }
    } else if (shape === 'rect') {
      maskData.fill(255);
    } else if (shape === 'ellipse') {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width / 2;
      const ry = height / 2;
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const dx = (px - cx) / rx;
          const dy = (py - cy) / ry;
          maskData[py * width + px] = dx * dx + dy * dy <= 1 ? 255 : 0;
        }
      }
    } else if (shape === 'lasso' && polygon) {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const gx = x + px;
          const gy = y + py;
          if (this.pointInPolygon(gx, gy, polygon)) {
            maskData[py * width + px] = 255;
          }
        }
      }
    }
    return maskData;
  }

  private pointInPolygon(
    x: number,
    y: number,
    polygon: { x: number; y: number }[]
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  onDefinePatternToggle(): void {
    this.rightPanelTab.set('definePattern');
  }

  onDefinePatternCancel(): void {
    this.definePatternState.deactivate();
    this.rightPanelTab.set('layers');
  }
}
