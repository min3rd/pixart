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
  framePattern: string;
  fromFrame: number;
  toFrame: number;
  spritesheetColumns: number;
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
  readonly framePattern = signal<string>('frame-{frame}');
  readonly fromFrame = signal<number>(1);
  readonly toFrame = signal<number>(1);
  readonly spritesheetColumns = signal<number>(8);
  readonly spritesheetPadding = signal<number>(0);

  readonly exportService = inject(EditorTimelineExportService);
  readonly document = inject(EditorDocumentService);

  readonly onConfirm = output<TimelineExportResult>();
  readonly onCancel = output<void>();

  readonly showCustomRange = computed(() => this.range() === 'custom');
  readonly showSpriteSheetOptions = computed(
    () => this.format() === 'spritesheet',
  );
  readonly totalFrames = computed(() => this.document.frames().length);

  readonly formatOptions: { value: TimelineExportFormat; key: string }[] = [
    { value: 'png', key: 'timeline.exportDialog.formatPng' },
    { value: 'jpeg', key: 'timeline.exportDialog.formatJpeg' },
    { value: 'bmp', key: 'timeline.exportDialog.formatBmp' },
    { value: 'gif', key: 'timeline.exportDialog.formatGif' },
    { value: 'spritesheet', key: 'timeline.exportDialog.formatSpritesheet' },
  ];

  readonly rangeOptions: { value: TimelineExportRange; key: string }[] = [
    { value: 'all', key: 'timeline.exportDialog.rangeAll' },
    { value: 'current', key: 'timeline.exportDialog.rangeCurrent' },
    { value: 'custom', key: 'timeline.exportDialog.rangeCustom' },
  ];

  open() {
    this.format.set('png');
    this.range.set('all');
    this.framePattern.set('frame-{frame}');
    this.fromFrame.set(1);
    this.toFrame.set(this.totalFrames());
    this.spritesheetColumns.set(8);
    this.spritesheetPadding.set(0);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  handleConfirm() {
    this.exportService.exportTimeline({
      format: this.format(),
      range: this.range(),
      framePattern: this.framePattern(),
      fromFrame: this.fromFrame(),
      toFrame: this.toFrame(),
      spritesheetColumns: this.spritesheetColumns(),
      spritesheetPadding: this.spritesheetPadding(),
    });

    this.onConfirm.emit({
      format: this.format(),
      range: this.range(),
      framePattern: this.framePattern(),
      fromFrame: this.fromFrame(),
      toFrame: this.toFrame(),
      spritesheetColumns: this.spritesheetColumns(),
      spritesheetPadding: this.spritesheetPadding(),
    });
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

  onFramePatternChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.framePattern.set(input.value);
  }

  onFromFrameChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.fromFrame.set(Number.parseInt(input.value, 10));
  }

  onToFrameChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.toFrame.set(Number.parseInt(input.value, 10));
  }

  onColumnsChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.spritesheetColumns.set(Number.parseInt(input.value, 10));
  }

  onPaddingChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.spritesheetPadding.set(Number.parseInt(input.value, 10));
  }
}
