# LMS Design System Catalog

## Tokens

Color, spacing, radius, shadow, focus, motion, and print tokens live in `frontend/src/index.css`.
Use semantic CSS variables first (`--color-primary`, `--color-surface`, `--radius-md`, `--shadow-sm`) and Tailwind utilities second.

## Shared Components

- `Button.jsx`: command actions, icon + text, loading/disabled states.
- `Input.jsx`: label, error, `aria-describedby`, `aria-invalid`.
- `Select.jsx`: label, option list, error association.
- `Modal.jsx`: `role="dialog"`, focus trap, Escape, outside click.
- `ConfirmDialog.jsx`: accessible destructive/default confirmation dialog.
- `Table.jsx`: caption, scoped headers, responsive wrapper.
- `AsyncState.jsx`, `EmptyState.jsx`, `LoadingSpinner.jsx`, `SkeletonLoader.jsx`: shared loading/empty/error states.
- `Toast.jsx`: screen-reader live region and dismiss button label.

## QA Checklist

- Keyboard-only: Tab/Shift+Tab stays inside dialogs and all controls have visible focus.
- Screen reader: form errors use live regions, tables have captions, toast/errors announce changes.
- Responsive: verify 375px, 768px, 1280px; no clipped labels/buttons.
- Print: transcript, invoice, and certificate views use `@media print` styles.
