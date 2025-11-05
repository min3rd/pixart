import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface Pixel {
  x: number;
  y: number;
  color: string;
  alpha?: number;
}

export interface PixelGrid {
  width: number;
  height: number;
  pixelSize: number;
  pixels: Pixel[];
}

export interface Frame {
  id: string;
  name?: string;
  pixelGrid: PixelGrid;
  duration: number; // ms
}

export interface Animation {
  id: string;
  name?: string;
  frames: Frame[];
  loopCount?: number;
}

export interface Sprite {
  id: string;
  name?: string;
  animations: Animation[];
  metadata?: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  created: string; // ISO date
  modified: string; // ISO date
  sprites: Sprite[];
  metadata?: Record<string, any>;
}

// Typings for the File System Access API are not guaranteed in all TS setups here,
// so we use `any` for handles (these are platform-provided objects).
type FileHandle = any;

@Injectable({ providedIn: 'root' })
export class FileService {
  // Map project.id -> file handle so we can save back to same file when possible
  private fileHandles = new Map<string, FileHandle>();

  constructor() {}

  createProject(name: string): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: name || `Project ${now}`,
      created: now,
      modified: now,
      sprites: [],
      metadata: {},
    };
    return project;
  }

  openProjectFromPicker(): Observable<Project | null> {
    if (window && (window as any).showOpenFilePicker) {
      let fileHandle: any;
      return from(
        (window as any).showOpenFilePicker({
          types: [
            {
              description: 'PixArt project (JSON)',
              accept: { 'application/json': ['.json', '.pix'] },
            },
          ],
          multiple: false,
        }) as Promise<any[]>,
      ).pipe(
        switchMap((handles: any[]) => {
          fileHandle = handles[0];
          return from(fileHandle.getFile() as Promise<File>);
        }),
        switchMap((file: File) => from(file.text())),
        map((text: string) => {
          const parsed = JSON.parse(text) as Project;
          const projectId =
            parsed.id ||
            `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          parsed.id = projectId;
          this.fileHandles.set(projectId, fileHandle);
          return parsed;
        }),
        catchError((e) => {
          console.warn('Open project canceled or failed', e);
          return of(null);
        }),
      );
    }

    return this.openProjectFromInputFile().pipe(
      catchError((e) => {
        console.warn('Open project from input file failed', e);
        return of(null);
      })
    );
  }

  openProjectFromFile(file: File): Observable<Project | null> {
    return from(file.text()).pipe(
      map((text: string) => {
        const parsed = JSON.parse(text) as Project;
        parsed.id =
          parsed.id ||
          `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        return parsed;
      }),
      catchError((e) => {
        console.error('Failed to open project from file', e);
        return of(null);
      }),
    );
  }

  private openProjectFromInputFile(): Observable<Project | null> {
    return new Observable<Project | null>((observer) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) {
          observer.next(null);
          observer.complete();
          return;
        }
        this.openProjectFromFile(f).subscribe({
          next: (project) => {
            observer.next(project);
            observer.complete();
          },
          error: (err) => {
            observer.error(err);
          },
        });
      };
      input.click();
    });
  }

  saveProjectToFile(
    project: Project,
    suggestedName?: string,
  ): Observable<boolean> {
    const contents = this.projectToJson(project);

    const knownHandle = this.fileHandles.get(project.id);
    if (knownHandle && knownHandle.createWritable) {
      return from(knownHandle.createWritable()).pipe(
        switchMap((writable: any) =>
          from(writable.write(contents)).pipe(
            switchMap(() => from(writable.close())),
            map(() => {
              project.modified = new Date().toISOString();
              return true;
            }),
          ),
        ),
        catchError((e) => {
          console.warn(
            'Failed to write to known handle, will fallback to save-as',
            e,
          );
          return this.saveAsNewFile(project, contents, suggestedName);
        }),
      );
    }

    if (window && (window as any).showSaveFilePicker) {
      return this.saveAsNewFile(project, contents, suggestedName);
    }

    this.downloadString(
      contents,
      suggestedName || `${project.name || 'project'}.json`,
    );
    project.modified = new Date().toISOString();
    return of(true);
  }

  private saveAsNewFile(
    project: Project,
    contents: string,
    suggestedName?: string,
  ): Observable<boolean> {
    return from(
      (window as any).showSaveFilePicker({
        suggestedName: suggestedName || `${project.name || 'project'}.json`,
        types: [
          {
            description: 'PixArt project (JSON)',
            accept: { 'application/json': ['.json', '.pix'] },
          },
        ],
      }),
    ).pipe(
      switchMap((handle: any) =>
        from(handle.createWritable()).pipe(
          switchMap((writable: any) =>
            from(writable.write(contents)).pipe(
              switchMap(() => from(writable.close())),
              map(() => {
                this.fileHandles.set(project.id, handle);
                project.modified = new Date().toISOString();
                return true;
              }),
            ),
          ),
        ),
      ),
      catchError((e) => {
        console.warn('Save-as canceled or failed', e);
        this.downloadString(
          contents,
          suggestedName || `${project.name || 'project'}.json`,
        );
        project.modified = new Date().toISOString();
        return of(true);
      }),
    );
  }

  /**
   * Export project by returning JSON string or triggering a download (download preferred for file-based flow)
   */
  exportProjectToDownload(project: Project, filename?: string): void {
    const contents = this.projectToJson(project);
    this.downloadString(
      contents,
      filename || `${project.name || 'project'}.json`,
    );
  }

  importProjectFromFile(file: File): Observable<Project | null> {
    return this.openProjectFromFile(file);
  }

  /**
   * Convert project to JSON string (pretty-printed)
   */
  projectToJson(project: Project): string {
    return JSON.stringify(project, null, 2);
  }

  /**
   * Utility: trigger download of string content as a file
   */
  private downloadString(content: string, filename: string): void {
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download project', e);
    }
  }

  /**
   * Clear remembered file handle for a project (not delete user's file)
   */
  clearFileHandle(projectId: string): void {
    this.fileHandles.delete(projectId);
  }
}
