import { Injectable } from '@angular/core';
import { Bone, BonePoint } from './editor/editor-bone.service';

export type BoneTemplateType =
  | 'human'
  | 'quadruped'
  | 'flying'
  | 'fish'
  | 'snake';

export interface BoneTemplate {
  type: BoneTemplateType;
  name: string;
  labelKey: string;
  points: Array<{
    name: string;
    ratioX: number;
    ratioY: number;
    parentIndex?: number;
  }>;
}

export interface PixelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface GenerateBoneResult {
  suggestedTemplate: BoneTemplateType;
  bones: Bone[];
}

@Injectable({ providedIn: 'root' })
export class BoneGenerationService {
  private readonly templates: BoneTemplate[] = [
    {
      type: 'human',
      name: 'Human',
      labelKey: 'boneGeneration.templates.human',
      points: [
        { name: 'Root', ratioX: 0.5, ratioY: 0.85 },
        { name: 'Spine', ratioX: 0.5, ratioY: 0.6, parentIndex: 0 },
        { name: 'Chest', ratioX: 0.5, ratioY: 0.4, parentIndex: 1 },
        { name: 'Neck', ratioX: 0.5, ratioY: 0.25, parentIndex: 2 },
        { name: 'Head', ratioX: 0.5, ratioY: 0.1, parentIndex: 3 },
        { name: 'L Shoulder', ratioX: 0.35, ratioY: 0.35, parentIndex: 2 },
        { name: 'L Elbow', ratioX: 0.25, ratioY: 0.55, parentIndex: 5 },
        { name: 'L Hand', ratioX: 0.2, ratioY: 0.75, parentIndex: 6 },
        { name: 'R Shoulder', ratioX: 0.65, ratioY: 0.35, parentIndex: 2 },
        { name: 'R Elbow', ratioX: 0.75, ratioY: 0.55, parentIndex: 8 },
        { name: 'R Hand', ratioX: 0.8, ratioY: 0.75, parentIndex: 9 },
        { name: 'L Hip', ratioX: 0.4, ratioY: 0.85, parentIndex: 0 },
        { name: 'L Knee', ratioX: 0.38, ratioY: 1.05, parentIndex: 11 },
        { name: 'L Foot', ratioX: 0.37, ratioY: 1.2, parentIndex: 12 },
        { name: 'R Hip', ratioX: 0.6, ratioY: 0.85, parentIndex: 0 },
        { name: 'R Knee', ratioX: 0.62, ratioY: 1.05, parentIndex: 14 },
        { name: 'R Foot', ratioX: 0.63, ratioY: 1.2, parentIndex: 15 },
      ],
    },
    {
      type: 'quadruped',
      name: 'Quadruped (4-legged)',
      labelKey: 'boneGeneration.templates.quadruped',
      points: [
        { name: 'Root', ratioX: 0.6, ratioY: 0.5 },
        { name: 'Spine Mid', ratioX: 0.5, ratioY: 0.45, parentIndex: 0 },
        { name: 'Chest', ratioX: 0.3, ratioY: 0.4, parentIndex: 1 },
        { name: 'Neck', ratioX: 0.15, ratioY: 0.35, parentIndex: 2 },
        { name: 'Head', ratioX: 0.05, ratioY: 0.3, parentIndex: 3 },
        { name: 'FL Shoulder', ratioX: 0.25, ratioY: 0.5, parentIndex: 2 },
        { name: 'FL Knee', ratioX: 0.22, ratioY: 0.75, parentIndex: 5 },
        { name: 'FL Paw', ratioX: 0.2, ratioY: 0.95, parentIndex: 6 },
        { name: 'FR Shoulder', ratioX: 0.35, ratioY: 0.5, parentIndex: 2 },
        { name: 'FR Knee', ratioX: 0.38, ratioY: 0.75, parentIndex: 8 },
        { name: 'FR Paw', ratioX: 0.4, ratioY: 0.95, parentIndex: 9 },
        { name: 'BL Hip', ratioX: 0.65, ratioY: 0.55, parentIndex: 0 },
        { name: 'BL Knee', ratioX: 0.68, ratioY: 0.8, parentIndex: 11 },
        { name: 'BL Paw', ratioX: 0.7, ratioY: 1.0, parentIndex: 12 },
        { name: 'BR Hip', ratioX: 0.75, ratioY: 0.55, parentIndex: 0 },
        { name: 'BR Knee', ratioX: 0.78, ratioY: 0.8, parentIndex: 14 },
        { name: 'BR Paw', ratioX: 0.8, ratioY: 1.0, parentIndex: 15 },
        { name: 'Tail Base', ratioX: 0.85, ratioY: 0.5, parentIndex: 0 },
        { name: 'Tail Mid', ratioX: 0.95, ratioY: 0.45, parentIndex: 17 },
        { name: 'Tail Tip', ratioX: 1.05, ratioY: 0.4, parentIndex: 18 },
      ],
    },
    {
      type: 'flying',
      name: 'Flying (bird/dragon)',
      labelKey: 'boneGeneration.templates.flying',
      points: [
        { name: 'Root', ratioX: 0.5, ratioY: 0.6 },
        { name: 'Spine', ratioX: 0.5, ratioY: 0.45, parentIndex: 0 },
        { name: 'Chest', ratioX: 0.5, ratioY: 0.3, parentIndex: 1 },
        { name: 'Neck', ratioX: 0.5, ratioY: 0.2, parentIndex: 2 },
        { name: 'Head', ratioX: 0.5, ratioY: 0.05, parentIndex: 3 },
        { name: 'L Wing Base', ratioX: 0.35, ratioY: 0.35, parentIndex: 2 },
        { name: 'L Wing Mid', ratioX: 0.15, ratioY: 0.3, parentIndex: 5 },
        { name: 'L Wing Tip', ratioX: 0.0, ratioY: 0.25, parentIndex: 6 },
        { name: 'R Wing Base', ratioX: 0.65, ratioY: 0.35, parentIndex: 2 },
        { name: 'R Wing Mid', ratioX: 0.85, ratioY: 0.3, parentIndex: 8 },
        { name: 'R Wing Tip', ratioX: 1.0, ratioY: 0.25, parentIndex: 9 },
        { name: 'L Leg', ratioX: 0.45, ratioY: 0.7, parentIndex: 0 },
        { name: 'L Foot', ratioX: 0.43, ratioY: 0.85, parentIndex: 11 },
        { name: 'R Leg', ratioX: 0.55, ratioY: 0.7, parentIndex: 0 },
        { name: 'R Foot', ratioX: 0.57, ratioY: 0.85, parentIndex: 13 },
        { name: 'Tail Base', ratioX: 0.5, ratioY: 0.75, parentIndex: 0 },
        { name: 'Tail Mid', ratioX: 0.5, ratioY: 0.9, parentIndex: 15 },
        { name: 'Tail Tip', ratioX: 0.5, ratioY: 1.05, parentIndex: 16 },
      ],
    },
    {
      type: 'fish',
      name: 'Fish',
      labelKey: 'boneGeneration.templates.fish',
      points: [
        { name: 'Head', ratioX: 0.15, ratioY: 0.5 },
        { name: 'Spine 1', ratioX: 0.3, ratioY: 0.5, parentIndex: 0 },
        { name: 'Spine 2', ratioX: 0.45, ratioY: 0.5, parentIndex: 1 },
        { name: 'Spine 3', ratioX: 0.6, ratioY: 0.5, parentIndex: 2 },
        { name: 'Tail Base', ratioX: 0.75, ratioY: 0.5, parentIndex: 3 },
        { name: 'Tail Mid', ratioX: 0.85, ratioY: 0.5, parentIndex: 4 },
        { name: 'Tail Fin', ratioX: 0.95, ratioY: 0.5, parentIndex: 5 },
        { name: 'Top Fin 1', ratioX: 0.4, ratioY: 0.25, parentIndex: 2 },
        { name: 'Top Fin 2', ratioX: 0.45, ratioY: 0.15, parentIndex: 7 },
        { name: 'Bottom Fin 1', ratioX: 0.35, ratioY: 0.75, parentIndex: 1 },
        { name: 'Bottom Fin 2', ratioX: 0.38, ratioY: 0.85, parentIndex: 9 },
        { name: 'L Pectoral', ratioX: 0.25, ratioY: 0.4, parentIndex: 1 },
        { name: 'R Pectoral', ratioX: 0.25, ratioY: 0.6, parentIndex: 1 },
      ],
    },
    {
      type: 'snake',
      name: 'Snake',
      labelKey: 'boneGeneration.templates.snake',
      points: [
        { name: 'Head', ratioX: 0.05, ratioY: 0.5 },
        { name: 'Spine 1', ratioX: 0.15, ratioY: 0.5, parentIndex: 0 },
        { name: 'Spine 2', ratioX: 0.25, ratioY: 0.5, parentIndex: 1 },
        { name: 'Spine 3', ratioX: 0.35, ratioY: 0.5, parentIndex: 2 },
        { name: 'Spine 4', ratioX: 0.45, ratioY: 0.5, parentIndex: 3 },
        { name: 'Spine 5', ratioX: 0.55, ratioY: 0.5, parentIndex: 4 },
        { name: 'Spine 6', ratioX: 0.65, ratioY: 0.5, parentIndex: 5 },
        { name: 'Spine 7', ratioX: 0.75, ratioY: 0.5, parentIndex: 6 },
        { name: 'Spine 8', ratioX: 0.85, ratioY: 0.5, parentIndex: 7 },
        { name: 'Tail Tip', ratioX: 0.95, ratioY: 0.5, parentIndex: 8 },
      ],
    },
  ];

  getTemplates(): BoneTemplate[] {
    return this.templates;
  }

  getTemplate(type: BoneTemplateType): BoneTemplate | undefined {
    return this.templates.find((t) => t.type === type);
  }

  analyzeLayerPixels(
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
  ): PixelBounds | null {
    let minX = canvasWidth;
    let maxX = 0;
    let minY = canvasHeight;
    let maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const idx = y * canvasWidth + x;
        const pixel = layerBuffer[idx];

        if (pixel && pixel.length > 0) {
          hasPixels = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasPixels) return null;

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width,
      height,
      centerX: minX + width / 2,
      centerY: minY + height / 2,
    };
  }

  suggestBoneTemplate(bounds: PixelBounds): BoneTemplateType {
    const aspectRatio = bounds.width / bounds.height;

    if (aspectRatio >= 2.5) {
      return 'snake';
    }

    if (aspectRatio >= 1.5) {
      return 'fish';
    }

    if (aspectRatio <= 0.7) {
      return 'human';
    }

    if (aspectRatio >= 1.0 && aspectRatio < 1.5) {
      return 'quadruped';
    }

    return 'flying';
  }

  generateBones(
    templateType: BoneTemplateType,
    bounds: PixelBounds,
    color: string,
    thickness: number,
  ): Bone[] {
    const template = this.getTemplate(templateType);
    if (!template) return [];

    const boneId = `bone-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const points: BonePoint[] = [];

    template.points.forEach((tPoint, index) => {
      const x = bounds.minX + tPoint.ratioX * bounds.width;
      const y = bounds.minY + tPoint.ratioY * bounds.height;

      const point: BonePoint = {
        id: `${boneId}-point-${index}`,
        x: Math.round(x),
        y: Math.round(y),
        name: tPoint.name,
        color,
      };

      if (tPoint.parentIndex !== undefined && points[tPoint.parentIndex]) {
        point.parentId = points[tPoint.parentIndex].id;
      }

      points.push(point);
    });

    return [
      {
        id: boneId,
        points,
        color,
        thickness,
      },
    ];
  }

  generateBonesForLayer(
    layerBuffer: string[],
    canvasWidth: number,
    canvasHeight: number,
    templateType?: BoneTemplateType,
    color = '#ff6600',
    thickness = 2,
  ): GenerateBoneResult {
    let bounds = this.analyzeLayerPixels(
      layerBuffer,
      canvasWidth,
      canvasHeight,
    );

    if (!bounds) {
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const defaultSize = Math.min(canvasWidth, canvasHeight) * 0.6;

      bounds = {
        minX: centerX - defaultSize / 2,
        maxX: centerX + defaultSize / 2,
        minY: centerY - defaultSize / 2,
        maxY: centerY + defaultSize / 2,
        width: defaultSize,
        height: defaultSize,
        centerX,
        centerY,
      };
    }

    const suggestedTemplate = templateType || this.suggestBoneTemplate(bounds);
    const bones = this.generateBones(
      suggestedTemplate,
      bounds,
      color,
      thickness,
    );

    return {
      suggestedTemplate,
      bones,
    };
  }
}
