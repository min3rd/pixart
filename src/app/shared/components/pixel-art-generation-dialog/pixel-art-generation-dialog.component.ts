import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroXMark,
  heroSparkles,
  heroArrowPath,
  heroCheckCircle,
  heroExclamationCircle,
} from '@ng-icons/heroicons/outline';
import {
  PixelArtStyle,
  PixelGenerationResponse,
} from '../../../services/pixel-generation/pixel-generation-models';
import { PixelGenerationEngineService } from '../../../services/pixel-generation/pixel-generation-engine.service';
import { EditorDocumentService, isGroup } from '../../../services/editor-document.service';

export interface PixelArtGenerationResult {
  jobId: string;
  addToNewLayer: boolean;
}

@Component({
  selector: 'pa-pixel-art-generation-dialog',
  templateUrl: './pixel-art-generation-dialog.component.html',
  styleUrls: ['./pixel-art-generation-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslocoPipe, NgIconComponent],
  providers: [
    provideIcons({
      heroXMark,
      heroSparkles,
      heroArrowPath,
      heroCheckCircle,
      heroExclamationCircle,
    }),
  ],
  host: {
    class: 'block',
  },
})
export class PixelArtGenerationDialog {
  private readonly pixelEngine = inject(PixelGenerationEngineService);
  private readonly editorDoc = inject(EditorDocumentService);

  readonly visible = signal(false);
  readonly prompt = signal('');
  readonly targetWidth = signal(64);
  readonly targetHeight = signal(64);
  readonly selectedStyle = signal<PixelArtStyle>('pixel-modern');
  readonly useCurrentLayer = signal(true);
  readonly processing = signal(false);
  readonly currentJobId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly completed = signal(false);

  readonly confirmed = output<PixelArtGenerationResult>();
  readonly cancelled = output<void>();

  readonly availableStyles: PixelArtStyle[] = [
    'retro-8bit',
    'retro-16bit',
    'pixel-modern',
    'low-res',
    'high-detail',
  ];

  readonly canGenerate = computed(() => {
    return this.prompt().trim().length > 0 && !this.processing();
  });

  readonly currentJob = computed(() => {
    const jobId = this.currentJobId();
    if (!jobId) return null;
    return this.pixelEngine.getJob(jobId);
  });

  readonly progressPercent = computed(() => {
    const job = this.currentJob();
    return job?.response.progress ?? 0;
  });

  open() {
    this.prompt.set('');
    this.targetWidth.set(64);
    this.targetHeight.set(64);
    this.selectedStyle.set('pixel-modern');
    this.useCurrentLayer.set(true);
    this.processing.set(false);
    this.currentJobId.set(null);
    this.error.set(null);
    this.completed.set(false);
    this.visible.set(true);
  }

  close() {
    const jobId = this.currentJobId();
    if (jobId && this.processing()) {
      this.pixelEngine.cancelJob(jobId);
    }
    this.visible.set(false);
  }

  async generate() {
    if (!this.canGenerate()) return;

    this.processing.set(true);
    this.error.set(null);
    this.completed.set(false);

    try {
      const selectedLayer = this.editorDoc.selectedLayer();
      const canvasWidth = this.editorDoc.canvasWidth();
      const canvasHeight = this.editorDoc.canvasHeight();

      if (this.useCurrentLayer() && selectedLayer && !isGroup(selectedLayer)) {
        const layerBuffer = this.editorDoc.getLayerBuffer(selectedLayer.id);
        const jobId = await this.pixelEngine.generateFromLayerBuffer(
          layerBuffer,
          canvasWidth,
          canvasHeight,
          this.prompt(),
          this.targetWidth(),
          this.targetHeight(),
          this.selectedStyle(),
        );

        this.currentJobId.set(jobId);
        this.pollJobStatus(jobId);
      } else {
        throw new Error('No layer selected');
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Unknown error');
      this.processing.set(false);
    }
  }

  addToNewLayer() {
    const jobId = this.currentJobId();
    if (!jobId) return;

    this.confirmed.emit({
      jobId,
      addToNewLayer: true,
    });
    this.close();
  }

  replaceCurrentLayer() {
    const jobId = this.currentJobId();
    if (!jobId) return;

    this.confirmed.emit({
      jobId,
      addToNewLayer: false,
    });
    this.close();
  }

  cancel() {
    this.cancelled.emit();
    this.close();
  }

  private pollJobStatus(jobId: string) {
    const checkInterval = setInterval(async () => {
      try {
        const response = await this.pixelEngine.checkJobStatus(jobId);

        if (response.status === 'completed') {
          clearInterval(checkInterval);
          this.processing.set(false);
          this.completed.set(true);
        } else if (response.status === 'failed') {
          clearInterval(checkInterval);
          this.processing.set(false);
          this.error.set(response.error || 'Generation failed');
        }
      } catch (err) {
        clearInterval(checkInterval);
        this.processing.set(false);
        this.error.set(err instanceof Error ? err.message : 'Failed to check status');
      }
    }, 1000);
  }
}
