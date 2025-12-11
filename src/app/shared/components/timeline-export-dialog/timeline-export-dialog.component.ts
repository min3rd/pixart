import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Modal } from '../modal/modal';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowDownTray } from '@ng-icons/heroicons/outline';
import {
  EditorTimelineExportService,
  TimelineExportFormat,
  TimelineExportRange,
} from '../../../services/editor/editor-timeline-export.service';
import { EditorDocumentService } from '../../../services/editor-document.service';

export interface TimelineExportResult {
  format: TimelineExportFormat;
  range: TimelineExportRange;
  fromFrame: number;
  toFrame: number;
  spritesheetColumns: number;
  spritesheetRows: number;
  spritesheetPadding: number;
}

@Component({
  selector: 'pa-timeline-export-dialog',
  templateUrl: './timeline-export-dialog.component.html',
  styleUrls: ['./timeline-export-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Modal, NgIconComponent],
  providers: [provideIcons({ heroArrowDownTray })],
})
export class TimelineExportDialog {
  readonly isOpen = signal(false);
  readonly format = signal<TimelineExportFormat>('png');
  readonly range = signal<TimelineExportRange>('all');
  readonly fromFrame = signal<number>(1);
  readonly toFrame = signal<number>(1);
  readonly spritesheetColumns = signal<number>(8);
  readonly spritesheetRows = signal<number>(1);
  readonly spritesheetPadding = signal<number>(0);

  readonly exportService = inject(EditorTimelineExportService);
  readonly document = inject(EditorDocumentService);

  readonly onConfirm = output<TimelineExportResult>();
  readonly onCancel = output<void>();

  readonly showCustomRange = computed(() => this.range() === 'custom');
  readonly totalFrames = computed(() => this.document.frames().length);

  readonly formatOptions: { value: TimelineExportFormat; key: string }[] = [
    { value: 'png', key: 'timeline.exportDialog.formatPng' },
    { value: 'jpeg', key: 'timeline.exportDialog.formatJpeg' },
    { value: 'bmp', key: 'timeline.exportDialog.formatBmp' },
    { value: 'gif', key: 'timeline.exportDialog.formatGif' },
  ];

  readonly rangeOptions: { value: TimelineExportRange; key: string }[] = [
    { value: 'all', key: 'timeline.exportDialog.rangeAll' },
    { value: 'current', key: 'timeline.exportDialog.rangeCurrent' },
    { value: 'custom', key: 'timeline.exportDialog.rangeCustom' },
  ];

  open() {
    this.format.set('png');
    this.range.set('all');
    this.fromFrame.set(1);
    const total = this.totalFrames();
    this.toFrame.set(Math.max(1, total));
    this.spritesheetColumns.set(8);
    this.spritesheetRows.set(Math.ceil(total / 8));
    this.spritesheetPadding.set(0);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  handleConfirm() {
    const options = {
      format: this.format(),
      range: this.range(),
      fromFrame: this.fromFrame(),
      toFrame: this.toFrame(),
      spritesheetColumns: this.spritesheetColumns(),
      spritesheetRows: this.spritesheetRows(),
      spritesheetPadding: this.spritesheetPadding(),
    };

    this.exportService.exportTimeline(options);
    this.onConfirm.emit(options);
    this.close();
  }

  handleCancel() {
    this.onCancel.emit();
    this.close();
  }

  onFormatChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.format.set(select.value as TimelineExportFormat);
  }

  onRangeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.range.set(select.value as TimelineExportRange);
  }

  onFromFrameChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = Number.parseInt(input.value, 10);
    if (!Number.isNaN(value)) {
      this.fromFrame.set(Math.max(1, Math.min(value, this.totalFrames())));
    }
  }

  onToFrameChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = Number.parseInt(input.value, 10);
    if (!Number.isNaN(value)) {
      this.toFrame.set(Math.max(1, Math.min(value, this.totalFrames())));
    }
  }

  onColumnsChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = Number.parseInt(input.value, 10);
    if (!Number.isNaN(value)) {
      this.spritesheetColumns.set(Math.max(1, Math.min(value, 20)));
    }
  }

  onRowsChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = Number.parseInt(input.value, 10);
    if (!Number.isNaN(value)) {
      this.spritesheetRows.set(Math.max(1, Math.min(value, 20)));
    }
  }

  onPaddingChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = Number.parseInt(input.value, 10);
    if (!Number.isNaN(value)) {
      this.spritesheetPadding.set(Math.max(0, Math.min(value, 10)));
    }
  }
}
