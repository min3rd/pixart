import { TestBed } from '@angular/core/testing';
import { EditorProjectStateService } from './editor-project-state.service';
import { EditorHistoryService } from './editor-history.service';
import { ProjectSnapshot } from './history.types';

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

  it('should emit state changes through Observable stream', (done) => {
    const mockSnapshot: ProjectSnapshot = {
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

    let emissionCount = 0;
    service.projectState$.subscribe((change) => {
      if (change) {
        emissionCount++;
        expect(change.snapshot).toEqual(mockSnapshot);
        expect(change.description).toBe('Test change');
        if (emissionCount === 1) {
          done();
        }
      }
    });

    service.emitStateChange(mockSnapshot, 'Test change');
  });

  it('should automatically create snapshots via history service', (done) => {
    const mockSnapshot: ProjectSnapshot = {
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

    spyOn(historyService, 'pushSnapshot');

    service.emitStateChange(mockSnapshot, 'Test change');

    setTimeout(() => {
      expect(historyService.pushSnapshot).toHaveBeenCalledWith(
        mockSnapshot,
        'Test change'
      );
      done();
    }, 100);
  });

  it('should get current state', () => {
    const mockSnapshot: ProjectSnapshot = {
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

    service.emitStateChange(mockSnapshot, 'Test');
    const currentState = service.getCurrentState();

    expect(currentState).toBeTruthy();
    expect(currentState?.snapshot).toEqual(mockSnapshot);
    expect(currentState?.description).toBe('Test');
  });
});
