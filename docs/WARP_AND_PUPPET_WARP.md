# Warp and Puppet Warp Features

This document describes the implementation of Warp and Puppet Warp transformation features in PixArt.

## Overview

Warp and Puppet Warp are non-destructive transformation tools that allow users to deform images and selections using different control paradigms:

- **Warp**: Grid-based mesh deformation with regularly spaced control points
- **Puppet Warp**: Pin-based deformation with flexible placement and influence radius

Both features follow the existing transform pattern established by Distort and Perspective transforms.

## Architecture

### Services

#### EditorWarpService (`editor-warp.service.ts`)

Manages the warp grid state using Angular signals:

```typescript
interface WarpState {
  active: boolean;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  gridSize: WarpGridSize; // '3x3' | '4x4' | '5x5'
  nodes: WarpGridNode[];
  smoothing: number; // 0.0 to 1.0
}

interface WarpGridNode {
  row: number;
  col: number;
  x: number;
  y: number;
  originalX: number;
  originalY: number;
}
```

**Key Methods**:
- `startWarp()`: Initialize warp mode with a selection
- `updateNode()`: Update a control point position
- `setGridSize()`: Change grid density
- `setSmoothing()`: Adjust deformation smoothing
- `commitWarp()`: Apply the transformation
- `cancelWarp()`: Discard changes

#### EditorPuppetWarpService (`editor-puppet-warp.service.ts`)

Manages puppet warp pins and their properties:

```typescript
interface PuppetWarpState {
  active: boolean;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  pins: PuppetWarpPinData[];
  defaultRadius: number;
}

interface PuppetWarpPinData {
  id: string;
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  radius: number;
  locked: boolean;
}
```

**Key Methods**:
- `startPuppetWarp()`: Initialize puppet warp mode
- `addPin()`: Add a new pin at position
- `removePin()`: Delete a pin
- `updatePin()`: Move a pin
- `setPinRadius()`: Adjust influence radius
- `togglePinLock()`: Lock/unlock a pin
- `findPinAtPosition()`: Hit test for pin selection

### UI Components

#### WarpDialog

Modal dialog for warp settings:
- Grid size selector (3x3, 4x4, 5x5)
- Smoothing slider (0-100%)
- Reset button
- Apply/Cancel buttons

#### PuppetWarpDialog

Modal dialog for puppet warp management:
- Pin list with coordinates
- Selected pin properties
- Pin radius adjustment
- Lock/unlock toggle per pin
- Remove pin button
- Apply/Cancel buttons

### Canvas Integration

The editor canvas component (`editor-canvas.component.ts`) handles:

1. **Rendering**:
   - Grid visualization for Warp (green color scheme)
   - Pin markers and influence circles for Puppet Warp (pink/magenta)
   - Draggable control points with handles
   - Apply/Cancel button controls

2. **Interaction**:
   - Mouse down: Select control point/pin or add new pin (Puppet Warp)
   - Mouse move: Drag selected control point/pin
   - Mouse up: Release drag
   - Button clicks: Apply or cancel transformation

3. **Visual Feedback**:
   - Warp: Green grid lines connecting control points
   - Puppet Warp: Pink influence radius circles, locked pins shown in red
   - Handle hover and drag states
   - Selection hiding during active transformation

## User Workflow

### Warp Mode

1. **Activation**:
   - Menu: Transform > Warp
   - Keyboard: `Ctrl + Shift + W`
   - Requires: Active selection or layer

2. **Usage**:
   - A grid overlay appears with draggable control points
   - Drag any control point to deform the grid
   - Adjust grid density via dialog (3x3, 4x4, or 5x5)
   - Adjust smoothing for softer/harder deformation
   - Click Apply (✓) to commit or Cancel (✗) to discard

3. **Grid Sizes**:
   - 3x3: 16 control points (coarse control)
   - 4x4: 25 control points (medium control)
   - 5x5: 36 control points (fine control)

### Puppet Warp Mode

1. **Activation**:
   - Menu: Transform > Puppet Warp
   - Keyboard: `Ctrl + Shift + Alt + W`
   - Requires: Active selection or layer

2. **Usage**:
   - Click anywhere on the image to add a pin
   - Drag pins to deform the mesh
   - Click a pin to select it
   - Adjust selected pin radius in the dialog
   - Lock pins to prevent movement
   - Remove unwanted pins
   - Click Apply (✓) to commit or Cancel (✗) to discard

3. **Pin Properties**:
   - **Radius**: Influence area for deformation (10-200px)
   - **Locked**: Prevents pin from being moved
   - **Color**: Pink (unlocked) or Red (locked)

## Localization

Full support for English and Vietnamese:

### English Keys
```json
{
  "menu": {
    "warp": "Warp",
    "puppetWarp": "Puppet Warp"
  },
  "warp": {
    "title": "Warp",
    "gridSize": "Grid size",
    "smoothing": "Smoothing",
    "reset": "Reset",
    "apply": "Apply",
    "cancel": "Cancel"
  },
  "puppetWarp": {
    "title": "Puppet Warp",
    "addPin": "Add Pin",
    "removePin": "Remove Pin",
    "lockPin": "Lock Pin",
    "pinRadius": "Pin Radius",
    "apply": "Apply",
    "cancel": "Cancel"
  }
}
```

## Visual Design

### Color Schemes

To distinguish from other transform tools:
- **Warp**: Green (`#22c55e` / `#16a34a`)
- **Puppet Warp**: Pink/Magenta (`#ec4899` / `#db2777`)
- **Distort**: Blue (`#3b82f6` / `#2563eb`)
- **Perspective**: Purple (`#9333ea` / `#7e22ce`)

### UI Elements

- Control points: Filled circles with white/black outline
- Grid lines: Solid lines in mode color
- Influence radius: Dashed circle in mode color with transparency
- Locked pins: Red fill instead of pink
- Buttons: Green (Apply), Red (Cancel)

## Implementation Status

### Completed ✅

1. **Service Layer**
   - State management with Angular signals
   - Grid/pin manipulation methods
   - Drag and drop handling
   - Lock/unlock functionality

2. **UI Components**
   - Warp settings dialog
   - Puppet warp management dialog
   - Localized text (EN/VI)

3. **Canvas Integration**
   - Visual rendering of grids and pins
   - Mouse interaction handlers
   - Apply/Cancel button controls
   - Proper layering with other tools

4. **Menu Integration**
   - Transform menu items
   - Keyboard shortcuts
   - Accessibility labels

### Not Implemented ⚠️

The current implementation provides the complete UI framework and state management, but does not include pixel transformation algorithms:

1. **Mesh Deformation Algorithms**
   - Thin Plate Spline (TPS) for Puppet Warp
   - Bilinear interpolation for Warp
   - As-Rigid-As-Possible (ARAP) deformation

2. **Pixel Transformation**
   - Apply button currently only closes the mode
   - No actual pixel warping occurs
   - No preview rendering during manipulation

3. **Performance Optimization**
   - Low-res preview during drag
   - High-res rendering on apply
   - Progressive mesh refinement

## Future Enhancement Ideas

1. **Advanced Deformation**
   - B-spline mesh for smoother warping
   - Radial basis functions for better interpolation
   - Multi-resolution mesh for large images

2. **Pin Connectivity**
   - Chain pins together (bone-like structure)
   - Hierarchical pin relationships
   - Constraint propagation

3. **Presets**
   - Save/load warp configurations
   - Common deformation templates
   - Animation keyframes

4. **Performance**
   - GPU-accelerated deformation
   - Incremental updates
   - Cached intermediate results

## Testing Recommendations

When implementing the transformation algorithms:

1. **Unit Tests**
   - Grid node positioning
   - Pin hit testing
   - Coordinate transformations
   - Edge cases (empty selection, etc.)

2. **Integration Tests**
   - Mouse interaction sequences
   - Dialog state synchronization
   - Undo/redo operations
   - Multi-layer scenarios

3. **Performance Tests**
   - 2000x2000 pixel images
   - 10+ pins in puppet warp
   - 5x5 grid in warp mode
   - Smooth 60fps during drag

## References

### Algorithms
- Thin Plate Spline: [Bookstein 1989]
- ARAP Deformation: [Igarashi et al. 2005]
- Bilinear Interpolation: Standard computer graphics technique

### Similar Implementations
- Adobe Photoshop: Warp & Puppet Warp
- Krita: Mesh Transform & Cage Transform
- GIMP: Cage Transform
- Affinity Photo: Mesh Warp

## Related Files

- Services: `src/app/services/editor/editor-warp.service.ts`
- Services: `src/app/services/editor/editor-puppet-warp.service.ts`
- Dialog: `src/app/shared/components/warp-dialog/`
- Dialog: `src/app/shared/components/puppet-warp-dialog/`
- Canvas: `src/app/editor/parts/editor-canvas/editor-canvas.component.ts`
- Menu: `src/app/editor/parts/editor-header/editor-header.component.ts`
- Translations: `public/i18n/en.json`, `public/i18n/vi.json`
