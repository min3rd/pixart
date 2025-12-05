import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorDocumentService } from '../../../services/editor-document.service';
import { EditorToolsService } from '../../../services/editor-tools.service';
import { FillToolMode, GradientType, PenLineMode, PixelFontFamily, ToolId } from '../../../services/tools/tool.types';
import { NgIcon } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CommonModule } from '@angular/common';
import { HotkeysService } from '../../../services/hotkeys.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { PaletteService } from '../../../services/palette.service';
import { PIXEL_FONTS } from '../../../services/tools/text-tool.service';

type LineToolVariant = 'line' | 'pen';

const LINE_TOOL_VARIANTS: readonly ToolId[] = ['line', 'pen'] as const;

@Component({
  selector: 'pa-tool-palette',
  templateUrl: './tool-palette.component.html',
  styleUrls: ['./tool-palette.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIcon, TranslocoPipe, FormsModule, TooltipDirective],
  host: {
    class: 'block h-full',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class ToolPalette {
  readonly document = inject(EditorDocumentService);
  readonly tools = inject(EditorToolsService);
  readonly hotkeys = inject(HotkeysService);
  readonly paletteService = inject(PaletteService);

  readonly lineToolVariant = signal<LineToolVariant>('line');
  readonly lineToolPopupVisible = signal(false);
  readonly palettePickerVisible = signal(false);
  readonly palettePickerTarget = signal<string | null>(null);

  readonly filteredTools = computed(() =>
    this.tools.tools().filter((t) => !LINE_TOOL_VARIANTS.includes(t.id))
  );

  readonly lineToolIcon = computed(() =>
    this.lineToolVariant() === 'line' ? 'bootstrapSlashLg' : 'bootstrapPen'
  );

  readonly lineToolLabelKey = computed(() =>
    this.lineToolVariant() === 'line' ? 'tools.line' : 'tools.pen'
  );

  readonly lineToolTooltipKey = computed(() =>
    this.lineToolVariant() === 'line'
      ? 'tooltips.tools.line'
      : 'tooltips.tools.pen'
  );

  readonly isLineToolActive = computed(() =>
    LINE_TOOL_VARIANTS.includes(this.tools.currentTool())
  );

  showPalettePicker(target: string): void {
    this.palettePickerTarget.set(target);
    this.palettePickerVisible.set(true);
  }

  hidePalettePicker(): void {
    this.palettePickerVisible.set(false);
    this.palettePickerTarget.set(null);
  }

  onPaletteColorPick(color: string): void {
    const target = this.palettePickerTarget();
    if (!target) return;

    switch (target) {
      case 'brush':
        this.tools.setBrushColor(color);
        break;
      case 'fill':
        this.tools.setFillColor(color);
        break;
      case 'line':
        this.tools.setLineColor(color);
        break;
      case 'pen':
        this.tools.setPenColor(color);
        break;
      case 'circle-stroke':
        this.tools.setCircleStrokeColor(color);
        break;
      case 'circle-fill':
        this.tools.setCircleFillColor(color);
        break;
      case 'square-stroke':
        this.tools.setSquareStrokeColor(color);
        break;
      case 'square-fill':
        this.tools.setSquareFillColor(color);
        break;
      case 'bone':
        this.tools.setBoneColor(color);
        break;
      case 'text':
        this.tools.setTextColor(color);
        break;
    }
    this.hidePalettePicker();
  }

  select(id: ToolId) {
    this.tools.selectTool(id);
  }

  toggleLineToolPopup(event: Event) {
    event.stopPropagation();
    this.lineToolPopupVisible.update((v) => !v);
  }

  selectLineToolVariant(variant: LineToolVariant) {
    this.lineToolVariant.set(variant);
    this.lineToolPopupVisible.set(false);
    this.tools.selectTool(variant);
  }

  onDocumentClick(event: Event) {
    const target = event.target;
    if (target instanceof HTMLElement && !target.closest('#tool-palette-line-group')) {
      this.lineToolPopupVisible.set(false);
    }
  }

  getToolHotkeyId(toolId: ToolId): string {
    const mapping: Record<ToolId, string> = {
      'select-layer': 'tool.selectLayer',
      'rect-select': 'tool.rectSelect',
      'ellipse-select': 'tool.ellipseSelect',
      'lasso-select': 'tool.lassoSelect',
      'smart-select': 'tool.smartSelect',
      eyedropper: 'tool.eyedropper',
      fill: 'tool.fill',
      eraser: 'tool.eraser',
      line: 'tool.line',
      pen: 'tool.pen',
      circle: 'tool.circle',
      square: 'tool.square',
      brush: 'tool.brush',
      bone: 'tool.bone',
      text: 'tool.text',
    };
    return mapping[toolId] || '';
  }

  getToolTooltipKey(toolId: ToolId): string {
    const mapping: Record<ToolId, string> = {
      'select-layer': 'tooltips.tools.selectLayer',
      'rect-select': 'tooltips.tools.rectSelect',
      'ellipse-select': 'tooltips.tools.ellipseSelect',
      'lasso-select': 'tooltips.tools.lassoSelect',
      'smart-select': 'tooltips.tools.smartSelect',
      eyedropper: 'tooltips.tools.eyedropper',
      fill: 'tooltips.tools.fill',
      eraser: 'tooltips.tools.eraser',
      line: 'tooltips.tools.line',
      pen: 'tooltips.tools.pen',
      circle: 'tooltips.tools.circle',
      square: 'tooltips.tools.square',
      brush: 'tooltips.tools.brush',
      bone: 'tooltips.tools.bone',
      text: 'tooltips.tools.text',
    };
    return mapping[toolId] || '';
  }

  onSmartSelectToleranceInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n)) {
      this.tools.setSmartSelectTolerance(Math.floor(n));
    }
  }

  setFillMode(mode: FillToolMode) {
    this.tools.setFillMode(mode);
  }

  onFillGradientStartInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setFillGradientStartColor(v);
  }

  onFillGradientEndInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setFillGradientEndColor(v);
  }

  setFillGradientType(type: GradientType) {
    this.tools.setFillGradientType(type);
  }

  onFillGradientAngleInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n)) {
      const clampedAngle = Math.max(0, Math.min(359, Math.round(n)));
      this.tools.setFillGradientAngle(clampedAngle);
    }
  }

  onFillColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setFillColor(v);
  }

  get maxCanvasDim() {
    return Math.max(
      1,
      Math.max(this.document.canvasWidth(), this.document.canvasHeight()),
    );
  }

  onBrushSizeInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n))
      this.tools.setBrushSize(Math.floor(n), this.maxCanvasDim);
  }

  onBrushColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setBrushColor(v);
  }

  onLineThicknessInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n))
      this.tools.setLineThickness(Math.floor(n), this.maxCanvasDim);
  }

  onLineColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setLineColor(v);
  }

  onPenThicknessInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n))
      this.tools.setPenThickness(Math.floor(n), this.maxCanvasDim);
  }

  onPenColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setPenColor(v);
  }

  setPenLineMode(mode: PenLineMode) {
    this.tools.setPenLineMode(mode);
  }

  onCircleStrokeThicknessInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n))
      this.tools.setCircleStrokeThickness(Math.floor(n), this.maxCanvasDim);
  }

  onCircleStrokeColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setCircleStrokeColor(v);
  }

  onCircleFillColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setCircleFillColor(v);
  }

  setCircleFillMode(mode: 'solid' | 'gradient') {
    this.tools.setCircleFillMode(mode);
  }

  onCircleGradientStartInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setCircleGradientStartColor(v);
  }

  onCircleGradientEndInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setCircleGradientEndColor(v);
  }

  setCircleGradientType(type: GradientType) {
    this.tools.setCircleGradientType(type === 'radial' ? 'radial' : 'linear');
  }

  onCircleGradientAngleInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n)) this.tools.setCircleGradientAngle(Math.round(n));
  }

  onSquareStrokeThicknessInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n))
      this.tools.setSquareStrokeThickness(Math.floor(n), this.maxCanvasDim);
  }

  onSquareStrokeColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setSquareStrokeColor(v);
  }

  onSquareFillColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setSquareFillColor(v);
  }

  setSquareFillMode(mode: 'solid' | 'gradient') {
    this.tools.setSquareFillMode(mode);
  }

  onSquareGradientStartInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setSquareGradientStartColor(v);
  }

  onSquareGradientEndInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setSquareGradientEndColor(v);
  }

  setSquareGradientType(type: GradientType) {
    this.tools.setSquareGradientType(type === 'radial' ? 'radial' : 'linear');
  }

  onSquareGradientAngleInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n)) this.tools.setSquareGradientAngle(Math.round(n));
  }

  onEraserSizeInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n))
      this.tools.setEraserSize(Math.floor(n), this.maxCanvasDim);
  }

  onEraserStrengthInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n)) this.tools.setEraserStrength(Math.floor(n));
  }

  onBoneThicknessInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n))
      this.tools.setBoneThickness(Math.floor(n), this.maxCanvasDim);
  }

  onBoneColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setBoneColor(v);
  }

  get autoBindEnabled(): boolean {
    return this.tools.boneAutoBindEnabled();
  }

  set autoBindEnabled(value: boolean) {
    this.tools.setBoneAutoBindEnabled(value);
  }

  get autoBindRadius(): number {
    return this.tools.boneAutoBindRadius();
  }

  set autoBindRadius(value: number) {
    this.tools.setBoneAutoBindRadius(value);
  }

  readonly saveToPaletteDialogVisible = signal(false);
  readonly saveToPaletteSelectedId = signal<string | null>(null);

  copyToClipboard(text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  showSaveToPaletteDialog(): void {
    const palettes = this.paletteService.palettes();
    if (palettes.length > 0) {
      this.saveToPaletteSelectedId.set(palettes[0].id);
    }
    this.saveToPaletteDialogVisible.set(true);
  }

  hideSaveToPaletteDialog(): void {
    this.saveToPaletteDialogVisible.set(false);
    this.saveToPaletteSelectedId.set(null);
  }

  onSaveToPaletteConfirm(): void {
    const color = this.tools.eyedropperLastPickedColor();
    const paletteId = this.saveToPaletteSelectedId();
    if (color && paletteId) {
      this.paletteService.addColorToPalette(paletteId, color);
    }
    this.hideSaveToPaletteDialog();
  }

  onCreateNewPaletteWithColor(): void {
    const color = this.tools.eyedropperLastPickedColor();
    if (color) {
      this.paletteService.createPalette('Picked Colors', [color]);
    }
    this.hideSaveToPaletteDialog();
  }

  usePickedColorAsBrush(): void {
    const color = this.tools.eyedropperLastPickedColor();
    if (color) {
      this.tools.setBrushColor(color);
      this.tools.selectTool('brush');
    }
  }

  readonly pixelFonts = PIXEL_FONTS;

  onTextContentInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setTextContent(v);
  }

  onTextFontFamilyChange(event: Event) {
    const v = (event.target as HTMLSelectElement).value as PixelFontFamily;
    this.tools.setTextFontFamily(v);
  }

  onTextFontSizeInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const n = Number(v);
    if (!Number.isNaN(n)) {
      this.tools.setTextFontSize(Math.floor(n));
    }
  }

  onTextColorInput(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.tools.setTextColor(v);
  }
}
