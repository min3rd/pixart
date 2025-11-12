import { Injectable } from '@angular/core';

interface EnergyMap {
  width: number;
  height: number;
  energy: number[];
}

interface Seam {
  indices: number[];
  energy: number;
}

@Injectable({ providedIn: 'root' })
export class EditorContentAwareScaleService {
  calculateEnergy(
    imageData: ImageData,
    importanceMap?: Set<string>,
  ): EnergyMap {
    const { width, height, data } = imageData;
    const energy = new Array(width * height).fill(0);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        let gx = 0;
        let gy = 0;

        if (x > 0 && x < width - 1) {
          const leftIdx = (y * width + (x - 1)) * 4;
          const rightIdx = (y * width + (x + 1)) * 4;
          gx =
            Math.abs(data[rightIdx] - data[leftIdx]) +
            Math.abs(data[rightIdx + 1] - data[leftIdx + 1]) +
            Math.abs(data[rightIdx + 2] - data[leftIdx + 2]);
        }

        if (y > 0 && y < height - 1) {
          const topIdx = ((y - 1) * width + x) * 4;
          const bottomIdx = ((y + 1) * width + x) * 4;
          gy =
            Math.abs(data[bottomIdx] - data[topIdx]) +
            Math.abs(data[bottomIdx + 1] - data[topIdx + 1]) +
            Math.abs(data[bottomIdx + 2] - data[topIdx + 2]);
        }

        energy[idx] = Math.sqrt(gx * gx + gy * gy);

        if (importanceMap && importanceMap.has(`${x},${y}`)) {
          energy[idx] *= 10;
        }
      }
    }

    return { width, height, energy };
  }

  findVerticalSeam(energyMap: EnergyMap): Seam {
    const { width, height, energy } = energyMap;
    const dp = new Array(width * height).fill(Infinity);
    const parent = new Array(width * height).fill(-1);

    for (let x = 0; x < width; x++) {
      dp[x] = energy[x];
    }

    for (let y = 1; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentIdx = y * width + x;
        const prevRowY = y - 1;

        for (let dx = -1; dx <= 1; dx++) {
          const prevX = x + dx;
          if (prevX >= 0 && prevX < width) {
            const prevIdx = prevRowY * width + prevX;
            const newCost = dp[prevIdx] + energy[currentIdx];
            if (newCost < dp[currentIdx]) {
              dp[currentIdx] = newCost;
              parent[currentIdx] = prevIdx;
            }
          }
        }
      }
    }

    let minIdx = 0;
    let minCost = dp[(height - 1) * width];
    for (let x = 1; x < width; x++) {
      const idx = (height - 1) * width + x;
      if (dp[idx] < minCost) {
        minCost = dp[idx];
        minIdx = idx;
      }
    }

    const indices: number[] = [];
    let currentIdx = minIdx;
    while (currentIdx !== -1) {
      indices.unshift(currentIdx);
      currentIdx = parent[currentIdx];
    }

    return { indices, energy: minCost };
  }

  findHorizontalSeam(energyMap: EnergyMap): Seam {
    const transposed = this.transposeEnergyMap(energyMap);
    const seam = this.findVerticalSeam(transposed);

    const { width, height } = energyMap;
    const mappedIndices = seam.indices.map((idx) => {
      const y = Math.floor(idx / height);
      const x = idx % height;
      return x * width + y;
    });

    return { indices: mappedIndices, energy: seam.energy };
  }

  private transposeEnergyMap(energyMap: EnergyMap): EnergyMap {
    const { width, height, energy } = energyMap;
    const transposed = new Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        transposed[x * height + y] = energy[y * width + x];
      }
    }

    return { width: height, height: width, energy: transposed };
  }

  removeVerticalSeam(imageData: ImageData, seam: Seam): ImageData {
    const { width, height, data } = imageData;
    const newWidth = width - 1;
    const newData = new Uint8ClampedArray(newWidth * height * 4);

    for (let y = 0; y < height; y++) {
      const seamX = seam.indices[y] % width;
      let newX = 0;

      for (let x = 0; x < width; x++) {
        if (x === seamX) continue;

        const oldIdx = (y * width + x) * 4;
        const newIdx = (y * newWidth + newX) * 4;

        newData[newIdx] = data[oldIdx];
        newData[newIdx + 1] = data[oldIdx + 1];
        newData[newIdx + 2] = data[oldIdx + 2];
        newData[newIdx + 3] = data[oldIdx + 3];

        newX++;
      }
    }

    return new ImageData(newData, newWidth, height);
  }

  removeHorizontalSeam(imageData: ImageData, seam: Seam): ImageData {
    const { width, height, data } = imageData;
    const newHeight = height - 1;
    const newData = new Uint8ClampedArray(width * newHeight * 4);

    for (let x = 0; x < width; x++) {
      const seamIndices = seam.indices
        .map((idx, i) => ({
          y: Math.floor(idx / width),
          x: idx % width,
          row: i,
        }))
        .filter((item) => item.x === x)
        .map((item) => item.y);

      const seamY = seamIndices[0] ?? -1;
      let newY = 0;

      for (let y = 0; y < height; y++) {
        if (y === seamY) continue;

        const oldIdx = (y * width + x) * 4;
        const newIdx = (newY * width + x) * 4;

        newData[newIdx] = data[oldIdx];
        newData[newIdx + 1] = data[oldIdx + 1];
        newData[newIdx + 2] = data[oldIdx + 2];
        newData[newIdx + 3] = data[oldIdx + 3];

        newY++;
      }
    }

    return new ImageData(newData, width, newHeight);
  }

  contentAwareScale(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    importanceMap?: Set<string>,
  ): ImageData {
    let current = imageData;

    while (current.width > targetWidth) {
      const energyMap = this.calculateEnergy(current, importanceMap);
      const seam = this.findVerticalSeam(energyMap);
      current = this.removeVerticalSeam(current, seam);
    }

    while (current.height > targetHeight) {
      const energyMap = this.calculateEnergy(current, importanceMap);
      const seam = this.findHorizontalSeam(energyMap);
      current = this.removeHorizontalSeam(current, seam);
    }

    return current;
  }
}
