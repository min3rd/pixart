import { Injectable, signal, inject } from '@angular/core';
import { EditorDocumentService } from '../../editor-document.service';
import { HotkeysService } from '../../hotkeys.service';

export type ContextMenuActionId =
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

export interface ContextMenuAction {
  id: ContextMenuActionId;
  labelKey: string;
  icon: string;
  disabled?: boolean;
  submenu?: ContextMenuAction[];
}

@Injectable({ providedIn: 'root' })
export class CanvasContextMenuService {
  private readonly document = inject(EditorDocumentService);
  private readonly hotkeys = inject(HotkeysService);

  readonly visible = signal(false);
  readonly position = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly actions = signal<ContextMenuAction[]>([]);
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

  close(): void {
    this.visible.set(false);
    this.actions.set([]);
    this.submenuVisible.set(false);
    this.submenuActions.set([]);
  }

  closeInputDialog(): void {
    this.inputDialogVisible.set(false);
    this.inputDialogCallback.set(null);
  }

  openInputDialog(
    position: { x: number; y: number },
    title: string,
    defaultValue: string,
    callback: (value: string) => void,
  ): void {
    this.inputDialogPosition.set(position);
    this.inputDialogTitle.set(title);
    this.inputDialogValue.set(defaultValue);
    this.inputDialogCallback.set(callback);
    this.inputDialogVisible.set(true);
  }

  submitInputDialog(): void {
    const callback = this.inputDialogCallback();
    if (callback) {
      callback(this.inputDialogValue());
    }
  }

  show(
    clientX: number,
    clientY: number,
    containerRect: DOMRect,
    hasNonEmptySelection: boolean,
  ): void {
    const hasSelection = !!this.document.selectionRect();
    if (!hasSelection) {
      this.close();
      return;
    }

    const menuActions: ContextMenuAction[] = [];

    menuActions.push({
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

    menuActions.push({
      id: 'invertSelection',
      labelKey: 'editor.canvas.menu.invertSelection',
      icon: 'heroIconsBarsArrowUpMini',
      disabled: false,
    });

    menuActions.push({
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

    menuActions.push({
      id: 'makeCopyLayer',
      labelKey: 'editor.canvas.menu.makeCopyLayer',
      icon: 'heroIconsDocumentDuplicateMini',
      disabled: !hasNonEmptySelection,
    });

    menuActions.push({
      id: 'mergeVisibleToNewLayer',
      labelKey: 'editor.canvas.menu.mergeVisibleToNewLayer',
      icon: 'heroIconsRectangleStackMini',
      disabled: false,
    });

    menuActions.push({
      id: 'deselect',
      labelKey: 'editor.canvas.menu.deselect',
      icon: 'bootstrapBoundingBox',
    });

    const offsetX = clientX - containerRect.left;
    const offsetY = clientY - containerRect.top;
    const estimatedWidth = 200;
    const estimatedHeight = Math.max(40, menuActions.length * 36);
    const maxX = Math.max(0, containerRect.width - estimatedWidth);
    const maxY = Math.max(0, containerRect.height - estimatedHeight);
    const clampedX = Math.max(0, Math.min(offsetX, maxX));
    const clampedY = Math.max(0, Math.min(offsetY, maxY));

    this.position.set({ x: clampedX, y: clampedY });
    this.actions.set(menuActions);
    this.visible.set(true);
  }

  showSubmenu(
    action: ContextMenuAction,
    buttonRect: DOMRect,
    containerRect: DOMRect,
  ): void {
    if (!action.submenu || action.submenu.length === 0) return;

    const submenuX = buttonRect.right - containerRect.left + 4;
    const submenuY = buttonRect.top - containerRect.top;
    this.submenuPosition.set({ x: submenuX, y: submenuY });
    this.submenuActions.set(action.submenu);
    this.submenuVisible.set(true);
  }

  executeAction(
    actionId: ContextMenuActionId,
    event: MouseEvent | undefined,
    containerRect: DOMRect,
    onGenerateFromLayer: () => void,
    onGenerateFromVisible: () => void,
  ): boolean {
    switch (actionId) {
      case 'generateFromLayer':
        onGenerateFromLayer();
        break;
      case 'generateFromVisible':
        onGenerateFromVisible();
        break;
      case 'deselect':
        this.document.clearSelection();
        break;
      case 'invertSelection':
        this.document.invertSelection();
        break;
      case 'growBy1px':
        this.document.growSelection(1);
        break;
      case 'growBy2px':
        this.document.growSelection(2);
        break;
      case 'growBy5px':
        this.document.growSelection(5);
        break;
      case 'growCustom':
        if (event) {
          const offsetX = event.clientX - containerRect.left;
          const offsetY = event.clientY - containerRect.top;
          this.openInputDialog(
            { x: offsetX + 10, y: offsetY },
            'Enter growth amount (pixels):',
            '10',
            (value: string) => {
              const parsed = parseInt(value, 10);
              if (!isNaN(parsed) && parsed > 0) {
                this.document.growSelection(parsed);
              }
              this.closeInputDialog();
            },
          );
          return false;
        }
        break;
      case 'makeCopyLayer':
        this.document.makeCopyLayer();
        break;
      case 'mergeVisibleToNewLayer':
        this.document.mergeVisibleToNewLayer();
        break;
      default:
        break;
    }
    this.close();
    return true;
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
}
