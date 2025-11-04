import { Component, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';

export interface GeneratePixelArtRequest {
  sketchDataUrl: string;
  prompt: string;
  width: number;
  height: number;
}

@Component({
  selector: 'pa-pixel-generation-dialog',
  imports: [FormsModule, TranslocoPipe, NgIcon],
  templateUrl: './pixel-generation-dialog.html',
  styleUrl: './pixel-generation-dialog.css',
  host: {
    class: 'block',
  },
})
export class PixelGenerationDialog {
  readonly visible = signal(false);
  readonly sketchPreviewUrl = signal<string | null>(null);
  readonly prompt = signal('');
  readonly width = signal(64);
  readonly height = signal(64);
  readonly sourceType = signal<'layer' | 'visible' | 'selection'>('layer');
  readonly generating = signal(false);
  
  readonly onGenerate = output<GeneratePixelArtRequest>();
  readonly onCancel = output<void>();

  show(
    sketchDataUrl: string,
    width: number,
    height: number,
    sourceType: 'layer' | 'visible' | 'selection'
  ) {
    this.sketchPreviewUrl.set(sketchDataUrl);
    this.width.set(width);
    this.height.set(height);
    this.sourceType.set(sourceType);
    this.prompt.set('');
    this.generating.set(false);
    this.visible.set(true);
  }

  hide() {
    this.visible.set(false);
    this.sketchPreviewUrl.set(null);
    this.prompt.set('');
    this.generating.set(false);
  }

  handleGenerate() {
    const sketchDataUrl = this.sketchPreviewUrl();
    if (!sketchDataUrl || !this.prompt().trim() || this.generating()) {
      return;
    }
    
    this.generating.set(true);
    this.onGenerate.emit({
      sketchDataUrl,
      prompt: this.prompt().trim(),
      width: this.width(),
      height: this.height(),
    });
  }

  handleCancel() {
    if (this.generating()) {
      return;
    }
    this.onCancel.emit();
    this.hide();
  }
}
