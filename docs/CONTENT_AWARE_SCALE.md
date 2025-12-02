# Content-Aware Scale (Seam Carving)

## Overview

Content-Aware Scale is a transformation feature that intelligently reduces image dimensions while preserving important visual content. Unlike regular scaling that uniformly compresses or stretches pixels, Content-Aware Scale uses the **seam carving** algorithm to remove low-energy (less important) vertical or horizontal paths from the image.

This feature is ideal for:
- Resizing images to fit specific aspect ratios without distorting subjects
- Removing unimportant background areas while keeping focal points intact
- Creating adaptive layouts that preserve key visual elements

## How It Works

### Seam Carving Algorithm

The implementation uses a classic seam carving approach:

1. **Energy Calculation**: Computes a gradient-based energy map where high-energy pixels represent important visual features (edges, contrast changes)
2. **Seam Finding**: Uses dynamic programming to find the lowest-energy path (seam) through the image
3. **Seam Removal**: Removes pixels along the seam, shifting remaining pixels to fill the gap
4. **Iteration**: Repeats the process until target dimensions are reached

### Important Area Protection

When "Protect important areas automatically" is enabled, the algorithm:
- Analyzes gradient strength across the image
- Identifies high-contrast regions (edges > 100 threshold)
- Multiplies their energy by 10× to protect them from seam removal
- Ensures subjects and key visual elements remain intact

## Usage

### Accessing the Feature

**Keyboard Shortcut**: `Shift + Ctrl + Alt + C`

**Menu Access**: Transform → Content-Aware Scale

### Prerequisites

- An active selection or selected layer
- Target dimensions must be **smaller than or equal to** the original (seam carving only reduces size)

### Dialog Options

1. **Original Size**: Displays current width × height
2. **Target Width**: Desired final width (1 to original width)
3. **Target Height**: Desired final height (1 to original height)
4. **Protect Important Areas**: Toggle automatic edge-based protection (recommended: ON)
5. **Preview**: Shows final dimensions before applying

### Workflow Examples

#### Reducing Selection Width

1. Create a selection using Rectangle Select (M) or Lasso Select (L)
2. Press `Shift + Ctrl + Alt + C`
3. Enter target width (e.g., reduce from 200px to 150px)
4. Keep height the same
5. Enable "Protect important areas"
6. Click Apply

The algorithm removes 50px worth of low-importance vertical seams, preserving the main subject.

#### Resizing Entire Layer

1. Select a layer in the layers panel
2. Make sure no selection is active (Deselect: Esc)
3. Press `Shift + Ctrl + Alt + C`
4. Enter new dimensions (both width and height can be reduced)
5. Click Apply

The entire layer is resized using seam carving, and the canvas dimensions adjust accordingly.

## Technical Details

### Service Architecture

- **EditorContentAwareScaleService**: Core seam carving implementation
  - `calculateEnergy()`: Gradient-based energy map
  - `findVerticalSeam()` / `findHorizontalSeam()`: Dynamic programming path finding
  - `removeVerticalSeam()` / `removeHorizontalSeam()`: Pixel removal
  - `contentAwareScale()`: Main entry point coordinating the full process

- **EditorDocumentService**: Integration layer
  - `applyContentAwareScale()`: Handles selection vs. layer logic
  - `detectImportantAreas()`: Edge-strength-based importance mapping
  - Converts between internal color buffer format and ImageData

### Performance Considerations

- **Computational Cost**: O(width × height) per seam, O(n × width × height) for n seams removed
- **Large Images**: May take several seconds for images > 1000px
- **Memory**: Requires temporary ImageData allocation equal to image size

### Limitations

1. **Reduction Only**: Cannot expand images (seam insertion not implemented)
2. **Iterative**: Removes one seam at a time (width first, then height)
3. **Quality**: Extreme reductions (>50%) may produce artifacts
4. **Speed**: Slower than regular scaling for large images

## Best Practices

### When to Use

✅ **Good use cases:**
- Portrait images with uniform backgrounds
- Landscape photos with repetitive sky/ground
- UI elements with safe padding areas
- Aspect ratio adjustments (16:9 → 4:3)

❌ **Avoid for:**
- Images with edge-to-edge important content
- Text-heavy graphics (may distort letterforms)
- Geometric patterns (may break symmetry)
- Very small images (<50px) where every pixel matters

### Recommended Settings

- **Protect Important Areas**: Always ON unless you want aggressive removal
- **Target Dimensions**: Reduce by 10-30% for best quality
- **Incremental**: For large reductions, apply multiple times with preview checks

### Undoing Changes

Content-Aware Scale creates an undo snapshot. Use:
- `Ctrl + Z` to undo
- `Ctrl + Y` to redo

## Code Examples

### Calling from Code

```typescript
// Apply to current selection
editorDocument.applyContentAwareScale(
  150,  // target width
  100,  // target height
  true  // protect important areas
);

// Direct service usage
const imageData = /* ... get ImageData ... */;
const importanceMap = new Set<string>(); // optional
importanceMap.add('10,20'); // protect pixel at (10, 20)

const result = contentAwareScaleService.contentAwareScale(
  imageData,
  150,
  100,
  importanceMap
);
```

### Energy Map Visualization

To debug or visualize the energy map:

```typescript
const energyMap = contentAwareScaleService.calculateEnergy(imageData);
const maxEnergy = Math.max(...energyMap.energy);
for (let i = 0; i < energyMap.energy.length; i++) {
  const normalized = energyMap.energy[i] / maxEnergy;
  console.log(`Pixel ${i}: energy = ${normalized}`);
}
```

## References

- [Original Seam Carving Paper](https://perso.crans.org/frenoy/matlab2012/seamcarving.pdf) by Avidan & Shamir (2007)
- [Wikipedia: Seam Carving](https://en.wikipedia.org/wiki/Seam_carving)
- [Photoshop Content-Aware Scale Documentation](https://helpx.adobe.com/photoshop/using/content-aware-scaling.html)

## Related Features

- **Free Transform** (`Ctrl + T`): Manual scaling with corner handles
- **Scale** (Transform menu): Uniform/non-uniform scaling by percentage
- **Distort** (`Ctrl + Shift + D`): Free-form corner manipulation
- **Perspective** (`Ctrl + Shift + P`): 3D perspective transformation
