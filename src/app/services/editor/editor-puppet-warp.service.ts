import { Injectable, signal, computed } from '@angular/core';

export interface PuppetWarpPinData {
  id: string;
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  radius: number;
  locked: boolean;
}

export interface PuppetWarpState {
  active: boolean;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  pins: PuppetWarpPinData[];
  defaultRadius: number;
}

@Injectable({ providedIn: 'root' })
export class EditorPuppetWarpService {
  readonly puppetWarpState = signal<PuppetWarpState | null>(null);
  readonly isDraggingPin = signal<PuppetWarpPinData | null>(null);
  readonly dragStartPos = signal<{ x: number; y: number } | null>(null);
  readonly selectedPin = signal<PuppetWarpPinData | null>(null);

  readonly isActive = computed(() => this.puppetWarpState() !== null);

  startPuppetWarp(x: number, y: number, width: number, height: number): void {
    this.puppetWarpState.set({
      active: true,
      sourceX: x,
      sourceY: y,
      sourceWidth: width,
      sourceHeight: height,
      pins: [],
      defaultRadius: Math.min(width, height) * 0.15,
    });
  }

  addPin(x: number, y: number, radius?: number): PuppetWarpPinData {
    const state = this.puppetWarpState();
    if (!state) throw new Error('Puppet warp not active');

    const pin: PuppetWarpPinData = {
      id: `pin-${Date.now()}-${Math.random()}`,
      x,
      y,
      originalX: x - state.sourceX,
      originalY: y - state.sourceY,
      radius: radius || state.defaultRadius,
      locked: false,
    };

    this.puppetWarpState.set({
      ...state,
      pins: [...state.pins, pin],
    });

    return pin;
  }

  removePin(pinId: string): void {
    const state = this.puppetWarpState();
    if (!state) return;

    this.puppetWarpState.set({
      ...state,
      pins: state.pins.filter((p) => p.id !== pinId),
    });

    if (this.selectedPin()?.id === pinId) {
      this.selectedPin.set(null);
    }
  }

  updatePin(pinId: string, x: number, y: number): void {
    const state = this.puppetWarpState();
    if (!state) return;

    const pins = state.pins.map((p) => {
      if (p.id === pinId && !p.locked) {
        return { ...p, x, y };
      }
      return p;
    });

    this.puppetWarpState.set({ ...state, pins });
  }

  setPinRadius(pinId: string, radius: number): void {
    const state = this.puppetWarpState();
    if (!state) return;

    const pins = state.pins.map((p) => {
      if (p.id === pinId) {
        return { ...p, radius };
      }
      return p;
    });

    this.puppetWarpState.set({ ...state, pins });
  }

  togglePinLock(pinId: string): void {
    const state = this.puppetWarpState();
    if (!state) return;

    const pins = state.pins.map((p) => {
      if (p.id === pinId) {
        return { ...p, locked: !p.locked };
      }
      return p;
    });

    this.puppetWarpState.set({ ...state, pins });
  }

  commitPuppetWarp(): PuppetWarpState | null {
    const state = this.puppetWarpState();
    this.puppetWarpState.set(null);
    this.isDraggingPin.set(null);
    this.dragStartPos.set(null);
    this.selectedPin.set(null);
    return state;
  }

  cancelPuppetWarp(): void {
    this.puppetWarpState.set(null);
    this.isDraggingPin.set(null);
    this.dragStartPos.set(null);
    this.selectedPin.set(null);
  }

  startPinDrag(pin: PuppetWarpPinData, x: number, y: number): void {
    const state = this.puppetWarpState();
    if (!state || pin.locked) return;
    this.isDraggingPin.set(pin);
    this.dragStartPos.set({ x, y });
  }

  updatePinDrag(x: number, y: number): void {
    const pin = this.isDraggingPin();
    if (!pin) return;
    this.updatePin(pin.id, x, y);
  }

  endPinDrag(): void {
    this.isDraggingPin.set(null);
    this.dragStartPos.set(null);
  }

  resetPins(): void {
    const state = this.puppetWarpState();
    if (!state) return;

    const pins = state.pins.map((p) => ({
      ...p,
      x: p.originalX,
      y: p.originalY,
    }));

    this.puppetWarpState.set({ ...state, pins });
  }

  findPinAtPosition(x: number, y: number, threshold = 10): PuppetWarpPinData | null {
    const state = this.puppetWarpState();
    if (!state) return null;

    return (
      state.pins.find((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
      }) || null
    );
  }

  setDefaultRadius(radius: number): void {
    const state = this.puppetWarpState();
    if (!state) return;
    this.puppetWarpState.set({ ...state, defaultRadius: radius });
  }
}
