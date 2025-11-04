# Pixart

A minimal 2D pixel editor and animation timeline (work in progress). This is an open-source Angular app with Tailwind CSS.

## Features (Initial)

- Editor layout with:
  - Header menu (File, Edit, Tool, Help)
  - Left tool palette (select layer, rectangle/ellipse/lasso select, eyedropper, fill, eraser, line, circle, square)
  - Right layers panel
  - Bottom timeline with frames
  - Center canvas area
- Customizable keyboard shortcuts (see [Hotkey Documentation](docs/HOTKEYS.md))

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:4200.

## Tech

- Angular 20 (standalone, signals)
- Tailwind CSS v4

## Development conventions

Please review `.github/copilot-instructions.md` before contributing. In particular:

- Every new user-facing feature must include:
  - A keyboard shortcut registered in a centralized hotkey registry service
  - A Left Tool Palette entry and a Header Menu action
  - Transloco-driven labels (no hard-coded strings), an `ng-icons` Heroicons icon, unique `id`, and `aria-keyshortcuts` attributes
- Keep components thin and split logic into small, focused services. Use signals for state and `computed()` for derived values.

## Next steps

- Implement actual drawing tools on the canvas
- Layer visibility/locking controls
- Frame manipulation (add/remove/reorder, duration editing)
- Project open/save using File System Access API
- Export to sprite sheet / GIF / PNG sequence
