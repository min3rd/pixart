import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
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
import {
  ScaleDialog,
  ScaleResult,
} from '../../../shared/components/scale-dialog/scale-dialog';
import {
  RotateDialog,
  RotateResult,
} from '../../../shared/components/rotate-dialog/rotate-dialog';

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
  readonly showFileMenu = signal(false);
  readonly showEditMenu = signal(false);
  readonly showInsertMenu = signal(false);
  readonly showToolMenu = signal(false);
  readonly showHelpMenu = signal(false);
  readonly showTransformMenu = signal(false);
  readonly insertImageDialog = viewChild(InsertImageDialog);
  readonly hotkeyConfigDialog = viewChild(HotkeyConfigDialog);
  readonly scaleDialog = viewChild(ScaleDialog);
  readonly rotateDialog = viewChild(RotateDialog);
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

  async onNewProject() {
    // Reset to a minimal new project
    this.document.resetToNewProject();
    this.showFileMenu.set(false);
  }
  async onOpen() {
    const parsed = await this.fileService.openProjectFromPicker();
    if (parsed) {
      // try to restore using editor snapshot shape; fallback to raw project
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
  }

  setLang(lang: 'en' | 'vi') {
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
    this.showTransformMenu.set(false);
  }

  onDistort() {
    this.showTransformMenu.set(false);
  }

  onPerspective() {
    this.showTransformMenu.set(false);
  }

  onWarp() {
    this.showTransformMenu.set(false);
  }

  onPuppetWarp() {
    this.showTransformMenu.set(false);
  }

  onContentAwareScale() {
    this.showTransformMenu.set(false);
  }

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
}
