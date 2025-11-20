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
  readonly draggable = input<boolean>(false);
  readonly showBackdrop = input<boolean>(true);

  readonly onClose = output<void>();

  readonly dialogX = signal<number>(0);
  readonly dialogY = signal<number>(0);
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dialogStartX = 0;
  private dialogStartY = 0;

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
      window.addEventListener('mousemove', (e) => this.onDragMove(e));
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

  onDragStart(event: MouseEvent): void {
    if (!this.draggable()) return;
    this.isDragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dialogStartX = this.dialogX();
    this.dialogStartY = this.dialogY();
    event.preventDefault();
  }

  private onDragMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.dialogX.set(this.dialogStartX + dx);
    this.dialogY.set(this.dialogStartY + dy);
  }

  private onDragEnd(): void {
    this.isDragging = false;
  }

  handleBackdropClick(event: MouseEvent): void {
    if (this.closeOnBackdrop() && event.target === event.currentTarget) {
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
