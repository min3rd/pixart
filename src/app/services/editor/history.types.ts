export interface ProjectSnapshot {
  canvas: {
    width: number;
    height: number;
  };
  layers: any[];
  layerBuffers: Record<string, string[]>;
  selectedLayerId: string;
  selectedLayerIds: string[];
  selection: {
    rect: any;
    shape: 'rect' | 'ellipse' | 'lasso';
    polygon: any;
    mask: any;
  } | null;
  frames: any[];
  currentFrameIndex: number;
  animations: any[];
  currentAnimationIndex: number;
  boneHierarchy: any[];
  selectedBoneId: string;
  bones: Record<string, any[]>;
  keyframes: any;
  pixelBindings: any;
  animationCurrentTime: number;
  animationDuration: number;
  timelineMode: 'frame' | 'time';
  toolSnapshot: any;
}

export interface HistoryEntry {
  snapshot: ProjectSnapshot;
  description?: string;
  timestamp: number;
}

export interface LayerChange {
  layerId: string;
  indices: number[];
  previous: string[];
  next: string[];
}

export interface MetaChange {
  key: string;
  previous: any;
  next: any;
}

export interface CurrentAction {
  map: Map<string, { indices: number[]; previous: string[]; next: string[] }>;
  meta: MetaChange[];
  description?: string;
}
