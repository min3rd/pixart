import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { PaletteService, ColorPalette } from '../../../services/palette.service';
import { EditorToolsService } from '../../../services/editor-tools.service';
import { HotkeysService } from '../../../services/hotkeys.service';
import { ColorPickerStateService } from '../../../services/color-picker-state.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'pa-palette-panel',
  templateUrl: './palette-panel.component.html',
  styleUrls: ['./palette-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoPipe, NgIcon, FormsModule, TooltipDirective],
  host: {
    class: 'block h-full',
  },
})
export class PalettePanelComponent {
  readonly paletteService = inject(PaletteService);
  readonly tools = inject(EditorToolsService);
  readonly hotkeys = inject(HotkeysService);
  readonly colorPickerState = inject(ColorPickerStateService);

  readonly selectedPaletteId = signal<string | null>(null);
  readonly editingPaletteId = signal<string | null>(null);
  readonly editingPaletteName = signal('');
  readonly newColorValue = signal('#000000');
  readonly focusedColorIndex = signal(-1);

  readonly selectedPalette = computed(() => {
    const id = this.selectedPaletteId();
    if (!id) return null;
    return this.paletteService.getPalette(id);
  });

  selectPalette(id: string): void {
    this.selectedPaletteId.set(id === this.selectedPaletteId() ? null : id);
  }

  onCreateNew(): void {
    const palette = this.paletteService.createPalette('New Palette');
    this.selectedPaletteId.set(palette.id);
    this.editingPaletteId.set(palette.id);
    this.editingPaletteName.set(palette.name);
  }

  onCreateFromSelection(): void {
    const palette = this.paletteService.createPaletteFromSelection();
    if (palette) {
      this.selectedPaletteId.set(palette.id);
    }
  }

  onCreateFromLayer(): void {
    const palette = this.paletteService.createPaletteFromLayer();
    if (palette) {
      this.selectedPaletteId.set(palette.id);
    }
  }

  onDeletePalette(id: string, event: Event): void {
    event.stopPropagation();
    this.paletteService.deletePalette(id);
    if (this.selectedPaletteId() === id) {
      this.selectedPaletteId.set(null);
    }
  }

  startRename(palette: ColorPalette, event: Event): void {
    event.stopPropagation();
    this.editingPaletteId.set(palette.id);
    this.editingPaletteName.set(palette.name);
  }

  onRenameBlur(): void {
    const id = this.editingPaletteId();
    const newName = this.editingPaletteName().trim();
    if (id) {
      if (newName) {
        this.paletteService.renamePalette(id, newName);
      }
    }
    this.editingPaletteId.set(null);
  }

  onRenameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onRenameBlur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editingPaletteId.set(null);
    }
  }

  onAddColorInline(): void {
    const id = this.selectedPaletteId();
    if (id) {
      this.paletteService.addColorToPalette(id, this.newColorValue());
      this.newColorValue.set('#000000');
    }
  }

  startPickColor(): void {
    const previousTool = this.tools.currentTool();
    this.tools.selectTool('eyedropper');
    this.colorPickerState.startPicking((color: string) => {
      this.newColorValue.set(color);
      this.tools.selectTool(previousTool);
    });
  }

  onRemoveColor(index: number): void {
    const id = this.selectedPaletteId();
    if (id) {
      this.paletteService.removeColorFromPalette(id, index);
    }
  }

  onColorClick(color: string): void {
    const currentTool = this.tools.currentTool();

    switch (currentTool) {
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
      case 'circle':
        this.tools.setCircleStrokeColor(color);
        break;
      case 'square':
        this.tools.setSquareStrokeColor(color);
        break;
      case 'bone':
        this.tools.setBoneColor(color);
        break;
      default:
        this.tools.setBrushColor(color);
        break;
    }
  }

  onColorDragStart(event: DragEvent, index: number): void {
    event.dataTransfer?.setData('text/plain', String(index));
  }

  onColorDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onColorDrop(event: DragEvent, toIndex: number): void {
    event.preventDefault();
    const fromIndex = parseInt(
      event.dataTransfer?.getData('text/plain') || '-1',
      10,
    );
    const id = this.selectedPaletteId();
    if (id && fromIndex >= 0 && fromIndex !== toIndex) {
      this.paletteService.reorderColorInPalette(id, fromIndex, toIndex);
    }
  }

  getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  getShortcut(hotkeyId: string): string | null {
    const binding = this.hotkeys.getBinding(hotkeyId);
    return binding ? this.hotkeys.keyStringToDisplay(binding) : null;
  }

  onColorGridKeydown(event: KeyboardEvent): void {
    const palette = this.selectedPalette();
    if (!palette || palette.colors.length === 0) return;

    const colorsPerRow = 8;
    let idx = this.focusedColorIndex();
    if (idx < 0) idx = 0;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        idx = Math.min(idx + 1, palette.colors.length - 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        idx = Math.max(idx - 1, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        idx = Math.min(idx + colorsPerRow, palette.colors.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        idx = Math.max(idx - colorsPerRow, 0);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (palette.colors[idx]) {
          this.onColorClick(palette.colors[idx]);
        }
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.onRemoveColor(idx);
        if (idx >= palette.colors.length) {
          idx = palette.colors.length - 1;
        }
        break;
      default:
        return;
    }

    this.focusedColorIndex.set(idx);
  }

  onColorFocus(index: number): void {
    this.focusedColorIndex.set(index);
  }
}
