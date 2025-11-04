import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { HotkeysService, HotkeyRegistration } from '../../../services/hotkeys.service';

@Component({
  selector: 'pa-hotkey-config-dialog',
  templateUrl: './hotkey-config-dialog.component.html',
  styleUrls: ['./hotkey-config-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoPipe, NgIcon],
})
export class HotkeyConfigDialog {
  readonly hotkeys = inject(HotkeysService);
  readonly isOpen = signal(false);
  readonly editingActionId = signal<string | null>(null);
  readonly capturedKey = signal<string>('');
  readonly conflictError = signal<string | null>(null);

  readonly groupedActions = computed(() => {
    const registrations = this.hotkeys.registrations();
    const groups = new Map<string, HotkeyRegistration[]>();

    for (const reg of registrations) {
      const existing = groups.get(reg.category) ?? [];
      existing.push(reg);
      groups.set(reg.category, existing);
    }

    return groups;
  });

  open(): void {
    this.isOpen.set(true);
    this.editingActionId.set(null);
    this.capturedKey.set('');
    this.conflictError.set(null);
  }

  close(): void {
    this.isOpen.set(false);
    this.editingActionId.set(null);
    this.capturedKey.set('');
    this.conflictError.set(null);
  }

  startEdit(actionId: string): void {
    this.editingActionId.set(actionId);
    this.capturedKey.set('');
    this.conflictError.set(null);
  }

  cancelEdit(): void {
    this.editingActionId.set(null);
    this.capturedKey.set('');
    this.conflictError.set(null);
  }

  saveEdit(): void {
    const actionId = this.editingActionId();
    const key = this.capturedKey();
    if (!actionId || !key) return;

    const conflict = this.hotkeys.findConflict(key, actionId);
    if (conflict) {
      this.conflictError.set(conflict);
      return;
    }

    const success = this.hotkeys.setBinding(actionId, key);
    if (success) {
      this.editingActionId.set(null);
      this.capturedKey.set('');
      this.conflictError.set(null);
    }
  }

  resetAction(actionId: string): void {
    this.hotkeys.resetBinding(actionId);
    if (this.editingActionId() === actionId) {
      this.cancelEdit();
    }
  }

  resetAll(): void {
    this.hotkeys.resetAllBindings();
    this.cancelEdit();
  }

  onKeyCapture(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');

    let key = event.key.toLowerCase();
    if (key === 'control' || key === 'shift' || key === 'alt' || key === 'meta')
      return;
    if (key === 'escape') {
      this.cancelEdit();
      return;
    }

    parts.push(key);
    this.capturedKey.set(parts.join('+'));
    this.conflictError.set(null);
  }

  displayKey(key: string): string {
    return this.hotkeys.keyStringToDisplay(key);
  }
}
