import { Injectable } from '@angular/core';

interface Point {
  x: number;
  y: number;
}

interface FeatureDescriptor {
  x: number;
  y: number;
  descriptor: number[];
}

interface AlignmentTransform {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
}

@Injectable({ providedIn: 'root' })
export class EditorAutoAlignService {
  detectFeatures(imageData: ImageData, maxFeatures = 100): FeatureDescriptor[] {
    const { width, height, data } = imageData;
    const features: FeatureDescriptor[] = [];
    const grayscale = this.toGrayscale(imageData);

    const corners = this.detectCorners(grayscale, width, height);

    const sortedCorners = corners
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFeatures);

    for (const corner of sortedCorners) {
      const descriptor = this.computeDescriptor(
        grayscale,
        width,
        height,
        corner.x,
        corner.y,
      );
      features.push({ x: corner.x, y: corner.y, descriptor });
    }

    return features;
  }

  private toGrayscale(imageData: ImageData): Uint8ClampedArray {
    const { width, height, data } = imageData;
    const gray = new Uint8ClampedArray(width * height);

    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      gray[i] = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return gray;
  }

  private detectCorners(
    gray: Uint8ClampedArray,
    width: number,
    height: number,
  ): { x: number; y: number; score: number }[] {
    const corners: { x: number; y: number; score: number }[] = [];
    const threshold = 30;

    for (let y = 3; y < height - 3; y++) {
      for (let x = 3; x < width - 3; x++) {
        const score = this.harrisCornerResponse(gray, width, x, y);
        if (score > threshold) {
          corners.push({ x, y, score });
        }
      }
    }

    return corners;
  }

  private harrisCornerResponse(
    gray: Uint8ClampedArray,
    width: number,
    x: number,
    y: number,
  ): number {
    let Ixx = 0;
    let Iyy = 0;
    let Ixy = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx;
        const py = y + dy;
        const idx = py * width + px;

        const Ix =
          dx !== 0 ? gray[idx + 1] - gray[idx - 1] : 0;
        const Iy =
          dy !== 0 ? gray[idx + width] - gray[idx - width] : 0;

        Ixx += Ix * Ix;
        Iyy += Iy * Iy;
        Ixy += Ix * Iy;
      }
    }

    const det = Ixx * Iyy - Ixy * Ixy;
    const trace = Ixx + Iyy;
    const k = 0.04;

    return det - k * trace * trace;
  }

  private computeDescriptor(
    gray: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number,
  ): number[] {
    const descriptor: number[] = [];
    const patchSize = 5;
    const halfPatch = Math.floor(patchSize / 2);

    for (let dy = -halfPatch; dy <= halfPatch; dy++) {
      for (let dx = -halfPatch; dx <= halfPatch; dx++) {
        const px = Math.max(0, Math.min(width - 1, x + dx));
        const py = Math.max(0, Math.min(height - 1, y + dy));
        descriptor.push(gray[py * width + px]);
      }
    }

    const mean =
      descriptor.reduce((sum, val) => sum + val, 0) / descriptor.length;
    const variance =
      descriptor.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
      descriptor.length;
    const stdDev = Math.sqrt(variance) || 1;

    return descriptor.map((val) => (val - mean) / stdDev);
  }

  matchFeatures(
    features1: FeatureDescriptor[],
    features2: FeatureDescriptor[],
  ): { p1: Point; p2: Point }[] {
    const matches: { p1: Point; p2: Point }[] = [];
    const threshold = 0.8;

    for (const f1 of features1) {
      let bestDist = Infinity;
      let secondBestDist = Infinity;
      let bestMatch: FeatureDescriptor | null = null;

      for (const f2 of features2) {
        const dist = this.descriptorDistance(f1.descriptor, f2.descriptor);
        if (dist < bestDist) {
          secondBestDist = bestDist;
          bestDist = dist;
          bestMatch = f2;
        } else if (dist < secondBestDist) {
          secondBestDist = dist;
        }
      }

      if (bestMatch && bestDist < threshold * secondBestDist) {
        matches.push(
          { p1: { x: f1.x, y: f1.y }, p2: { x: bestMatch.x, y: bestMatch.y } },
        );
      }
    }

    return matches;
  }

  private descriptorDistance(d1: number[], d2: number[]): number {
    let sum = 0;
    for (let i = 0; i < d1.length && i < d2.length; i++) {
      const diff = d1[i] - d2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  calculateAlignment(
    matches: { p1: Point; p2: Point }[],
  ): AlignmentTransform | null {
    if (matches.length < 3) {
      return null;
    }

    let sumDx = 0;
    let sumDy = 0;

    for (const match of matches) {
      sumDx += match.p2.x - match.p1.x;
      sumDy += match.p2.y - match.p1.y;
    }

    const dx = sumDx / matches.length;
    const dy = sumDy / matches.length;

    return {
      dx: Math.round(dx),
      dy: Math.round(dy),
      scale: 1,
      rotation: 0,
    };
  }

  alignLayers(
    baseImageData: ImageData,
    targetImageData: ImageData,
  ): AlignmentTransform | null {
    const baseFeatures = this.detectFeatures(baseImageData);
    const targetFeatures = this.detectFeatures(targetImageData);

    const matches = this.matchFeatures(baseFeatures, targetFeatures);

    return this.calculateAlignment(matches);
  }
}
