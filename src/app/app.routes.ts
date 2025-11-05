import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Routes,
  ResolveFn,
} from '@angular/router';
import { EditorPage } from './editor/editor.page';
import { inject } from '@angular/core';
import { EditorDocumentService } from './services/editor-document.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface EditorResolverData {
  projectLoaded: boolean;
  error: string | null;
}

export const editorResolver: ResolveFn<EditorResolverData> = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Observable<EditorResolverData> => {
  const documentService = inject(EditorDocumentService);

  return documentService.loadProjectFromLocalStorage().pipe(
    map((loaded) => ({
      projectLoaded: loaded,
      error: null,
    })),
    catchError((error) => {
      console.error('Failed to load project from localStorage:', error);
      return of({
        projectLoaded: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }),
  );
};

export const routes: Routes = [
  { path: '', resolve: { editorData: editorResolver }, component: EditorPage },
];
