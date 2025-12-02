import { Injectable, signal, computed } from '@angular/core';

export type WarpGridSize = '3x3' | '4x4' | '5x5';

export interface WarpPoint {
  x: number;
  y: number;
}

export interface WarpGridNode extends WarpPoint {
  row: number;
  col: number;
  originalX: number;
  originalY: number;
}

export interface WarpState {
  active: boolean;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  gridSize: WarpGridSize;
  nodes: WarpGridNode[];
  smoothing: number;
}

@Injectable({ providedIn: 'root' })
export class EditorWarpService {
  readonly warpState = signal<WarpState | null>(null);
  readonly isDraggingNode = signal<WarpGridNode | null>(null);
  readonly dragStartPos = signal<{ x: number; y: number } | null>(null);

  readonly isActive = computed(() => this.warpState() !== null);

  startWarp(
    x: number,
    y: number,
    width: number,
    height: number,
    gridSize: WarpGridSize = '3x3',
  ): void {
    const nodes = this.createGridNodes(x, y, width, height, gridSize);
    this.warpState.set({
      active: true,
      sourceX: x,
      sourceY: y,
      sourceWidth: width,
      sourceHeight: height,
      gridSize,
      nodes,
      smoothing: 0.5,
    });
  }

  private createGridNodes(
    x: number,
    y: number,
    width: number,
    height: number,
    gridSize: WarpGridSize,
  ): WarpGridNode[] {
    const [rows, cols] = gridSize.split('x').map(Number);
    const nodes: WarpGridNode[] = [];

    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const nodeX = x + (width * col) / cols;
        const nodeY = y + (height * row) / rows;
        nodes.push({
          row,
          col,
          x: nodeX,
          y: nodeY,
          originalX: (width * col) / cols,
          originalY: (height * row) / rows,
        });
      }
    }

    return nodes;
  }

  updateNode(node: WarpGridNode, x: number, y: number): void {
    const current = this.warpState();
    if (!current) return;

    const nodes = current.nodes.map((n) => {
      if (n.row === node.row && n.col === node.col) {
        return { ...n, x, y };
      }
      return n;
    });

    this.warpState.set({ ...current, nodes });
  }

  setGridSize(gridSize: WarpGridSize): void {
    const current = this.warpState();
    if (!current) return;

    const nodes = this.createGridNodes(
      current.sourceX,
      current.sourceY,
      current.sourceWidth,
      current.sourceHeight,
      gridSize,
    );

    this.warpState.set({ ...current, gridSize, nodes });
  }

  setSmoothing(smoothing: number): void {
    const current = this.warpState();
    if (!current) return;
    this.warpState.set({ ...current, smoothing });
  }

  commitWarp(): WarpState | null {
    const state = this.warpState();
    this.warpState.set(null);
    this.isDraggingNode.set(null);
    this.dragStartPos.set(null);
    return state;
  }

  cancelWarp(): void {
    this.warpState.set(null);
    this.isDraggingNode.set(null);
    this.dragStartPos.set(null);
  }

  startNodeDrag(node: WarpGridNode, x: number, y: number): void {
    const state = this.warpState();
    if (!state) return;
    this.isDraggingNode.set(node);
    this.dragStartPos.set({ x, y });
  }

  updateNodeDrag(x: number, y: number): void {
    const node = this.isDraggingNode();
    if (!node) return;
    this.updateNode(node, x, y);
  }

  endNodeDrag(): void {
    this.isDraggingNode.set(null);
    this.dragStartPos.set(null);
  }

  resetNodes(): void {
    const state = this.warpState();
    if (!state) return;

    const nodes = state.nodes.map((n) => ({
      ...n,
      x: n.originalX,
      y: n.originalY,
    }));

    this.warpState.set({ ...state, nodes });
  }

  getNode(row: number, col: number): WarpGridNode | null {
    const state = this.warpState();
    if (!state) return null;

    return state.nodes.find((n) => n.row === row && n.col === col) || null;
  }

  getGridDimensions(): { rows: number; cols: number } | null {
    const state = this.warpState();
    if (!state) return null;

    const [rows, cols] = state.gridSize.split('x').map(Number);
    return { rows, cols };
  }
}
