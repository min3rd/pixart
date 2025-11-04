import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorDocumentService } from '../../../services/editor-document.service';
import { EditorToolsService } from '../../../services/editor-tools.service';
import { GradientType, ToolId } from '../../../services/tools/tool.types';
import { NgIcon } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CommonModule } from '@angular/common';
import { HotkeysService } from '../../../services/hotkeys.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'pa-tool-palette',
  templateUrl: './tool-palette.component.html',
  styleUrls: ['./tool-palette.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIcon, TranslocoPipe, FormsModule, TooltipDirective],
  host: {
    class: 'block h-full',
  },
})
export class ToolPalette {
  readonly document = inject(EditorDocumentService);
  readonly tools = inject(EditorToolsService);
  readonly hotkeys = inject(HotkeysService);

  select(id: ToolId) {
    this.tools.selectTool(id);
  }

  getToolHotkeyId(toolId: ToolId): string {
    const mapping: Record<ToolId, string> = {
      'select-layer': 'tool.selectLayer',
      'rect-select': 'tool.rectSelect',
      'ellipse-select': 'tool.ellipseSelect',
      'lasso-select': 'tool.lassoSelect',
      'eyedropper': 'tool.eyedropper',
      'fill': 'tool.fill',
      'eraser': 'tool.eraser',
      'line': 'tool.line',
      'circle': 'tool.circle',
      'square': 'tool.square',
      'brush': 'tool.brush',
      'bone': 'tool.bone',
    };
    return mapping[toolId] || '';
  }

  getToolTooltipKey(toolId: ToolId): string {
    const mapping: Record<ToolId, string> = {
      'select-layer': 'tooltips.tools.selectLayer',
      'rect-select': 'tooltips.tools.rectSelect',
      'ellipse-select': 'tooltips.tools.ellipseSelect',
      'lasso-select': 'tooltips.tools.lassoSelect',
      'eyedropper': 'tooltips.tools.eyedropper',
      'fill': 'tooltips.tools.fill',
      'eraser': 'tooltips.tools.eraser',
      'line': 'tooltips.tools.line',
      'circle': 'tooltips.tools.circle',
      'square': 'tooltips.tools.square',
      'brush': 'tooltips.tools.brush',
      'bone': 'tooltips.tools.bone',
    };
    return mapping[toolId] || '';
  }

  setFillMode(mode: 'color' | 'erase') {
    this.tools.setFillMode(mode);
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
}
