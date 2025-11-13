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

  readonly onClose = output<void>();

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
