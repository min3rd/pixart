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
  private readonly projectStateSubject = new BehaviorSubject<ProjectSnapshot | null>(null);
  private subscription?: Subscription;
  private lastDescription?: string;
  
  readonly projectState$: Observable<ProjectSnapshot | null> = this.projectStateSubject.asObservable();

  constructor() {
    this.setupAutomaticSnapshot();
  }

  private setupAutomaticSnapshot() {
    this.subscription = this.projectState$
      .pipe(
        skip(1),
        distinctUntilChanged(),
        tap((snapshot) => {
          if (snapshot) {
            this.historyService.pushSnapshot(snapshot, this.lastDescription);
            this.lastDescription = undefined;
          }
        })
      )
      .subscribe();
  }

  setState(snapshot: ProjectSnapshot, description?: string) {
    this.lastDescription = description;
    this.projectStateSubject.next(snapshot);
  }

  getCurrentState(): ProjectSnapshot | null {
    return this.projectStateSubject.value;
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.projectStateSubject.complete();
  }
}
