import { Injectable, inject, signal } from '@angular/core';
import {
  FillToolMode,
  GradientType,
  PenLineMode,
  PixelFontFamily,
  ToolDefinition,
  ToolHistoryAdapter,
  ToolId,
  ToolMetaKey,
  ToolRestoreContext,
  ToolService,
  ToolSnapshot,
} from './tools/tool.types';
import { BrushToolService } from './tools/brush-tool.service';
import { CircleToolService } from './tools/circle-tool.service';
import { EllipseSelectToolService } from './tools/ellipse-select-tool.service';
import { EraserToolService } from './tools/eraser-tool.service';
import { EyedropperToolService } from './tools/eyedropper-tool.service';
import { FillToolService } from './tools/fill-tool.service';
import { LassoSelectToolService } from './tools/lasso-select-tool.service';
import { LineToolService } from './tools/line-tool.service';
import { PenToolService } from './tools/pen-tool.service';
import { RectSelectToolService } from './tools/rect-select-tool.service';
import { SelectLayerToolService } from './tools/select-layer-tool.service';
import { SquareToolService } from './tools/square-tool.service';
import { BoneToolService } from './tools/bone-tool.service';
import { SmartSelectToolService } from './tools/smart-select-tool.service';
import { TextToolService, VALID_PIXEL_FONTS } from './tools/text-tool.service';

@Injectable({ providedIn: 'root' })
export class EditorToolsService {
  private readonly STORAGE_KEY = 'pixart.editor.settings.v1';
  private historyAdapter?: ToolHistoryAdapter;

  private readonly selectLayerTool = inject(SelectLayerToolService);
  private readonly rectSelectTool = inject(RectSelectToolService);
  private readonly ellipseSelectTool = inject(EllipseSelectToolService);
  private readonly lassoSelectTool = inject(LassoSelectToolService);
  private readonly smartSelectTool = inject(SmartSelectToolService);
  private readonly eyedropperTool = inject(EyedropperToolService);
  private readonly fillTool = inject(FillToolService);
  private readonly brushTool = inject(BrushToolService);
  private readonly eraserTool = inject(EraserToolService);
  private readonly lineTool = inject(LineToolService);
  private readonly penTool = inject(PenToolService);
  private readonly circleTool = inject(CircleToolService);
  private readonly squareTool = inject(SquareToolService);
  private readonly boneTool = inject(BoneToolService);
  private readonly textTool = inject(TextToolService);

  private readonly toolRegistry = new Map<ToolId, ToolService>([
    ['select-layer', this.selectLayerTool],
    ['rect-select', this.rectSelectTool],
    ['ellipse-select', this.ellipseSelectTool],
    ['lasso-select', this.lassoSelectTool],
    ['smart-select', this.smartSelectTool],
    ['eyedropper', this.eyedropperTool],
    ['fill', this.fillTool],
    ['brush', this.brushTool],
    ['eraser', this.eraserTool],
    ['line', this.lineTool],
    ['pen', this.penTool],
    ['circle', this.circleTool],
    ['square', this.squareTool],
    ['bone', this.boneTool],
    ['text', this.textTool],
  ]);

  readonly tools = signal<ToolDefinition[]>(
    Array.from(this.toolRegistry.values()).map((service) => service.definition),
  );

  readonly currentTool = signal<ToolId>('select-layer');
  readonly fillColor = this.fillTool.color.asReadonly();
  readonly fillMode = this.fillTool.mode.asReadonly();
  readonly fillPatternId = this.fillTool.patternId.asReadonly();
  readonly fillGradientStartColor =
    this.fillTool.gradientStartColor.asReadonly();
  readonly fillGradientEndColor = this.fillTool.gradientEndColor.asReadonly();
  readonly fillGradientType = this.fillTool.gradientType.asReadonly();
  readonly fillGradientAngle = this.fillTool.gradientAngle.asReadonly();
  readonly brushSize = this.brushTool.size.asReadonly();
  readonly brushColor = this.brushTool.color.asReadonly();
  readonly eraserSize = this.eraserTool.size.asReadonly();
  readonly eraserStrength = this.eraserTool.strength.asReadonly();
  readonly lineThickness = this.lineTool.thickness.asReadonly();
  readonly lineColor = this.lineTool.color.asReadonly();
  readonly penThickness = this.penTool.thickness.asReadonly();
  readonly penColor = this.penTool.color.asReadonly();
  readonly penLineMode = this.penTool.lineMode.asReadonly();
  readonly circleStrokeThickness = this.circleTool.strokeThickness.asReadonly();
  readonly circleStrokeColor = this.circleTool.strokeColor.asReadonly();
  readonly circleFillMode = this.circleTool.fillMode.asReadonly();
  readonly circleFillColor = this.circleTool.fillColor.asReadonly();
  readonly circleGradientStartColor =
    this.circleTool.gradientStartColor.asReadonly();
  readonly circleGradientEndColor =
    this.circleTool.gradientEndColor.asReadonly();
  readonly circleGradientType = this.circleTool.gradientType.asReadonly();
  readonly circleGradientAngle = this.circleTool.gradientAngle.asReadonly();
  readonly squareStrokeThickness = this.squareTool.strokeThickness.asReadonly();
  readonly squareStrokeColor = this.squareTool.strokeColor.asReadonly();
  readonly squareFillMode = this.squareTool.fillMode.asReadonly();
  readonly squareFillColor = this.squareTool.fillColor.asReadonly();
  readonly squareGradientStartColor =
    this.squareTool.gradientStartColor.asReadonly();
  readonly squareGradientEndColor =
    this.squareTool.gradientEndColor.asReadonly();
  readonly squareGradientType = this.squareTool.gradientType.asReadonly();
  readonly squareGradientAngle = this.squareTool.gradientAngle.asReadonly();
  readonly boneThickness = this.boneTool.thickness.asReadonly();
  readonly boneColor = this.boneTool.color.asReadonly();
  readonly boneAutoBindEnabled = this.boneTool.autoBindEnabled.asReadonly();
  readonly boneAutoBindRadius = this.boneTool.autoBindRadius.asReadonly();
  readonly eyedropperLastPickedColor =
    this.eyedropperTool.lastPickedColor.asReadonly();
  readonly eyedropperLastPickedColorRGB =
    this.eyedropperTool.lastPickedColorRGB;
  readonly eyedropperLastPickedColorHSL =
    this.eyedropperTool.lastPickedColorHSL;
  readonly smartSelectTolerance = this.smartSelectTool.tolerance.asReadonly();
  readonly smartSelectMode = this.smartSelectTool.mode.asReadonly();
  readonly textContent = this.textTool.content.asReadonly();
  readonly textFontFamily = this.textTool.fontFamily.asReadonly();
  readonly textFontSize = this.textTool.fontSize.asReadonly();
  readonly textColor = this.textTool.color.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  private hasTool(id: ToolId): boolean {
    return this.toolRegistry.has(id);
  }

  registerHistoryAdapter(adapter: ToolHistoryAdapter) {
    this.historyAdapter = adapter;
    for (const service of this.toolRegistry.values()) {
      service.connectHistory?.(adapter);
    }
  }

  selectTool(id: ToolId) {
    if (!this.hasTool(id)) return;
    const prev = this.currentTool();
    if (prev === id) return;
    this.historyAdapter?.('currentTool', prev, id);
    this.currentTool.set(id);
    this.saveToStorage();
  }

  setFillColor(color: string) {
    this.fillTool.setColor(color);
    this.saveToStorage();
  }

  setFillMode(mode: FillToolMode) {
    this.fillTool.setMode(mode);
    this.saveToStorage();
  }

  setFillPatternId(patternId: string) {
    this.fillTool.setPatternId(patternId);
    this.saveToStorage();
  }

  setFillGradientStartColor(color: string) {
    this.fillTool.setGradientStartColor(color);
    this.saveToStorage();
  }

  setFillGradientEndColor(color: string) {
    this.fillTool.setGradientEndColor(color);
    this.saveToStorage();
  }

  setFillGradientType(type: 'linear' | 'radial') {
    this.fillTool.setGradientType(type);
    this.saveToStorage();
  }

  setFillGradientAngle(angle: number) {
    this.fillTool.setGradientAngle(angle);
    this.saveToStorage();
  }

  setBrushSize(size: number, max?: number) {
    this.brushTool.setSize(size, max);
    this.saveToStorage();
  }

  setBrushColor(color: string) {
    this.brushTool.setColor(color);
    this.saveToStorage();
  }

  setEraserSize(size: number, max?: number) {
    this.eraserTool.setSize(size, max);
    this.saveToStorage();
  }

  setEraserStrength(strength: number) {
    this.eraserTool.setStrength(strength);
    this.saveToStorage();
  }

  setLineThickness(value: number, max?: number) {
    this.lineTool.setThickness(value, max);
    this.saveToStorage();
  }

  setLineColor(color: string) {
    this.lineTool.setColor(color);
    this.saveToStorage();
  }

  setPenThickness(value: number, max?: number) {
    this.penTool.setThickness(value, max);
    this.saveToStorage();
  }

  setPenColor(color: string) {
    this.penTool.setColor(color);
    this.saveToStorage();
  }

  setPenLineMode(mode: PenLineMode) {
    this.penTool.setLineMode(mode);
    this.saveToStorage();
  }

  setCircleStrokeThickness(value: number, max?: number) {
    this.circleTool.setStrokeThickness(value, max);
    this.saveToStorage();
  }

  setCircleStrokeColor(color: string) {
    this.circleTool.setStrokeColor(color);
    this.saveToStorage();
  }

  setCircleFillMode(mode: 'solid' | 'gradient') {
    this.circleTool.setFillMode(mode);
    this.saveToStorage();
  }

  setCircleFillColor(color: string) {
    this.circleTool.setFillColor(color);
    this.saveToStorage();
  }

  setCircleGradientStartColor(color: string) {
    this.circleTool.setGradientStartColor(color);
    this.saveToStorage();
  }

  setCircleGradientEndColor(color: string) {
    this.circleTool.setGradientEndColor(color);
    this.saveToStorage();
  }

  setCircleGradientType(type: GradientType) {
    this.circleTool.setGradientType(type);
    this.saveToStorage();
  }

  setCircleGradientAngle(angle: number) {
    this.circleTool.setGradientAngle(angle);
    this.saveToStorage();
  }

  setSquareStrokeThickness(value: number, max?: number) {
    this.squareTool.setStrokeThickness(value, max);
    this.saveToStorage();
  }

  setSquareStrokeColor(color: string) {
    this.squareTool.setStrokeColor(color);
    this.saveToStorage();
  }

  setSquareFillMode(mode: 'solid' | 'gradient') {
    this.squareTool.setFillMode(mode);
    this.saveToStorage();
  }

  setSquareFillColor(color: string) {
    this.squareTool.setFillColor(color);
    this.saveToStorage();
  }

  setSquareGradientStartColor(color: string) {
    this.squareTool.setGradientStartColor(color);
    this.saveToStorage();
  }

  setSquareGradientEndColor(color: string) {
    this.squareTool.setGradientEndColor(color);
    this.saveToStorage();
  }

  setSquareGradientType(type: GradientType) {
    this.squareTool.setGradientType(type);
    this.saveToStorage();
  }

  setSquareGradientAngle(angle: number) {
    this.squareTool.setGradientAngle(angle);
    this.saveToStorage();
  }

  setBoneThickness(value: number, max?: number) {
    this.boneTool.setThickness(value, max);
    this.saveToStorage();
  }

  setBoneColor(color: string) {
    this.boneTool.setColor(color);
    this.saveToStorage();
  }

  setBoneAutoBindEnabled(enabled: boolean) {
    this.boneTool.setAutoBindEnabled(enabled);
    this.saveToStorage();
  }

  setBoneAutoBindRadius(radius: number) {
    this.boneTool.setAutoBindRadius(radius);
    this.saveToStorage();
  }

  setEyedropperLastPickedColor(color: string) {
    this.eyedropperTool.setLastPickedColor(color);
  }

  setSmartSelectTolerance(tolerance: number) {
    this.smartSelectTool.setTolerance(tolerance);
    this.saveToStorage();
  }

  setSmartSelectMode(mode: 'normal' | 'add' | 'subtract') {
    this.smartSelectTool.setMode(mode);
  }

  getSmartSelectToolService() {
    return this.smartSelectTool;
  }

  setTextContent(content: string) {
    this.textTool.setContent(content);
    this.saveToStorage();
  }

  setTextFontFamily(fontFamily: PixelFontFamily) {
    this.textTool.setFontFamily(fontFamily);
    this.saveToStorage();
  }

  setTextFontSize(size: number) {
    this.textTool.setFontSize(size);
    this.saveToStorage();
  }

  setTextColor(color: string) {
    this.textTool.setColor(color);
    this.saveToStorage();
  }

  applySnapshot(snapshot: Partial<ToolSnapshot>, context?: ToolRestoreContext) {
    if (!snapshot) return;
    if (snapshot.currentTool && this.hasTool(snapshot.currentTool)) {
      this.currentTool.set(snapshot.currentTool);
    }
    this.fillTool.restore(snapshot.fill);
    this.brushTool.restore(snapshot.brush, context);
    this.eraserTool.restore(snapshot.eraser, context);
    this.lineTool.restore(snapshot.line, context);
    this.penTool.restore(snapshot.pen, context);
    this.circleTool.restore(snapshot.circle);
    this.squareTool.restore(snapshot.square);
    this.boneTool.restore(snapshot.bone, context);
    this.smartSelectTool.restore(snapshot.smartSelect);
    this.textTool.restore(snapshot.text);
    this.saveToStorage();
  }

  applyMeta(key: ToolMetaKey, value: unknown) {
    if (key === 'currentTool') {
      if (typeof value === 'string' && this.hasTool(value as ToolId)) {
        this.currentTool.set(value as ToolId);
        this.saveToStorage();
      }
      return;
    }

    if (key === 'smartSelectTolerance') {
      if (typeof value === 'number') {
        this.smartSelectTool.setTolerance(value);
        this.saveToStorage();
      }
      return;
    }

    const handled =
      (this.fillTool.applyMeta?.(key, value) ?? false) ||
      (this.brushTool.applyMeta?.(key, value) ?? false) ||
      (this.eraserTool.applyMeta?.(key, value) ?? false) ||
      (this.lineTool.applyMeta?.(key, value) ?? false) ||
      (this.penTool.applyMeta?.(key, value) ?? false) ||
      (this.circleTool.applyMeta?.(key, value) ?? false) ||
      (this.squareTool.applyMeta?.(key, value) ?? false) ||
      (this.boneTool.applyMeta?.(key, value) ?? false) ||
      (this.textTool.applyMeta?.(key, value) ?? false);

    if (handled) {
      this.saveToStorage();
    }
  }

  snapshot(): ToolSnapshot {
    return {
      currentTool: this.currentTool(),
      fill: this.fillTool.snapshot(),
      brush: this.brushTool.snapshot(),
      eraser: this.eraserTool.snapshot(),
      line: this.lineTool.snapshot(),
      pen: this.penTool.snapshot(),
      circle: this.circleTool.snapshot(),
      square: this.squareTool.snapshot(),
      bone: this.boneTool.snapshot(),
      smartSelect: this.smartSelectTool.snapshot(),
      text: this.textTool.snapshot(),
    };
  }

  private saveToStorage() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const data = {
        currentTool: this.currentTool(),
        fillColor: this.fillTool.color(),
        fillMode: this.fillTool.mode(),
        fillPatternId: this.fillTool.patternId(),
        fillGradientStartColor: this.fillTool.gradientStartColor(),
        fillGradientEndColor: this.fillTool.gradientEndColor(),
        fillGradientType: this.fillTool.gradientType(),
        fillGradientAngle: this.fillTool.gradientAngle(),
        brushSize: this.brushTool.size(),
        brushColor: this.brushTool.color(),
        eraserStrength: this.eraserTool.strength(),
        eraserSize: this.eraserTool.size(),
        lineThickness: this.lineTool.thickness(),
        lineColor: this.lineTool.color(),
        penThickness: this.penTool.thickness(),
        penColor: this.penTool.color(),
        penLineMode: this.penTool.lineMode(),
        circleStrokeThickness: this.circleTool.strokeThickness(),
        circleStrokeColor: this.circleTool.strokeColor(),
        circleFillMode: this.circleTool.fillMode(),
        circleFillColor: this.circleTool.fillColor(),
        circleGradientStartColor: this.circleTool.gradientStartColor(),
        circleGradientEndColor: this.circleTool.gradientEndColor(),
        circleGradientType: this.circleTool.gradientType(),
        circleGradientAngle: this.circleTool.gradientAngle(),
        squareStrokeThickness: this.squareTool.strokeThickness(),
        squareStrokeColor: this.squareTool.strokeColor(),
        squareFillMode: this.squareTool.fillMode(),
        squareFillColor: this.squareTool.fillColor(),
        squareGradientStartColor: this.squareTool.gradientStartColor(),
        squareGradientEndColor: this.squareTool.gradientEndColor(),
        squareGradientType: this.squareTool.gradientType(),
        squareGradientAngle: this.squareTool.gradientAngle(),
        boneThickness: this.boneTool.thickness(),
        boneColor: this.boneTool.color(),
        boneAutoBindEnabled: this.boneTool.autoBindEnabled(),
        boneAutoBindRadius: this.boneTool.autoBindRadius(),
        smartSelectTolerance: this.smartSelectTool.tolerance(),
        textContent: this.textTool.content(),
        textFontFamily: this.textTool.fontFamily(),
        textFontSize: this.textTool.fontSize(),
        textColor: this.textTool.color(),
      } as const;
      window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  private loadFromStorage() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        currentTool: ToolId;
        fillColor: string;
        fillMode: FillToolMode;
        fillPatternId: string;
        fillGradientStartColor: string;
        fillGradientEndColor: string;
        fillGradientType: 'linear' | 'radial';
        fillGradientAngle: number;
        brushSize: number;
        brushColor: string;
        eraserStrength: number;
        eraserSize: number;
        lineThickness: number;
        lineColor: string;
        penThickness: number;
        penColor: string;
        penLineMode: PenLineMode;
        circleStrokeThickness: number;
        circleStrokeColor: string;
        circleFillMode: 'solid' | 'gradient';
        circleFillColor: string;
        circleGradientStartColor: string;
        circleGradientEndColor: string;
        circleGradientType: GradientType;
        circleGradientAngle: number;
        squareStrokeThickness: number;
        squareStrokeColor: string;
        squareFillMode: 'solid' | 'gradient';
        squareFillColor: string;
        squareGradientStartColor: string;
        squareGradientEndColor: string;
        squareGradientType: GradientType;
        squareGradientAngle: number;
        circleColor: string;
        squareColor: string;
        boneThickness: number;
        boneColor: string;
        boneAutoBindEnabled: boolean;
        boneAutoBindRadius: number;
        smartSelectTolerance: number;
        textContent: string;
        textFontFamily: PixelFontFamily;
        textFontSize: number;
        textColor: string;
      }> | null;
      if (!parsed) return;
      if (parsed.currentTool && this.hasTool(parsed.currentTool)) {
        this.currentTool.set(parsed.currentTool);
      }
      const fillSnapshot: Partial<ToolSnapshot['fill']> = {};
      if (typeof parsed.fillColor === 'string' && parsed.fillColor.length) {
        fillSnapshot.color = parsed.fillColor;
      }
      if (
        parsed.fillMode === 'color' ||
        parsed.fillMode === 'erase' ||
        parsed.fillMode === 'pattern' ||
        parsed.fillMode === 'gradient'
      ) {
        fillSnapshot.mode = parsed.fillMode;
      }
      if (
        typeof parsed.fillPatternId === 'string' &&
        parsed.fillPatternId.length
      ) {
        fillSnapshot.patternId = parsed.fillPatternId;
      }
      if (
        typeof parsed.fillGradientStartColor === 'string' &&
        parsed.fillGradientStartColor.length
      ) {
        fillSnapshot.gradientStartColor = parsed.fillGradientStartColor;
      }
      if (
        typeof parsed.fillGradientEndColor === 'string' &&
        parsed.fillGradientEndColor.length
      ) {
        fillSnapshot.gradientEndColor = parsed.fillGradientEndColor;
      }
      if (
        parsed.fillGradientType === 'linear' ||
        parsed.fillGradientType === 'radial'
      ) {
        fillSnapshot.gradientType = parsed.fillGradientType;
      }
      if (typeof parsed.fillGradientAngle === 'number') {
        fillSnapshot.gradientAngle = parsed.fillGradientAngle;
      }
      const brushSnapshot: Partial<ToolSnapshot['brush']> = {};
      if (typeof parsed.brushSize === 'number') {
        brushSnapshot.size = parsed.brushSize;
      }
      if (typeof parsed.brushColor === 'string') {
        brushSnapshot.color = parsed.brushColor;
      }
      const eraserSnapshot: Partial<ToolSnapshot['eraser']> = {};
      if (typeof parsed.eraserSize === 'number') {
        eraserSnapshot.size = parsed.eraserSize;
      }
      if (typeof parsed.eraserStrength === 'number') {
        eraserSnapshot.strength = parsed.eraserStrength;
      }
      const lineSnapshot: Partial<ToolSnapshot['line']> = {};
      if (typeof parsed.lineThickness === 'number') {
        lineSnapshot.thickness = parsed.lineThickness;
      }
      if (typeof parsed.lineColor === 'string' && parsed.lineColor.length) {
        lineSnapshot.color = parsed.lineColor;
      }
      const penSnapshot: Partial<ToolSnapshot['pen']> = {};
      if (typeof parsed.penThickness === 'number') {
        penSnapshot.thickness = parsed.penThickness;
      }
      if (typeof parsed.penColor === 'string' && parsed.penColor.length) {
        penSnapshot.color = parsed.penColor;
      }
      if (parsed.penLineMode === 'polyline' || parsed.penLineMode === 'spline') {
        penSnapshot.lineMode = parsed.penLineMode;
      }
      const circleSnapshot: Partial<ToolSnapshot['circle']> = {};
      if (typeof parsed.circleStrokeThickness === 'number') {
        circleSnapshot.strokeThickness = parsed.circleStrokeThickness;
      }
      if (
        typeof parsed.circleStrokeColor === 'string' &&
        parsed.circleStrokeColor.length
      ) {
        circleSnapshot.strokeColor = parsed.circleStrokeColor;
      }
      if (
        parsed.circleFillMode === 'solid' ||
        parsed.circleFillMode === 'gradient'
      ) {
        circleSnapshot.fillMode = parsed.circleFillMode;
      }
      if (
        typeof parsed.circleFillColor === 'string' &&
        parsed.circleFillColor.length
      ) {
        circleSnapshot.fillColor = parsed.circleFillColor;
      }
      if (
        typeof parsed.circleGradientStartColor === 'string' &&
        parsed.circleGradientStartColor.length
      ) {
        circleSnapshot.gradientStartColor = parsed.circleGradientStartColor;
      }
      if (
        typeof parsed.circleGradientEndColor === 'string' &&
        parsed.circleGradientEndColor.length
      ) {
        circleSnapshot.gradientEndColor = parsed.circleGradientEndColor;
      }
      if (
        parsed.circleGradientType === 'linear' ||
        parsed.circleGradientType === 'radial'
      ) {
        circleSnapshot.gradientType = parsed.circleGradientType;
      }
      if (
        typeof parsed.circleGradientAngle === 'number' &&
        !Number.isNaN(parsed.circleGradientAngle)
      ) {
        circleSnapshot.gradientAngle = parsed.circleGradientAngle;
      }
      if (
        !circleSnapshot.fillColor &&
        typeof parsed.circleColor === 'string' &&
        parsed.circleColor.length
      ) {
        circleSnapshot.fillColor = parsed.circleColor;
      }
      const squareSnapshot: Partial<ToolSnapshot['square']> = {};
      if (typeof parsed.squareStrokeThickness === 'number') {
        squareSnapshot.strokeThickness = parsed.squareStrokeThickness;
      }
      if (
        typeof parsed.squareStrokeColor === 'string' &&
        parsed.squareStrokeColor.length
      ) {
        squareSnapshot.strokeColor = parsed.squareStrokeColor;
      }
      if (
        parsed.squareFillMode === 'solid' ||
        parsed.squareFillMode === 'gradient'
      ) {
        squareSnapshot.fillMode = parsed.squareFillMode;
      }
      if (
        typeof parsed.squareFillColor === 'string' &&
        parsed.squareFillColor.length
      ) {
        squareSnapshot.fillColor = parsed.squareFillColor;
      }
      if (
        typeof parsed.squareGradientStartColor === 'string' &&
        parsed.squareGradientStartColor.length
      ) {
        squareSnapshot.gradientStartColor = parsed.squareGradientStartColor;
      }
      if (
        typeof parsed.squareGradientEndColor === 'string' &&
        parsed.squareGradientEndColor.length
      ) {
        squareSnapshot.gradientEndColor = parsed.squareGradientEndColor;
      }
      if (
        parsed.squareGradientType === 'linear' ||
        parsed.squareGradientType === 'radial'
      ) {
        squareSnapshot.gradientType = parsed.squareGradientType;
      }
      if (
        typeof parsed.squareGradientAngle === 'number' &&
        !Number.isNaN(parsed.squareGradientAngle)
      ) {
        squareSnapshot.gradientAngle = parsed.squareGradientAngle;
      }
      if (
        !squareSnapshot.fillColor &&
        typeof parsed.squareColor === 'string' &&
        parsed.squareColor.length
      ) {
        squareSnapshot.fillColor = parsed.squareColor;
      }
      const boneSnapshot: Partial<ToolSnapshot['bone']> = {};
      if (typeof parsed.boneThickness === 'number') {
        boneSnapshot.thickness = parsed.boneThickness;
      }
      if (typeof parsed.boneColor === 'string' && parsed.boneColor.length) {
        boneSnapshot.color = parsed.boneColor;
      }
      if (typeof parsed.boneAutoBindEnabled === 'boolean') {
        boneSnapshot.autoBindEnabled = parsed.boneAutoBindEnabled;
      }
      if (typeof parsed.boneAutoBindRadius === 'number') {
        boneSnapshot.autoBindRadius = parsed.boneAutoBindRadius;
      }
      const smartSelectSnapshot: Partial<ToolSnapshot['smartSelect']> = {};
      if (typeof parsed.smartSelectTolerance === 'number') {
        smartSelectSnapshot.tolerance = parsed.smartSelectTolerance;
      }
      const textSnapshot: Partial<ToolSnapshot['text']> = {};
      if (typeof parsed.textContent === 'string') {
        textSnapshot.content = parsed.textContent;
      }
      if (parsed.textFontFamily && VALID_PIXEL_FONTS.includes(parsed.textFontFamily)) {
        textSnapshot.fontFamily = parsed.textFontFamily;
      }
      if (typeof parsed.textFontSize === 'number') {
        textSnapshot.fontSize = parsed.textFontSize;
      }
      if (typeof parsed.textColor === 'string' && parsed.textColor.length) {
        textSnapshot.color = parsed.textColor;
      }
      this.fillTool.restore(fillSnapshot);
      this.brushTool.restore(brushSnapshot);
      this.eraserTool.restore(eraserSnapshot);
      this.lineTool.restore(lineSnapshot);
      this.penTool.restore(penSnapshot);
      this.circleTool.restore(circleSnapshot);
      this.squareTool.restore(squareSnapshot);
      this.boneTool.restore(boneSnapshot);
      this.smartSelectTool.restore(smartSelectSnapshot);
      this.textTool.restore(textSnapshot);
    } catch {}
  }
}
