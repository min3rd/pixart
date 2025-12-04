import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

@Component({
  selector: 'pa-modal',
  templateUrl: './modal.html',
  styleUrls: ['./modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, NgIcon],
})
export class Modal {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly size = input<ModalSize>('md');
  readonly showCloseButton = input<boolean>(true);
  readonly closeOnBackdrop = input<boolean>(true);
  readonly closeOnEscape = input<boolean>(true);
  readonly modalId = input<string>('modal');
  readonly draggable = input<boolean>(true);
  readonly showBackdrop = input<boolean>(false);

  readonly onClose = output<void>();

  readonly dialogX = signal<number>(0);
  readonly dialogY = signal<number>(0);
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dialogStartX = 0;
  private dialogStartY = 0;
  private activePointerId: number | null = null;
  private dragElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.isOpen() && this.closeOnEscape()) {
        const handleEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            this.handleClose();
          }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }
      return undefined;
    });

    effect(() => {
      const open = this.isOpen();
      const isDraggable = this.draggable();
      if (open && isDraggable) {
        this.centerDialog();
      }
    });

    if (typeof window !== 'undefined') {
      // Use pointer events to avoid interfering with mouse/touch interactions on inputs
      window.addEventListener('pointermove', (e) =>
        this.onPointerMove(e as PointerEvent),
      );
      window.addEventListener('pointerup', () => this.onDragEnd());
      // Fallback for older browsers that do not support pointer events
      window.addEventListener('mousemove', (e) =>
        this.onDragMove(e as MouseEvent),
      );
      window.addEventListener('mouseup', () => this.onDragEnd());
    }
  }

  private centerDialog(): void {
    if (typeof window !== 'undefined') {
      const width = this.getDialogWidth();
      this.dialogX.set((window.innerWidth - width) / 2);
      this.dialogY.set(window.innerHeight * 0.2);
    }
  }

  private getDialogWidth(): number {
    const sizeMap: Record<ModalSize, number> = {
      sm: 384,
      md: 672,
      lg: 896,
      xl: 1152,
      full: window.innerWidth - 32,
    };
    return sizeMap[this.size()];
  }

  onDragStart(event: PointerEvent | MouseEvent): void {
    if (!this.draggable()) return;
    // If the target is an interactive element, don't start dragging
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    this.isDragging = true;
    this.dragStartX =
      (event as PointerEvent).clientX ?? (event as MouseEvent).clientX;
    this.dragStartY =
      (event as PointerEvent).clientY ?? (event as MouseEvent).clientY;
    this.dialogStartX = this.dialogX();
    this.dialogStartY = this.dialogY();
    // Store pointerId if present so we only track that pointer
    if ((event as PointerEvent).pointerId !== undefined) {
      this.activePointerId = (event as PointerEvent).pointerId;
      try {
        this.dragElement = event.target as HTMLElement;
        this.dragElement?.setPointerCapture?.(this.activePointerId);
      } catch {}
    }
    // Prevent default to avoid selection but do not stop propagation so inputs can still focus
    event.preventDefault();
  }

  private onDragMove(event: MouseEvent): void {
    // Legacy mouse move handler
    if (!this.isDragging) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.dialogX.set(this.dialogStartX + dx);
    this.dialogY.set(this.dialogStartY + dy);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;
    if (
      this.activePointerId !== null &&
      event.pointerId !== this.activePointerId
    )
      return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.dialogX.set(this.dialogStartX + dx);
    this.dialogY.set(this.dialogStartY + dy);
  }

  private onDragEnd(): void {
    this.isDragging = false;
    if (this.activePointerId !== null) {
      try {
        this.dragElement?.releasePointerCapture?.(this.activePointerId);
      } catch {}
    }
    this.activePointerId = null;
    this.dragElement = null;
  }

  handleBackdropClick(event: MouseEvent): void {
    if (this.showBackdrop() && this.closeOnBackdrop() && event.target === event.currentTarget) {
      this.handleClose();
    }
  }

  handleClose(): void {
    this.onClose.emit();
  }

  getSizeClass(): string {
    const sizeMap: Record<ModalSize, string> = {
      sm: 'max-w-sm',
      md: 'max-w-2xl',
      lg: 'max-w-4xl',
      xl: 'max-w-6xl',
      full: 'max-w-full mx-4',
    };
    return sizeMap[this.size()];
  }
}
