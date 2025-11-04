import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

export interface EditPointResult {
  name: string;
  color: string;
}

@Component({
  selector: 'pa-edit-point-dialog',
  templateUrl: './edit-point-dialog.component.html',
  styleUrls: ['./edit-point-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, NgIcon, FormsModule],
  providers: [
    provideIcons({
      heroXMark,
    }),
  ],
})
export class EditPointDialog {
  readonly isOpen = signal(false);
  readonly pointId = signal<string>('');
  readonly pointName = signal<string>('');
  readonly pointColor = signal<string>('#ff6600');

  readonly onConfirm = output<EditPointResult>();
  readonly onCancel = output<void>();

  open(pointId: string, currentName?: string, currentColor?: string) {
    this.pointId.set(pointId);
    this.pointName.set(currentName || '');
    this.pointColor.set(currentColor || '#ff6600');
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.pointId.set('');
    this.pointName.set('');
    this.pointColor.set('#ff6600');
  }

  handleConfirm() {
    const name = this.pointName().trim();
    const color = this.pointColor();
    this.onConfirm.emit({ name, color });
    this.close();
  }

  handleCancel() {
    this.onCancel.emit();
    this.close();
  }

  handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.handleCancel();
    }
  }

  onNameInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.pointName.set(input.value);
  }

  onColorInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.pointColor.set(input.value);
  }
}
