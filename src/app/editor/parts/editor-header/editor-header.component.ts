import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FileService } from '../../../services/file.service';
import { EditorDocumentService } from '../../../services/editor-document.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UserSettingsService } from '../../../services/user-settings.service';
import { NgIcon } from '@ng-icons/core';
import {
  InsertImageDialog,
  InsertImageResult,
} from '../../../shared/components/insert-image-dialog/insert-image-dialog.component';
import { EditorToolsService } from '../../../services/editor-tools.service';
import { HotkeysService } from '../../../services/hotkeys.service';
import { HotkeyConfigDialog } from '../../../shared/components/hotkey-config-dialog/hotkey-config-dialog.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { EditorTransformService } from '../../../services/editor/editor-transform.service';
import { EditorFreeTransformService } from '../../../services/editor/editor-free-transform.service';
import { EditorDistortService } from '../../../services/editor/editor-distort.service';
import { EditorPerspectiveService } from '../../../services/editor/editor-perspective.service';
import { EditorWarpService } from '../../../services/editor/editor-warp.service';
import { EditorPuppetWarpService } from '../../../services/editor/editor-puppet-warp.service';
import {
  ScaleDialog,
  ScaleResult,
} from '../../../shared/components/scale-dialog/scale-dialog';
import {
  RotateDialog,
  RotateResult,
} from '../../../shared/components/rotate-dialog/rotate-dialog';
import {
  SkewDialog,
  SkewResult,
} from '../../../shared/components/skew-dialog/skew-dialog';
import { WarpDialog } from '../../../shared/components/warp-dialog/warp-dialog';
import { PuppetWarpDialog } from '../../../shared/components/puppet-warp-dialog/puppet-warp-dialog';
import {
  ContentAwareScaleDialog,
  ContentAwareScaleResult,
} from '../../../shared/components/content-aware-scale-dialog/content-aware-scale-dialog';
import { EditorContentAwareScaleService } from '../../../services/editor/editor-content-aware-scale.service';
import { FillSelectionService } from '../../../services/editor/fill-selection.service';
import { FillSelectionDialog } from '../../../shared/components/fill-selection-dialog/fill-selection-dialog.component';
import { ContentAwareFillStateService } from '../../../services/editor/content-aware-fill-state.service';
import { DefinePatternService } from '../../../services/editor/define-pattern.service';
import { DefineBrushService } from '../../../services/editor/define-brush.service';
import { DefineShapeService } from '../../../services/editor/define-shape.service';
import { EditorStrokeService } from '../../../services/editor/editor-stroke.service';
import { PaletteService } from '../../../services/palette.service';
import {
  ImageSizeDialog,
  ImageSizeResult,
} from '../../../shared/components/image-size-dialog/image-size-dialog';
import { LanguageSelectorComponent } from '../../../shared/components/language-selector/language-selector.component';
import { LogViewerDialog } from '../../../shared/components/log-viewer-dialog/log-viewer-dialog.component';
import {
  ExportImageDialog,
  ExportImageResult,
} from '../../../shared/components/export-image-dialog/export-image-dialog.component';
import { EditorExportService } from '../../../services/editor/editor-export.service';
import { TimelineExportDialog } from '../../../shared/components/timeline-export-dialog/timeline-export-dialog.component';

@Component({
  selector: 'pa-editor-header',
  templateUrl: './editor-header.component.html',
  styleUrls: ['./editor-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    NgIcon,
    InsertImageDialog,
    HotkeyConfigDialog,
    TooltipDirective,
    ScaleDialog,
    RotateDialog,
    SkewDialog,
    WarpDialog,
    PuppetWarpDialog,
    ContentAwareScaleDialog,
    FillSelectionDialog,
    ImageSizeDialog,
    LanguageSelectorComponent,
    LogViewerDialog,
    ExportImageDialog,
    TimelineExportDialog,
  ],
  host: {
    class:
      'block w-full bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-800',
  },
})
export class EditorHeader {
  readonly fileService = inject(FileService);
  readonly document = inject(EditorDocumentService);
  readonly i18n = inject(TranslocoService);
  readonly settings = inject(UserSettingsService);
  readonly tools = inject(EditorToolsService);
  readonly hotkeys = inject(HotkeysService);
  readonly transform = inject(EditorTransformService);
  readonly freeTransform = inject(EditorFreeTransformService);
  readonly distort = inject(EditorDistortService);
  readonly perspective = inject(EditorPerspectiveService);
  readonly warp = inject(EditorWarpService);
  readonly puppetWarp = inject(EditorPuppetWarpService);
  readonly contentAwareScaleService = inject(EditorContentAwareScaleService);
  readonly contentAwareFillState = inject(ContentAwareFillStateService);
  readonly definePatternService = inject(DefinePatternService);
  readonly defineBrushService = inject(DefineBrushService);
  readonly defineShapeService = inject(DefineShapeService);
  readonly strokeService = inject(EditorStrokeService);
  readonly paletteService = inject(PaletteService);
  readonly exportService = inject(EditorExportService);
  readonly showFileMenu = signal(false);
  readonly showEditMenu = signal(false);
  readonly showInsertMenu = signal(false);
  readonly showToolMenu = signal(false);
  readonly showHelpMenu = signal(false);
  readonly showTransformMenu = signal(false);
  readonly showFillMenu = signal(false);
  readonly showPaletteMenu = signal(false);
  readonly showViewMenu = signal(false);
  readonly insertImageDialog = viewChild(InsertImageDialog);
  readonly hotkeyConfigDialog = viewChild(HotkeyConfigDialog);
  readonly logViewerDialog = viewChild(LogViewerDialog);
  readonly scaleDialog = viewChild(ScaleDialog);
  readonly rotateDialog = viewChild(RotateDialog);
  readonly skewDialog = viewChild(SkewDialog);
  readonly warpDialog = viewChild(WarpDialog);
  readonly puppetWarpDialog = viewChild(PuppetWarpDialog);
  readonly contentAwareScaleDialog = viewChild(ContentAwareScaleDialog);
  readonly fillSelectionDialog = viewChild(FillSelectionDialog);
  readonly imageSizeDialog = viewChild(ImageSizeDialog);
  readonly exportImageDialog = viewChild(ExportImageDialog);
  readonly timelineExportDialog = viewChild(TimelineExportDialog);
  readonly fillSelectionService = inject(FillSelectionService);
  readonly onContentAwareFillToggle = output<void>();
  readonly onDefinePatternToggle = output<void>();
  readonly onDefineBrushToggle = output<void>();
  readonly onDefineShapeToggle = output<void>();
  readonly onStrokeToggle = output<void>();
  readonly onPaletteManage = output<void>();
  private hoverOpenTimer?: number;
  private hoverCloseTimer?: number;
  private editHoverOpenTimer?: number;
  private editHoverCloseTimer?: number;
  private insertHoverOpenTimer?: number;
  private insertHoverCloseTimer?: number;
  private toolHoverOpenTimer?: number;
  private toolHoverCloseTimer?: number;
  private helpHoverOpenTimer?: number;
  private helpHoverCloseTimer?: number;
  private transformHoverOpenTimer?: number;
  private transformHoverCloseTimer?: number;
  private fillHoverOpenTimer?: number;
  private fillHoverCloseTimer?: number;
  private paletteHoverOpenTimer?: number;
  private paletteHoverCloseTimer?: number;
  private viewHoverOpenTimer?: number;
  private viewHoverCloseTimer?: number;

  async onNewProject() {
    this.document.resetToNewProject();
    this.showFileMenu.set(false);
  }
  async onOpen() {
    const parsed = await this.fileService.openProjectFromPicker();
    if (parsed) {
      try {
        this.document.restoreProjectSnapshot(parsed as any);
      } catch (e) {
        console.warn(
          'Open returned project but failed to restore into editor state',
          e,
        );
      }
    }
    this.showFileMenu.set(false);
  }

  async onOpenFromComputer() {
    // Use FileService open picker which falls back to input file when needed
    await this.onOpen();
  }
  async onSave() {
    // Save current project to localStorage via EditorDocumentService
    try {
      const ok = this.document.saveProjectToLocalStorage();
      if (ok) console.info('Project saved to localStorage');
    } catch (e) {
      console.error('Save failed', e);
    }
  }

  async onSaveToComputer() {
    try {
      const snapshot = this.document.exportProjectSnapshot();
      const name = `${(snapshot as any).name || 'project'}.pix`;
      this.fileService.exportProjectToDownload(snapshot as any, name);
    } catch (e) {
      console.error('Save to computer failed', e);
    }
    this.showFileMenu.set(false);
  }

  // Open the file menu when user hovers over the header. A short delay avoids
  // accidental flicker when moving the pointer across the header.
  openFileMenuHover() {
    // clear any pending close
    if (this.hoverCloseTimer) {
      clearTimeout(this.hoverCloseTimer);
      this.hoverCloseTimer = undefined;
    }
    // schedule open
    if (!this.showFileMenu()) {
      this.hoverOpenTimer = window.setTimeout(() => {
        this.showFileMenu.set(true);
        this.hoverOpenTimer = undefined;
      }, 150);
    }
  }

  // Close the file menu when pointer leaves; use a slight delay so submenu can
  // be focused without immediately closing.
  closeFileMenuHover() {
    if (this.hoverOpenTimer) {
      clearTimeout(this.hoverOpenTimer);
      this.hoverOpenTimer = undefined;
    }
    if (this.showFileMenu()) {
      this.hoverCloseTimer = window.setTimeout(() => {
        this.showFileMenu.set(false);
        this.hoverCloseTimer = undefined;
      }, 200);
    }
  }

  openFillMenuHover() {
    if (this.fillHoverCloseTimer) {
      clearTimeout(this.fillHoverCloseTimer);
      this.fillHoverCloseTimer = undefined;
    }
    if (!this.showFillMenu()) {
      this.fillHoverOpenTimer = window.setTimeout(() => {
        this.showFillMenu.set(true);
        this.fillHoverOpenTimer = undefined;
      }, 150);
    }
  }

  closeFillMenuHover() {
    if (this.fillHoverOpenTimer) {
      clearTimeout(this.fillHoverOpenTimer);
      this.fillHoverOpenTimer = undefined;
    }
    if (this.showFillMenu()) {
      this.fillHoverCloseTimer = window.setTimeout(() => {
        this.showFillMenu.set(false);
        this.fillHoverCloseTimer = undefined;
      }, 150);
    }
  }

  onFillMenuFocusIn() {
    if (this.fillHoverCloseTimer) {
      clearTimeout(this.fillHoverCloseTimer);
      this.fillHoverCloseTimer = undefined;
    }
  }

  onFillMenuFocusOut() {
    if (this.fillHoverOpenTimer) {
      clearTimeout(this.fillHoverOpenTimer);
      this.fillHoverOpenTimer = undefined;
    }
    this.fillHoverCloseTimer = window.setTimeout(() => {
      this.showFillMenu.set(false);
      this.fillHoverCloseTimer = undefined;
    }, 150);
  }

  // Keep menu open if it receives focus (keyboard navigation); close when it
  // loses focus.
  onMenuFocusIn() {
    if (this.hoverCloseTimer) {
      clearTimeout(this.hoverCloseTimer);
      this.hoverCloseTimer = undefined;
    }
    this.showFileMenu.set(true);
  }

  onMenuFocusOut() {
    // close shortly after focus leaves
    if (this.hoverCloseTimer) clearTimeout(this.hoverCloseTimer);
    this.hoverCloseTimer = window.setTimeout(() => {
      this.showFileMenu.set(false);
      this.hoverCloseTimer = undefined;
    }, 150);
  }

  openEditMenuHover() {
    if (this.editHoverCloseTimer) {
      clearTimeout(this.editHoverCloseTimer);
      this.editHoverCloseTimer = undefined;
    }
    if (!this.showEditMenu()) {
      this.editHoverOpenTimer = window.setTimeout(() => {
        this.showEditMenu.set(true);
        this.editHoverOpenTimer = undefined;
      }, 150);
    }
  }

  closeEditMenuHover() {
    if (this.editHoverOpenTimer) {
      clearTimeout(this.editHoverOpenTimer);
      this.editHoverOpenTimer = undefined;
    }
    if (this.showEditMenu()) {
      this.editHoverCloseTimer = window.setTimeout(() => {
        this.showEditMenu.set(false);
        this.editHoverCloseTimer = undefined;
      }, 200);
    }
  }

  onEditMenuFocusIn() {
    if (this.editHoverCloseTimer) {
      clearTimeout(this.editHoverCloseTimer);
      this.editHoverCloseTimer = undefined;
    }
    this.showEditMenu.set(true);
  }

  onEditMenuFocusOut() {
    if (this.editHoverCloseTimer) clearTimeout(this.editHoverCloseTimer);
    this.editHoverCloseTimer = window.setTimeout(() => {
      this.showEditMenu.set(false);
      this.editHoverCloseTimer = undefined;
    }, 150);
  }

  onCut() {
    try {
      this.document.cutSelection();
      this.showEditMenu.set(false);
    } catch (e) {
      console.error('Cut failed', e);
    }
  }

  onCopy() {
    try {
      this.document.copySelection();
      this.showEditMenu.set(false);
    } catch (e) {
      console.error('Copy failed', e);
    }
  }

  onCopyMerged() {
    try {
      this.document.copyMerged();
      this.showEditMenu.set(false);
    } catch (e) {
      console.error('Copy merged failed', e);
    }
  }

  onPaste() {
    try {
      this.document.pasteClipboard();
      this.showEditMenu.set(false);
    } catch (e) {
      console.error('Paste failed', e);
    }
  }

  onPasteInPlace() {
    try {
      this.document.pasteInPlace();
      this.showEditMenu.set(false);
    } catch (e) {
      console.error('Paste in place failed', e);
    }
  }

  onPasteInto() {
    try {
      this.document.pasteInto();
      this.showEditMenu.set(false);
    } catch (e) {
      console.error('Paste into failed', e);
    }
  }

  onClear() {
    try {
      this.document.clearSelectionContent();
      this.showEditMenu.set(false);
    } catch (e) {
      console.error('Clear failed', e);
    }
  }

  onUndo() {
    try {
      this.document.undo();
    } catch {}
  }

  onRedo() {
    try {
      this.document.redo();
    } catch {}
  }

  constructor() {
    this.registerHotkeys();
  }

  private registerHotkeys() {
    this.hotkeys.register({
      id: 'file.new',
      category: 'file',
      defaultKey: 'ctrl+n',
      handler: () => this.onNewProject(),
    });

    this.hotkeys.register({
      id: 'file.open',
      category: 'file',
      defaultKey: 'ctrl+o',
      handler: () => this.onOpenFromComputer(),
    });

    this.hotkeys.register({
      id: 'file.save',
      category: 'file',
      defaultKey: 'ctrl+s',
      handler: () => this.onSave(),
    });

    this.hotkeys.register({
      id: 'file.saveToComputer',
      category: 'file',
      defaultKey: 'ctrl+shift+s',
      handler: () => this.onSaveToComputer(),
    });

    this.hotkeys.register({
      id: 'file.exportImage',
      category: 'file',
      defaultKey: 'ctrl+shift+e',
      handler: () => this.onExportImage(),
    });

    this.hotkeys.register({
      id: 'edit.undo',
      category: 'edit',
      defaultKey: 'ctrl+z',
      handler: () => this.onUndo(),
    });

    this.hotkeys.register({
      id: 'edit.redo',
      category: 'edit',
      defaultKey: 'ctrl+y',
      handler: () => this.onRedo(),
    });

    this.hotkeys.register({
      id: 'edit.cut',
      category: 'edit',
      defaultKey: 'ctrl+x',
      handler: () => this.onCut(),
    });

    this.hotkeys.register({
      id: 'edit.copy',
      category: 'edit',
      defaultKey: 'ctrl+c',
      handler: () => this.onCopy(),
    });

    this.hotkeys.register({
      id: 'edit.copyMerged',
      category: 'edit',
      defaultKey: 'ctrl+shift+c',
      handler: () => this.onCopyMerged(),
    });

    this.hotkeys.register({
      id: 'edit.paste',
      category: 'edit',
      defaultKey: 'ctrl+v',
      handler: () => this.onPaste(),
    });

    this.hotkeys.register({
      id: 'edit.pasteInPlace',
      category: 'edit',
      defaultKey: 'ctrl+shift+v',
      handler: () => this.onPasteInPlace(),
    });

    this.hotkeys.register({
      id: 'edit.pasteInto',
      category: 'edit',
      defaultKey: 'ctrl+alt+shift+v',
      handler: () => this.onPasteInto(),
    });

    this.hotkeys.register({
      id: 'edit.clear',
      category: 'edit',
      defaultKey: 'delete',
      handler: () => this.onClear(),
    });

    this.hotkeys.register({
      id: 'tool.selectLayer',
      category: 'tool',
      defaultKey: 'v',
      handler: () => this.tools.selectTool('select-layer'),
    });

    this.hotkeys.register({
      id: 'tool.rectSelect',
      category: 'tool',
      defaultKey: 'm',
      handler: () => this.tools.selectTool('rect-select'),
    });

    this.hotkeys.register({
      id: 'tool.ellipseSelect',
      category: 'tool',
      defaultKey: 'shift+e',
      handler: () => this.tools.selectTool('ellipse-select'),
    });

    this.hotkeys.register({
      id: 'tool.lassoSelect',
      category: 'tool',
      defaultKey: 'l',
      handler: () => this.tools.selectTool('lasso-select'),
    });

    this.hotkeys.register({
      id: 'tool.smartSelect',
      category: 'tool',
      defaultKey: 'w',
      handler: () => this.tools.selectTool('smart-select'),
    });

    this.hotkeys.register({
      id: 'tool.eyedropper',
      category: 'tool',
      defaultKey: 'i',
      handler: () => this.tools.selectTool('eyedropper'),
    });

    this.hotkeys.register({
      id: 'tool.fill',
      category: 'tool',
      defaultKey: 'g',
      handler: () => this.tools.selectTool('fill'),
    });

    this.hotkeys.register({
      id: 'tool.eraser',
      category: 'tool',
      defaultKey: 'e',
      handler: () => this.tools.selectTool('eraser'),
    });

    this.hotkeys.register({
      id: 'tool.line',
      category: 'tool',
      defaultKey: 'shift+l',
      handler: () => this.tools.selectTool('line'),
    });

    this.hotkeys.register({
      id: 'tool.circle',
      category: 'tool',
      defaultKey: 'c',
      handler: () => this.tools.selectTool('circle'),
    });

    this.hotkeys.register({
      id: 'tool.square',
      category: 'tool',
      defaultKey: 'r',
      handler: () => this.tools.selectTool('square'),
    });

    this.hotkeys.register({
      id: 'tool.brush',
      category: 'tool',
      defaultKey: 'b',
      handler: () => this.tools.selectTool('brush'),
    });

    this.hotkeys.register({
      id: 'tool.bone',
      category: 'tool',
      defaultKey: 'shift+b',
      handler: () => this.tools.selectTool('bone'),
    });

    this.hotkeys.register({
      id: 'tool.pen',
      category: 'tool',
      defaultKey: 'p',
      handler: () => this.tools.selectTool('pen'),
    });

    this.hotkeys.register({
      id: 'tool.text',
      category: 'tool',
      defaultKey: 't',
      handler: () => this.tools.selectTool('text'),
    });

    this.hotkeys.register({
      id: 'insert.image',
      category: 'insert',
      defaultKey: 'ctrl+i',
      handler: () => this.onInsertImage(),
    });

    this.hotkeys.register({
      id: 'transform.freeTransform',
      category: 'edit',
      defaultKey: 'ctrl+t',
      handler: () => this.onFreeTransform(),
    });

    this.hotkeys.register({
      id: 'transform.skew',
      category: 'edit',
      defaultKey: 'ctrl+shift+k',
      handler: () => {
        const sel = this.document.selectionRect();
        if (sel) {
          this.onSkew();
        }
      },
    });

    this.hotkeys.register({
      id: 'transform.distort',
      category: 'edit',
      defaultKey: 'ctrl+shift+d',
      handler: () => {
        const sel = this.document.selectionRect();
        if (sel) {
          this.onDistort();
        }
      },
    });

    this.hotkeys.register({
      id: 'transform.perspective',
      category: 'edit',
      defaultKey: 'ctrl+shift+p',
      handler: () => {
        const sel = this.document.selectionRect();
        if (sel) {
          this.onPerspective();
        }
      },
    });

    this.hotkeys.register({
      id: 'transform.warp',
      category: 'edit',
      defaultKey: 'ctrl+shift+w',
      handler: () => {
        const sel = this.document.selectionRect();
        if (sel) {
          this.onWarp();
        }
      },
    });

    this.hotkeys.register({
      id: 'transform.puppetWarp',
      category: 'edit',
      defaultKey: 'ctrl+shift+alt+w',
      handler: () => {
        const sel = this.document.selectionRect();
        if (sel) {
          this.onPuppetWarp();
        }
      },
    });

    this.hotkeys.register({
      id: 'transform.contentAwareScale',
      category: 'edit',
      defaultKey: 'ctrl+shift+alt+c',
      handler: () => this.onContentAwareScale(),
    });

    this.hotkeys.register({
      id: 'transform.flipHorizontal',
      category: 'edit',
      defaultKey: 'ctrl+shift+h',
      handler: () => {
        const sel = this.document.selectionRect();
        if (sel) {
          this.onFlipHorizontal();
        }
      },
    });

    this.hotkeys.register({
      id: 'transform.flipVertical',
      category: 'edit',
      defaultKey: 'ctrl+shift+v',
      handler: () => {
        const sel = this.document.selectionRect();
        if (sel) {
          this.onFlipVertical();
        }
      },
    });

    this.hotkeys.register({
      id: 'edit.contentAwareFill',
      category: 'edit',
      defaultKey: 'shift+f5',
      handler: () => this.onContentAwareFill(),
    });

    this.hotkeys.register({
      id: 'edit.definePattern',
      category: 'edit',
      defaultKey: 'ctrl+alt+p',
      handler: () => this.onDefinePattern(),
    });

    this.hotkeys.register({
      id: 'edit.defineBrush',
      category: 'edit',
      defaultKey: 'ctrl+alt+b',
      handler: () => this.onDefineBrush(),
    });

    this.hotkeys.register({
      id: 'edit.defineShape',
      category: 'edit',
      defaultKey: 'ctrl+alt+u',
      handler: () => this.onDefineShape(),
    });

    this.hotkeys.register({
      id: 'edit.stroke',
      category: 'edit',
      defaultKey: 'ctrl+alt+s',
      handler: () => this.onStroke(),
    });

    this.hotkeys.register({
      id: 'edit.imageSize',
      category: 'edit',
      defaultKey: 'ctrl+alt+i',
      handler: () => this.onEditImageSize(),
    });

    this.hotkeys.register({
      id: 'palette.createNew',
      category: 'palette',
      defaultKey: 'ctrl+shift+n',
      handler: () => this.onPaletteCreateNew(),
    });

    this.hotkeys.register({
      id: 'palette.createFromSelection',
      category: 'palette',
      defaultKey: 'ctrl+shift+alt+s',
      handler: () => this.onPaletteCreateFromSelection(),
    });

    this.hotkeys.register({
      id: 'palette.createFromLayer',
      category: 'palette',
      defaultKey: 'ctrl+shift+alt+l',
      handler: () => this.onPaletteCreateFromLayer(),
    });

    this.hotkeys.register({
      id: 'palette.manage',
      category: 'palette',
      defaultKey: 'ctrl+shift+alt+p',
      handler: () => this.onPaletteManageOpen(),
    });

    this.hotkeys.register({
      id: 'view.toggleOutOfBoundsPixels',
      category: 'view',
      defaultKey: 'ctrl+shift+o',
      handler: () => this.onToggleOutOfBoundsPixels(),
    });

    this.hotkeys.register({
      id: 'help.logViewer',
      category: 'help',
      defaultKey: 'ctrl+shift+l',
      handler: () => this.onOpenLogViewer(),
    });
  }

  onPaletteCreateNew(): void {
    this.paletteService.createPalette('New Palette');
    this.onPaletteManage.emit();
    this.showPaletteMenu.set(false);
  }

  onPaletteCreateFromSelection(): void {
    const palette = this.paletteService.createPaletteFromSelection();
    if (palette) {
      this.onPaletteManage.emit();
    }
    this.showPaletteMenu.set(false);
  }

  onPaletteCreateFromLayer(): void {
    const palette = this.paletteService.createPaletteFromLayer();
    if (palette) {
      this.onPaletteManage.emit();
    }
    this.showPaletteMenu.set(false);
  }

  onPaletteManageOpen(): void {
    this.onPaletteManage.emit();
    this.showPaletteMenu.set(false);
  }

  openPaletteMenuHover(): void {
    if (this.paletteHoverCloseTimer) {
      clearTimeout(this.paletteHoverCloseTimer);
      this.paletteHoverCloseTimer = undefined;
    }
    if (!this.showPaletteMenu()) {
      this.paletteHoverOpenTimer = window.setTimeout(() => {
        this.showPaletteMenu.set(true);
        this.paletteHoverOpenTimer = undefined;
      }, 150);
    }
  }

  closePaletteMenuHover(): void {
    if (this.paletteHoverOpenTimer) {
      clearTimeout(this.paletteHoverOpenTimer);
      this.paletteHoverOpenTimer = undefined;
    }
    if (this.showPaletteMenu()) {
      this.paletteHoverCloseTimer = window.setTimeout(() => {
        this.showPaletteMenu.set(false);
        this.paletteHoverCloseTimer = undefined;
      }, 150);
    }
  }

  onPaletteMenuFocusIn(): void {
    if (this.paletteHoverCloseTimer) {
      clearTimeout(this.paletteHoverCloseTimer);
      this.paletteHoverCloseTimer = undefined;
    }
    this.showPaletteMenu.set(true);
  }

  onPaletteMenuFocusOut(): void {
    if (this.paletteHoverOpenTimer) {
      clearTimeout(this.paletteHoverOpenTimer);
      this.paletteHoverOpenTimer = undefined;
    }
    this.paletteHoverCloseTimer = window.setTimeout(() => {
      this.showPaletteMenu.set(false);
      this.paletteHoverCloseTimer = undefined;
    }, 150);
  }

  openViewMenuHover(): void {
    if (this.viewHoverCloseTimer) {
      clearTimeout(this.viewHoverCloseTimer);
      this.viewHoverCloseTimer = undefined;
    }
    if (!this.showViewMenu()) {
      this.viewHoverOpenTimer = window.setTimeout(() => {
        this.showViewMenu.set(true);
        this.viewHoverOpenTimer = undefined;
      }, 150);
    }
  }

  closeViewMenuHover(): void {
    if (this.viewHoverOpenTimer) {
      clearTimeout(this.viewHoverOpenTimer);
      this.viewHoverOpenTimer = undefined;
    }
    if (this.showViewMenu()) {
      this.viewHoverCloseTimer = window.setTimeout(() => {
        this.showViewMenu.set(false);
        this.viewHoverCloseTimer = undefined;
      }, 150);
    }
  }

  onViewMenuFocusIn(): void {
    if (this.viewHoverCloseTimer) {
      clearTimeout(this.viewHoverCloseTimer);
      this.viewHoverCloseTimer = undefined;
    }
    this.showViewMenu.set(true);
  }

  onViewMenuFocusOut(): void {
    if (this.viewHoverOpenTimer) {
      clearTimeout(this.viewHoverOpenTimer);
      this.viewHoverOpenTimer = undefined;
    }
    this.viewHoverCloseTimer = window.setTimeout(() => {
      this.showViewMenu.set(false);
      this.viewHoverCloseTimer = undefined;
    }, 150);
  }

  onToggleOutOfBoundsPixels(): void {
    this.settings.toggleShowOutOfBoundsPixels();
    this.showViewMenu.set(false);
  }

  onStroke(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      this.showEditMenu.set(false);
      return;
    }

    this.strokeService.activate();
    this.onStrokeToggle.emit();
    this.showEditMenu.set(false);
  }

  onEditImageSize(): void {
    const dialog = this.imageSizeDialog();
    if (dialog) {
      dialog.open(this.document.canvasWidth(), this.document.canvasHeight());
    }
    this.showEditMenu.set(false);
  }

  handleImageSizeConfirm(result: ImageSizeResult): void {
    this.document.setCanvasSize(result.width, result.height);
  }

  handleImageSizeCancel(): void {}

  onDefineShape(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      this.showEditMenu.set(false);
      return;
    }

    this.defineShapeService.activate();
    this.onDefineShapeToggle.emit();
    this.showEditMenu.set(false);
  }

  onDefinePattern(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      this.showEditMenu.set(false);
      return;
    }

    this.definePatternService.activate();
    this.onDefinePatternToggle.emit();
    this.showEditMenu.set(false);
  }

  onDefineBrush(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      this.showEditMenu.set(false);
      return;
    }

    this.defineBrushService.activate();
    this.onDefineBrushToggle.emit();
    this.showEditMenu.set(false);
  }

  onContentAwareFill(): void {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      this.showFillMenu.set(false);
      return;
    }

    this.contentAwareFillState.activate();
    this.onContentAwareFillToggle.emit();
    this.showFillMenu.set(false);
  }

  async onInsertImage() {
    this.showInsertMenu.set(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const dialog = this.insertImageDialog();
      if (dialog) {
        dialog.open(file);
      }
    };
    input.click();
  }

  async onFillSelection() {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      this.showTransformMenu.set(false);
      this.showToolMenu.set(false);
      return;
    }

    const result = await this.fillSelectionDialog()?.open();
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
      if (result.gradientStartColor)
        this.tools.setFillGradientStartColor(result.gradientStartColor);
      if (result.gradientEndColor)
        this.tools.setFillGradientEndColor(result.gradientEndColor);
      if (result.gradientType)
        this.tools.setFillGradientType(result.gradientType);
      if (result.gradientAngle !== undefined)
        this.tools.setFillGradientAngle(result.gradientAngle);
    }
  }

  handleInsertImageConfirm(result: InsertImageResult) {
    this.document
      .insertImageAsLayer(
        result.file,
        result.width > 0 ? result.width : undefined,
        result.height > 0 ? result.height : undefined,
      )
      .subscribe({
        next: (insertResult) => {
          if (insertResult) {
            console.info(
              `Image inserted as layer: ${insertResult.layerId}`,
              insertResult.bounds,
            );
          } else {
            console.error('Failed to insert image');
          }
        },
        error: (error) => {
          console.error('Failed to insert image', error);
        },
      });
  }

  handleInsertImageCancel() {
    console.info('Image insertion cancelled');
  }

  openInsertMenuHover() {
    if (this.insertHoverCloseTimer) {
      clearTimeout(this.insertHoverCloseTimer);
      this.insertHoverCloseTimer = undefined;
    }
    if (!this.showInsertMenu()) {
      this.insertHoverOpenTimer = window.setTimeout(() => {
        this.showInsertMenu.set(true);
        this.insertHoverOpenTimer = undefined;
      }, 150);
    }
  }

  closeInsertMenuHover() {
    if (this.insertHoverOpenTimer) {
      clearTimeout(this.insertHoverOpenTimer);
      this.insertHoverOpenTimer = undefined;
    }
    if (this.showInsertMenu()) {
      this.insertHoverCloseTimer = window.setTimeout(() => {
        this.showInsertMenu.set(false);
        this.insertHoverCloseTimer = undefined;
      }, 200);
    }
  }

  onInsertMenuFocusIn() {
    if (this.insertHoverCloseTimer) {
      clearTimeout(this.insertHoverCloseTimer);
      this.insertHoverCloseTimer = undefined;
    }
    this.showInsertMenu.set(true);
  }

  onInsertMenuFocusOut() {
    if (this.insertHoverCloseTimer) clearTimeout(this.insertHoverCloseTimer);
    this.insertHoverCloseTimer = window.setTimeout(() => {
      this.showInsertMenu.set(false);
      this.insertHoverCloseTimer = undefined;
    }, 150);
  }

  openToolMenuHover() {
    if (this.toolHoverCloseTimer) {
      clearTimeout(this.toolHoverCloseTimer);
      this.toolHoverCloseTimer = undefined;
    }
    if (!this.showToolMenu()) {
      this.toolHoverOpenTimer = window.setTimeout(() => {
        this.showToolMenu.set(true);
        this.toolHoverOpenTimer = undefined;
      }, 150);
    }
  }

  closeToolMenuHover() {
    if (this.toolHoverOpenTimer) {
      clearTimeout(this.toolHoverOpenTimer);
      this.toolHoverOpenTimer = undefined;
    }
    if (this.showToolMenu()) {
      this.toolHoverCloseTimer = window.setTimeout(() => {
        this.showToolMenu.set(false);
        this.toolHoverCloseTimer = undefined;
      }, 200);
    }
  }

  onToolMenuFocusIn() {
    if (this.toolHoverCloseTimer) {
      clearTimeout(this.toolHoverCloseTimer);
      this.toolHoverCloseTimer = undefined;
    }
    this.showToolMenu.set(true);
  }

  onToolMenuFocusOut() {
    if (this.toolHoverCloseTimer) clearTimeout(this.toolHoverCloseTimer);
    this.toolHoverCloseTimer = window.setTimeout(() => {
      this.showToolMenu.set(false);
      this.toolHoverCloseTimer = undefined;
    }, 150);
  }

  onSelectBoneTool() {
    this.tools.selectTool('bone');
    this.showToolMenu.set(false);
  }

  onSelectTool(toolId: string) {
    this.tools.selectTool(toolId as any);
    this.showToolMenu.set(false);
  }

  openHelpMenuHover() {
    if (this.helpHoverCloseTimer) {
      clearTimeout(this.helpHoverCloseTimer);
      this.helpHoverCloseTimer = undefined;
    }
    if (!this.showHelpMenu()) {
      this.helpHoverOpenTimer = window.setTimeout(() => {
        this.showHelpMenu.set(true);
        this.helpHoverOpenTimer = undefined;
      }, 150);
    }
  }

  closeHelpMenuHover() {
    if (this.helpHoverOpenTimer) {
      clearTimeout(this.helpHoverOpenTimer);
      this.helpHoverOpenTimer = undefined;
    }
    if (this.showHelpMenu()) {
      this.helpHoverCloseTimer = window.setTimeout(() => {
        this.showHelpMenu.set(false);
        this.helpHoverCloseTimer = undefined;
      }, 200);
    }
  }

  onHelpMenuFocusIn() {
    if (this.helpHoverCloseTimer) {
      clearTimeout(this.helpHoverCloseTimer);
      this.helpHoverCloseTimer = undefined;
    }
    this.showHelpMenu.set(true);
  }

  onHelpMenuFocusOut() {
    if (this.helpHoverCloseTimer) clearTimeout(this.helpHoverCloseTimer);
    this.helpHoverCloseTimer = window.setTimeout(() => {
      this.showHelpMenu.set(false);
      this.helpHoverCloseTimer = undefined;
    }, 150);
  }

  onConfigureHotkeys() {
    this.showHelpMenu.set(false);
    const dialog = this.hotkeyConfigDialog();
    if (dialog) {
      dialog.open();
    }
  }

  onOpenLogViewer() {
    this.showHelpMenu.set(false);
    const dialog = this.logViewerDialog();
    if (dialog) {
      dialog.open();
    }
  }

  ngOnDestroy(): void {
    if (this.hoverOpenTimer) {
      clearTimeout(this.hoverOpenTimer);
      this.hoverOpenTimer = undefined;
    }
    if (this.hoverCloseTimer) {
      clearTimeout(this.hoverCloseTimer);
      this.hoverCloseTimer = undefined;
    }
    if (this.editHoverOpenTimer) {
      clearTimeout(this.editHoverOpenTimer);
      this.editHoverOpenTimer = undefined;
    }
    if (this.editHoverCloseTimer) {
      clearTimeout(this.editHoverCloseTimer);
      this.editHoverCloseTimer = undefined;
    }
    if (this.insertHoverOpenTimer) {
      clearTimeout(this.insertHoverOpenTimer);
      this.insertHoverOpenTimer = undefined;
    }
    if (this.insertHoverCloseTimer) {
      clearTimeout(this.insertHoverCloseTimer);
      this.insertHoverCloseTimer = undefined;
    }
    if (this.toolHoverOpenTimer) {
      clearTimeout(this.toolHoverOpenTimer);
      this.toolHoverOpenTimer = undefined;
    }
    if (this.toolHoverCloseTimer) {
      clearTimeout(this.toolHoverCloseTimer);
      this.toolHoverCloseTimer = undefined;
    }
    if (this.helpHoverOpenTimer) {
      clearTimeout(this.helpHoverOpenTimer);
      this.helpHoverOpenTimer = undefined;
    }
    if (this.helpHoverCloseTimer) {
      clearTimeout(this.helpHoverCloseTimer);
      this.helpHoverCloseTimer = undefined;
    }
    if (this.transformHoverOpenTimer) {
      clearTimeout(this.transformHoverOpenTimer);
      this.transformHoverOpenTimer = undefined;
    }
    if (this.transformHoverCloseTimer) {
      clearTimeout(this.transformHoverCloseTimer);
      this.transformHoverCloseTimer = undefined;
    }
    if (this.paletteHoverOpenTimer) {
      clearTimeout(this.paletteHoverOpenTimer);
      this.paletteHoverOpenTimer = undefined;
    }
    if (this.paletteHoverCloseTimer) {
      clearTimeout(this.paletteHoverCloseTimer);
      this.paletteHoverCloseTimer = undefined;
    }
    if (this.viewHoverOpenTimer) {
      clearTimeout(this.viewHoverOpenTimer);
      this.viewHoverOpenTimer = undefined;
    }
    if (this.viewHoverCloseTimer) {
      clearTimeout(this.viewHoverCloseTimer);
      this.viewHoverCloseTimer = undefined;
    }
  }

  setLang(lang: string) {
    this.settings.setLanguage(lang);
  }

  toggleTheme() {
    const next = this.settings.theme() === 'dark' ? 'light' : 'dark';
    this.settings.setTheme(next);
  }

  openTransformMenuHover() {
    if (this.transformHoverCloseTimer) {
      clearTimeout(this.transformHoverCloseTimer);
      this.transformHoverCloseTimer = undefined;
    }
    if (!this.showTransformMenu()) {
      this.transformHoverOpenTimer = window.setTimeout(() => {
        this.showTransformMenu.set(true);
        this.transformHoverOpenTimer = undefined;
      }, 150);
    }
  }

  closeTransformMenuHover() {
    if (this.transformHoverOpenTimer) {
      clearTimeout(this.transformHoverOpenTimer);
      this.transformHoverOpenTimer = undefined;
    }
    if (this.showTransformMenu()) {
      this.transformHoverCloseTimer = window.setTimeout(() => {
        this.showTransformMenu.set(false);
        this.transformHoverCloseTimer = undefined;
      }, 200);
    }
  }

  onTransformMenuFocusIn() {
    if (this.transformHoverCloseTimer) {
      clearTimeout(this.transformHoverCloseTimer);
      this.transformHoverCloseTimer = undefined;
    }
    this.showTransformMenu.set(true);
  }

  onTransformMenuFocusOut() {
    if (this.transformHoverCloseTimer)
      clearTimeout(this.transformHoverCloseTimer);
    this.transformHoverCloseTimer = window.setTimeout(() => {
      this.showTransformMenu.set(false);
      this.transformHoverCloseTimer = undefined;
    }, 150);
  }

  onFreeTransform() {
    const sel = this.document.selectionRect();
    if (!sel || sel.width <= 0 || sel.height <= 0) {
      this.showTransformMenu.set(false);
      return;
    }

    this.freeTransform.startTransform(sel.x, sel.y, sel.width, sel.height);
    this.showTransformMenu.set(false);
  }

  onScale() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }

    const dialog = this.scaleDialog();
    if (dialog) {
      dialog.open(sel.width, sel.height);
    }
    this.showTransformMenu.set(false);
  }

  handleScaleConfirm(result: ScaleResult) {
    this.document.scaleSelectionOrLayer(result.scaleX, result.scaleY);
  }

  handleScaleCancel() {}

  onRotate() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }

    const dialog = this.rotateDialog();
    if (dialog) {
      const layerId = this.document.selectedLayerId();
      if (!layerId) {
        this.showTransformMenu.set(false);
        return;
      }

      const fullBuffer = this.document.getLayerBuffer(layerId);
      if (!fullBuffer) {
        this.showTransformMenu.set(false);
        return;
      }

      const canvasWidth = this.document.canvasWidth();
      const selBuffer: string[] = [];
      for (let y = 0; y < sel.height; y++) {
        for (let x = 0; x < sel.width; x++) {
          const srcIdx = (sel.y + y) * canvasWidth + (sel.x + x);
          selBuffer.push(fullBuffer[srcIdx] || '');
        }
      }

      dialog.open(sel.width, sel.height, selBuffer);
    }
    this.showTransformMenu.set(false);
  }

  handleRotateConfirm(result: RotateResult) {
    this.document.rotateSelectionOrLayer(result.angle);
  }

  handleRotateCancel() {}

  onSkew() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }

    const dialog = this.skewDialog();
    if (dialog) {
      const layerId = this.document.selectedLayerId();
      if (!layerId) {
        this.showTransformMenu.set(false);
        return;
      }

      const fullBuffer = this.document.getLayerBuffer(layerId);
      if (!fullBuffer) {
        this.showTransformMenu.set(false);
        return;
      }

      const selBuffer: string[] = [];
      for (let y = 0; y < sel.height; y++) {
        for (let x = 0; x < sel.width; x++) {
          const srcX = sel.x + x;
          const srcY = sel.y + y;
          if (
            srcX >= 0 &&
            srcX < this.document.canvasWidth() &&
            srcY >= 0 &&
            srcY < this.document.canvasHeight()
          ) {
            const srcIdx = srcY * this.document.canvasWidth() + srcX;
            selBuffer.push(fullBuffer[srcIdx] || '');
          } else {
            selBuffer.push('');
          }
        }
      }

      dialog.open(sel.width, sel.height, selBuffer);
    }
    this.showTransformMenu.set(false);
  }

  handleSkewConfirm(result: SkewResult) {
    this.document.skewSelectionOrLayer(result.skewX, result.skewY);
  }

  handleSkewCancel() {}

  onDistort() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }

    this.distort.startDistort(sel.x, sel.y, sel.width, sel.height);
    this.showTransformMenu.set(false);
  }

  onPerspective() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }

    this.perspective.startPerspective(sel.x, sel.y, sel.width, sel.height);
    this.showTransformMenu.set(false);
  }

  onWarp() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }

    this.warp.startWarp(sel.x, sel.y, sel.width, sel.height);
    this.showTransformMenu.set(false);
  }

  onPuppetWarp() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }

    this.puppetWarp.startPuppetWarp(sel.x, sel.y, sel.width, sel.height);
    this.showTransformMenu.set(false);
  }

  onContentAwareScale() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }

    const dialog = this.contentAwareScaleDialog();
    if (dialog) {
      dialog.open(sel.width, sel.height);
    }
    this.showTransformMenu.set(false);
  }

  handleContentAwareScaleConfirm(result: ContentAwareScaleResult) {
    this.document.applyContentAwareScale(
      result.targetWidth,
      result.targetHeight,
      result.protectImportantAreas,
    );
  }

  handleContentAwareScaleCancel() {}

  onAutoAlignLayers() {
    this.showTransformMenu.set(false);
  }

  onAutoBlendLayers() {
    this.showTransformMenu.set(false);
  }

  onFlipHorizontal() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }
    this.document.flipLayerHorizontal();
    this.showTransformMenu.set(false);
  }

  onFlipVertical() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }
    this.document.flipLayerVertical();
    this.showTransformMenu.set(false);
  }

  onRotate90CW() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }
    this.document.rotateLayer90CW();
    this.showTransformMenu.set(false);
  }

  onRotate90CCW() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }
    this.document.rotateLayer90CCW();
    this.showTransformMenu.set(false);
  }

  onRotate180() {
    const sel = this.document.selectionRect();
    if (!sel) {
      this.showTransformMenu.set(false);
      return;
    }
    this.document.rotateLayer180();
    this.showTransformMenu.set(false);
  }

  onExportImage() {
    this.showFileMenu.set(false);
    const dialog = this.exportImageDialog();
    if (dialog) {
      dialog.open();
    }
  }

  async handleExportImageConfirm(result: ExportImageResult) {
    const currentLayerId = this.document.selectedLayerId();
    const blob = await this.exportService.exportImage({
      format: result.format,
      region: result.region,
      quality: result.quality,
      currentLayerId: currentLayerId || undefined,
    });

    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `pixart-export-${timestamp}.${result.format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  handleExportImageCancel() {}

  onExportTimeline() {
    this.showFileMenu.set(false);
    const dialog = this.timelineExportDialog();
    if (dialog) {
      dialog.open();
    }
  }

  handleExportTimelineConfirm() {}

  handleExportTimelineCancel() {}
}
