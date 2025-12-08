import { Injectable, inject, signal, computed } from '@angular/core';
import { LogService } from './logging/log.service';

export interface HotkeyAction {
  id: string;
  category: 'file' | 'edit' | 'tool' | 'insert' | 'view' | 'help' | 'palette';
  defaultKey: string;
  handler: () => void;
}

export interface HotkeyRegistration {
  id: string;
  category: string;
  defaultKey: string;
  currentKey: string;
}

interface StoredHotkeys {
  [actionId: string]: string;
}

@Injectable({ providedIn: 'root' })
export class HotkeysService {
  private readonly STORAGE_KEY = 'pixart.hotkeys.v1';
  private readonly logService = inject(LogService);
  private readonly actions = new Map<string, HotkeyAction>();
  private readonly customBindings = signal<Map<string, string>>(new Map());

  readonly registrations = computed<HotkeyRegistration[]>(() => {
    const custom = this.customBindings();
    return Array.from(this.actions.values()).map((action) => ({
      id: action.id,
      category: action.category,
      defaultKey: action.defaultKey,
      currentKey: custom.get(action.id) ?? action.defaultKey,
    }));
  });

  constructor() {
    this.loadCustomBindings();
    this.attachGlobalListener();
  }

  register(action: HotkeyAction): void {
    if (this.actions.has(action.id)) {
      console.warn(`Hotkey action ${action.id} is already registered`);
      return;
    }
    this.actions.set(action.id, action);
  }

  unregister(actionId: string): void {
    this.actions.delete(actionId);
  }

  getBinding(actionId: string): string | undefined {
    const custom = this.customBindings().get(actionId);
    if (custom) return custom;
    return this.actions.get(actionId)?.defaultKey;
  }

  setBinding(actionId: string, key: string): boolean {
    const action = this.actions.get(actionId);
    if (!action) return false;

    const conflict = this.findConflict(key, actionId);
    if (conflict) {
      return false;
    }

    this.customBindings.update((map) => {
      const newMap = new Map(map);
      if (key === action.defaultKey) {
        newMap.delete(actionId);
      } else {
        newMap.set(actionId, key);
      }
      return newMap;
    });

    this.saveCustomBindings();
    return true;
  }

  resetBinding(actionId: string): void {
    this.customBindings.update((map) => {
      const newMap = new Map(map);
      newMap.delete(actionId);
      return newMap;
    });
    this.saveCustomBindings();
  }

  resetAllBindings(): void {
    this.customBindings.set(new Map());
    this.saveCustomBindings();
  }

  findConflict(key: string, excludeActionId?: string): string | null {
    const custom = this.customBindings();
    for (const [actionId, boundKey] of custom.entries()) {
      if (actionId !== excludeActionId && boundKey === key) {
        return actionId;
      }
    }
    for (const [actionId, action] of this.actions.entries()) {
      if (
        actionId !== excludeActionId &&
        !custom.has(actionId) &&
        action.defaultKey === key
      ) {
        return actionId;
      }
    }
    return null;
  }

  private attachGlobalListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName.toLowerCase();
          if (
            tag === 'input' ||
            tag === 'textarea' ||
            target.isContentEditable
          ) {
            return;
          }
        }

        const key = this.eventToKeyString(event);
        if (!key) return;

        for (const [actionId, action] of this.actions.entries()) {
          const binding =
            this.customBindings().get(actionId) ?? action.defaultKey;
          if (binding === key) {
            event.preventDefault();
            event.stopPropagation();
            this.logService.log('keyboard', 'hotkey_execute', {
              parameters: { actionId, key, category: action.category },
            });
            action.handler();
            break;
          }
        }
      },
      true,
    );
  }

  private eventToKeyString(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');

    let key = event.key.toLowerCase();
    if (key === 'control' || key === 'shift' || key === 'alt' || key === 'meta')
      return '';

    parts.push(key);
    return parts.join('+');
  }

  keyStringToDisplay(key: string): string {
    return key
      .split('+')
      .map((part) => {
        if (part === 'ctrl') return 'Ctrl';
        if (part === 'shift') return 'Shift';
        if (part === 'alt') return 'Alt';
        return part.toUpperCase();
      })
      .join(' + ');
  }

  private loadCustomBindings(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;

      const stored = JSON.parse(raw) as StoredHotkeys;
      this.customBindings.set(new Map(Object.entries(stored)));
    } catch (error) {
      console.error('Failed to load custom hotkey bindings', error);
    }
  }

  private saveCustomBindings(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;

      const obj: StoredHotkeys = {};
      for (const [key, value] of this.customBindings().entries()) {
        obj[key] = value;
      }

      window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error('Failed to save custom hotkey bindings', error);
    }
  }
}
