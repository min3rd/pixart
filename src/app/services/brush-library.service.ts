import { Injectable, signal, computed } from '@angular/core';

export interface CustomBrush {
  id: string;
  name: string;
  imageDataBase64: string;
  pixelData?: number[];
  width: number;
  height: number;
  type: 'soft' | 'hard' | 'normal';
  opacity: number;
  spacing: number;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class BrushLibraryService {
  private readonly customBrushesData = signal<CustomBrush[]>([]);
  private readonly STORAGE_KEY = 'pixart.customBrushes.v1';

  readonly customBrushes = this.customBrushesData.asReadonly();

  readonly hasCustomBrushes = computed(
    () => this.customBrushesData().length > 0,
  );

  constructor() {
    this.loadCustomBrushes();
  }

  addCustomBrush(
    customBrush: Omit<CustomBrush, 'id' | 'createdAt'>,
  ): CustomBrush {
    const uniqueId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const newBrush: CustomBrush = {
      ...customBrush,
      id: `brush_${uniqueId}`,
      createdAt: Date.now(),
    };
    this.customBrushesData.update((list) => [...list, newBrush]);
    this.saveCustomBrushes();
    return newBrush;
  }

  removeCustomBrush(id: string): boolean {
    const current = this.customBrushesData();
    const idx = current.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    this.customBrushesData.update((list) => list.filter((b) => b.id !== id));
    this.saveCustomBrushes();
    return true;
  }

  getCustomBrush(id: string): CustomBrush | undefined {
    return this.customBrushesData().find((b) => b.id === id);
  }

  updateCustomBrush(
    id: string,
    updates: Partial<Omit<CustomBrush, 'id' | 'createdAt'>>,
  ): boolean {
    const current = this.customBrushesData();
    const idx = current.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    this.customBrushesData.update((list) =>
      list.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    );
    this.saveCustomBrushes();
    return true;
  }

  private loadCustomBrushes(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CustomBrush[];
      if (Array.isArray(parsed)) {
        this.customBrushesData.set(parsed);
      }
    } catch {
      return;
    }
  }

  private saveCustomBrushes(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(this.customBrushesData()),
      );
    } catch {
      return;
    }
  }
}
