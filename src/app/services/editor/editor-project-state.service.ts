import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, skip, tap } from 'rxjs/operators';
import { EditorHistoryService } from './editor-history.service';
import { ProjectSnapshot } from './history.types';

export interface ProjectStateChange {
  snapshot: ProjectSnapshot;
  description?: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class EditorProjectStateService implements OnDestroy {
  private readonly historyService = inject(EditorHistoryService);
  private readonly projectStateSubject = new BehaviorSubject<ProjectStateChange | null>(null);
  private subscription?: Subscription;
  
  readonly projectState$: Observable<ProjectStateChange | null> = this.projectStateSubject.asObservable();

  constructor() {
    this.setupAutomaticSnapshot();
  }

  private setupAutomaticSnapshot() {
    this.subscription = this.projectState$
      .pipe(
        skip(1),
        distinctUntilChanged(),
        tap((change) => {
          if (change && change.snapshot) {
            this.historyService.pushSnapshot(change.snapshot, change.description);
          }
        })
      )
      .subscribe();
  }

  emitStateChange(snapshot: ProjectSnapshot, description?: string) {
    const change: ProjectStateChange = {
      snapshot,
      description,
      timestamp: Date.now(),
    };
    this.projectStateSubject.next(change);
  }

  getCurrentState(): ProjectStateChange | null {
    return this.projectStateSubject.value;
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.projectStateSubject.complete();
  }
}
