import { Injectable, inject, signal } from '@angular/core';
import { EditorHistoryService } from './editor-history.service';
import { ProjectSnapshot } from './history.types';

@Injectable({ providedIn: 'root' })
export class EditorProjectStateService {
  private readonly historyService = inject(EditorHistoryService);
  private readonly projectState = signal<ProjectSnapshot | null>(null);

  setState(snapshot: ProjectSnapshot, description?: string) {
    this.projectState.set(snapshot);
    this.historyService.pushSnapshot(snapshot, description);
  }

  getCurrentState(): ProjectSnapshot | null {
    return this.projectState();
  }
}
