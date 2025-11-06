# Bone Rigging and Animation System

## Overview

The bone rigging system allows you to attach a skeletal structure to pixel art and animate it by moving bone points. This document explains how the system works, particularly how pixels are bound to bones and transformed during animation.

## Pixel Binding System

### Weight-Based Binding

When you create bone points with auto-binding enabled, pixels near each bone point are automatically bound to that bone. Each binding has a **weight** that determines how strongly the pixel is influenced by that bone.

**Weight Calculation:**
```
weight = 1 - (distance / radius)
```

Where:
- `distance` is the pixel's distance from the bone point
- `radius` is the auto-bind radius (configurable in tools panel)
- `weight` ranges from 0.0 (far) to 1.0 (at the bone point)

### Multi-Bone Binding

A pixel can be bound to **multiple bones** simultaneously (multi-bound pixels). This happens when:
- Multiple bone points have overlapping auto-bind radii
- The same pixel falls within the binding radius of different bones

When a pixel has multiple bindings, the system uses the **dominant bone** approach:
- The binding with the **highest weight** becomes the dominant binding
- Only the dominant bone's transform is applied to that pixel
- This prevents pixels from being incorrectly transformed by non-dominant bones

## Transform Application

### During Animation/Timeline Mode

When playing an animation or scrubbing the timeline:

1. **Group bindings by pixel**: All bindings are grouped by their source pixel position
2. **Select dominant binding**: For each pixel, the binding with the highest weight is selected
3. **Apply transform**: Only the dominant bone's transform is applied to move the pixel
4. **Conflict resolution**: If multiple transformed pixels try to occupy the same destination, priority is given based on distance (closer to bone point = higher priority)

### Key Benefits

- **Stable transforms**: Pixels only move with their primary bone, avoiding jitter
- **Predictable behavior**: Clear visual feedback shows which bone controls each pixel
- **No pixel "stealing"**: Multi-bound pixels consistently follow their dominant bone

## Debug Visualization

When the "Auto-Bind" option is enabled in the Bone Tool:

- **Single-bound pixels**: Displayed with a colored overlay matching their bone's color
- **Multi-bound pixels**: Highlighted in **yellow** to indicate multiple bindings
- This helps identify areas where binding overlap occurs and allows manual adjustment if needed

## Best Practices

1. **Adjust auto-bind radius**: Use smaller radii for precise control, larger for broader influence
2. **Review multi-bound pixels**: Yellow highlights indicate potential binding conflicts
3. **Strategic bone placement**: Place bones to minimize overlap in critical areas
4. **Test animations**: Preview animations to ensure pixels move as expected
5. **Manual binding cleanup**: If needed, clear and re-bind pixels with adjusted bone positions

## Technical Details

### Pixel Binding Interface

```typescript
interface PixelBinding {
  pixelX: number;        // Pixel X coordinate
  pixelY: number;        // Pixel Y coordinate
  layerId: string;       // Layer/frame ID
  boneId: string;        // Bone ID
  bonePointId: string;   // Specific bone point ID
  offsetX: number;       // X offset from bone point
  offsetY: number;       // Y offset from bone point
  weight: number;        // Binding strength (0.0 - 1.0)
}
```

### Weight Migration

For backward compatibility, bindings without a weight property are automatically assigned a weight of `1.0` when retrieved, ensuring existing projects continue to work.

## Troubleshooting

### Issue: Pixels move with the wrong bone

**Solution**: 
- Enable auto-bind visualization to see multi-bound pixels (yellow)
- Clear existing bindings
- Adjust auto-bind radius to reduce overlap
- Re-bind pixels with new settings

### Issue: Pixels don't move when bone moves

**Possible causes**:
- Pixel is not bound to the bone (no binding exists)
- Animation is not in timeline mode
- Bone is not attached to the current animation

**Solution**:
- Use auto-bind feature to create bindings
- Switch to timeline mode
- Attach bone to animation in Bones Panel

### Issue: Animation looks jittery or unstable

**Possible cause**: Conflicting multi-bone bindings causing pixels to switch between bones

**Solution**:
- Review yellow-highlighted pixels
- Adjust bone positions to minimize overlap
- Use smaller auto-bind radius for finer control
