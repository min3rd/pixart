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

  it('should create snapshots through Observable stream when adding layers', (done) => {
    spyOn(projectStateService, 'setState').and.callThrough();

    service.addLayer('Test Layer');

    setTimeout(() => {
      expect(projectStateService.setState).toHaveBeenCalledWith(
        jasmine.any(Object),
        'Add layer'
      );
      expect(historyService.canUndo()).toBe(true);
      done();
    }, 100);
  });

  it('should support undo after layer operations', (done) => {
    const initialLayers = service.layers().length;

    service.addLayer('Test Layer 1');

    setTimeout(() => {
      expect(service.layers().length).toBe(initialLayers + 1);
      expect(historyService.canUndo()).toBe(true);

      service.undo();

      setTimeout(() => {
        expect(service.layers().length).toBe(initialLayers);
        done();
      }, 50);
    }, 100);
  });

  it('should support redo after undo', (done) => {
    const initialLayers = service.layers().length;

    service.addLayer('Test Layer 1');

    setTimeout(() => {
      expect(service.layers().length).toBe(initialLayers + 1);

      service.undo();

      setTimeout(() => {
        expect(service.layers().length).toBe(initialLayers);
        expect(historyService.canRedo()).toBe(true);

        service.redo();

        setTimeout(() => {
          expect(service.layers().length).toBe(initialLayers + 1);
          done();
        }, 50);
      }, 50);
    }, 100);
  });

  it('should create snapshots for canvas resize operations', (done) => {
    spyOn(projectStateService, 'setState').and.callThrough();

    service.setCanvasSize(128, 128);

    setTimeout(() => {
      expect(projectStateService.setState).toHaveBeenCalledWith(
        jasmine.any(Object),
        'Resize canvas'
      );
      expect(historyService.canUndo()).toBe(true);
      done();
    }, 100);
  });

  it('should create snapshots for layer visibility toggle', (done) => {
    service.addLayer('Test Layer');

    setTimeout(() => {
      const layerId = service.layers()[0].id;
      spyOn(projectStateService, 'setState').and.callThrough();

      service.toggleLayerVisibility(layerId);

      setTimeout(() => {
        expect(projectStateService.setState).toHaveBeenCalledWith(
          jasmine.any(Object),
          'Toggle layer visibility'
        );
        done();
      }, 100);
    }, 100);
  });

  it('should create snapshots for selection operations', (done) => {
    spyOn(projectStateService, 'setState').and.callThrough();

    service.beginSelection(0, 0, 'rect');
    service.updateSelection(10, 10);
    service.endSelection();

    setTimeout(() => {
      expect(projectStateService.setState).toHaveBeenCalledWith(
        jasmine.any(Object),
        'Create selection'
      );
      done();
    }, 100);
  });
});
