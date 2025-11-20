# Testing Content-Aware Scale Feature

## Manual Testing Checklist

### Test 1: Selection-Based Content-Aware Scale

**Objective**: Verify content-aware scale works on a selected region

**Steps**:
1. Open Pixart in browser (http://localhost:4201)
2. Create a new layer or use existing content
3. Draw a simple image with a subject in center and plain background on sides
4. Use Rectangle Select tool (M) to select the entire drawn area
5. Press `Shift + Ctrl + Alt + C` or use Transform → Content-Aware Scale
6. Verify dialog opens with correct original dimensions
7. Set target width to 70% of original (e.g., 200px → 140px)
8. Keep target height same as original
9. Ensure "Protect important areas automatically" is checked
10. Click "Apply"

**Expected Result**:
- Background areas compress more than the central subject
- Subject remains recognizable and proportional
- Selection updates to new dimensions
- Undo (Ctrl+Z) restores original state

### Test 2: Full Layer Content-Aware Scale

**Objective**: Verify content-aware scale works on entire layer

**Steps**:
1. Clear any selection (press Esc)
2. Select a layer with content
3. Press `Shift + Ctrl + Alt + C`
4. Reduce both width and height by 20-30%
5. Click "Apply"

**Expected Result**:
- Entire layer resizes
- Canvas dimensions adjust to match
- Other layers preserve their relative positions
- Undo restores original canvas size and layer

### Test 3: Important Area Protection

**Objective**: Verify edge detection protects high-contrast regions

**Steps**:
1. Create an image with:
   - A simple character/face in center (high contrast)
   - Solid background color on left/right sides (low contrast)
2. Select the entire image
3. Open Content-Aware Scale dialog
4. **Test A**: Disable "Protect important areas"
   - Reduce width by 40%
   - Apply
   - Observe: Character may be distorted
   - Undo (Ctrl+Z)
5. **Test B**: Enable "Protect important areas"
   - Reduce width by 40%
   - Apply
   - Observe: Character preserved, background compressed

**Expected Result**:
- With protection OFF: Uniform seam removal (may distort character)
- With protection ON: Background seams removed preferentially, character intact

### Test 4: Boundary Validation

**Objective**: Ensure dialog prevents invalid inputs

**Steps**:
1. Create selection 100×100 pixels
2. Open Content-Aware Scale dialog
3. Try to set width to 101 (exceeds original)
4. Verify apply button is disabled
5. Try to set width to 0 or negative
6. Verify apply button is disabled
7. Set valid dimensions (50×50)
8. Verify apply button is enabled

**Expected Result**:
- Cannot apply if target > original (seam carving limitation)
- Cannot apply if target ≤ 0
- Preview shows "50 × 50" correctly

### Test 5: Keyboard Shortcut

**Objective**: Verify hotkey registration works

**Steps**:
1. With a selection active, press `Shift + Ctrl + Alt + C`
2. Verify dialog opens immediately
3. Press Esc to cancel
4. Open Help → Keyboard Shortcuts
5. Search for "Content-Aware Scale"
6. Verify shortcut is listed as "Shift + Ctrl + Alt + C"

**Expected Result**:
- Hotkey opens dialog instantly
- Listed correctly in shortcuts panel

### Test 6: Translation Support

**Objective**: Verify Vietnamese and English translations work

**Steps**:
1. Click "EN" button in header to switch to English
2. Open Content-Aware Scale dialog
3. Verify all text is in English
4. Click "VI" button to switch to Vietnamese
5. Re-open dialog
6. Verify all text is in Vietnamese

**Expected Result**:
- English: "Content-Aware Scale", "Target width", "Apply"
- Vietnamese: "Co giãn thông minh", "Chiều rộng mục tiêu", "Áp dụng"

### Test 7: Performance Test

**Objective**: Ensure reasonable performance for typical images

**Steps**:
1. Create a 500×500 layer with detailed content
2. Select entire layer
3. Open Content-Aware Scale
4. Reduce to 300×300 (40% reduction)
5. Click Apply and measure time

**Expected Result**:
- Completes within 5-10 seconds for 500×500 image
- UI remains responsive (no freezing)
- Progress indication would be nice (future enhancement)

### Test 8: Undo/Redo Integration

**Objective**: Verify history system integration

**Steps**:
1. Draw a simple shape
2. Apply content-aware scale
3. Press Ctrl+Z to undo
4. Verify original dimensions restored
5. Press Ctrl+Y to redo
6. Verify scaled version restored
7. Make another change (e.g., draw a line)
8. Undo multiple times
9. Verify content-aware scale undo works in sequence

**Expected Result**:
- Undo restores pre-scale state perfectly
- Redo reapplies scale transformation
- History stack handles content-aware scale correctly

### Test 9: Edge Cases

**Objective**: Handle unusual scenarios gracefully

**Test 9A: Minimal Reduction**
- Scale from 100×100 to 99×99 (1 pixel each dimension)
- Result: Works smoothly, minimal seam removal

**Test 9B: Extreme Reduction**
- Scale from 200×200 to 50×50 (75% reduction)
- Result: May show artifacts, but completes without error

**Test 9C: Single Dimension Reduction**
- Scale from 200×100 to 100×100 (width only)
- Result: Only vertical seams removed, height unchanged

**Test 9D: No Selection, No Layer**
- Clear selection, deselect all layers
- Try to open Content-Aware Scale
- Result: Menu item disabled or shows error message

### Test 10: Multiple Iterations

**Objective**: Verify repeated applications work

**Steps**:
1. Create 200×200 selection
2. Apply content-aware scale: 200×200 → 180×180
3. Apply again: 180×180 → 160×160
4. Apply again: 160×160 → 140×140

**Expected Result**:
- Each iteration works correctly
- Final result is 140×140
- Undo restores step-by-step (140→160→180→200)

## Automated Testing (Future)

While this feature primarily requires visual verification, future unit tests could cover:

1. **Energy Map Calculation**:
   ```typescript
   it('should calculate correct gradient energy', () => {
     const service = TestBed.inject(EditorContentAwareScaleService);
     const imageData = createTestImageData(10, 10);
     const energyMap = service.calculateEnergy(imageData);
     expect(energyMap.width).toBe(10);
     expect(energyMap.height).toBe(10);
     expect(energyMap.energy.length).toBe(100);
   });
   ```

2. **Seam Finding**:
   ```typescript
   it('should find valid vertical seam', () => {
     const service = TestBed.inject(EditorContentAwareScaleService);
     const energyMap = { width: 5, height: 5, energy: [...] };
     const seam = service.findVerticalSeam(energyMap);
     expect(seam.indices.length).toBe(5); // one per row
     expect(seam.energy).toBeGreaterThan(0);
   });
   ```

3. **Seam Removal**:
   ```typescript
   it('should reduce width by one pixel', () => {
     const service = TestBed.inject(EditorContentAwareScaleService);
     const imageData = createTestImageData(10, 10);
     const energyMap = service.calculateEnergy(imageData);
     const seam = service.findVerticalSeam(energyMap);
     const result = service.removeVerticalSeam(imageData, seam);
     expect(result.width).toBe(9);
     expect(result.height).toBe(10);
   });
   ```

## Known Issues / Future Enhancements

1. **Performance**: Large images (>1000px) can be slow. Consider:
   - Web Worker implementation for background processing
   - Progress bar with cancel option
   - Optimized energy calculation (GPU?)

2. **User Feedback**: No visual indication during processing
   - Add spinner/progress indicator
   - Show preview of seams to be removed
   - Real-time energy map visualization (debug mode)

3. **Manual Protection**: Currently automatic only
   - Allow users to paint "protected" regions
   - Add "Remove" regions to force seam removal
   - Brush tool for importance map editing

4. **Expansion**: Only reduction supported
   - Implement seam insertion for enlargement
   - Hybrid approach: enlarge to 110%, then reduce to 100% for better quality

5. **Quality Settings**: Single algorithm
   - Add quality/speed slider
   - Different energy functions (saliency, face detection)
   - Multi-pass options for better results
