import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPlay,
  heroStop,
  heroPlus,
  heroTrash,
} from '@ng-icons/heroicons/outline';
import { EditorKeyframeService } from '../../../services/editor/editor-keyframe.service';
import { EditorAnimationCollectionService } from '../../../services/editor/editor-animation-collection.service';
import { EditorBoneService } from '../../../services/editor/editor-bone.service';

@Component({
  selector: 'pa-animation-creator-panel',
  templateUrl: './animation-creator-panel.component.html',
  styleUrls: ['./animation-creator-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslocoPipe, NgIconComponent],
  providers: [
    provideIcons({
      heroPlay,
      heroStop,
      heroPlus,
      heroTrash,
    }),
  ],
  host: {
    class: 'block h-full bg-neutral-50 dark:bg-neutral-900',
  },
})
export class AnimationCreatorPanel implements AfterViewInit {
  readonly keyframeService = inject(EditorKeyframeService);
  readonly animationService = inject(EditorAnimationCollectionService);
  readonly boneService = inject(EditorBoneService);

  @ViewChild('timelineCanvas')
  timelineCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChild('timelineRuler')
  timelineRuler?: ElementRef<HTMLDivElement>;

  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(3000);
  readonly playheadPosition = signal(0);
  readonly hoveredTime = signal<number | null>(null);
  readonly selectedKeyframeId = signal<string | null>(null);
  readonly zoomLevel = signal(1);

  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;

  constructor() {
    effect(() => {
      const time = this.currentTime();
      this.keyframeService.setCurrentTime(time);
      this.updatePlayheadPosition();
    });

    effect(() => {
      const duration = this.duration();
      this.keyframeService.setAnimationDuration(duration);
    });
  }

  ngAfterViewInit() {
    this.renderTimeline();
    this.updatePlayheadPosition();
  }

  renderTimeline() {
    const canvas = this.timelineCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue(
      '--timeline-bg-color',
    ) || '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    const zoom = this.zoomLevel();
    const duration = this.duration();
    const pixelsPerMs = (width / duration) * zoom;

    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;

    for (let t = 0; t <= duration; t += 100) {
      const x = t * pixelsPerMs;
      const isMajorTick = t % 1000 === 0;

      ctx.beginPath();
      ctx.moveTo(x, isMajorTick ? 0 : height * 0.3);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isMajorTick) {
        ctx.fillStyle = '#4b5563';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${(t / 1000).toFixed(1)}s`, x + 2, 12);
      }
    }

    const currentAnimation = this.animationService.getCurrentAnimation();
    if (currentAnimation) {
      const keyframes = this.keyframeService.getKeyframes(currentAnimation.id);

      keyframes.forEach((kf) => {
        const x = kf.time * pixelsPerMs;
        const isSelected = this.selectedKeyframeId() === kf.id;

        ctx.fillStyle = isSelected ? '#3b82f6' : '#6366f1';
        ctx.beginPath();
        ctx.arc(x, height / 2, isSelected ? 6 : 5, 0, Math.PI * 2);
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#1d4ed8';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }

    const playheadX = this.currentTime() * pixelsPerMs;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, 0);
    ctx.lineTo(playheadX + 6, 0);
    ctx.lineTo(playheadX, 8);
    ctx.closePath();
    ctx.fill();
  }

  updatePlayheadPosition() {
    const time = this.currentTime();
    const duration = this.duration();
    const percent = (time / duration) * 100;
    this.playheadPosition.set(percent);
    this.renderTimeline();
  }

  onTimelineClick(event: MouseEvent) {
    const canvas = this.timelineCanvas?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const duration = this.duration();
    const zoom = this.zoomLevel();
    const pixelsPerMs = (rect.width / duration) * zoom;
    const clickedTime = x / pixelsPerMs;

    this.setCurrentTime(Math.max(0, Math.min(clickedTime, duration)));

    const currentAnimation = this.animationService.getCurrentAnimation();
    if (!currentAnimation) return;

    const keyframes = this.keyframeService.getKeyframes(currentAnimation.id);
    const threshold = 10 / pixelsPerMs;

    const clickedKeyframe = keyframes.find(
      (kf) => Math.abs(kf.time - clickedTime) < threshold,
    );

    if (clickedKeyframe) {
      this.selectedKeyframeId.set(clickedKeyframe.id);
    } else {
      this.selectedKeyframeId.set(null);
    }
  }

  onTimelineMouseMove(event: MouseEvent) {
    const canvas = this.timelineCanvas?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const duration = this.duration();
    const zoom = this.zoomLevel();
    const pixelsPerMs = (rect.width / duration) * zoom;
    const hoveredTime = x / pixelsPerMs;

    this.hoveredTime.set(hoveredTime);
  }

  onTimelineMouseLeave() {
    this.hoveredTime.set(null);
  }

  togglePlayback() {
    if (this.isPlaying()) {
      this.stopAnimation();
    } else {
      this.playAnimation();
    }
  }

  playAnimation() {
    if (this.isPlaying()) return;

    this.isPlaying.set(true);
    this.lastUpdateTime = performance.now();

    const animate = (timestamp: number) => {
      if (!this.isPlaying()) return;

      const deltaTime = timestamp - this.lastUpdateTime;
      this.lastUpdateTime = timestamp;

      let newTime = this.currentTime() + deltaTime;
      if (newTime >= this.duration()) {
        newTime = 0;
      }

      this.setCurrentTime(newTime);

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  stopAnimation() {
    this.isPlaying.set(false);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  setCurrentTime(time: number) {
    this.currentTime.set(Math.max(0, Math.min(time, this.duration())));
    this.keyframeService.setCurrentTime(this.currentTime());
  }

  addKeyframe() {
    const currentAnimation = this.animationService.getCurrentAnimation();
    if (!currentAnimation) return;

    const frameId = currentAnimation.frames[0]?.id || 'default';
    const bones = this.boneService.getBones(frameId);
    const boneTransforms = bones.map((bone) => {
      const firstPoint = bone.points[0];
      return {
        boneId: bone.id,
        x: firstPoint?.x || 0,
        y: firstPoint?.y || 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
    });

    const keyframe = {
      id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time: this.currentTime(),
      boneTransforms,
    };

    this.keyframeService.addKeyframe(currentAnimation.id, keyframe);
    this.selectedKeyframeId.set(keyframe.id);
    this.renderTimeline();
  }

  deleteSelectedKeyframe() {
    const currentAnimation = this.animationService.getCurrentAnimation();
    const keyframeId = this.selectedKeyframeId();
    if (!currentAnimation || !keyframeId) return;

    this.keyframeService.deleteKeyframe(currentAnimation.id, keyframeId);
    this.selectedKeyframeId.set(null);
    this.renderTimeline();
  }

  formatTime(ms: number): string {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  }

  increaseZoom() {
    this.zoomLevel.set(Math.min(this.zoomLevel() * 1.5, 10));
    this.renderTimeline();
  }

  decreaseZoom() {
    this.zoomLevel.set(Math.max(this.zoomLevel() / 1.5, 0.5));
    this.renderTimeline();
  }
}
