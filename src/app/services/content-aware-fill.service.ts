import { Injectable } from '@angular/core';

export interface ContentAwareFillOptions {
  threshold: number;
  sampleRadius: number;
}

@Injectable({ providedIn: 'root' })
export class ContentAwareFillService {
  fillSelection(
    sourceData: ImageData,
    maskData: Uint8Array,
    width: number,
    height: number,
    options: ContentAwareFillOptions = { threshold: 32, sampleRadius: 5 }
  ): ImageData {
    const result = new ImageData(
      new Uint8ClampedArray(sourceData.data),
      width,
      height
    );
    const data = result.data;

    const fillPixels: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (maskData[y * width + x] > 0) {
          fillPixels.push({ x, y });
        }
      }
    }

    fillPixels.sort((a, b) => {
      const edgeDistA = this.distanceToEdge(a.x, a.y, maskData, width, height);
      const edgeDistB = this.distanceToEdge(b.x, b.y, maskData, width, height);
      return edgeDistA - edgeDistB;
    });

    for (const pixel of fillPixels) {
      const { x, y } = pixel;
      const samples = this.sampleNearbyPixels(
        sourceData.data,
        maskData,
        x,
        y,
        width,
        height,
        options.sampleRadius
      );

      if (samples.length > 0) {
        const avgColor = this.averageColors(samples);
        const idx = (y * width + x) * 4;
        data[idx] = avgColor[0];
        data[idx + 1] = avgColor[1];
        data[idx + 2] = avgColor[2];
        data[idx + 3] = avgColor[3];

        maskData[y * width + x] = 0;
      }
    }

    return result;
  }

  private distanceToEdge(
    x: number,
    y: number,
    maskData: Uint8Array,
    width: number,
    height: number
  ): number {
    let minDist = Infinity;
    const searchRadius = 10;

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (maskData[ny * width + nx] === 0) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            minDist = Math.min(minDist, dist);
          }
        }
      }
    }
    return minDist;
  }

  private sampleNearbyPixels(
    data: Uint8ClampedArray,
    maskData: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): number[][] {
    const samples: number[][] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (maskData[ny * width + nx] === 0) {
            const idx = (ny * width + nx) * 4;
            if (data[idx + 3] > 0) {
              samples.push([
                data[idx],
                data[idx + 1],
                data[idx + 2],
                data[idx + 3],
              ]);
            }
          }
        }
      }
    }
    return samples;
  }

  private averageColors(samples: number[][]): [number, number, number, number] {
    if (samples.length === 0) return [0, 0, 0, 0];

    let r = 0,
      g = 0,
      b = 0,
      a = 0;
    for (const sample of samples) {
      r += sample[0];
      g += sample[1];
      b += sample[2];
      a += sample[3];
    }
    const count = samples.length;
    return [
      Math.round(r / count),
      Math.round(g / count),
      Math.round(b / count),
      Math.round(a / count),
    ];
  }
}
