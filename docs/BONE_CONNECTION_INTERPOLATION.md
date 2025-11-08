# Bone Connection Interpolation - Fix for Visual Gaps

## Problem Description

After implementing the weight-based dominant bone selection, pixels correctly followed their primary bone during animation. However, a new issue appeared: **visual gaps** formed between connected bones when they moved.

### Visual Example

```
Before interpolation:
   Bone A (parent)
      * ← bone point
      |
      |  ← GAP! (no pixels here after transform)
      |
      * ← Bone B (child)
```

When Bone B rotates or moves, its pixels transform correctly, but the connection between Bone B and its parent (Bone A) becomes disconnected, creating a visual gap.

## Root Cause

The original implementation only transformed pixels that were **directly bound** to bones. When a bone moved:
1. Its bound pixels moved with it ✅
2. But the pixels **along the connection** to its parent didn't move ❌
3. Result: Visual discontinuity/gaps

## Solution: Bone Connection Interpolation

### Algorithm

For each bone point with a parent:

1. **Get transformed positions** of both point and parent
2. **Calculate distance** between them
3. **Interpolate pixels** along the connecting line
4. **Sample colors** from the original source positions
5. **Fill destination** with interpolated pixels

### Implementation

```typescript
// After normal pixel transformation...
const bones = this.boneService.getBones(frameId);

for (const bone of bones) {
  for (const point of bone.points) {
    if (!point.parentId) continue; // Skip root points
    
    const parent = bone.points.find(p => p.id === point.parentId);
    if (!parent) continue;
    
    // Get transformed positions (or original if no transform)
    const pointTransform = interpolateBoneTransform(animationId, bone.id, point.id, currentTime);
    const parentTransform = interpolateBoneTransform(animationId, bone.id, parent.id, currentTime);
    
    const p1x = pointTransform ? pointTransform.x : point.x;
    const p1y = pointTransform ? pointTransform.y : point.y;
    const p2x = parentTransform ? parentTransform.x : parent.x;
    const p2y = parentTransform ? parentTransform.y : parent.y;
    
    // Calculate steps needed for smooth interpolation
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist); // One pixel per unit distance
    
    // Interpolate along the connection
    for (let i = 0; i <= steps; i++) {
      const t = steps > 0 ? i / steps : 0;
      const interpX = Math.round(p1x + dx * t);
      const interpY = Math.round(p1y + dy * t);
      
      // Sample from original position
      const sourcePixelX = Math.round(point.x + (parent.x - point.x) * t);
      const sourcePixelY = Math.round(point.y + (parent.y - point.y) * t);
      
      const sourceColor = buf[sourcePixelY * w + sourcePixelX];
      
      // Add to destination map with low priority
      if (sourceColor && !destinationPixelMap.has(interpIdx)) {
        destinationPixelMap.set(interpIdx, {
          color: sourceColor,
          priority: -1000 // Lower than bound pixels
        });
      }
    }
  }
}
```

### Key Design Decisions

#### 1. **Source Color Sampling**
We sample colors from the **original source position** along the bone connection, not from empty space. This ensures the interpolated pixels match the character's appearance.

#### 2. **Low Priority**
Interpolated pixels have priority `-1000`, which is lower than:
- Directly bound pixels (priority based on -distance²)
- This ensures bound pixels always take precedence

#### 3. **Linear Interpolation**
We use simple linear interpolation (`t = i / steps`) for:
- Performance (no complex math)
- Predictability (easy to understand)
- Visual quality (sufficient for pixel art)

#### 4. **Step Calculation**
`steps = Math.ceil(dist)` ensures:
- At least one pixel per unit distance
- No visible gaps in the interpolation
- Reasonable performance (not too many pixels)

## Results

### Before Interpolation
```
Problem: Gaps between bones
  Parent Bone
      |
      |  ← Missing pixels!
      |
  Child Bone
```

### After Interpolation
```
Solution: Filled connections
  Parent Bone
      |
      ▓  ← Interpolated pixels
      ▓
  Child Bone
```

### Visual Impact

- ✅ **No gaps**: Smooth visual continuity during animation
- ✅ **Natural appearance**: Interpolated pixels match character colors
- ✅ **Performance**: Minimal overhead (linear time per connection)
- ✅ **Compatibility**: Works with existing weight-based system

## Performance Analysis

### Complexity
- **Per frame**: O(B × P) where:
  - B = number of bones
  - P = average points per bone
- **Per connection**: O(D) where D = distance between points

### Typical Case
- Character with 5 bones, 4 points each = 20 points
- Average connection length = 10 pixels
- Interpolation cost = 20 × 10 = 200 pixel operations
- **Negligible** compared to rendering thousands of pixels

### Optimization Opportunities
If needed in the future:
1. **Cache interpolation**: Store interpolated positions between frames
2. **Skip short connections**: Don't interpolate if distance < threshold
3. **Parallel processing**: Process bones independently

## Edge Cases Handled

### 1. No Transform
If a bone has no keyframe transform:
```typescript
const p1x = pointTransform ? pointTransform.x : point.x;
```
Falls back to original position ✅

### 2. Root Points
```typescript
if (!point.parentId) continue;
```
Skips points without parents ✅

### 3. Missing Parent
```typescript
const parent = bone.points.find(p => p.id === point.parentId);
if (!parent) continue;
```
Handles orphaned points gracefully ✅

### 4. Out of Bounds
```typescript
if (interpX >= 0 && interpX < w && interpY >= 0 && interpY < h)
```
Clamps to canvas boundaries ✅

## Future Enhancements

### 1. **Adaptive Sampling**
Instead of linear interpolation, use the bone's thickness or pixel density to determine sampling rate.

### 2. **Smooth Falloff**
Apply smoothstep or ease functions to interpolation for more natural deformation at joints.

### 3. **Multi-Layer Connections**
Support connections across different layers (e.g., shadow layer follows main layer).

### 4. **Connection Thickness**
Use bone thickness to fill wider connections, not just single-pixel lines.

## Conclusion

The bone connection interpolation system successfully solves the visual gap problem by:
1. Detecting parent-child bone relationships
2. Interpolating pixels along connections after transformation
3. Using source colors for natural appearance
4. Prioritizing bound pixels over interpolated ones

This completes the bone rigging system with:
- ✅ Weight-based dominant bone selection (prevents multi-bone conflicts)
- ✅ Bone connection interpolation (prevents visual gaps)
- ✅ Debug visualization (yellow highlights for multi-bound pixels)

The result is a robust, performant skeletal animation system suitable for pixel art.

---

**Implementation Date:** November 8, 2025
**Commit:** dd2b698
**Status:** Complete and tested
