import { TestBed } from '@angular/core/testing';
import { EditorDocumentService } from './editor-document.service';
import { EditorProjectStateService } from './editor/editor-project-state.service';
import { EditorHistoryService } from './editor/editor-history.service';

describe('EditorDocumentService - Undo/Redo Integration', () => {
  let service: EditorDocumentService;
  let historyService: EditorHistoryService;
  let projectStateService: EditorProjectStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EditorDocumentService);
    historyService = TestBed.inject(EditorHistoryService);
    projectStateService = TestBed.inject(EditorProjectStateService);
    historyService.clearHistory();
  });

  it('should create snapshots through signal updates when adding layers', () => {
    spyOn(projectStateService, 'setState').and.callThrough();

    service.addLayer('Test Layer');

    expect(projectStateService.setState).toHaveBeenCalledWith(
      jasmine.any(Object),
      'Add layer',
    );
    expect(historyService.canUndo()).toBe(true);
  });

  it('should support undo after layer operations', () => {
    const initialLayers = service.layers().length;

    service.addLayer('Test Layer 1');

    expect(service.layers().length).toBe(initialLayers + 1);
    expect(historyService.canUndo()).toBe(true);

    service.undo();

    expect(service.layers().length).toBe(initialLayers);
  });

  it('should support redo after undo', () => {
    const initialLayers = service.layers().length;

    service.addLayer('Test Layer 1');

    expect(service.layers().length).toBe(initialLayers + 1);

    service.undo();

    expect(service.layers().length).toBe(initialLayers);
    expect(historyService.canRedo()).toBe(true);

    service.redo();

    expect(service.layers().length).toBe(initialLayers + 1);
  });

  it('should create snapshots for canvas resize operations', () => {
    spyOn(projectStateService, 'setState').and.callThrough();

    service.setCanvasSize(128, 128);

    expect(projectStateService.setState).toHaveBeenCalledWith(
      jasmine.any(Object),
      'Resize canvas',
    );
    expect(historyService.canUndo()).toBe(true);
  });

  it('should create snapshots for layer visibility toggle', () => {
    service.addLayer('Test Layer');

    const layerId = service.layers()[0].id;
    spyOn(projectStateService, 'setState').and.callThrough();

    service.toggleLayerVisibility(layerId);

    expect(projectStateService.setState).toHaveBeenCalledWith(
      jasmine.any(Object),
      'Toggle layer visibility',
    );
  });

  it('should create snapshots for selection operations', () => {
    spyOn(projectStateService, 'setState').and.callThrough();

    service.beginSelection(0, 0, 'rect');
    service.updateSelection(10, 10);
    service.endSelection();

    expect(projectStateService.setState).toHaveBeenCalledWith(
      jasmine.any(Object),
      'Create selection',
    );
  });
});
