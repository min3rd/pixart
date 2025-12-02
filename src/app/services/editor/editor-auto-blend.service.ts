import { Injectable } from '@angular/core';

export type BlendMode = 'normal' | 'hdr' | 'focus-stack';

interface PyramidLevel {
  width: number;
  height: number;
  data: Float32Array;
}

@Injectable({ providedIn: 'root' })
export class EditorAutoBlendService {
  blendLayers(
    layers: ImageData[],
    mode: BlendMode = 'normal',
  ): ImageData | null {
    if (layers.length === 0) return null;
    if (layers.length === 1) return layers[0];

    switch (mode) {
      case 'hdr':
        return this.blendHDR(layers);
      case 'focus-stack':
        return this.blendFocusStack(layers);
      default:
        return this.blendNormal(layers);
    }
  }

  private blendNormal(layers: ImageData[]): ImageData {
    const base = layers[0];
    const { width, height } = base;
    const result = new ImageData(width, height);

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const alpha = 1 / (i + 1);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;

          if (i === 0) {
            result.data[idx] = layer.data[idx];
            result.data[idx + 1] = layer.data[idx + 1];
            result.data[idx + 2] = layer.data[idx + 2];
            result.data[idx + 3] = layer.data[idx + 3];
          } else {
            result.data[idx] = Math.round(
              result.data[idx] * (1 - alpha) + layer.data[idx] * alpha,
            );
            result.data[idx + 1] = Math.round(
              result.data[idx + 1] * (1 - alpha) + layer.data[idx + 1] * alpha,
            );
            result.data[idx + 2] = Math.round(
              result.data[idx + 2] * (1 - alpha) + layer.data[idx + 2] * alpha,
            );
            result.data[idx + 3] = 255;
          }
        }
      }
    }

    return result;
  }

  private blendHDR(layers: ImageData[]): ImageData {
    const base = layers[0];
    const { width, height } = base;
    const result = new ImageData(width, height);

    const exposureWeights = this.calculateExposureWeights(layers);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;
        let totalWeight = 0;

        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          const weight = exposureWeights[i][idx / 4];

          r += layer.data[idx] * weight;
          g += layer.data[idx + 1] * weight;
          b += layer.data[idx + 2] * weight;
          totalWeight += weight;
        }

        if (totalWeight > 0) {
          result.data[idx] = Math.round(r / totalWeight);
          result.data[idx + 1] = Math.round(g / totalWeight);
          result.data[idx + 2] = Math.round(b / totalWeight);
          result.data[idx + 3] = 255;
        }
      }
    }

    return this.toneMap(result);
  }

  private calculateExposureWeights(layers: ImageData[]): Float32Array[] {
    const weights: Float32Array[] = [];

    for (const layer of layers) {
      const { width, height, data } = layer;
      const weight = new Float32Array(width * height);

      for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        const midPoint = 128;
        const sigma = 64;
        const diff = luminance - midPoint;
        weight[i] = Math.exp(-(diff * diff) / (2 * sigma * sigma));
      }

      weights.push(weight);
    }

    return weights;
  }

  private toneMap(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const result = new ImageData(width, height);

    let maxLum = 0;
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      maxLum = Math.max(maxLum, lum);
    }

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      result.data[idx] = Math.round((data[idx] / maxLum) * 255);
      result.data[idx + 1] = Math.round((data[idx + 1] / maxLum) * 255);
      result.data[idx + 2] = Math.round((data[idx + 2] / maxLum) * 255);
      result.data[idx + 3] = 255;
    }

    return result;
  }

  private blendFocusStack(layers: ImageData[]): ImageData {
    const base = layers[0];
    const { width, height } = base;
    const result = new ImageData(width, height);

    const sharpnessMaps = this.calculateSharpness(layers);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let maxSharpness = -Infinity;
        let bestLayer = 0;

        for (let i = 0; i < layers.length; i++) {
          const sharpness = sharpnessMaps[i][idx / 4];
          if (sharpness > maxSharpness) {
            maxSharpness = sharpness;
            bestLayer = i;
          }
        }

        const layer = layers[bestLayer];
        result.data[idx] = layer.data[idx];
        result.data[idx + 1] = layer.data[idx + 1];
        result.data[idx + 2] = layer.data[idx + 2];
        result.data[idx + 3] = layer.data[idx + 3];
      }
    }

    return this.smoothBoundaries(result, sharpnessMaps);
  }

  private calculateSharpness(layers: ImageData[]): Float32Array[] {
    const sharpnessMaps: Float32Array[] = [];

    for (const layer of layers) {
      const { width, height, data } = layer;
      const sharpness = new Float32Array(width * height);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          const centerIdx = idx;
          const topIdx = ((y - 1) * width + x) * 4;
          const bottomIdx = ((y + 1) * width + x) * 4;
          const leftIdx = (y * width + (x - 1)) * 4;
          const rightIdx = (y * width + (x + 1)) * 4;

          const laplacian =
            Math.abs(
              4 * data[centerIdx] -
                data[topIdx] -
                data[bottomIdx] -
                data[leftIdx] -
                data[rightIdx],
            ) +
            Math.abs(
              4 * data[centerIdx + 1] -
                data[topIdx + 1] -
                data[bottomIdx + 1] -
                data[leftIdx + 1] -
                data[rightIdx + 1],
            ) +
            Math.abs(
              4 * data[centerIdx + 2] -
                data[topIdx + 2] -
                data[bottomIdx + 2] -
                data[leftIdx + 2] -
                data[rightIdx + 2],
            );

          sharpness[y * width + x] = laplacian / 3;
        }
      }

      sharpnessMaps.push(sharpness);
    }

    return sharpnessMaps;
  }

  private smoothBoundaries(
    imageData: ImageData,
    sharpnessMaps: Float32Array[],
  ): ImageData {
    const { width, height } = imageData;
    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      width,
      height,
    );

    const kernelSize = 3;
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = halfKernel; y < height - halfKernel; y++) {
      for (let x = halfKernel; x < width - halfKernel; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let totalWeight = 0;

        for (let dy = -halfKernel; dy <= halfKernel; dy++) {
          for (let dx = -halfKernel; dx <= halfKernel; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            const idx = (ny * width + nx) * 4;

            const weight = 1 / (1 + Math.abs(dx) + Math.abs(dy));
            r += imageData.data[idx] * weight;
            g += imageData.data[idx + 1] * weight;
            b += imageData.data[idx + 2] * weight;
            totalWeight += weight;
          }
        }

        const idx = (y * width + x) * 4;
        result.data[idx] = Math.round(r / totalWeight);
        result.data[idx + 1] = Math.round(g / totalWeight);
        result.data[idx + 2] = Math.round(b / totalWeight);
      }
    }

    return result;
  }
}
