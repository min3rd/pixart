import { TestBed } from '@angular/core/testing';
import { EditorProjectStateService } from './editor-project-state.service';
import { EditorHistoryService } from './editor-history.service';
import { ProjectSnapshot } from './history.types';

function createMockProjectSnapshot(): ProjectSnapshot {
  return {
    canvas: { width: 64, height: 64 },
    layers: [],
    layerBuffers: {},
    selectedLayerId: '',
    selectedLayerIds: [],
    selection: null,
    frames: [],
    currentFrameIndex: 0,
    animations: [],
    currentAnimationIndex: 0,
    boneHierarchy: [],
    selectedBoneId: '',
    bones: {},
    keyframes: null,
    pixelBindings: null,
    animationCurrentTime: 0,
    animationDuration: 1000,
    timelineMode: 'frame',
    toolSnapshot: null,
  };
}

describe('EditorProjectStateService', () => {
  let service: EditorProjectStateService;
  let historyService: EditorHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EditorProjectStateService);
    historyService = TestBed.inject(EditorHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should update state via setState', () => {
    const mockSnapshot = createMockProjectSnapshot();

    service.setState(mockSnapshot, 'Test change');
    const currentState = service.getCurrentState();

    expect(currentState).toEqual(mockSnapshot);
  });

  it('should automatically create snapshots via history service', () => {
    const mockSnapshot = createMockProjectSnapshot();

    spyOn(historyService, 'pushSnapshot');

    service.setState(mockSnapshot, 'Test change');

    expect(historyService.pushSnapshot).toHaveBeenCalledWith(
      mockSnapshot,
      'Test change',
    );
  });

  it('should get current state', () => {
    const mockSnapshot = createMockProjectSnapshot();

    service.setState(mockSnapshot, 'Test');
    const currentState = service.getCurrentState();

    expect(currentState).toBeTruthy();
    expect(currentState).toEqual(mockSnapshot);
  });
});
