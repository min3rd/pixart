# Shared Modal Component

## Overview

The `pa-modal` component is a reusable modal dialog component used across all features in the PixArt application that require modal dialogs. It provides a consistent, accessible, and customizable modal experience.

## Features

- **Flexible Content Projection**: Supports custom content for modal body and footer via Angular content projection
- **Backdrop Click-to-Close**: Users can close the modal by clicking the backdrop (configurable)
- **Keyboard Support**: Press ESC key to close the modal (configurable)
- **Customizable Sizes**: Five predefined sizes (sm, md, lg, xl, full)
- **Accessibility**: Includes proper ARIA attributes and roles for screen readers
- **Dark Mode Support**: Automatically adapts to light/dark theme
- **Optional Close Button**: Built-in close button can be shown or hidden

## Usage

### Basic Example

```html
<pa-modal
  [isOpen]="dialogOpen()"
  [title]="'dialog.title' | transloco"
  [size]="'md'"
  [modalId]="'my-dialog'"
  (onClose)="handleClose()"
>
  <!-- Modal body content goes here -->
  <p>This is the modal content.</p>
  
  <!-- Modal footer (optional) -->
  <div modal-footer class="flex gap-2">
    <button (click)="handleCancel()">Cancel</button>
    <button (click)="handleConfirm()">OK</button>
  </div>
</pa-modal>
```

### Component TypeScript

```typescript
import { Component, signal } from '@angular/core';
import { Modal } from './shared/components/modal/modal';

@Component({
  selector: 'my-dialog',
  templateUrl: './my-dialog.component.html',
  imports: [Modal],
})
export class MyDialog {
  readonly isOpen = signal(false);

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  handleClose() {
    this.close();
  }

  handleCancel() {
    // Handle cancel logic
    this.close();
  }

  handleConfirm() {
    // Handle confirm logic
    this.close();
  }
}
```

## Input Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `isOpen` | `boolean` | `false` | Controls the visibility of the modal |
| `title` | `string` | `''` | The modal title text |
| `size` | `ModalSize` | `'md'` | Modal size: 'sm', 'md', 'lg', 'xl', or 'full' |
| `showCloseButton` | `boolean` | `true` | Whether to show the close button in the header |
| `closeOnBackdrop` | `boolean` | `true` | Whether clicking the backdrop closes the modal |
| `closeOnEscape` | `boolean` | `true` | Whether pressing ESC closes the modal |
| `modalId` | `string` | `'modal'` | Unique identifier for the modal (used for element IDs) |

## Output Events

| Event | Type | Description |
|-------|------|-------------|
| `onClose` | `void` | Emitted when the modal should be closed (via close button, backdrop, or ESC) |

## Content Projection

The modal supports two content projection slots:

1. **Default Slot**: The main body content of the modal
2. **Footer Slot**: Use the `modal-footer` attribute to project content into the footer section

```html
<pa-modal [isOpen]="isOpen()" [title]="'My Modal'">
  <!-- Main content (default slot) -->
  <p>Modal body content</p>
  
  <!-- Footer content (named slot) -->
  <div modal-footer>
    <button>Action</button>
  </div>
</pa-modal>
```

## Modal Sizes

The component supports five predefined sizes:

- `sm`: Small (max-width: 24rem / 384px)
- `md`: Medium (max-width: 42rem / 672px) - **Default**
- `lg`: Large (max-width: 56rem / 896px)
- `xl`: Extra Large (max-width: 72rem / 1152px)
- `full`: Full width with 1rem margins on each side

## Accessibility

The modal component includes proper accessibility features:

- `role="dialog"` and `aria-modal="true"` attributes
- `aria-labelledby` pointing to the modal title
- Keyboard trap (ESC to close, configurable)
- Focus management
- Screen reader compatible

## Styling

The modal uses Tailwind CSS utility classes and follows the application's design system:

- Compact spacing (4px/8px-based)
- Square corners (`rounded-sm`)
- Neutral color palette
- Dark mode support via Tailwind's dark mode variants

## Migration from Existing Dialogs

When migrating an existing dialog to use the shared modal:

1. Import the `Modal` component
2. Replace the outer backdrop and container divs with `<pa-modal>`
3. Move custom headers/titles into the modal's title input or default slot
4. Move action buttons into the footer slot with `modal-footer` attribute
5. Remove custom backdrop click handlers (handled by the modal)
6. Remove custom ESC key handlers (handled by the modal)

### Before

```html
<div *ngIf="isOpen()" class="fixed inset-0 bg-black/50 z-50">
  <div class="bg-white rounded p-4">
    <h2>Title</h2>
    <!-- content -->
    <div class="flex gap-2">
      <button>Cancel</button>
      <button>OK</button>
    </div>
  </div>
</div>
```

### After

```html
<pa-modal [isOpen]="isOpen()" [title]="'Title'" (onClose)="close()">
  <!-- content -->
  <div modal-footer class="flex gap-2">
    <button>Cancel</button>
    <button>OK</button>
  </div>
</pa-modal>
```

## Translation Keys

The modal component uses the following translation key:

- `modal.close`: Text for the close button tooltip/aria-label

Add this to your translation files (e.g., `public/i18n/en.json`):

```json
{
  "modal": {
    "close": "Close"
  }
}
```

## Best Practices

1. **Always provide a unique `modalId`**: This ensures proper element ID uniqueness
2. **Use transloco for all text**: Never hard-code strings in the template
3. **Handle close events properly**: Always implement the `onClose` handler
4. **Choose appropriate size**: Use `sm` for simple dialogs, `lg` or `xl` for complex forms
5. **Provide accessible labels**: Use meaningful `id` attributes on all interactive elements
6. **Keep footers consistent**: Place cancel buttons on the left, primary actions on the right

## Examples in the Codebase

See these components for real-world examples:

- `scale-dialog`: Simple form dialog with size 'sm'
- `rotate-dialog`: Dialog with preview, size 'lg'
- `hotkey-config-dialog`: Complex dialog with scrollable content, size 'md'
- `insert-image-dialog`: Dialog with image preview, size 'sm'
- `bone-generation-dialog`: Dialog with custom header and list selection, size 'sm'
- `edit-point-dialog`: Simple form with color picker, size 'sm'
- `pixel-art-generation-dialog`: Complex multi-state dialog, size 'md'
