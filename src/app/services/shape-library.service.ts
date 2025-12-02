import { Injectable, signal, computed } from '@angular/core';

export type ShapeType = 'filled' | 'outlined' | 'both';

export interface CustomShape {
  id: string;
  name: string;
  pathData: string;
  shapeType: ShapeType;
  cornerRadius: number;
  pathSmoothing: number;
  width: number;
  height: number;
  imageDataBase64: string;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class ShapeLibraryService {
  private readonly customShapesData = signal<CustomShape[]>([]);
  private readonly STORAGE_KEY = 'pixart.customShapes.v1';

  readonly customShapes = this.customShapesData.asReadonly();

  constructor() {
    this.loadCustomShapes();
  }

  addCustomShape(shape: Omit<CustomShape, 'id' | 'createdAt'>): CustomShape {
    const uniqueId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const newShape: CustomShape = {
      ...shape,
      id: `custom_shape_${uniqueId}`,
      createdAt: Date.now(),
    };
    this.customShapesData.update((list) => [...list, newShape]);
    this.saveCustomShapes();
    return newShape;
  }

  removeCustomShape(id: string): boolean {
    const current = this.customShapesData();
    const idx = current.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.customShapesData.update((list) => list.filter((s) => s.id !== id));
    this.saveCustomShapes();
    return true;
  }

  getCustomShape(id: string): CustomShape | undefined {
    return this.customShapesData().find((s) => s.id === id);
  }

  updateCustomShape(
    id: string,
    updates: Partial<Omit<CustomShape, 'id' | 'createdAt'>>,
  ): boolean {
    const current = this.customShapesData();
    const idx = current.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.customShapesData.update((list) =>
      list.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
    this.saveCustomShapes();
    return true;
  }

  private loadCustomShapes(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CustomShape[];
      if (Array.isArray(parsed)) {
        this.customShapesData.set(parsed);
      }
    } catch (error) {
      console.error('Failed to load custom shapes', error);
    }
  }

  private saveCustomShapes(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(this.customShapesData()),
      );
    } catch (error) {
      console.error('Failed to save custom shapes', error);
    }
  }
}
